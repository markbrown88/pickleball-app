import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

const csvPath = path.join(
  process.cwd(),
  '..',
  'Downloads',
  'players-merged-deduped-with-status-2025-11-11 - players-merged-deduped-with-status-2025-11-11.csv'
);

async function checkAllClubIds() {
  try {
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
    });

    const clubs = await prisma.club.findMany({
      select: { id: true, name: true },
    });
    const validClubIds = new Set(clubs.map(c => c.id));
    const clubIdToName = new Map(clubs.map(c => [c.id, c.name]));

    const invalidClubIds = new Map<string, { count: number; players: string[] }>();
    const clubIdCounts = new Map<string, number>();

    for (const record of records) {
      const clubId = record['Club ID']?.trim();
      const playerName = `${record['First Name']} ${record['Last Name']}`;
      const playerId = record.ID?.trim();

      if (clubId) {
        clubIdCounts.set(clubId, (clubIdCounts.get(clubId) || 0) + 1);

        if (!validClubIds.has(clubId)) {
          if (!invalidClubIds.has(clubId)) {
            invalidClubIds.set(clubId, { count: 0, players: [] });
          }
          const entry = invalidClubIds.get(clubId)!;
          entry.count++;
          entry.players.push(`${playerName} (${playerId})`);
        }
      }
    }

    console.log('=== CLUB ID ANALYSIS ===\n');
    console.log(`Total records: ${records.length}`);
    console.log(`Valid club IDs in database: ${validClubIds.size}\n`);

    console.log('Club ID distribution:');
    for (const [clubId, count] of Array.from(clubIdCounts.entries()).sort((a, b) => b[1] - a[1])) {
      const clubName = clubIdToName.get(clubId) || 'INVALID';
      console.log(`  ${clubId}: ${count} players - ${clubName}`);
    }

    if (invalidClubIds.size > 0) {
      console.log('\n\n⚠️  INVALID CLUB IDs FOUND:\n');
      for (const [clubId, data] of invalidClubIds.entries()) {
        console.log(`Club ID: ${clubId}`);
        console.log(`  Count: ${data.count} players`);
        console.log(`  Players:`);
        data.players.forEach(p => console.log(`    - ${p}`));
        console.log('');
      }

      // Check if they're all old Windsor IDs
      const windsorClub = clubs.find(c => c.name === 'Pickleplex Windsor');
      if (windsorClub) {
        const allOldWindsor = Array.from(invalidClubIds.keys()).every(id => 
          id.startsWith('cmfwjxglo0000rdxtvyl80iu') && id !== windsorClub.id
        );
        if (allOldWindsor) {
          console.log('✓ All invalid IDs are old Pickleplex Windsor IDs');
          console.log(`  Will be updated to: ${windsorClub.id} (${windsorClub.name})`);
        }
      }
    } else {
      console.log('\n✓ All club IDs are valid!');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllClubIds();

