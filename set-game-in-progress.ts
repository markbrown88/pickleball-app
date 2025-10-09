import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Setting MIXED_2 Game to In Progress ===\n');

  const matchId = 'cmgdy7sqo006pr0k8iq2wujpm';

  // Get the MIXED_2 game
  const mixed2Game = await prisma.game.findFirst({
    where: {
      matchId: matchId,
      slot: 'MIXED_2'
    }
  });

  if (!mixed2Game) {
    console.log('❌ MIXED_2 game not found');
    return;
  }

  console.log(`Found MIXED_2 game: ${mixed2Game.id}`);
  console.log(`Current status - Complete: ${mixed2Game.isComplete}`);

  try {
    // Set the game to in progress (not complete)
    await prisma.game.update({
      where: { id: mixed2Game.id },
      data: {
        isComplete: false,
        // Keep the lineup as is
        teamALineup: mixed2Game.teamALineup,
        teamBLineup: mixed2Game.teamBLineup,
        lineupConfirmed: mixed2Game.lineupConfirmed
      }
    });

    console.log('✅ Successfully set MIXED_2 game to in progress!');
    console.log('Game status: In Progress (not complete)');
    console.log('Lineup: Adrien Mizal & Christie Han vs Drew Carrick & Maryann Kewin');

  } catch (error) {
    console.error('❌ Error updating game status:', error);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
