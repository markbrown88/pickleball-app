import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tournament = await prisma.tournament.findFirst({
    where: { name: { contains: 'Klyng' } },
  });

  if (!tournament) {
    console.log('Tournament not found');
    return;
  }

  console.log('Tournament:', tournament.name, tournament.id);

  const stops = await prisma.stop.findMany({
    where: { tournamentId: tournament.id },
    orderBy: { createdAt: 'asc' },
    include: {
      _count: {
        select: {
          rounds: true,
        },
      },
    },
  });

  console.log('\nStops:');
  for (const stop of stops) {
    console.log(`  ${stop.name} (${stop.id}) - ${stop._count.rounds} rounds`);
  }

  // Check for any rounds
  const allRounds = await prisma.round.findMany({
    where: {
      stop: {
        tournamentId: tournament.id,
      },
    },
    include: {
      stop: true,
      _count: {
        select: {
          matches: true,
        },
      },
    },
  });

  console.log(`\nTotal rounds across all stops: ${allRounds.length}`);
  for (const round of allRounds) {
    console.log(`  Stop ${round.stop.name} - Round ${round.idx} - ${round._count.matches} matches`);
  }

  // Check for any matches
  const totalMatches = await prisma.match.count({
    where: {
      round: {
        stop: {
          tournamentId: tournament.id,
        },
      },
    },
  });

  console.log(`\nTotal matches: ${totalMatches}`);

  // Check for any games
  const totalGames = await prisma.game.count({
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

  console.log(`Total games: ${totalGames}`);

  // Sample a game if it exists
  if (totalGames > 0) {
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
            round: {
              include: {
                stop: true,
              },
            },
            teamA: { include: { club: true } },
            teamB: { include: { club: true } },
          },
        },
        lineups: {
          include: {
            player: true,
          },
        },
      },
    });

    if (sampleGame) {
      console.log('\nSample game:');
      console.log(`  Stop: ${sampleGame.match.round.stop.name}`);
      console.log(`  Round: ${sampleGame.match.round.idx}`);
      console.log(
        `  Match: ${sampleGame.match.teamA?.club?.name || 'BYE'} vs ${sampleGame.match.teamB?.club?.name || 'BYE'}`
      );
      console.log(`  Game Type: ${sampleGame.gameType}`);
      console.log(`  Score: ${sampleGame.teamAScore}-${sampleGame.teamBScore}`);
      console.log(`  Players in game: ${sampleGame.lineups.length}`);
      for (const lineup of sampleGame.lineups) {
        console.log(
          `    - ${lineup.player.firstName} ${lineup.player.lastName} (${lineup.side}, position ${lineup.position})`
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
