import { prisma } from './src/lib/prisma';

async function checkLineups() {
  const lineups = await prisma.lineup.findMany({
    where: {
      round: {
        stopId: 'cmfot1xyc0006rd6akzrbmapv'
      }
    },
    take: 2,
    include: {
      team: { select: { name: true } },
      entries: {
        include: {
          player1: { select: { name: true } },
          player2: { select: { name: true } }
        }
      }
    }
  });

  console.log('Lineups found:', lineups.length);
  console.log('Sample lineups:', JSON.stringify(lineups, null, 2));
}

checkLineups().then(() => process.exit(0));
