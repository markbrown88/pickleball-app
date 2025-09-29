const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixForfeitedGames() {
  try {
    console.log('🔍 Looking for forfeited matches...');
    
    // Find all matches that have a forfeitTeam set
    const forfeitedMatches = await prisma.match.findMany({
      where: {
        forfeitTeam: {
          not: null
        }
      },
      select: {
        id: true,
        forfeitTeam: true,
        teamA: { select: { name: true } },
        teamB: { select: { name: true } }
      }
    });

    console.log(`📋 Found ${forfeitedMatches.length} forfeited matches:`);
    forfeitedMatches.forEach(match => {
      console.log(`  - Match ${match.id}: ${match.teamA?.name} vs ${match.teamB?.name} (Team ${match.forfeitTeam} forfeited)`);
    });

    if (forfeitedMatches.length === 0) {
      console.log('✅ No forfeited matches found. Nothing to fix.');
      return;
    }

    // Get all games for these forfeited matches
    const matchIds = forfeitedMatches.map(m => m.id);
    const games = await prisma.game.findMany({
      where: {
        matchId: { in: matchIds }
      },
      select: {
        id: true,
        matchId: true,
        slot: true,
        teamAScore: true,
        teamBScore: true,
        isComplete: true
      }
    });

    console.log(`🎮 Found ${games.length} games for forfeited matches`);

    // Group games by match
    const gamesByMatch = {};
    games.forEach(game => {
      if (!gamesByMatch[game.matchId]) {
        gamesByMatch[game.matchId] = [];
      }
      gamesByMatch[game.matchId].push(game);
    });

    // Update each game
    let totalUpdated = 0;
    for (const match of forfeitedMatches) {
      const matchGames = gamesByMatch[match.id] || [];
      console.log(`\n🔄 Processing match ${match.id} (${matchGames.length} games):`);
      
      for (const game of matchGames) {
        // Skip tiebreaker games
        if (game.slot === 'TIEBREAKER') {
          console.log(`  ⏭️  Skipping tiebreaker game ${game.id}`);
          continue;
        }

        // Determine scores based on forfeit
        const teamAScore = match.forfeitTeam === 'A' ? 0 : 1;
        const teamBScore = match.forfeitTeam === 'B' ? 0 : 1;

        console.log(`  🎯 Updating game ${game.id} (${game.slot}): ${teamAScore}-${teamBScore}, complete: true`);

        await prisma.game.update({
          where: { id: game.id },
          data: {
            teamAScore,
            teamBScore,
            isComplete: true
          }
        });

        totalUpdated++;
      }
    }

    console.log(`\n✅ Successfully updated ${totalUpdated} games for forfeited matches!`);
    console.log('🎉 All forfeited matches should now show as complete.');

  } catch (error) {
    console.error('❌ Error fixing forfeited games:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixForfeitedGames();
