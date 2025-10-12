import { prisma } from './src/lib/prisma.ts';

async function checkGameData() {
  const game = await prisma.game.findFirst({
    where: {
      match: {
        round: {
          stopId: 'cmfot1xyc0006rd6akzrbmapv'
        }
      }
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
    }
  });

  console.log('Sample game from database:', JSON.stringify(game, null, 2));
}

checkGameData().then(() => process.exit(0));
