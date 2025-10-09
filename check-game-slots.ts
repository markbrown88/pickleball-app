import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkGameSlots() {
  try {
    // Get the specific match
    const match = await prisma.match.findFirst({
      where: {
        teamA: { name: 'Pickleplex Barrie 2.5' },
        teamB: { name: 'Pickleplex Promenade 2.5' }
      },
      include: {
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
      console.log('Match not found');
      return;
    }

    console.log(`\n=== Game slots for: ${match.teamA?.name} vs ${match.teamB?.name} ===`);
    
    for (const game of match.games) {
      console.log(`\n${game.slot}:`);
      console.log('Team A Lineup:', game.teamALineup);
      console.log('Team B Lineup:', game.teamBLineup);
    }

  } catch (error) {
    console.error('Error checking game slots:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkGameSlots();
