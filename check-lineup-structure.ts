import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function checkLineupStructure() {
  try {
    // Get a specific match with lineup data
    const match = await prisma.match.findFirst({
      where: {
        games: {
          some: {
            teamALineup: { not: Prisma.JsonNull }
          }
        }
      },
      include: {
        teamA: { select: { id: true, name: true } },
        teamB: { select: { id: true, name: true } },
        games: {
          select: {
            id: true,
            slot: true,
            teamALineup: true,
            teamBLineup: true
          }
        }
      }
    });

    if (!match) {
      console.log('No match with lineup data found');
      return;
    }

    console.log(`\n=== Match: ${match.teamA?.name} vs ${match.teamB?.name} ===`);

    for (const game of match.games) {
      console.log(`\n${game.slot}:`);
      console.log('Team A Lineup:', JSON.stringify(game.teamALineup, null, 2));
      console.log('Team B Lineup:', JSON.stringify(game.teamBLineup, null, 2));
    }

  } catch (error) {
    console.error('Error checking lineup structure:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLineupStructure();
