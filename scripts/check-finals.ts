import { prisma } from '../src/lib/prisma';

async function check() {
  // Find Klyng Cup Grand Finale stop
  const stop = await prisma.stop.findUnique({
    where: { id: 'cmi7h1t8f0003l504kzclfhr4' },
    select: { id: true, name: true }
  });

  if (!stop) {
    console.log('Stop not found');
    return;
  }

  console.log('Stop:', stop.name);
  console.log('Stop ID:', stop.id);

  // Get finals rounds
  const finalsRounds = await prisma.round.findMany({
    where: {
      stopId: stop.id,
      bracketType: 'FINALS'
    },
    orderBy: { depth: 'desc' },
    include: {
      matches: {
        select: {
          id: true,
          teamAId: true,
          teamBId: true,
          winnerId: true,
          teamA: { select: { name: true } },
          teamB: { select: { name: true } }
        }
      }
    }
  });

  console.log('\n=== FINALS ROUNDS ===');
  for (const round of finalsRounds) {
    console.log(`\nRound: bracketType=${round.bracketType}, depth=${round.depth}`);
    for (const match of round.matches) {
      console.log(`  Match ID: ${match.id}`);
      console.log(`  Team A: ${match.teamA?.name || 'NULL'} (ID: ${match.teamAId || 'NULL'})`);
      console.log(`  Team B: ${match.teamB?.name || 'NULL'} (ID: ${match.teamBId || 'NULL'})`);
      console.log(`  Winner ID: ${match.winnerId || 'NULL'}`);
    }
  }
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
