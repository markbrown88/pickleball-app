import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

function escapeCsvValue(value: string | null | undefined): string {
  if (!value) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function exportDuplicatesToCSV() {
  try {
    console.log('Analyzing duplicate players and exporting to CSV...\n');

    // Get all players
    const allPlayers = await prisma.player.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        clubId: true,
        clerkUserId: true,
        createdAt: true,
      },
      orderBy: {
        firstName: 'asc',
      },
    });

    // Group by first name + last name combination
    const nameCombinations = new Map<string, typeof allPlayers>();
    
    for (const player of allPlayers) {
      const firstName = (player.firstName || '').trim().toLowerCase();
      const lastName = (player.lastName || '').trim().toLowerCase();
      const key = `${firstName}|${lastName}`;
      
      if (key !== '|') { // Ignore empty names
        if (!nameCombinations.has(key)) {
          nameCombinations.set(key, []);
        }
        nameCombinations.get(key)!.push(player);
      }
    }

    // Find duplicates
    const duplicates: Array<{ name: string; players: typeof allPlayers }> = [];
    
    nameCombinations.forEach((players, key) => {
      if (players.length > 1) {
        const [firstName, lastName] = key.split('|');
        duplicates.push({
          name: `${firstName} ${lastName}`,
          players,
        });
      }
    });

    // Get clubs for display
    const clubs = await prisma.club.findMany({
      select: { id: true, name: true },
    });
    const clubMap = new Map(clubs.map(c => [c.id, c.name]));

    console.log(`Found ${duplicates.length} duplicate name combination(s)\n`);

    // Prepare CSV data
    const csvRows: string[] = [];
    
    // CSV Header
    csvRows.push([
      'Duplicate Group',
      'Player ID',
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'Club',
      'Has Clerk Account',
      'Created Date',
      'Roster Entries Count',
      'Lineup Entries Count',
      'Registrations Count',
      'Roster Details',
      'Registration Details',
    ].join(','));

    // Process each duplicate group
    for (const group of duplicates) {
      for (const player of group.players) {
        const clubName = player.clubId ? clubMap.get(player.clubId) || 'Unknown' : 'No club';
        const hasClerk = player.clerkUserId ? 'Yes' : 'No';
        
        // Get roster entries
        const rosterEntries = await prisma.stopTeamPlayer.findMany({
          where: { playerId: player.id },
          include: {
            stop: {
              include: {
                tournament: {
                  select: { name: true },
                },
                club: {
                  select: { name: true },
                },
              },
            },
            team: {
              include: {
                bracket: {
                  select: { name: true },
                },
                club: {
                  select: { name: true },
                },
              },
            },
          },
        });

        const rosterDetails = rosterEntries.map(entry => 
          `${entry.stop.tournament.name} - ${entry.stop.name} (${entry.team.club.name}, ${entry.team.bracket.name})`
        ).join('; ');

        // Get lineup entries count
        const lineupCount = await prisma.lineupEntry.count({
          where: {
            OR: [
              { player1Id: player.id },
              { player2Id: player.id },
            ],
          },
        });

        // Get registrations
        const registrations = await prisma.tournamentRegistration.findMany({
          where: { playerId: player.id },
          include: {
            tournament: {
              select: { name: true },
            },
          },
        });

        const registrationDetails = registrations.map(reg => 
          `${reg.tournament.name} - ${reg.status} - ${reg.paymentStatus} - $${((reg.amountPaid || 0) / 100).toFixed(2)}`
        ).join('; ');

        // Build CSV row
        csvRows.push([
          escapeCsvValue(group.name),
          escapeCsvValue(player.id),
          escapeCsvValue(player.firstName),
          escapeCsvValue(player.lastName),
          escapeCsvValue(player.email),
          escapeCsvValue(player.phone),
          escapeCsvValue(clubName),
          escapeCsvValue(hasClerk),
          escapeCsvValue(player.createdAt.toISOString().split('T')[0]),
          escapeCsvValue(rosterEntries.length.toString()),
          escapeCsvValue(lineupCount.toString()),
          escapeCsvValue(registrations.length.toString()),
          escapeCsvValue(rosterDetails),
          escapeCsvValue(registrationDetails),
        ].join(','));
      }
    }

    // Write to CSV file
    const csvContent = csvRows.join('\n');
    const csvPath = path.join(process.cwd(), 'duplicate-players-export.csv');
    fs.writeFileSync(csvPath, csvContent, 'utf-8');

    console.log(`✓ Exported ${duplicates.length} duplicate groups (${duplicates.reduce((sum, g) => sum + g.players.length, 0)} total players)`);
    console.log(`✓ CSV file saved to: ${csvPath}\n`);

    // Summary
    console.log('Summary:');
    console.log(`  Total duplicate groups: ${duplicates.length}`);
    console.log(`  Total players in duplicate groups: ${duplicates.reduce((sum, g) => sum + g.players.length, 0)}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

exportDuplicatesToCSV();

