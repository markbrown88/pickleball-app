import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const stop1Id = 'cmfot1xyc0006rd6akzrbmapv';

  // Get all games for Stop 1
  const games = await prisma.game.findMany({
    where: {
      match: {
        round: {
          stopId: stop1Id,
        },
      },
    },
    include: {
      match: {
        include: {
          round: true,
          teamA: { include: { club: true } },
          teamB: { include: { club: true } },
        },
      },
    },
    take: 10,
  });

  console.log(`Stop 1 Total Games: ${games.length}\n`);

  if (games.length > 0) {
    console.log('Sample games:');
    for (const game of games.slice(0, 5)) {
      const teamA = game.match.teamA?.club?.name || 'BYE';
      const teamB = game.match.teamB?.club?.name || 'BYE';
      console.log(
        `Round ${game.match.round.idx}: ${teamA} vs ${teamB} - ${game.slot} - ${game.teamAScore}-${game.teamBScore}`
      );
      console.log(`  teamALineup: ${game.teamALineup ? 'HAS DATA' : 'NULL'}`);
      console.log(`  teamBLineup: ${game.teamBLineup ? 'HAS DATA' : 'NULL'}`);
      if (game.teamALineup) {
        console.log(`  teamALineup data:`, JSON.stringify(game.teamALineup));
      }
    }
  }

  // Check Lineup table
  console.log('\n\nChecking Lineup table:');
  const lineups = await prisma.lineup.findMany({
    where: {
      round: {
        stopId: stop1Id,
      },
    },
    include: {
      team: { include: { club: true } },
      round: true,
      entries: {
        include: {
          player1: true,
          player2: true,
        },
      },
    },
    take: 5,
  });

  console.log(`Stop 1 Total Lineups: ${lineups.length}`);

  if (lineups.length > 0) {
    console.log('\nSample lineup:');
    const lineup = lineups[0];
    console.log(`Team: ${lineup.team.club?.name}`);
    console.log(`Round: ${lineup.round.idx}`);
    console.log(`Entries: ${lineup.entries.length}`);
    for (const entry of lineup.entries) {
      console.log(`  - ${entry.player1?.firstName} ${entry.player1?.lastName}`);
      if (entry.player2) {
        console.log(`    + ${entry.player2?.firstName} ${entry.player2?.lastName}`);
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
