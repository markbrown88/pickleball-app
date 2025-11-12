const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findCompletedLoserFinal() {
  try {
    console.log('=== Finding Completed Loser Bracket Matches ===\n');

    const matches = await prisma.match.findMany({
      where: {
        round: {
          stop: {
            tournament: {
              name: { contains: 'Bracket Test 4' }
            }
          }
        }
      },
      include: {
        round: {
          select: {
            bracketType: true,
            depth: true,
            idx: true,
          }
        },
        teamA: { select: { id: true, name: true } },
        teamB: { select: { id: true, name: true } },
        games: true,
      },
      orderBy: {
        round: {
          idx: 'asc'
        }
      }
    });

    console.log('All Loser Bracket matches:\n');
    const loserMatches = matches.filter(m => m.round?.bracketType === 'LOSER');

    loserMatches.forEach((m, idx) => {
      const completeGames = m.games.filter(g => g.isComplete).length;
      console.log(`Match ${idx + 1} (Round idx ${m.round?.idx}, depth ${m.round?.depth}):`);
      console.log(`  ID: ${m.id.slice(0, 8)}`);
      console.log(`  Teams: ${m.teamA?.name || 'TBD'} vs ${m.teamB?.name || 'TBD'}`);
      console.log(`  Winner: ${m.winnerId ? m.winnerId.slice(0, 8) : 'null'}`);
      console.log(`  Games: ${completeGames}/${m.games.length} complete`);
      console.log('');
    });

    // Find matches with Pickering AND complete games
    console.log('\n--- Matches with Pickering AND completed games ---\n');
    const pickeringMatches = matches.filter(m =>
      (m.teamA?.name?.includes('Pickering') || m.teamB?.name?.includes('Pickering')) &&
      m.games.some(g => g.isComplete)
    );

    pickeringMatches.forEach(m => {
      const completeGames = m.games.filter(g => g.isComplete).length;
      let teamAWins = 0, teamBWins = 0;
      for (const game of m.games) {
        if (!game.isComplete) continue;
        const scoreA = game.teamAScore ?? 0;
        const scoreB = game.teamBScore ?? 0;
        if (scoreA > scoreB) teamAWins++;
        else if (scoreB > scoreA) teamBWins++;
      }

      console.log(`Match (${m.round?.bracketType} Round ${m.round?.idx}, depth ${m.round?.depth}):`);
      console.log(`  ID: ${m.id.slice(0, 8)}`);
      console.log(`  Teams: ${m.teamA?.name || 'TBD'} vs ${m.teamB?.name || 'TBD'}`);
      console.log(`  Game wins: ${teamAWins} - ${teamBWins}`);
      console.log(`  Winner ID: ${m.winnerId ? m.winnerId.slice(0, 8) : 'null'}`);
      console.log(`  Complete games: ${completeGames}/${m.games.length}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

findCompletedLoserFinal();
