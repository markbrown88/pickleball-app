import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeImpact() {
  try {
    // Count games with JSON lineup data
    const gamesWithJSON = await prisma.game.count({
      where: {
        OR: [
          { teamALineup: { not: null } },
          { teamBLineup: { not: null } }
        ]
      }
    });

    console.log(`Total games with JSON lineup data: ${gamesWithJSON}\n`);

    // Count completed games (these have scores - won't be affected)
    const completedGames = await prisma.game.count({
      where: { isComplete: true }
    });

    console.log(`Completed games (with scores): ${completedGames}`);

    // Count completed games WITH JSON data
    const completedWithJSON = await prisma.game.count({
      where: {
        isComplete: true,
        OR: [
          { teamALineup: { not: null } },
          { teamBLineup: { not: null } }
        ]
      }
    });

    console.log(`Completed games with JSON lineup data: ${completedWithJSON}`);

    // Check what's stored in Game table for scores/results
    const sampleCompletedGame = await prisma.game.findFirst({
      where: { isComplete: true },
      select: {
        id: true,
        slot: true,
        teamAScore: true,
        teamBScore: true,
        isComplete: true,
        teamALineup: true,
        teamBLineup: true,
        match: {
          select: {
            id: true,
            teamA: { select: { name: true } },
            teamB: { select: { name: true } },
            round: {
              select: {
                idx: true,
                stop: { select: { name: true } }
              }
            }
          }
        }
      }
    });

    console.log('\nSample completed game:');
    console.log(`  Stop: ${sampleCompletedGame?.match.round.stop.name}`);
    console.log(`  Round: ${sampleCompletedGame?.match.round.idx}`);
    console.log(`  Match: ${sampleCompletedGame?.match.teamA?.name} vs ${sampleCompletedGame?.match.teamB?.name}`);
    console.log(`  Slot: ${sampleCompletedGame?.slot}`);
    console.log(`  Score: ${sampleCompletedGame?.teamAScore} - ${sampleCompletedGame?.teamBScore}`);
    console.log(`  Has JSON lineup: ${!!sampleCompletedGame?.teamALineup}`);

    // Check if removing JSON will affect historical data
    console.log('\n=== IMPACT ANALYSIS ===');
    console.log('Game.teamALineup/teamBLineup fields contain:');
    console.log('  - Player IDs for who played in each game');
    console.log('  - NOT used for score calculation');
    console.log('  - NOT used for tournament standings');
    console.log('  - Only used for displaying "who played" historically');

    console.log('\nWhat will be PRESERVED:');
    console.log(`  ✓ ${completedGames} completed game scores`);
    console.log(`  ✓ Match results and win/loss records`);
    console.log(`  ✓ Tournament standings and rankings`);
    console.log(`  ✓ All team and player data`);

    console.log('\nWhat will be LOST:');
    console.log(`  ✗ Historical "who played in which game" data for ${completedWithJSON} completed games`);
    console.log(`  ✗ You won\'t be able to see which specific players played in past games`);
    console.log(`  ✗ But you WILL still see team names, scores, and results`);

    console.log('\nRECOMMENDATION:');
    if (completedWithJSON > 0) {
      console.log(`  ⚠️  You have ${completedWithJSON} completed games with player lineup history`);
      console.log('  Consider backing up this data before clearing if you need historical player participation records');
    } else {
      console.log('  ✓ No completed games have lineup data - safe to clear!');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeImpact();
