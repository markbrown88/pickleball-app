/**
 * Clean up duplicate loser rounds
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanDuplicates() {
  try {
    // Find all loser rounds grouped by stop and idx
    const rounds = await prisma.round.findMany({
      where: { bracketType: 'LOSER' },
      orderBy: [{ stopId: 'asc' }, { idx: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        stopId: true,
        idx: true,
        depth: true,
        _count: { select: { matches: true } }
      }
    });

    console.log(`Found ${rounds.length} loser rounds total\n`);

    // Group by stopId + idx to find duplicates
    const groups = {};
    rounds.forEach(r => {
      const key = `${r.stopId}-${r.idx}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });

    // Find and delete duplicates (keep only the first one)
    const toDelete = [];
    for (const [key, rounds] of Object.entries(groups)) {
      if (rounds.length > 1) {
        console.log(`Found ${rounds.length} rounds with key ${key}:`);
        rounds.forEach((r, i) => {
          console.log(`  [${i}] id=${r.id.slice(0, 8)}, depth=${r.depth}, matches=${r._count.matches}`);
        });

        // Delete all but the first
        for (let i = 1; i < rounds.length; i++) {
          toDelete.push(rounds[i].id);
        }
        console.log(`  → Will delete ${rounds.length - 1} duplicate(s)\n`);
      }
    }

    if (toDelete.length > 0) {
      console.log(`\nDeleting ${toDelete.length} duplicate rounds...`);

      // Delete matches first
      const matchesToDelete = await prisma.match.findMany({
        where: { roundId: { in: toDelete } },
        select: { id: true }
      });

      if (matchesToDelete.length > 0) {
        const matchIds = matchesToDelete.map(m => m.id);

        // Delete games
        await prisma.game.deleteMany({
          where: { matchId: { in: matchIds } }
        });

        // Delete matches
        await prisma.match.deleteMany({
          where: { id: { in: matchIds } }
        });
      }

      // Delete rounds
      await prisma.round.deleteMany({
        where: { id: { in: toDelete } }
      });

      console.log(`✅ Deleted ${toDelete.length} duplicate rounds`);
    } else {
      console.log('✅ No duplicates found');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

cleanDuplicates();
