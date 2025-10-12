const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkGameData() {
  const game = await prisma.game.findFirst({
    where: {
      match: {
        round: {
          stopId: 'cmfot1xyc0006rd6akzrbmapv',
        },
      },
    },
    select: {
      id: true,
      slot: true,
      teamAScore: true,
      teamBScore: true,
      teamALineup: true,
      teamBLineup: true,
      courtNumber: true,
      isComplete: true,
      startedAt: true,
    },
  });

  console.log('Sample game from database:', JSON.stringify(game, null, 2));
}

checkGameData()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
