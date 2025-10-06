import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const stop2Id = 'cmfot1xzy0008rd6a1kvvmvta';

  const match = await prisma.match.findFirst({
    where: { round: { stopId: stop2Id } },
    include: {
      games: true,
      teamA: { include: { club: true } },
      teamB: { include: { club: true } },
      round: true,
    },
  });

  if (match) {
    console.log(`\nSample Match:`);
    console.log(`  Round idx: ${match.round.idx}`);
    console.log(`  Team A: ${match.teamA?.club?.name || match.teamA?.name}`);
    console.log(`  Team B: ${match.teamB?.club?.name || match.teamB?.name}`);
    console.log(`  Games: ${match.games.length}`);
    for (const game of match.games) {
      console.log(`    - ${game.slot}: ${game.teamAScore}-${game.teamBScore}`);
      console.log(`      Team A lineup: ${JSON.stringify(game.teamALineup)}`);
      console.log(`      Team B lineup: ${JSON.stringify(game.teamBLineup)}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
