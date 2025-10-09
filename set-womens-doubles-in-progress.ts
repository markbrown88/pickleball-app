import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Setting WOMENS_DOUBLES to In Progress ===\n');
  console.log('Round 5 - Real Pickleball Advanced vs Greenhills Advanced\n');

  const matchId = 'cmgdy7w6j009pr0k88zi7qn8v';

  // Find the WOMENS_DOUBLES game
  const game = await prisma.game.findFirst({
    where: {
      matchId: matchId,
      slot: 'WOMENS_DOUBLES'
    },
    select: {
      id: true,
      slot: true,
      isComplete: true,
      teamALineup: true,
      teamBLineup: true
    }
  });

  if (!game) {
    console.log('❌ WOMENS_DOUBLES game not found');
    return;
  }

  console.log(`Found game: ${game.slot}`);
  console.log(`Current status: ${game.isComplete ? 'Complete' : 'Not Complete'}`);
  console.log(`Team A lineup: ${JSON.stringify(game.teamALineup)}`);
  console.log(`Team B lineup: ${JSON.stringify(game.teamBLineup)}`);

  try {
    await prisma.game.update({
      where: { id: game.id },
      data: {
        isComplete: false // Set to in progress
      }
    });

    console.log('\n✅ WOMENS_DOUBLES game set to IN PROGRESS');
    console.log('Ashley Stewart & Leanna Macdonnell vs Una Pandurevic & Thea Rifol');
  } catch (error) {
    console.error('❌ Error updating game status:', error);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
