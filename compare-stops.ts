import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const stop1Id = 'cmfot1xyc0006rd6akzrbmapv';
  const stop2Id = 'cmfot1xzy0008rd6a1kvvmvta';

  const stop1Games = await prisma.game.count({ where: { match: { round: { stopId: stop1Id } } } });
  const stop2Games = await prisma.game.count({ where: { match: { round: { stopId: stop2Id } } } });

  const stop1Matches = await prisma.match.count({ where: { round: { stopId: stop1Id } } });
  const stop2Matches = await prisma.match.count({ where: { round: { stopId: stop2Id } } });

  console.log(`Stop 1: ${stop1Matches} matches, ${stop1Games} games`);
  console.log(`Stop 2: ${stop2Matches} matches, ${stop2Games} games`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
