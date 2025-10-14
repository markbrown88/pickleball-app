const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupUnnecessaryTiebreakerGames() {
  try {
    console.log('🧹 Cleaning up unnecessary tiebreaker games...\n');

    // Get the Klyng Cup tournament
    const tournament = await prisma.tournament.findFirst({
      where: { name: 'Klyng Cup' },
      select: { id: true, name: true }
    });

    if (!tournament) {
      console.log('❌ Klyng Cup tournament not found');
      return;
    }

    console.log(`📊 TOURNAMENT: ${tournament.name} (${tournament.id})\n`);

    // Get all matches in this tournament
    const allMatches = await prisma.match.findMany({
      where: {
        round: {
          stop: {
            tournamentId: tournament.id
          }
        }
      },
      include: {
        games: {
          where: {
            slot: {
              in: ['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_1', 'MIXED_2', 'TIEBREAKER']
            }
          }
        },
        teamA: { select: { id: true, name: true } },
        teamB: { select: { id: true, name: true } },
        round: {
          select: {
            stop: {
              select: { name: true }
            }
          }
        }
      }
    });

    console.log(`Found ${allMatches.length} total matches\n`);

    let cleanedMatches = 0;
    let totalTiebreakerGamesDeleted = 0;

    for (const match of allMatches) {
      const standardGames = match.games.filter(g => 
        ['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_1', 'MIXED_2'].includes(g.slot)
      );
      const tiebreakerGames = match.games.filter(g => g.slot === 'TIEBREAKER');
      const completedStandardGames = standardGames.filter(g => 
        g.teamAScore !== null && g.teamBScore !== null
      );

      // Count wins
      const teamAWins = completedStandardGames.filter(g => g.teamAScore > g.teamBScore).length;
      const teamBWins = completedStandardGames.filter(g => g.teamBScore > g.teamAScore).length;

      // Check if match is decided by standard games but has tiebreaker games
      const hasUnnecessaryTiebreaker = 
        completedStandardGames.length === 4 && 
        (teamAWins > teamBWins || teamBWins > teamAWins) && 
        tiebreakerGames.length > 0;

      if (hasUnnecessaryTiebreaker) {
        console.log(`🧹 Cleaning: ${match.teamA?.name || 'Team A'} vs ${match.teamB?.name || 'Team B'}`);
        console.log(`   Stop: ${match.round?.stop?.name || 'Unknown'}`);
        console.log(`   Game Results: ${teamAWins}-${teamBWins}`);
        console.log(`   Deleting ${tiebreakerGames.length} unnecessary tiebreaker game(s)...`);

        // Delete the unnecessary tiebreaker games
        const deleteResult = await prisma.game.deleteMany({
          where: {
            matchId: match.id,
            slot: 'TIEBREAKER'
          }
        });

        console.log(`   ✅ Deleted ${deleteResult.count} tiebreaker game(s)\n`);

        cleanedMatches++;
        totalTiebreakerGamesDeleted += deleteResult.count;
      }
    }

    console.log(`\n📊 CLEANUP SUMMARY:`);
    console.log(`- Matches cleaned: ${cleanedMatches}`);
    console.log(`- Tiebreaker games deleted: ${totalTiebreakerGamesDeleted}`);
    console.log(`- Total matches processed: ${allMatches.length}`);

    if (cleanedMatches > 0) {
      console.log('\n✅ Successfully cleaned up unnecessary tiebreaker games!');
      console.log('The /manager pages should now show the correct game counts.');
    } else {
      console.log('\n✅ No unnecessary tiebreaker games found - all matches are already clean!');
    }

  } catch (error) {
    console.error('❌ Error cleaning up tiebreaker games:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupUnnecessaryTiebreakerGames();
