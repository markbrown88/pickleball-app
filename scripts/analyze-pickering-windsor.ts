import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

const TOURNAMENT_ID = 'cmh7qeb1t0000ju04udwe7w8w';
const TARGET_CLUBS = ['Pickleplex Pickering', 'Pickleplex Windsor'];

type StopStats = {
  stopName: string;
  wins: number;
  losses: number;
  forfeitWins: number;
  forfeitLosses: number;
  pointsFromWins: number;
  pointsFromLosses: number;
};

type TeamStats = {
  teamId: string;
  teamName: string;
  bracketName: string | null;
  clubName: string;
  totalWins: number;
  totalLosses: number;
  totalForfeitWins: number;
  totalForfeitLosses: number;
  pointsFromWins: number;
  pointsFromLosses: number;
  perStop: Record<string, StopStats>;
};

function determineWinner(match: any): { winner: 'A' | 'B' | null; isForfeit: boolean } {
  if (match.forfeitTeam) {
    return { winner: match.forfeitTeam === 'A' ? 'B' : 'A', isForfeit: true };
  }

  if (match.tiebreakerWinnerTeamId) {
    if (match.tiebreakerWinnerTeamId === match.teamAId) return { winner: 'A', isForfeit: false };
    if (match.tiebreakerWinnerTeamId === match.teamBId) return { winner: 'B', isForfeit: false };
  }

  let teamAScore = 0;
  let teamBScore = 0;
  for (const game of match.games) {
    if (game.isComplete && game.teamAScore != null && game.teamBScore != null) {
      if (game.teamAScore > game.teamBScore) teamAScore++;
      else if (game.teamBScore > game.teamAScore) teamBScore++;
    }
  }

  if (teamAScore > teamBScore) return { winner: 'A', isForfeit: false };
  if (teamBScore > teamAScore) return { winner: 'B', isForfeit: false };
  return { winner: null, isForfeit: false };
}

async function analyzeTeams() {
  const teams = await prisma.team.findMany({
    where: {
      tournamentId: TOURNAMENT_ID,
      club: { name: { in: TARGET_CLUBS } },
    },
    include: {
      club: true,
      bracket: { select: { name: true } },
      matchesA: {
        where: { isBye: false },
        include: {
          games: true,
          round: {
            select: {
              stopId: true,
              stop: { select: { name: true } },
            },
          },
        },
      },
      matchesB: {
        where: { isBye: false },
        include: {
          games: true,
          round: {
            select: {
              stopId: true,
              stop: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const results: TeamStats[] = [];

  for (const team of teams) {
    const stats: TeamStats = {
      teamId: team.id,
      teamName: team.name,
      bracketName: team.bracket?.name ?? null,
      clubName: team.club?.name ?? 'Unknown Club',
      totalWins: 0,
      totalLosses: 0,
      totalForfeitWins: 0,
      totalForfeitLosses: 0,
      pointsFromWins: 0,
      pointsFromLosses: 0,
      perStop: {},
    };

    const allMatches = [...team.matchesA, ...team.matchesB];

    for (const match of allMatches) {
      const { winner } = determineWinner(match);
      if (!winner) continue;

      const stopName = match.round?.stop?.name ?? 'Unknown Stop';
      if (!stats.perStop[stopName]) {
        stats.perStop[stopName] = {
          stopName,
          wins: 0,
          losses: 0,
          forfeitWins: 0,
          forfeitLosses: 0,
          pointsFromWins: 0,
          pointsFromLosses: 0,
        };
      }
      const stopStats = stats.perStop[stopName];

      const isTeamA = match.teamAId === team.id;
      const teamWon = (winner === 'A' && isTeamA) || (winner === 'B' && !isTeamA);
      const teamForfeited = match.forfeitTeam === (isTeamA ? 'A' : 'B');
      const opponentForfeited = match.forfeitTeam && !teamForfeited;

      if (teamWon) {
        stats.totalWins += 1;
        stopStats.wins += 1;

        if (opponentForfeited) {
          stats.totalForfeitWins += 1;
          stopStats.forfeitWins += 1;
        }

        stats.pointsFromWins += 3;
        stopStats.pointsFromWins += 3;
      } else {
        stats.totalLosses += 1;
        stopStats.losses += 1;

        if (teamForfeited) {
          stats.totalForfeitLosses += 1;
          stopStats.forfeitLosses += 1;
        } else {
          stats.pointsFromLosses += 1;
          stopStats.pointsFromLosses += 1;
        }
      }
    }

    results.push(stats);
  }

  results.sort((a, b) => a.clubName.localeCompare(b.clubName) || a.teamName.localeCompare(b.teamName));

  for (const team of results) {
    console.log('\n============================================================');
    console.log(`${team.teamName} (${team.clubName}) - Bracket: ${team.bracketName ?? 'N/A'}`);
    console.log(`Record: ${team.totalWins}-${team.totalLosses}`);
    console.log(
      `Points: ${team.pointsFromWins + team.pointsFromLosses} (Wins: ${team.pointsFromWins}, Losses: ${team.pointsFromLosses})`,
    );
    console.log(
      `Forfeit Wins: ${team.totalForfeitWins} | Forfeit Losses: ${team.totalForfeitLosses}`,
    );

    console.log('Per Stop Breakdown:');
    Object.values(team.perStop).forEach((stop) => {
      console.log(
        `  • ${stop.stopName}: ${stop.wins}-${stop.losses} (Pts from wins: ${stop.pointsFromWins}, from losses: ${stop.pointsFromLosses}, forfeit wins: ${stop.forfeitWins}, forfeit losses: ${stop.forfeitLosses})`,
      );
    });
  }
}

analyzeTeams()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

