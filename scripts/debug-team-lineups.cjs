const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const stopId = 'cmftqlrha000crd1estw0n0a6';
  const matchId = 'cmgfnr3z9000gr0asfxhbiiq3';

  const lineups = await prisma.lineup.findMany({
    where: {
      stopId,
      round: {
        matches: {
          some: {
            id: matchId,
          },
        },
      },
    },
    include: {
      entries: true,
      round: true,
      team: true,
    },
  });

  console.log(JSON.stringify(lineups, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


