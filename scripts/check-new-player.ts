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

async function checkNewPlayer() {
  try {
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
    });

    const existingPlayers = await prisma.player.findMany({
      select: { id: true },
    });
    const existingPlayerIds = new Set(existingPlayers.map(p => p.id));

    console.log('Checking for new player...\n');
    
    for (const record of records) {
      const playerId = record.ID?.trim();
      if (!existingPlayerIds.has(playerId)) {
        console.log('NEW PLAYER FOUND:');
        console.log(`  ID: ${playerId}`);
        console.log(`  First Name: ${record['First Name']}`);
        console.log(`  Last Name: ${record['Last Name']}`);
        console.log(`  Full Name: ${record['Full Name']}`);
        console.log(`  Email: ${record.Email}`);
        console.log(`  Club ID: ${record['Club ID']}`);
        console.log(`  Club Name: ${record['Club Name']}`);
        break;
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkNewPlayer();

