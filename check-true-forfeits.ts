import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Checking True Forfeit Matches in Stop 2 ===\n');

  // Get Stop 2
  const stop2 = await prisma.stop.findFirst({
    where: { name: 'Stop 2' },
    select: { id: true, name: true }
  });

  if (!stop2) {
    console.log('❌ Stop 2 not found');
    return;
  }

  // Find matches with forfeitTeam field set
  const forfeitMatches = await prisma.match.findMany({
    where: {
      round: { stopId: stop2.id },
      forfeitTeam: { not: null }
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

  console.log(`Found ${forfeitMatches.length} true forfeit matches:\n`);

  forfeitMatches.forEach((match, index) => {
    console.log(`=== FORFEIT MATCH ${index + 1} ===`);
    console.log(`Round ${match.round.idx + 1}: ${match.teamA?.name} vs ${match.teamB?.name}`);
    console.log(`Match ID: ${match.id}`);
    console.log(`Forfeit team: ${match.forfeitTeam}`);
    console.log(`Is bye: ${match.isBye}`);
    
    // Determine which team forfeited
    const forfeitingTeam = match.forfeitTeam === 'A' ? match.teamA?.name : match.teamB?.name;
    const winningTeam = match.forfeitTeam === 'A' ? match.teamB?.name : match.teamA?.name;
    
    console.log(`Forfeiting team: ${forfeitingTeam}`);
    console.log(`Winning team: ${winningTeam}`);
    
    // Check games
    const nonTiebreakerGames = match.games.filter(g => g.slot !== 'TIEBREAKER');
    const completedGames = nonTiebreakerGames.filter(g => g.isComplete);
    const allGamesComplete = nonTiebreakerGames.every(g => g.isComplete);
    
    console.log(`Games: ${completedGames.length}/${nonTiebreakerGames.length} complete`);
    console.log(`All games complete: ${allGamesComplete ? '✅ YES' : '❌ NO'}`);
    
    if (nonTiebreakerGames.length > 0) {
      console.log(`Game details:`);
      nonTiebreakerGames.forEach(game => {
        console.log(`  ${game.slot}: ${game.teamAScore || 'null'} - ${game.teamBScore || 'null'} (Complete: ${game.isComplete})`);
      });
    } else {
      console.log(`No games found for this match.`);
    }
    
    // Check if this is properly handled as a forfeit
    if (allGamesComplete && nonTiebreakerGames.length > 0) {
      console.log(`✅ Forfeit properly handled: All games complete`);
    } else if (allGamesComplete && nonTiebreakerGames.length === 0) {
      console.log(`⚠️  Forfeit with no games - this might be correct for a bye/forfeit`);
    } else {
      console.log(`❌ Forfeit not properly handled: Games not complete`);
    }
    
    console.log('');
  });

  console.log(`=== SUMMARY ===`);
  console.log(`Total true forfeit matches: ${forfeitMatches.length}`);
  console.log(`Expected: 2`);
  
  if (forfeitMatches.length === 2) {
    console.log('✅ Found exactly 2 true forfeit matches as expected!');
    
    // Check if they're properly handled
    const properlyHandled = forfeitMatches.every(match => {
      const nonTiebreakerGames = match.games.filter(g => g.slot !== 'TIEBREAKER');
      return nonTiebreakerGames.length === 0 || nonTiebreakerGames.every(g => g.isComplete);
    });
    
    console.log(`All forfeits properly handled: ${properlyHandled ? '✅ YES' : '❌ NO'}`);
  } else {
    console.log(`❌ Expected 2 true forfeit matches, found ${forfeitMatches.length}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
