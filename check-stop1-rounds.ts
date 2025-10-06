import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkStop1Rounds() {
  const stop1Id = 'cmfot1xyc0006rd6akzrbmapv';

  const stop1Rounds = await prisma.round.findMany({
    where: { stopId: stop1Id },
    select: { id: true, idx: true, createdAt: true, updatedAt: true },
    orderBy: { idx: 'asc' }
  });

  console.log('\n=== Stop 1 Rounds ===');
  stop1Rounds.forEach(r => {
    console.log(`Round ${r.idx}: ${r.id}`);
    console.log(`  Created: ${r.createdAt}`);
    console.log(`  Updated: ${r.updatedAt}`);
  });

  // Check lineup count
  const lineupCount = await prisma.lineup.count({
    where: {
      round: { stopId: stop1Id }
    }
  });

  console.log(`\n=== Stop 1 has ${lineupCount} lineups ===`);

  await prisma.$disconnect();
}

checkStop1Rounds().catch(console.error);
