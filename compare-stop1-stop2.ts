import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Comparing Stop 1 vs Stop 2 ===\n');

  // Get both stops
  const stops = await prisma.stop.findMany({
    where: {
      name: { in: ['Stop 1', 'Stop 2'] }
    },
    select: {
      id: true,
      name: true,
      startAt: true,
      endAt: true
    },
    orderBy: { name: 'asc' }
  });

  console.log('Stops found:');
  stops.forEach(stop => {
    console.log(`  ${stop.name}: ${stop.id}`);
  });

  // Compare matches and games for each stop
  for (const stop of stops) {
    console.log(`\n=== ${stop.name} Analysis ===`);

    // Get all matches for this stop
    const matches = await prisma.match.findMany({
      where: {
        round: { stopId: stop.id }
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
            isComplete: true,
            teamALineup: true,
            teamBLineup: true
          },
          orderBy: { slot: 'asc' }
        }
      },
      orderBy: { round: { idx: 'asc' } }
    });

    console.log(`Total matches: ${matches.length}`);

    // Analyze game structure
    const matchesWithGames = matches.filter(m => m.games.length > 0);
    const matchesWithoutGames = matches.filter(m => m.games.length === 0);
    
    console.log(`Matches with games: ${matchesWithGames.length}`);
    console.log(`Matches without games: ${matchesWithoutGames.length}`);

    if (matchesWithGames.length > 0) {
      const sampleMatch = matchesWithGames[0];
      console.log(`\nSample match: ${sampleMatch.teamA?.name} vs ${sampleMatch.teamB?.name}`);
      console.log(`Games in sample match: ${sampleMatch.games.length}`);
      console.log(`Game slots: ${sampleMatch.games.map(g => g.slot).join(', ')}`);
      
      // Check if games have scores
      const gamesWithScores = sampleMatch.games.filter(g => g.teamAScore !== null && g.teamBScore !== null);
      console.log(`Games with scores: ${gamesWithScores.length}/${sampleMatch.games.length}`);
      
      // Check if games have lineups
      const gamesWithLineups = sampleMatch.games.filter(g => 
        (g.teamALineup && Array.isArray(g.teamALineup) && g.teamALineup.length > 0) ||
        (g.teamBLineup && Array.isArray(g.teamBLineup) && g.teamBLineup.length > 0)
      );
      console.log(`Games with lineups: ${gamesWithLineups.length}/${sampleMatch.games.length}`);

      // Show sample game details
      console.log(`\nSample game details:`);
      sampleMatch.games.forEach(game => {
        console.log(`  ${game.slot}: ${game.teamAScore || 'null'} - ${game.teamBScore || 'null'} (Complete: ${game.isComplete})`);
        if (game.teamALineup && Array.isArray(game.teamALineup) && game.teamALineup.length > 0) {
          console.log(`    Team A lineup: ${JSON.stringify(game.teamALineup)}`);
        }
        if (game.teamBLineup && Array.isArray(game.teamBLineup) && game.teamBLineup.length > 0) {
          console.log(`    Team B lineup: ${JSON.stringify(game.teamBLineup)}`);
        }
      });
    }

    // Check for forfeit matches
    const forfeitMatches = matches.filter(m => m.forfeitTeam);
    console.log(`\nForfeit matches: ${forfeitMatches.length}`);
    forfeitMatches.forEach(match => {
      console.log(`  Round ${match.round.idx + 1}: ${match.teamA?.name} vs ${match.teamB?.name} (Forfeit: ${match.forfeitTeam})`);
    });

    // Check for bye matches
    const byeMatches = matches.filter(m => m.isBye);
    console.log(`\nBye matches: ${byeMatches.length}`);
    byeMatches.forEach(match => {
      console.log(`  Round ${match.round.idx + 1}: ${match.teamA?.name} vs ${match.teamB?.name} (Bye)`);
    });
  }

  console.log(`\n=== SUMMARY ===`);
  console.log('This comparison will help identify why Stop 1 shows matches but no games/scores');
  console.log('while Stop 2 shows everything properly.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
