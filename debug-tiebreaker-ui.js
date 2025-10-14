const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugTiebreakerUI() {
  try {
    console.log('🔍 Debugging tiebreaker display in Klyng Cup tournament...\n');

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

    // Get ALL matches in this tournament (not just those with tiebreaker statuses)
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
      },
      orderBy: [
        { round: { stop: { name: 'asc' } } },
        { round: { idx: 'asc' } }
      ]
    });

    console.log(`Found ${allMatches.length} total matches\n`);

    let problemMatches = 0;

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

      // Check for problematic scenarios
      const hasUnnecessaryTiebreaker = 
        completedStandardGames.length === 4 && 
        (teamAWins > teamBWins || teamBWins > teamAWins) && 
        tiebreakerGames.length > 0;

      const hasTiebreakerWhenNotTied = 
        completedStandardGames.length === 4 && 
        (teamAWins > teamBWins || teamBWins > teamAWins) && 
        match.tiebreakerStatus !== 'NONE';

      if (hasUnnecessaryTiebreaker || hasTiebreakerWhenNotTied) {
        problemMatches++;
        console.log(`🚨 PROBLEM MATCH: ${match.teamA?.name || 'Team A'} vs ${match.teamB?.name || 'Team B'}`);
        console.log(`   Stop: ${match.round?.stop?.name || 'Unknown'}`);
        console.log(`   Tiebreaker Status: ${match.tiebreakerStatus}`);
        console.log(`   Standard Games: ${completedStandardGames.length}/4`);
        console.log(`   Game Results: ${teamAWins}-${teamBWins}`);
        console.log(`   Tiebreaker Games: ${tiebreakerGames.length}`);
        
        if (tiebreakerGames.length > 0) {
          console.log(`   Tiebreaker Game Details:`);
          tiebreakerGames.forEach((game, i) => {
            console.log(`     Game ${i + 1}: ${game.teamAScore || 'null'} - ${game.teamBScore || 'null'}`);
          });
        }
        
        console.log(`   Problem: ${hasUnnecessaryTiebreaker ? 'Has tiebreaker games when match is decided' : 'Has tiebreaker status when match is decided'}\n`);
      }
    }

    console.log(`\n📊 SUMMARY:`);
    console.log(`- Total matches: ${allMatches.length}`);
    console.log(`- Problem matches: ${problemMatches}`);

    if (problemMatches === 0) {
      console.log('\n✅ No problematic matches found - all tiebreakers appear to be legitimate');
    } else {
      console.log(`\n❌ Found ${problemMatches} matches with unnecessary tiebreakers`);
    }

  } catch (error) {
    console.error('❌ Error debugging tiebreakers:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugTiebreakerUI();
