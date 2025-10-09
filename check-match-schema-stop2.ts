import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Checking Match Schema and Data in Stop 2 ===\n');

  // Get Stop 2
  const stop2 = await prisma.stop.findFirst({
    where: { name: 'Stop 2' },
    select: { id: true, name: true }
  });

  if (!stop2) {
    console.log('❌ Stop 2 not found');
    return;
  }

  // Get a sample match to see the full schema
  const sampleMatch = await prisma.match.findFirst({
    where: {
      round: { stopId: stop2.id }
    },
    select: {
      id: true,
      teamAScore: true,
      teamBScore: true,
      isComplete: true,
      isBye: true,
      teamA: { select: { id: true, name: true } },
      teamB: { select: { id: true, name: true } },
      round: { select: { idx: true } }
    }
  });

  console.log('Sample match schema:');
  console.log(JSON.stringify(sampleMatch, null, 2));

  // Check all matches for any that might be forfeits
  const allMatches = await prisma.match.findMany({
    where: {
      round: { stopId: stop2.id }
    },
    select: {
      id: true,
      teamAScore: true,
      teamBScore: true,
      isComplete: true,
      isBye: true,
      teamA: { select: { id: true, name: true } },
      teamB: { select: { id: true, name: true } },
      round: { select: { idx: true } },
      games: {
        select: {
          id: true,
          slot: true,
          teamAScore: true,
          teamBScore: true,
          isComplete: true
        }
      }
    },
    orderBy: { round: { idx: 'asc' } }
  });

  console.log(`\nTotal matches in Stop 2: ${allMatches.length}`);

  // Look for patterns that might indicate forfeits
  console.log('\n=== Checking for Forfeit Patterns ===\n');

  let potentialForfeits = 0;

  for (const match of allMatches) {
    const teamAName = match.teamA?.name || '';
    const teamBName = match.teamB?.name || '';
    
    // Check if match is marked as complete
    const matchComplete = match.isComplete;
    
    // Check if all games are complete
    const allGamesComplete = match.games.every(g => g.isComplete);
    
    // Check for unusual score patterns
    const nonTiebreakerGames = match.games.filter(g => g.slot !== 'TIEBREAKER');
    const teamAWins = nonTiebreakerGames.filter(g => (g.teamAScore || 0) > (g.teamBScore || 0)).length;
    const teamBWins = nonTiebreakerGames.filter(g => (g.teamBScore || 0) > (g.teamAScore || 0)).length;
    
    // Check for sweep (one team won all games)
    const isSweep = (teamAWins === nonTiebreakerGames.length && nonTiebreakerGames.length > 0) || 
                   (teamBWins === nonTiebreakerGames.length && nonTiebreakerGames.length > 0);
    
    // Check for matches with 0-0 scores (possible forfeit)
    const hasZeroScores = nonTiebreakerGames.some(g => 
      (g.teamAScore === 0 && g.teamBScore === 0) || 
      (g.teamAScore === null && g.teamBScore === null)
    );

    // Check for matches where one team has null scores
    const hasNullScores = nonTiebreakerGames.some(g => 
      g.teamAScore === null || g.teamBScore === null
    );

    if (isSweep || hasZeroScores || hasNullScores || teamAName.toLowerCase().includes('forfeit') || teamBName.toLowerCase().includes('forfeit')) {
      potentialForfeits++;
      
      console.log(`🎯 POTENTIAL FORFEIT #${potentialForfeits}:`);
      console.log(`  Round ${match.round.idx + 1}: ${teamAName} vs ${teamBName}`);
      console.log(`  Match ID: ${match.id}`);
      console.log(`  Match complete: ${matchComplete}`);
      console.log(`  All games complete: ${allGamesComplete}`);
      console.log(`  Is bye: ${match.isBye}`);
      console.log(`  Team A wins: ${teamAWins}, Team B wins: ${teamBWins}`);
      console.log(`  Is sweep: ${isSweep}`);
      console.log(`  Has zero scores: ${hasZeroScores}`);
      console.log(`  Has null scores: ${hasNullScores}`);
      
      console.log(`  Game details:`);
      match.games.forEach(game => {
        if (game.slot !== 'TIEBREAKER') {
          console.log(`    ${game.slot}: ${game.teamAScore || 'null'} - ${game.teamBScore || 'null'} (Complete: ${game.isComplete})`);
        }
      });
      console.log('');
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total potential forfeit matches: ${potentialForfeits}`);
  console.log(`Expected forfeit matches: 2`);
  
  if (potentialForfeits === 2) {
    console.log('✅ Found exactly 2 potential forfeit matches as expected!');
  } else if (potentialForfeits > 2) {
    console.log(`⚠️  Found ${potentialForfeits} potential forfeit matches (more than expected)`);
  } else {
    console.log(`❌ Found only ${potentialForfeits} potential forfeit matches (expected 2)`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
