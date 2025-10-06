import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const stop1Id = 'cmftqlrha000crd1estw0n0a6';

  // Check for rounds
  const rounds = await prisma.round.findMany({
    where: { stopId: stop1Id },
    orderBy: { idx: 'asc' },
  });

  console.log(`Stop 1 Rounds: ${rounds.length}`);
  for (const round of rounds) {
    console.log(`  Round ${round.idx} (${round.id})`);
  }

  if (rounds.length === 0) {
    console.log('\nNo rounds found for Stop 1!');
    return;
  }

  // Check for matches
  const matches = await prisma.match.findMany({
    where: {
      roundId: { in: rounds.map((r) => r.id) },
    },
    include: {
      teamA: { include: { club: true } },
      teamB: { include: { club: true } },
    },
    take: 5,
  });

  console.log(`\nStop 1 Matches: ${matches.length}`);
  for (const match of matches) {
    const teamAName = match.teamA?.club?.name || match.teamA?.name || 'BYE';
    const teamBName = match.teamB?.club?.name || match.teamB?.name || 'BYE';
    console.log(`  ${teamAName} vs ${teamBName}`);
  }

  // Check for games
  const games = await prisma.game.findMany({
    where: {
      match: {
        roundId: { in: rounds.map((r) => r.id) },
      },
    },
    take: 10,
    include: {
      match: {
        include: {
          teamA: { include: { club: true } },
          teamB: { include: { club: true } },
        },
      },
    },
  });

  console.log(`\nStop 1 Games: ${games.length}`);
  for (const game of games.slice(0, 5)) {
    const teamAName = game.match.teamA?.club?.name || 'BYE';
    const teamBName = game.match.teamB?.club?.name || 'BYE';
    console.log(
      `  ${teamAName} vs ${teamBName} - ${game.slot} - Score: ${game.teamAScore}-${game.teamBScore}`
    );
  }

  // Check game lineup entries (commented out as gameLineup model may not exist)
  // const gameLineups = await prisma.gameLineup.findMany({
  //   where: {
  //     game: {
  //       match: {
  //         roundId: { in: rounds.map((r) => r.id) },
  //       },
  //     },
  //   },
  //   include: {
  //     player: true,
  //     game: {
  //       include: {
  //         match: {
  //           include: {
  //             teamA: { include: { club: true } },
  //             teamB: { include: { club: true } },
  //           },
  //         },
  //       },
  //     },
  //   },
  //   take: 10,
  // });

  // console.log(`\nStop 1 Game Lineups (player assignments): ${gameLineups.length}`);
  // if (gameLineups.length > 0) {
  //   console.log('\nSample game lineups:');
  //   for (const gl of gameLineups.slice(0, 10)) {
  //     const teamName =
  //       gl.side === 'A'
  //         ? gl.game.match.teamA?.club?.name
  //         : gl.game.match.teamB?.club?.name;
  //     console.log(
  //       `  ${teamName} - ${gl.player.firstName} ${gl.player.lastName} (${gl.side} - Position ${gl.position})`
  //     );
  //   }
  // }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
