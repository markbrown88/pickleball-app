import { prisma } from '../src/lib/prisma';

async function clearFinals2() {
  const stopId = 'cmi7h1t8f0003l504kzclfhr4'; // Klyng Cup - Grand Finale

  // Find Finals 2 round (depth 0)
  const finals2Round = await prisma.round.findFirst({
    where: {
      stopId,
      bracketType: 'FINALS',
      depth: 0
    },
    include: {
      matches: true
    }
  });

  if (!finals2Round || finals2Round.matches.length === 0) {
    console.log('Finals 2 round/match not found');
    return;
  }

  const finals2Match = finals2Round.matches[0];
  console.log('Before clearing:');
  console.log(`  Match ID: ${finals2Match.id}`);
  console.log(`  Team A ID: ${finals2Match.teamAId}`);
  console.log(`  Team B ID: ${finals2Match.teamBId}`);

  // Clear both teams from Finals 2
  await prisma.match.update({
    where: { id: finals2Match.id },
    data: {
      teamAId: null,
      teamBId: null
    }
  });

  console.log('\nAfter clearing:');
  const updated = await prisma.match.findUnique({
    where: { id: finals2Match.id }
  });
  console.log(`  Team A ID: ${updated?.teamAId}`);
  console.log(`  Team B ID: ${updated?.teamBId}`);
  console.log('\nFinals 2 teams cleared successfully!');
}

clearFinals2().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
