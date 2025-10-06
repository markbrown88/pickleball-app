import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const stop1Id = 'cmfot1xyc0006rd6akzrbmapv';

  const game = await prisma.game.findFirst({
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
          teamA: { include: { club: true } },
          teamB: { include: { club: true } },
          round: true,
        },
      },
    },
  });

  if (game) {
    console.log('Stop 1 Game Sample:');
    console.log(`Round: ${game.match.round.idx}`);
    console.log(`Match: ${game.match.teamA?.club?.name} vs ${game.match.teamB?.club?.name}`);
    console.log(`Game Slot: ${game.slot}`);
    console.log(`Score: ${game.teamAScore}-${game.teamBScore}`);
    console.log('\nTeam A lineup (JSON):');
    console.log(JSON.stringify(game.teamALineup, null, 2));
    console.log('\nTeam B lineup (JSON):');
    console.log(JSON.stringify(game.teamBLineup, null, 2));
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
