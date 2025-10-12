const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const roundId = 'cmgfnr3xd000br0as15y59e1s';
  const teamId = 'cmftqlrqb000mrd1ehlf4r2ql';

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      lineups: {
        include: {
          entries: {
            include: {
              player1: true,
              player2: true,
            },
          },
        },
      },
      matches: {
        include: {
          games: true,
        },
      },
    },
  });

  console.log(JSON.stringify(round, null, 2));

  const lineup = round?.lineups.find((l) => l.teamId === teamId);
  if (lineup) {
    console.log('Lineup entries for team', teamId, JSON.stringify(lineup.entries, null, 2));
  } else {
    console.log('No lineup found for team', teamId);
  }
}

main()
  .catch((error) => {
    console.error(error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


