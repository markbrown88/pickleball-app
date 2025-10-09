import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Checking Forfeit Games in Stop 2 (Correct Schema) ===\n');

  // Get Stop 2
  const stop2 = await prisma.stop.findFirst({
    where: { name: 'Stop 2' },
    select: { id: true, name: true }
  });

  if (!stop2) {
    console.log('❌ Stop 2 not found');
    return;
  }

  // Get all matches in Stop 2 with correct schema
  const matches = await prisma.match.findMany({
    where: {
      round: { stopId: stop2.id }
    },
    include: {
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
        },
        orderBy: { slot: 'asc' }
      }
    },
    orderBy: { round: { idx: 'asc' } }
  });

  console.log(`Found ${matches.length} matches in Stop 2\n`);

  // Check for forfeit indicators
  let forfeitCount = 0;
  const forfeitMatches: any[] = [];

  for (const match of matches) {
    const teamAName = match.teamA?.name || '';
    const teamBName = match.teamB?.name || '';
    
    // Check for explicit forfeit indicators in team names
    const hasForfeitInName = teamAName.toLowerCase().includes('forfeit') || 
                            teamBName.toLowerCase().includes('forfeit') ||
                            teamAName.toLowerCase().includes('bye') ||
                            teamBName.toLowerCase().includes('bye');

    // Check if match is marked as bye
    const isBye = match.isBye;

    // Check game completion patterns
    const nonTiebreakerGames = match.games.filter(g => g.slot !== 'TIEBREAKER');
    const completedGames = nonTiebreakerGames.filter(g => g.isComplete);
    const allGamesComplete = nonTiebreakerGames.every(g => g.isComplete);

    // Check for sweep patterns (one team won all games)
    const teamAWins = nonTiebreakerGames.filter(g => (g.teamAScore || 0) > (g.teamBScore || 0)).length;
    const teamBWins = nonTiebreakerGames.filter(g => (g.teamBScore || 0) > (g.teamAScore || 0)).length;
    const isSweep = (teamAWins === nonTiebreakerGames.length && nonTiebreakerGames.length > 0) || 
                   (teamBWins === nonTiebreakerGames.length && nonTiebreakerGames.length > 0);

    // Check for forfeit team field
    const forfeitTeam = match.forfeitTeam;

    if (hasForfeitInName || isBye || forfeitTeam || (isSweep && allGamesComplete)) {
      forfeitCount++;
      forfeitMatches.push(match);
      
      console.log(`🚨 FORFEIT MATCH #${forfeitCount}:`);
      console.log(`  Round ${match.round.idx + 1}: ${teamAName} vs ${teamBName}`);
      console.log(`  Match ID: ${match.id}`);
      console.log(`  Is bye: ${isBye}`);
      console.log(`  Forfeit team: ${forfeitTeam || 'None'}`);
      console.log(`  Has forfeit in name: ${hasForfeitInName}`);
      console.log(`  All games complete: ${allGamesComplete}`);
      console.log(`  Games completed: ${completedGames.length}/${nonTiebreakerGames.length}`);
      console.log(`  Team A wins: ${teamAWins}, Team B wins: ${teamBWins}`);
      console.log(`  Is sweep: ${isSweep}`);
      
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
  console.log(`Total forfeit matches found: ${forfeitCount}`);
  console.log(`Expected forfeit matches: 2`);
  
  if (forfeitCount === 2) {
    console.log('✅ Found exactly 2 forfeit matches as expected!');
    
    // Check if they're properly marked as complete
    console.log('\n=== Forfeit Match Completion Status ===');
    forfeitMatches.forEach((match, index) => {
      const allGamesComplete = match.games.filter(g => g.slot !== 'TIEBREAKER').every(g => g.isComplete);
      console.log(`Forfeit Match ${index + 1}: All games complete = ${allGamesComplete ? '✅ YES' : '❌ NO'}`);
    });
    
  } else if (forfeitCount > 2) {
    console.log(`⚠️  Found ${forfeitCount} forfeit matches (more than expected)`);
  } else {
    console.log(`❌ Found only ${forfeitCount} forfeit matches (expected 2)`);
  }

  // If we didn't find 2 forfeits, let's look for other patterns
  if (forfeitCount !== 2) {
    console.log('\n=== Looking for Other Patterns ===');
    
    // Look for matches with all games complete and sweep patterns
    const sweepMatches = matches.filter(match => {
      const nonTiebreakerGames = match.games.filter(g => g.slot !== 'TIEBREAKER');
      const allGamesComplete = nonTiebreakerGames.every(g => g.isComplete);
      const teamAWins = nonTiebreakerGames.filter(g => (g.teamAScore || 0) > (g.teamBScore || 0)).length;
      const teamBWins = nonTiebreakerGames.filter(g => (g.teamBScore || 0) > (g.teamAScore || 0)).length;
      const isSweep = (teamAWins === nonTiebreakerGames.length && nonTiebreakerGames.length > 0) || 
                     (teamBWins === nonTiebreakerGames.length && nonTiebreakerGames.length > 0);
      
      return allGamesComplete && isSweep && nonTiebreakerGames.length > 0;
    });

    console.log(`Found ${sweepMatches.length} matches with sweep patterns (all games complete, one team won all):`);
    sweepMatches.forEach((match, index) => {
      console.log(`  ${index + 1}. Round ${match.round.idx + 1}: ${match.teamA?.name} vs ${match.teamB?.name}`);
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
