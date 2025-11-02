
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting report generation for Klyng Cup...');

  const tournament = await prisma.tournament.findFirst({
    where: {
      name: 'Klyng Cup'
    },
    include: {
      stops: {
        orderBy: {
          startAt: 'asc',
        },
        include: {
          rounds: {
            orderBy: {
              idx: 'asc',
            },
            include: {
              matches: {
                include: {
                  teamA: {
                    include: {
                      club: true,
                    },
                  },
                  teamB: {
                    include: {
                      club: true,
                    },
                  },
                  games: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!tournament) {
    console.error('Klyng Cup tournament not found.');
    return;
  }

  console.log(`Found tournament: ${tournament.name} with ${tournament.stops.length} stops.`);

  const teamStats: { [key: string]: { wins: number; losses: number; forfeits: number; points: number; team: any } } = {};
  const clubStats: { [key: string]: { wins: number; losses: number; points: number; club: any } } = {};

  tournament.stops.forEach((stop, stopIndex) => {
    // Stop 3 is at index 2 (0-indexed)
    const isStop3 = stopIndex === 2;

    for (const round of stop.rounds) {
      for (const match of round.matches) {
        if (!match.teamA || !match.teamB) continue;

        // Initialize team stats if not present
        if (!teamStats[match.teamA.id]) {
          teamStats[match.teamA.id] = { wins: 0, losses: 0, forfeits: 0, points: 0, team: match.teamA };
        }
        if (!teamStats[match.teamB.id]) {
          teamStats[match.teamB.id] = { wins: 0, losses: 0, forfeits: 0, points: 0, team: match.teamB };
        }
        if (match.teamA.club && !clubStats[match.teamA.club.id]) {
            clubStats[match.teamA.club.id] = { wins: 0, losses: 0, points: 0, club: match.teamA.club };
        }
        if (match.teamB.club && !clubStats[match.teamB.club.id]) {
            clubStats[match.teamB.club.id] = { wins: 0, losses: 0, points: 0, club: match.teamB.club };
        }

        let winner: 'A' | 'B' | null = null;
        let isForfeit = false;

        if (match.forfeitTeam) {
          isForfeit = true;
          winner = match.forfeitTeam === 'A' ? 'B' : 'A';
        } else if (match.tiebreakerWinnerTeamId) {
            winner = match.tiebreakerWinnerTeamId === match.teamA.id ? 'A' : 'B';
        }
        else {
          let teamAScore = 0;
          let teamBScore = 0;
          match.games.forEach(game => {
            // Only count completed games
            if (game.isComplete && game.teamAScore != null && game.teamBScore != null) {
              if (game.teamAScore > game.teamBScore) {
                teamAScore++;
              } else if (game.teamBScore > game.teamAScore) {
                teamBScore++;
              }
            }
          });
          if (teamAScore > teamBScore) winner = 'A';
          if (teamBScore > teamAScore) winner = 'B';
        }

        if (winner) {
          const winnerTeam = winner === 'A' ? match.teamA : match.teamB;
          const loserTeam = winner === 'A' ? match.teamB : match.teamA;

          // Special rule for Stop 3 forfeits by '4 Fathers'
          if (isStop3 && isForfeit && loserTeam.club?.name === '4 Fathers') {
            // Treat as a bye, no points awarded, no win/loss record change
            continue;
          }

          const winnerId = winnerTeam.id;
          const loserId = loserTeam.id;
          const winnerClubId = winnerTeam.club?.id;
          const loserClubId = loserTeam.club?.id;

          teamStats[winnerId].wins++;
          teamStats[loserId].losses++;
          if(winnerClubId) clubStats[winnerClubId].wins++;
          if(loserClubId) clubStats[loserClubId].losses++;

          if (isForfeit) {
            teamStats[winnerId].points += 3;
            teamStats[loserId].points += 0;
             if(winnerClubId) clubStats[winnerClubId].points += 3;
             if(loserClubId) clubStats[loserClubId].points += 0;
            teamStats[loserId].forfeits++;
          } else {
            teamStats[winnerId].points += 3;
            teamStats[loserId].points += 1;
            if(winnerClubId) clubStats[winnerClubId].points += 3;
            if(loserClubId) clubStats[loserClubId].points += 1;
          }
        }
      }
    }
  });

  console.log('\n--- Team Standings ---');
  generateReport(teamStats);

  console.log('\n--- Club Standings ---');
  generateReport(clubStats);
}

function generateReport(stats: any) {
    const sortedStats = Object.values(stats).sort((a: any, b: any) => b.points - a.points);

    console.log(
        '| Rank | Name | Wins | Losses | Win % | Forfeits | Points |'
    );
    console.log(
        '| :--- | :--- | :--- | :--- | :--- | :--- | :--- |'
    );

    sortedStats.forEach((s: any, index: number) => {
        const totalGames = s.wins + s.losses;
        const winPercentage = totalGames > 0 ? ((s.wins / totalGames) * 100).toFixed(2) + '%' : 'N/A';
        const name = s.team?.name ?? s.club?.name;
        console.log(
        `| ${index + 1} | ${name} | ${s.wins} | ${s.losses} | ${winPercentage} | ${s.forfeits ?? '-'} | ${s.points} |`
        );
    });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
