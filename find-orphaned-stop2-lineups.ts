import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findOrphanedLineups() {
  const stop2Id = 'cmfot1xzy0008rd6a1kvvmvta';

  // Get all current rounds for Stop 2
  const currentRounds = await prisma.round.findMany({
    where: { stopId: stop2Id },
    select: { id: true, idx: true, createdAt: true }
  });

  console.log('\n=== Current Stop 2 Rounds ===');
  currentRounds.forEach(r => {
    console.log(`Round ${r.idx}: ${r.id} (created: ${r.createdAt})`);
  });

  const currentRoundIds = currentRounds.map(r => r.id);

  // Check if there are any lineups pointing to rounds that belong to Stop 2
  const stop2Lineups = await prisma.lineup.findMany({
    where: {
      round: { stopId: stop2Id }
    },
    include: {
      round: { select: { idx: true, stopId: true } },
      team: { select: { name: true } }
    }
  });

  console.log(`\n=== Lineups for current Stop 2 rounds: ${stop2Lineups.length} ===`);
  stop2Lineups.forEach(l => {
    console.log(`Lineup ${l.id}: Round ${l.round.idx}, Team: ${l.team.name}`);
  });

  // Look for lineups that might belong to old/deleted Stop 2 rounds
  // Check if there are rounds with different IDs that were created for Stop 2
  const allStop2Rounds = await prisma.$queryRaw<Array<{
    id: string;
    idx: number;
    createdAt: Date;
    updatedAt: Date;
  }>>`
    SELECT id, idx, "createdAt", "updatedAt"
    FROM "Round"
    WHERE "stopId" = ${stop2Id}
    ORDER BY idx, "createdAt";
  `;

  console.log(`\n=== All Stop 2 Rounds from DB (${allStop2Rounds.length}) ===`);
  allStop2Rounds.forEach(r => {
    console.log(`Round ${r.idx}: ${r.id}`);
    console.log(`  Created: ${r.createdAt}`);
    console.log(`  Updated: ${r.updatedAt}`);
  });

  // Check if rounds were recreated (different updatedAt vs createdAt)
  const recreatedRounds = allStop2Rounds.filter(r => {
    const created = new Date(r.createdAt).getTime();
    const updated = new Date(r.updatedAt).getTime();
    return updated - created > 60000; // More than 1 minute difference
  });

  if (recreatedRounds.length > 0) {
    console.log('\n=== Potentially Recreated Rounds ===');
    recreatedRounds.forEach(r => {
      console.log(`Round ${r.idx}: ${r.id}`);
      console.log(`  Time diff: ${Math.floor((new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime()) / 1000 / 60)} minutes`);
    });
  }

  await prisma.$disconnect();
}

findOrphanedLineups().catch(console.error);
