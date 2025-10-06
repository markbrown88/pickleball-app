/**
 * Restore Stop 2 Data - Mark Games as In Progress
 *
 * This script marks all games in Stop 2 that have scores as "in progress"
 * so you can manually end each game as a final verification step.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STOP_2_ID = 'cmfot1xzy0008rd6a1kvvmvta'; // Klyng Stop 2

async function restoreStop2InProgress() {
  console.log('🔍 Analyzing Stop 2 games...\n');

  // Find all games that have scores but haven't started
  const gamesToStart = await prisma.game.findMany({
    where: {
      match: {
        round: {
          stopId: STOP_2_ID
        }
      },
      startedAt: null,
      teamAScore: { not: null },
      teamBScore: { not: null }
    },
    select: {
      id: true,
      slot: true,
      teamAScore: true,
      teamBScore: true,
      match: {
        select: {
          id: true,
          round: {
            select: {
              idx: true
            }
          }
        }
      }
    }
  });

  console.log(`Found ${gamesToStart.length} games with scores that need to be marked as "in progress"\n`);

  if (gamesToStart.length === 0) {
    console.log('✅ No games need updating!');
    return;
  }

  // Show sample before update
  console.log('📋 Sample games to update:');
  gamesToStart.slice(0, 5).forEach((game, idx) => {
    console.log(`${idx + 1}. Round ${game.match.round.idx + 1} - ${game.slot}: ${game.teamAScore}-${game.teamBScore}`);
  });
  console.log('');

  console.log('⚠️  This will mark all these games as IN PROGRESS (not completed).');
  console.log('   You can then manually END each game in the Event Manager UI.\n');
  console.log('   Continue? (Ctrl+C to cancel)\n');

  // Wait 3 seconds to allow cancellation
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('🔄 Updating games to "in progress"...\n');

  // Update all games in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const updates = [];

    for (const game of gamesToStart) {
      const update = await tx.game.update({
        where: { id: game.id },
        data: {
          isComplete: false,
          startedAt: new Date(), // Mark as started (in progress)
          endedAt: null // Ensure not ended
        }
      });
      updates.push(update);
    }

    return updates;
  });

  console.log(`✅ Successfully updated ${result.length} games to "in progress"!\n`);

  // Verify the update
  const inProgressGames = await prisma.game.count({
    where: {
      match: {
        round: {
          stopId: STOP_2_ID
        }
      },
      startedAt: { not: null },
      isComplete: false
    }
  });

  console.log('📊 Verification:');
  console.log(`   Games marked as "in progress": ${inProgressGames}`);

  const totalComplete = await prisma.game.count({
    where: {
      match: {
        round: {
          stopId: STOP_2_ID
        }
      },
      isComplete: true
    }
  });

  console.log(`   Games already completed: ${totalComplete}\n`);

  console.log('🎉 Stop 2 restoration complete!');
  console.log('   Now you can go to Event Manager and END each game to verify scores.');
}

async function main() {
  try {
    await restoreStop2InProgress();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
