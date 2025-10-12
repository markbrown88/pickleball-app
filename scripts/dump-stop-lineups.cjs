const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const stopId = 'cmftqlrha000crd1estw0n0a6';

  const lineups = await prisma.lineup.findMany({
    where: { stopId },
    include: {
      entries: {
        include: {
          player1: true,
          player2: true,
        },
      },
      team: true,
      round: true,
    },
  });

  console.log('Lineup count:', lineups.length);
  console.log(JSON.stringify(lineups, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


