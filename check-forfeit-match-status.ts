import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Checking Forfeit Match Status ===\n');
  console.log('Stop 2, Round 4: Pickleplex Barrie Advanced vs 4 Fathers Advanced\n');

  // Find the specific forfeit match
  const forfeitMatch = await prisma.match.findFirst({
    where: {
      teamA: { name: 'Pickleplex Barrie Advanced' },
      teamB: { name: '4 Fathers Advanced' },
      round: {
        stop: { name: 'Stop 2' },
        idx: 3 // Round 4 (0-based index)
      }
    },
    include: {
      teamA: { select: { id: true, name: true } },
      teamB: { select: { id: true, name: true } },
      round: { 
        select: { 
          idx: true,
          stop: { select: { name: true } }
        } 
      },
      games: {
        select: {
          id: true,
          slot: true,
          teamAScore: true,
          teamBScore: true,
          isComplete: true
        }
      }
    }
  });

  if (!forfeitMatch) {
    console.log('❌ Forfeit match not found');
    return;
  }

  console.log('=== MATCH DETAILS ===');
  console.log(`Match ID: ${forfeitMatch.id}`);
  console.log(`Round: ${forfeitMatch.round.idx + 1} (${forfeitMatch.round.stop.name})`);
  console.log(`Teams: ${forfeitMatch.teamA?.name} vs ${forfeitMatch.teamB?.name}`);
  console.log(`Forfeit team: ${forfeitMatch.forfeitTeam}`);
  console.log(`Is bye: ${forfeitMatch.isBye}`);
  console.log(`Games count: ${forfeitMatch.games.length}`);

  // Check match completion status
  console.log('\n=== COMPLETION STATUS ===');
  
  // Check if match has isComplete field (if it exists in schema)
  const matchWithComplete = await prisma.match.findUnique({
    where: { id: forfeitMatch.id },
    select: {
      id: true,
      // Try to get isComplete if it exists
    }
  });

  console.log('Match schema fields available:');
  console.log(JSON.stringify(matchWithComplete, null, 2));

  // Check games completion
  const nonTiebreakerGames = forfeitMatch.games.filter(g => g.slot !== 'TIEBREAKER');
  const completedGames = nonTiebreakerGames.filter(g => g.isComplete);
  const allGamesComplete = nonTiebreakerGames.every(g => g.isComplete);

  console.log(`\nGames analysis:`);
  console.log(`  Total games: ${forfeitMatch.games.length}`);
  console.log(`  Non-tiebreaker games: ${nonTiebreakerGames.length}`);
  console.log(`  Completed games: ${completedGames.length}`);
  console.log(`  All games complete: ${allGamesComplete}`);

  // Check if this affects match completion logic
  console.log(`\n=== MATCH COMPLETION LOGIC ===`);
  
  if (forfeitMatch.games.length === 0) {
    console.log('❌ ISSUE: No games created for forfeit match');
    console.log('   This means the match completion logic might not work properly');
    console.log('   because it relies on games being present and complete');
  } else {
    console.log('✅ Games exist for forfeit match');
  }

  if (forfeitMatch.forfeitTeam) {
    console.log('✅ Forfeit team is set');
    console.log(`   Forfeiting team: ${forfeitMatch.forfeitTeam === 'A' ? forfeitMatch.teamA?.name : forfeitMatch.teamB?.name}`);
    console.log(`   Winning team: ${forfeitMatch.forfeitTeam === 'A' ? forfeitMatch.teamB?.name : forfeitMatch.teamA?.name}`);
  } else {
    console.log('❌ No forfeit team set');
  }

  // Check if we need to create games for forfeit matches
  console.log(`\n=== RECOMMENDATION ===`);
  console.log('For forfeit matches, you might need to:');
  console.log('1. Create 4 games (MENS_DOUBLES, WOMENS_DOUBLES, MIXED_1, MIXED_2)');
  console.log('2. Set the winning team to win all games (e.g., 11-0)');
  console.log('3. Mark all games as complete');
  console.log('4. This ensures the match completion logic works properly');

  // Let's check how other completed matches look
  console.log(`\n=== COMPARISON WITH REGULAR MATCH ===`);
  
  const regularMatch = await prisma.match.findFirst({
    where: {
      round: { stop: { name: 'Stop 2' } },
      forfeitTeam: null,
      games: { some: {} }
    },
    include: {
      teamA: { select: { name: true } },
      teamB: { select: { name: true } },
      round: { select: { idx: true } },
      games: {
        select: {
          slot: true,
          teamAScore: true,
          teamBScore: true,
          isComplete: true
        }
      }
    }
  });

  if (regularMatch) {
    console.log(`Regular match: ${regularMatch.teamA?.name} vs ${regularMatch.teamB?.name}`);
    console.log(`Round: ${regularMatch.round.idx + 1}`);
    console.log(`Games: ${regularMatch.games.length}`);
    console.log(`All games complete: ${regularMatch.games.every(g => g.isComplete)}`);
    console.log('Game details:');
    regularMatch.games.forEach(game => {
      if (game.slot !== 'TIEBREAKER') {
        console.log(`  ${game.slot}: ${game.teamAScore || 'null'} - ${game.teamBScore || 'null'} (Complete: ${game.isComplete})`);
      }
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
