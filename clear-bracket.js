const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearBracket() {
  try {
    const tournament = await prisma.tournament.findFirst({
      where: { name: { contains: 'Bracket Test 4' } },
      include: { stops: { include: { rounds: true } } },
    });

    if (!tournament) {
      console.log('Tournament not found');
      return;
    }

    console.log('Found tournament:', tournament.name);
    
    for (const stop of tournament.stops) {
      const roundIds = stop.rounds.map(r => r.id);
      if (roundIds.length === 0) continue;

      const matches = await prisma.match.findMany({
        where: { roundId: { in: roundIds } },
      });
      const matchIds = matches.map(m => m.id);

      if (matchIds.length > 0) {
        await prisma.game.deleteMany({ where: { matchId: { in: matchIds } } });
        await prisma.match.deleteMany({ where: { id: { in: matchIds } } });
      }
      await prisma.round.deleteMany({ where: { id: { in: roundIds } } });
      
      console.log('Deleted:', matches.length, 'matches');
    }

    console.log('\nDone! Refresh browser and regenerate bracket.');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

clearBracket();
