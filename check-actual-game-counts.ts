import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Checking Actual Game Counts ===\n');

  // Get both stops
  const stops = await prisma.stop.findMany({
    where: {
      name: { in: ['Stop 1', 'Stop 2'] }
    },
    select: {
      id: true,
      name: true
    },
    orderBy: { name: 'asc' }
  });

  for (const stop of stops) {
    console.log(`=== ${stop.name} ===`);

    // Get all matches for this stop
    const matches = await prisma.match.findMany({
      where: {
        round: { stopId: stop.id }
      },
      include: {
        teamA: { select: { name: true } },
        teamB: { select: { name: true } },
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

    console.log(`Total matches: ${matches.length}`);

    // Categorize matches
    const regularMatches = matches.filter(m => !m.isBye && !m.forfeitTeam);
    const byeMatches = matches.filter(m => m.isBye);
    const forfeitMatches = matches.filter(m => m.forfeitTeam);

    console.log(`Regular matches: ${regularMatches.length}`);
    console.log(`Bye matches: ${byeMatches.length}`);
    console.log(`Forfeit matches: ${forfeitMatches.length}`);

    // Count actual games played
    let totalGamesPlayed = 0;
    let gamesWithScores = 0;
    let gamesComplete = 0;
    let tiebreakerGames = 0;

    for (const match of matches) {
      const matchGames = match.games;
      totalGamesPlayed += matchGames.length;

      // Count games with actual scores (not null)
      const gamesWithActualScores = matchGames.filter(g => 
        g.teamAScore !== null && g.teamBScore !== null
      );
      gamesWithScores += gamesWithActualScores.length;

      // Count complete games
      const completeGames = matchGames.filter(g => g.isComplete);
      gamesComplete += completeGames.length;

      // Count tiebreaker games
      const tiebreakers = matchGames.filter(g => g.slot === 'TIEBREAKER');
      tiebreakerGames += tiebreakers.length;

      // Show details for forfeit matches
      if (match.forfeitTeam) {
        console.log(`  Forfeit: ${match.teamA?.name} vs ${match.teamB?.name} - ${matchGames.length} games`);
      }
    }

    console.log(`\nGame counts:`);
    console.log(`  Total games created: ${totalGamesPlayed}`);
    console.log(`  Games with scores: ${gamesWithScores}`);
    console.log(`  Games complete: ${gamesComplete}`);
    console.log(`  Tiebreaker games: ${tiebreakerGames}`);

    // Calculate what the UI should show
    const regularMatchGames = regularMatches.length * 4; // 4 main games per regular match
    const forfeitMatchGames = forfeitMatches.length * 4; // 4 games created for forfeits (but not "played")
    const byeMatchGames = byeMatches.length * 0; // 0 games for byes

    console.log(`\nUI calculation breakdown:`);
    console.log(`  Regular matches (${regularMatches.length}) × 4 games = ${regularMatchGames}`);
    console.log(`  Forfeit matches (${forfeitMatches.length}) × 4 games = ${forfeitMatchGames}`);
    console.log(`  Bye matches (${byeMatches.length}) × 0 games = ${byeMatchGames}`);
    console.log(`  Total: ${regularMatchGames + forfeitMatchGames + byeMatchGames}`);

    // More accurate count: only count games that were actually played
    const actuallyPlayedGames = regularMatches.reduce((sum, match) => {
      const playedGames = match.games.filter(g => 
        g.teamAScore !== null && g.teamBScore !== null && g.slot !== 'TIEBREAKER'
      );
      return sum + playedGames.length;
    }, 0);

    console.log(`\nMore accurate count:`);
    console.log(`  Games actually played (with scores, excluding tiebreakers): ${actuallyPlayedGames}`);
    console.log(`  Tiebreakers played: ${tiebreakerGames}`);
    console.log(`  Total games actually played: ${actuallyPlayedGames + tiebreakerGames}`);

    console.log('');
  }

  console.log('=== RECOMMENDATION ===');
  console.log('The UI should show one of these counts:');
  console.log('1. Games actually played (with scores): Most accurate');
  console.log('2. Games created (current): Shows all games that exist');
  console.log('3. Games that could be played: Regular matches × 4 + Forfeit matches × 4');
  console.log('');
  console.log('The current "280 games" is misleading because it includes:');
  console.log('- Games that were never played (forfeits)');
  console.log('- Tiebreakers that may not have been needed');
  console.log('- Games with null scores');
}

main().catch(console.error).finally(() => prisma.$disconnect());
