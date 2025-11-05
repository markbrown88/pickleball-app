const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzeTournament() {
  try {
    // Find the tournament
    const tournament = await prisma.tournament.findFirst({
      where: {
        name: { contains: 'Klyng Cup', mode: 'insensitive' },
        clubs: { some: { club: { name: { contains: 'pickleplex', mode: 'insensitive' } } } }
      },
      select: { id: true, name: true }
    });

    if (!tournament) {
      console.log('Tournament not found');
      process.exit(0);
    }

    console.log('Tournament:', tournament.name, '(' + tournament.id + ')');
    console.log('');

    // Get all teams in this tournament
    const teams = await prisma.team.findMany({
      where: { tournamentId: tournament.id },
      include: {
        club: true,
        bracket: true,
        matchesA: {
          include: {
            teamB: { select: { name: true } },
            games: true
          }
        },
        matchesB: {
          include: {
            teamA: { select: { name: true } },
            games: true
          }
        }
      }
    });

    console.log('=== MATCH RESULTS AND POINT CALCULATIONS ===');
    console.log('');

    for (const team of teams) {
      console.log('TEAM:', team.name, '(Bracket:', team.bracket?.name || 'None', ')');
      console.log('Club:', team.club?.name || 'Unknown');
      console.log('');

      const allMatches = [...team.matchesA, ...team.matchesB];
      const realMatches = allMatches.filter(m => !m.isBye);

      let wins = 0;
      let losses = 0;
      let points = 0;

      console.log('Matches:');
      for (const match of realMatches) {
        const isTeamA = match.teamAId === team.id;
        const opponent = isTeamA ? match.teamB?.name : match.teamA?.name;

        let winner = null;
        let isForfeit = false;

        if (match.forfeitTeam) {
          isForfeit = true;
          winner = match.forfeitTeam === 'A' ? 'B' : 'A';
          console.log('  vs', opponent, '- FORFEIT by Team', match.forfeitTeam);
        } else if (match.tiebreakerWinnerTeamId) {
          winner = match.tiebreakerWinnerTeamId === match.teamAId ? 'A' : 'B';
          console.log('  vs', opponent, '- TIEBREAKER winner:', winner === 'A' ? 'Team A' : 'Team B');
        } else {
          let teamAScore = 0;
          let teamBScore = 0;
          const gameDetails = [];

          for (const game of match.games) {
            if (game.teamAScore != null && game.teamBScore != null) {
              gameDetails.push(game.slot + ': ' + game.teamAScore + '-' + game.teamBScore);
              if (game.teamAScore > game.teamBScore) {
                teamAScore++;
              } else if (game.teamBScore > game.teamAScore) {
                teamBScore++;
              }
            }
          }

          if (teamAScore > teamBScore) winner = 'A';
          if (teamBScore > teamAScore) winner = 'B';

          console.log('  vs', opponent, '- Games won:', isTeamA ? teamAScore : teamBScore, '-', isTeamA ? teamBScore : teamAScore);
          console.log('    Details:', gameDetails.join(', '));
        }

        if (winner) {
          const teamWon = (winner === 'A' && isTeamA) || (winner === 'B' && !isTeamA);
          if (teamWon) {
            wins++;
            points += 3;
            console.log('    Result: WIN (+3 points)');
          } else {
            losses++;
            points += isForfeit ? 0 : 1;
            console.log('    Result: LOSS (+' + (isForfeit ? 0 : 1) + ' points)');
          }
        } else {
          console.log('    Result: UNDECIDED');
        }
        console.log('');
      }

      console.log('Summary: ' + wins + 'W - ' + losses + 'L, ' + points + ' points');
      console.log('');
      console.log('---');
      console.log('');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeTournament();
