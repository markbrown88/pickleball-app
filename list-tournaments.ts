import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tournaments = await prisma.tournament.findMany({
    include: {
      _count: {
        select: {
          teams: true,
          stops: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log('All tournaments:');
  for (const tournament of tournaments) {
    // Count games for this tournament
    const gameCount = await prisma.game.count({
      where: {
        match: {
          round: {
            stop: {
              tournamentId: tournament.id,
            },
          },
        },
      },
    });

    const roundCount = await prisma.round.count({
      where: {
        stop: {
          tournamentId: tournament.id,
        },
      },
    });

    console.log(
      `\n${tournament.name} (${tournament.id})\n  - ${tournament._count.teams} teams, ${tournament._count.stops} stops, ${roundCount} rounds, ${gameCount} games`
    );

    if (gameCount > 0) {
      // Get a sample game to see teams
      const sampleGame = await prisma.game.findFirst({
        where: {
          match: {
            round: {
              stop: {
                tournamentId: tournament.id,
              },
            },
          },
        },
        include: {
          match: {
            include: {
              teamA: { include: { club: true } },
              teamB: { include: { club: true } },
            },
          },
        },
      });

      if (sampleGame) {
        console.log(
          `  Sample match: ${sampleGame.match.teamA?.club?.name || 'BYE'} vs ${sampleGame.match.teamB?.club?.name || 'BYE'}`
        );
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
