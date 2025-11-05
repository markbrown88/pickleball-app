import type { GameSlot, Match, MatchTiebreakerStatus, Prisma, PrismaClient } from '@prisma/client';

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

type PrismaClientOrTx = Prisma.TransactionClient | PrismaClient;

export async function evaluateMatchTiebreaker(
  tx: PrismaClientOrTx,
  matchId: string,
): Promise<MatchWithGames | null> {
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

  // For forfeits we can short-circuit - no tiebreaker needed
  if (match.forfeitTeam) {
    const winnerTeamId = match.forfeitTeam === 'A' ? match.teamBId ?? null : match.teamAId ?? null;
    return tx.match.update({
      where: { id: matchId },
      data: {
        tiebreakerStatus: 'NONE',
        tiebreakerWinnerTeamId: winnerTeamId,
        tiebreakerGameId: null,
        tiebreakerDecidedAt: null,
        totalPointsTeamA: 0,
        totalPointsTeamB: 0,
      },
      include: {
        games: true,
        teamA: { select: { id: true } },
        teamB: { select: { id: true } },
      },
    });
  }

  // Determine if this is a DE Club tournament (has bracketId) or Team tournament (has slot)
  const isDEClubTournament = match.games.some(g => g.bracketId !== null);

  let standardGames, completedStandardGames, expectedGameCount;

  if (isDEClubTournament) {
    // For DE Club: standard games are those with a bracketId (not TIEBREAKER slot)
    standardGames = match.games.filter(
      (game) => game.bracketId !== null && game.slot !== 'TIEBREAKER',
    );
    completedStandardGames = standardGames.filter(
      (game) => game.isComplete === true,
    );
    // Expected game count is based on number of unique brackets * 4 games per bracket
    const uniqueBrackets = new Set(standardGames.map(g => g.bracketId).filter(Boolean));
    expectedGameCount = uniqueBrackets.size * 4;
  } else {
    // For Team tournaments: standard games are those with standard slots
    standardGames = match.games.filter(
      (game) => game.slot && STANDARD_SLOTS.includes(game.slot),
    );
    completedStandardGames = standardGames.filter(
      (game) => game.isComplete === true,
    );
    expectedGameCount = STANDARD_SLOTS.length; // Always 4 for Team tournaments
  }

  // If match is already decided, preserve that decision
  if (DECIDED_STATUSES.includes(match.tiebreakerStatus)) {
    return match;
  }

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

  if (completedStandardGames.length === expectedGameCount) {
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
      tiebreakerStatus = 'NONE';
      resetTiebreaker();

      // Set the winner based on game wins
      const teamAId = match.teamA?.id ?? match.teamAId ?? null;
      const teamBId = match.teamB?.id ?? match.teamBId ?? null;
      winnerTeamId = summary.winsA > summary.winsB ? teamAId : teamBId;

      // Delete tiebreaker game if it exists (for reopened game scenarios)
      if (tiebreakerGame && !tiebreakerGame.isComplete) {
        await tx.game.delete({
          where: { id: tiebreakerGame.id },
        });
      }
    } else {
      // Games are tied (2-2 for Team, 4-4/8-8/etc for DE Club) – evaluate totals or tiebreaker game
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
          // Tiebreaker game exists but doesn't have scores yet
          // Check if points are equal or unequal
          if (summary.pointsA === summary.pointsB) {
            tiebreakerStatus = 'PENDING_TIEBREAKER';
          } else {
            // Points are unequal - user should decide by points instead
            // Delete the tiebreaker game since it shouldn't exist
            await tx.game.delete({
              where: { id: tiebreakerGame.id },
            });
            tiebreakerStatus = 'NEEDS_DECISION';
            tiebreakerGameId = null;
          }
        }
      } else {
        if (summary.pointsA === summary.pointsB) {
          // Automatically create a tiebreaker game so it appears without manual action
          const createdTiebreaker = await tx.game.create({
            data: {
              matchId,
              slot: 'TIEBREAKER',
              teamAScore: null,
              teamBScore: null,
            },
          });

          match.games.push(createdTiebreaker);
          tiebreakerGameId = createdTiebreaker.id;
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
    // Not all standard games complete – clear interim values
    tiebreakerStatus = 'NONE';
    resetTiebreaker();

    // Delete tiebreaker game if it exists (game was reopened)
    if (tiebreakerGame && !tiebreakerGame.isComplete) {
      await tx.game.delete({
        where: { id: tiebreakerGame.id },
      });
    }
  }

  // Persist changes when something differs
  const shouldUpdate =
    tiebreakerStatus !== match.tiebreakerStatus ||
    winnerTeamId !== (match.tiebreakerWinnerTeamId ?? null) ||
    winnerTeamId !== (match.winnerId ?? null) ||
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
      winnerId: winnerTeamId, // Set winnerId for bracket progression
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


