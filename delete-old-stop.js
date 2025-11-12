const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteOldStop() {
  const oldStopId = 'cmhkwnh6000a8aor0c496gflp55'; // The one with only 4 loser rounds

  try {
    // Get all rounds for this stop
    const rounds = await prisma.round.findMany({
      where: { stopId: { startsWith: 'cmhkwnh6' } },
      select: { id: true }
    });

    if (rounds.length === 0) {
      console.log('No rounds found for old stop');
      return;
    }

    const roundIds = rounds.map(r => r.id);

    // Get all matches
    const matches = await prisma.match.findMany({
      where: { roundId: { in: roundIds } },
      select: { id: true }
    });

    const matchIds = matches.map(m => m.id);

    console.log(`Deleting from old stop:`);
    console.log(`  Rounds: ${rounds.length}`);
    console.log(`  Matches: ${matches.length}`);

    // Delete games
    if (matchIds.length > 0) {
      await prisma.game.deleteMany({
        where: { matchId: { in: matchIds } }
      });
    }

    // Delete matches
    await prisma.match.deleteMany({
      where: { id: { in: matchIds } }
    });

    // Delete rounds
    await prisma.round.deleteMany({
      where: { id: { in: roundIds } }
    });

    console.log(`✅ Deleted old stop data`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

deleteOldStop();
