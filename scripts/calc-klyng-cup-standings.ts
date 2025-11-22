import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

const TOURNAMENT_ID = 'cmh7qeb1t0000ju04udwe7w8w'; // Klyng Cup - pickleplex
const BELLEVILLE_CLUB_ID = 'cmfwjxyqn0001rdxtr8v9fmdj';
const FIRST_STOP_ID = 'cmh7rtx2x000hl804yn12dfw9'; // Vaughn

type StandingRow = {
  teamId: string;
  teamName: string;
  bracketName: string | null;
  clubName: string | null;
  matchesPlayed: number;
  wins: number;
  losses: number;
  points: number;
  perStop: Record<
    string,
    {
      stopName: string;
      wins: number;
      losses: number;
      points: number;
    }
  >;
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

async function calculateStandings() {
  const teams = await prisma.team.findMany({
    where: { tournamentId: TOURNAMENT_ID },
    include: {
      club: { select: { name: true } },
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

  const standings: StandingRow[] = [];

  for (const team of teams) {
    const isBellevilleTeam = team.clubId === BELLEVILLE_CLUB_ID;
    const realMatches = [...team.matchesA, ...team.matchesB];

    const perStop: StandingRow['perStop'] = {};
    let wins = 0;
    let losses = 0;
    let points = 0;

    for (const match of realMatches) {
      const { winner, isForfeit } = determineWinner(match);
      const stopId = match.round?.stopId ?? 'unknown';
      const stopName = match.round?.stop?.name ?? 'Unknown Stop';
      const suppressPoints = isBellevilleTeam && stopId === FIRST_STOP_ID;

      if (!perStop[stopId]) {
        perStop[stopId] = { stopName, wins: 0, losses: 0, points: 0 };
      }

      if (!winner) continue;

      const teamIsA = match.teamAId === team.id;
      const teamWon = (winner === 'A' && teamIsA) || (winner === 'B' && !teamIsA);

      if (teamWon) {
        wins++;

        if (!suppressPoints) {
          points += 3;
          perStop[stopId].points += 3;
        }

        perStop[stopId].wins += 1;
      } else {
        losses++;

        if (!suppressPoints && !isForfeit) {
          points += 1;
          perStop[stopId].points += 1;
        }

        perStop[stopId].losses += 1;
      }
    }

    standings.push({
      teamId: team.id,
      teamName: team.name,
      bracketName: team.bracket?.name ?? null,
      clubName: team.club?.name ?? null,
      matchesPlayed: wins + losses,
      wins,
      losses,
      points,
      perStop,
    });
  }

  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.teamName.localeCompare(b.teamName);
  });

  console.log('\n=== Manual Standings: Klyng Cup - Pickleplex ===\n');
  console.log('Team'.padEnd(30), 'Club'.padEnd(25), 'W', 'L', 'Pts');
  console.log('-'.repeat(80));

  for (const row of standings) {
    console.log(
      `${row.teamName.padEnd(30)} ${String(row.clubName ?? '').padEnd(25)} ${String(row.wins).padStart(2)} ${String(
        row.losses,
      ).padStart(2)} ${String(row.points).padStart(3)}`,
    );

    Object.entries(row.perStop).forEach(([stopId, breakdown]) => {
      const label = stopId === FIRST_STOP_ID ? `${breakdown.stopName} (Vaughn)` : breakdown.stopName;
      console.log(
        `   - ${label?.padEnd(25)}: ${String(breakdown.wins).padStart(2)}-${String(breakdown.losses).padEnd(2)} | ${
          breakdown.points
        } pts`,
      );
    });
  }

  console.log('\nBelleville first-stop suppression is applied directly in the per-stop breakdown above.\n');
}

calculateStandings()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

