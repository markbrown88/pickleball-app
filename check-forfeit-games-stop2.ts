import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Checking Forfeit Games in Stop 2 ===\n');

  // Get Stop 2
  const stop2 = await prisma.stop.findFirst({
    where: { name: 'Stop 2' },
    select: { id: true, name: true }
  });

  if (!stop2) {
    console.log('❌ Stop 2 not found');
    return;
  }

  console.log(`Found Stop 2: ${stop2.name} (ID: ${stop2.id})\n`);

  // Get all matches in Stop 2
  const matches = await prisma.match.findMany({
    where: {
      round: { stopId: stop2.id }
    },
    include: {
      teamA: { select: { id: true, name: true } },
      teamB: { select: { id: true, name: true } },
      round: {
        select: { idx: true }
      },
      games: {
        select: {
          id: true,
          slot: true,
          teamAScore: true,
          teamBScore: true,
          isComplete: true,
          teamALineup: true,
          teamBLineup: true
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
    // Look for forfeit indicators in team names or other fields
    const teamAName = match.teamA?.name || '';
    const teamBName = match.teamB?.name || '';
    
    const hasForfeit = teamAName.toLowerCase().includes('forfeit') || 
                      teamBName.toLowerCase().includes('forfeit') ||
                      teamAName.toLowerCase().includes('bye') ||
                      teamBName.toLowerCase().includes('bye');

    if (hasForfeit) {
      forfeitCount++;
      forfeitMatches.push(match);
      
      console.log(`🚨 FORFEIT MATCH FOUND:`);
      console.log(`  Round ${match.round.idx + 1}: ${teamAName} vs ${teamBName}`);
      console.log(`  Match ID: ${match.id}`);
      
      // Check game completion status
      const completedGames = match.games.filter(g => g.isComplete);
      const totalGames = match.games.length;
      
      console.log(`  Games: ${completedGames.length}/${totalGames} complete`);
      
      // Check if all games are complete
      const allGamesComplete = match.games.every(g => g.isComplete);
      console.log(`  All games complete: ${allGamesComplete ? '✅ YES' : '❌ NO'}`);
      
      // Check scores - forfeit should result in one team winning all games
      console.log(`  Game scores:`);
      match.games.forEach(game => {
        if (game.slot !== 'TIEBREAKER') {
          console.log(`    ${game.slot}: ${game.teamAScore || 0} - ${game.teamBScore || 0} (Complete: ${game.isComplete})`);
        }
      });
      
      console.log('');
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total forfeit matches found: ${forfeitCount}`);
  
  if (forfeitCount === 0) {
    console.log('❌ No forfeit matches found. Let me check for other indicators...\n');
    
    // Check for matches with unusual patterns that might indicate forfeits
    console.log('Checking for matches with all games complete but unusual score patterns...\n');
    
    for (const match of matches) {
      const allGamesComplete = match.games.every(g => g.isComplete);
      const nonTiebreakerGames = match.games.filter(g => g.slot !== 'TIEBREAKER');
      
      if (allGamesComplete && nonTiebreakerGames.length > 0) {
        // Check if one team won all games (possible forfeit)
        const teamAWins = nonTiebreakerGames.filter(g => (g.teamAScore || 0) > (g.teamBScore || 0)).length;
        const teamBWins = nonTiebreakerGames.filter(g => (g.teamBScore || 0) > (g.teamAScore || 0)).length;
        
        if (teamAWins === nonTiebreakerGames.length || teamBWins === nonTiebreakerGames.length) {
          console.log(`🎯 POSSIBLE FORFEIT MATCH:`);
          console.log(`  Round ${match.round.idx + 1}: ${match.teamA?.name} vs ${match.teamB?.name}`);
          console.log(`  Team A wins: ${teamAWins}, Team B wins: ${teamBWins}`);
          console.log(`  All games complete: ${allGamesComplete}`);
          console.log('');
        }
      }
    }
  }

  // Also check for matches with isBye flag
  console.log('Checking for bye matches...\n');
  const byeMatches = matches.filter(m => m.isBye);
  console.log(`Found ${byeMatches.length} bye matches`);
  
  byeMatches.forEach(match => {
    console.log(`  Round ${match.round.idx + 1}: ${match.teamA?.name} vs ${match.teamB?.name} (BYE)`);
    const allGamesComplete = match.games.every(g => g.isComplete);
    console.log(`  All games complete: ${allGamesComplete ? '✅ YES' : '❌ NO'}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
