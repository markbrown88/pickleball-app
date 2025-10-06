import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const stop2Id = 'cmfot1xzy0008rd6a1kvvmvta';

  const rounds = await prisma.round.count({ where: { stopId: stop2Id } });
  const matches = await prisma.match.count({ where: { round: { stopId: stop2Id } } });
  const games = await prisma.game.count({ where: { match: { round: { stopId: stop2Id } } } });

  console.log(`Stop 2 counts:`);
  console.log(`  Rounds: ${rounds}`);
  console.log(`  Matches: ${matches}`);
  console.log(`  Games: ${games}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
