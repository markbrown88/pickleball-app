import type { GameSlot, Match, MatchTiebreakerStatus, Prisma } from '@prisma/client';

const STANDARD_SLOTS: GameSlot[] = [
  'MENS_DOUBLES',
  'WOMENS_DOUBLES',
  'MIXED_1',
  'MIXED_2',
];

const DECIDED_STATUSES: MatchTiebreakerStatus[] = ['DECIDED_POINTS', 'DECIDED_TIEBREAKER'];

type MatchWithGames = Prisma.MatchGetPayload<{
  include: {
    games: true;
    teamA: { select: { id: true } };
    teamB: { select: { id: true } };
  };
}>;

type PrismaClientOrTx = Prisma.TransactionClient | Prisma.PrismaClient;

export async function evaluateMatchTiebreaker(
  tx: PrismaClientOrTx,
  matchId: string,
): Promise<Match | null> {
  const match = await tx.match.findUnique({
    where: { id: matchId },
    include: {
      games: true,
      teamA: { select: { id: true } },
      teamB: { select: { id: true } },
    },
  });

  if (!match) {
    return null;
  }

  // For forfeits we can short-circuit and mark as decided via points
  if (match.forfeitTeam) {
    const winnerTeamId = match.forfeitTeam === 'A' ? match.teamBId ?? null : match.teamAId ?? null;
    return tx.match.update({
      where: { id: matchId },
      data: {
        tiebreakerStatus: 'DECIDED_POINTS',
        tiebreakerWinnerTeamId: winnerTeamId,
        tiebreakerGameId: null,
        tiebreakerDecidedAt: match.tiebreakerDecidedAt ?? new Date(),
      },
      include: {
        games: true,
        teamA: { select: { id: true } },
        teamB: { select: { id: true } },
      },
    });
  }

  const standardGames = match.games.filter(
    (game) => game.slot && STANDARD_SLOTS.includes(game.slot),
  );
  const completedStandardGames = standardGames.filter(
    (game) => game.teamAScore !== null && game.teamBScore !== null,
  );

  let totalPointsTeamA: number | null = null;
  let totalPointsTeamB: number | null = null;
  let winnerTeamId: string | null = null;
  let tiebreakerStatus: MatchTiebreakerStatus = match.tiebreakerStatus;
  let tiebreakerGameId: string | null = null;
  let tiebreakerDecidedAt: Date | null = match.tiebreakerDecidedAt;

  const tiebreakerGame = match.games.find((game) => game.slot === 'TIEBREAKER');

  const resetTiebreaker = () => {
    winnerTeamId = null;
    tiebreakerGameId = null;
    if (!DECIDED_STATUSES.includes(tiebreakerStatus)) {
      tiebreakerDecidedAt = null;
    }
  };

  resetTiebreaker();

  if (completedStandardGames.length === STANDARD_SLOTS.length) {
    const summary = completedStandardGames.reduce(
      (acc, game) => {
        const a = game.teamAScore ?? 0;
        const b = game.teamBScore ?? 0;
        acc.pointsA += a;
        acc.pointsB += b;
        if (a > b) acc.winsA += 1;
        else if (b > a) acc.winsB += 1;
        return acc;
      },
      { winsA: 0, winsB: 0, pointsA: 0, pointsB: 0 },
    );

    totalPointsTeamA = summary.pointsA;
    totalPointsTeamB = summary.pointsB;

    if (summary.winsA > summary.winsB || summary.winsB > summary.winsA) {
      // Match already decided via standard games, clear any tiebreaker data
      if (!DECIDED_STATUSES.includes(tiebreakerStatus)) {
        tiebreakerStatus = 'NONE';
      }
      resetTiebreaker();
    } else {
      // 2-2 situation – evaluate totals or tiebreaker game
      const teamAId = match.teamA?.id ?? match.teamAId ?? null;
      const teamBId = match.teamB?.id ?? match.teamBId ?? null;

      if (tiebreakerGame) {
        tiebreakerGameId = tiebreakerGame.id;
        if (tiebreakerGame.teamAScore !== null && tiebreakerGame.teamBScore !== null) {
          if (tiebreakerGame.teamAScore > tiebreakerGame.teamBScore) {
            winnerTeamId = teamAId;
          } else if (tiebreakerGame.teamBScore > tiebreakerGame.teamAScore) {
            winnerTeamId = teamBId;
          }

          if (winnerTeamId) {
            tiebreakerStatus = 'DECIDED_TIEBREAKER';
            if (!tiebreakerDecidedAt) {
              tiebreakerDecidedAt = new Date();
            }
          } else {
            tiebreakerStatus = 'PENDING_TIEBREAKER';
          }
        } else {
          tiebreakerStatus = 'PENDING_TIEBREAKER';
        }
      } else {
        if (summary.pointsA === summary.pointsB) {
          tiebreakerStatus = 'REQUIRES_TIEBREAKER';
        } else {
          // Totals differ – need a decision unless already recorded
          if (!DECIDED_STATUSES.includes(tiebreakerStatus)) {
            tiebreakerStatus = 'NEEDS_DECISION';
          }
        }
      }

      if (tiebreakerStatus === 'DECIDED_POINTS') {
        if (summary.pointsA > summary.pointsB) {
          winnerTeamId = teamAId;
        } else if (summary.pointsB > summary.pointsA) {
          winnerTeamId = teamBId;
        }
        if (!tiebreakerDecidedAt) {
          tiebreakerDecidedAt = new Date();
        }
      }
    }
  } else {
    // Not all standard games complete – clear interim values unless already decided
    if (!DECIDED_STATUSES.includes(tiebreakerStatus)) {
      tiebreakerStatus = 'NONE';
      resetTiebreaker();
    }
  }

  // Persist changes when something differs
  const shouldUpdate =
    tiebreakerStatus !== match.tiebreakerStatus ||
    winnerTeamId !== (match.tiebreakerWinnerTeamId ?? null) ||
    tiebreakerGameId !== (match.tiebreakerGameId ?? null) ||
    (tiebreakerDecidedAt?.getTime() ?? null) !== (match.tiebreakerDecidedAt?.getTime() ?? null) ||
    totalPointsTeamA !== (match.totalPointsTeamA ?? null) ||
    totalPointsTeamB !== (match.totalPointsTeamB ?? null);

  if (!shouldUpdate) {
    return match;
  }

  return tx.match.update({
    where: { id: matchId },
    data: {
      tiebreakerStatus,
      tiebreakerWinnerTeamId: winnerTeamId,
      tiebreakerGameId,
      tiebreakerDecidedAt,
      totalPointsTeamA,
      totalPointsTeamB,
    },
    include: {
      games: true,
      teamA: { select: { id: true } },
      teamB: { select: { id: true } },
    },
  });
}

export function determineWinnerFromTotals(
  totalPointsTeamA: number | null,
  totalPointsTeamB: number | null,
  teamAId: string | null,
  teamBId: string | null,
): string | null {
  if (totalPointsTeamA === null || totalPointsTeamB === null) return null;
  if (totalPointsTeamA === totalPointsTeamB) return null;
  return totalPointsTeamA > totalPointsTeamB ? teamAId : teamBId;
}

export const MatchTiebreakerStatuses = {
  STANDARD: 'NONE' as MatchTiebreakerStatus,
  NEEDS_DECISION: 'NEEDS_DECISION' as MatchTiebreakerStatus,
  REQUIRES_TIEBREAKER: 'REQUIRES_TIEBREAKER' as MatchTiebreakerStatus,
  PENDING_TIEBREAKER: 'PENDING_TIEBREAKER' as MatchTiebreakerStatus,
  DECIDED_POINTS: 'DECIDED_POINTS' as MatchTiebreakerStatus,
  DECIDED_TIEBREAKER: 'DECIDED_TIEBREAKER' as MatchTiebreakerStatus,
};


