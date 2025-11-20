import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function markVaughnStop1PlayersAsPaid() {
  try {
    console.log('Finding Klyng Cup-pickleplex tournament...\n');
    
    // Find the tournament
    const tournament = await prisma.tournament.findFirst({
      where: {
        name: {
          contains: 'pickleplex',
          mode: 'insensitive',
        },
      },
      include: {
        stops: {
          where: {
            name: {
              contains: 'Vaughn',
              mode: 'insensitive',
            },
          },
        },
      },
    });

    if (!tournament) {
      console.error('Tournament not found');
      return;
    }

    console.log(`Found tournament: ${tournament.name} (${tournament.id})`);
    
    if (tournament.stops.length === 0) {
      console.error('Vaughn stop not found');
      return;
    }

    const vaughnStop = tournament.stops[0];
    console.log(`Found stop: ${vaughnStop.name} (${vaughnStop.id})\n`);

    // Find all lineups for this stop
    console.log('Finding all lineups for this stop...');
    const lineups = await prisma.lineup.findMany({
      where: {
        stopId: vaughnStop.id,
      },
      include: {
        entries: {
          include: {
            player1: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            player2: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    console.log(`Found ${lineups.length} lineups\n`);

    // Collect all unique player IDs from lineup entries
    const playerIds = new Set<string>();
    const playerDetails = new Map<string, { firstName: string | null; lastName: string | null; email: string | null }>();

    for (const lineup of lineups) {
      for (const entry of lineup.entries) {
        if (entry.player1Id) {
          playerIds.add(entry.player1Id);
          if (!playerDetails.has(entry.player1Id)) {
            playerDetails.set(entry.player1Id, {
              firstName: entry.player1.firstName,
              lastName: entry.player1.lastName,
              email: entry.player1.email,
            });
          }
        }
        if (entry.player2Id) {
          playerIds.add(entry.player2Id);
          if (!playerDetails.has(entry.player2Id)) {
            playerDetails.set(entry.player2Id, {
              firstName: entry.player2.firstName,
              lastName: entry.player2.lastName,
              email: entry.player2.email,
            });
          }
        }
      }
    }

    console.log(`Found ${playerIds.size} unique players in lineups:\n`);
    const playerIdsArray = Array.from(playerIds);
    for (const playerId of playerIdsArray) {
      const details = playerDetails.get(playerId);
      const name = details?.firstName && details?.lastName
        ? `${details.firstName} ${details.lastName}`
        : details?.email || playerId;
      console.log(`  - ${name}`);
    }

    // Find all roster entries for this stop
    console.log(`\nFinding roster entries for stop ${vaughnStop.name}...`);
    const rosterEntries = await prisma.stopTeamPlayer.findMany({
      where: {
        stopId: vaughnStop.id,
      },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    console.log(`Found ${rosterEntries.length} total roster entries\n`);

    // Update roster entries for players who are in lineups
    let updatedCount = 0;
    let alreadyPaidCount = 0;
    let notOnRosterCount = 0;

    for (const playerId of playerIdsArray) {
      const rosterEntry = rosterEntries.find(re => re.playerId === playerId);
      
      if (!rosterEntry) {
        const details = playerDetails.get(playerId);
        const name = details?.firstName && details?.lastName
          ? `${details.firstName} ${details.lastName}`
          : details?.email || playerId;
        console.log(`⚠️  Player ${name} is in lineups but not on roster`);
        notOnRosterCount++;
        continue;
      }

      if (rosterEntry.paymentMethod === 'MANUAL') {
        const details = playerDetails.get(playerId);
        const name = details?.firstName && details?.lastName
          ? `${details.firstName} ${details.lastName}`
          : details?.email || playerId;
        console.log(`✓ ${name} already marked as MANUAL`);
        alreadyPaidCount++;
        continue;
      }

      // Update to MANUAL (Paid X)
      await prisma.stopTeamPlayer.updateMany({
        where: {
          stopId: vaughnStop.id,
          teamId: rosterEntry.teamId,
          playerId: playerId,
        },
        data: {
          paymentMethod: 'MANUAL',
        },
      });

      const details = playerDetails.get(playerId);
      const name = details?.firstName && details?.lastName
        ? `${details.firstName} ${details.lastName}`
        : details?.email || playerId;
      console.log(`✅ Updated ${name} to MANUAL (Paid X)`);
      updatedCount++;
    }

    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total unique players in lineups: ${playerIds.size}`);
    console.log(`Updated to MANUAL (Paid X): ${updatedCount}`);
    console.log(`Already marked as MANUAL: ${alreadyPaidCount}`);
    console.log(`In lineups but not on roster: ${notOnRosterCount}`);
    console.log(`Total roster entries: ${rosterEntries.length}`);
    console.log(`Roster entries left as UNPAID: ${rosterEntries.length - updatedCount - alreadyPaidCount}`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

markVaughnStop1PlayersAsPaid()
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

