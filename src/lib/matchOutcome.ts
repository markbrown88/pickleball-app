/**
 * Match Outcome Utility
 *
 * This is the single gatekeeper for determining match status, winner, and decision method.
 * It inspects games, forfeit flags, and tiebreaker status to consistently classify matches.
 */

import type { MatchTiebreakerStatus } from '@prisma/client';

// Types for match outcome
export interface NormalizedGame {
  game: any;
  started: boolean;
  completed: boolean;
  pendingTiebreaker: boolean;
}

export interface MatchOutcome {
  status: 'not_started' | 'in_progress' | 'completed';
  winnerTeamId: string | null;
  decidedBy: 'FORFEIT' | 'GAMES' | 'POINTS' | 'TIEBREAKER' | null;
  pendingTiebreaker: boolean;
  games: NormalizedGame[];
}

interface Game {
  id: string;
  slot: string;
  teamAScore: number | null;
  teamBScore: number | null;
  teamALineup?: any;
  teamBLineup?: any;
  startedAt?: Date | string | null;
  endedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  isComplete?: boolean;
}

interface Match {
  id: string;
  games?: Game[];
  teamA?: { id: string } | null;
  teamB?: { id: string } | null;
  teamAId?: string | null;
  teamBId?: string | null;
  forfeitTeam?: string | null;
  tiebreakerStatus?: MatchTiebreakerStatus | string;
  tiebreakerWinnerTeamId?: string | null;
  totalPointsTeamA?: number | null;
  totalPointsTeamB?: number | null;
}

/**
 * Helper: Check if a game has started
 */
function hasGameStarted(game: Game): boolean {
  if (game.startedAt) return true;
  if (game.teamAScore !== null || game.teamBScore !== null) return true;
  return false;
}

/**
 * Helper: Check if a game is complete
 */
function isGameComplete(game: Game): boolean {
  if (game.isComplete === true) return true;
  if (game.endedAt) return true;
  return false;
}

/**
 * Helper: Calculate total points from standard games only (excluding tiebreaker)
 */
function calculateTotalPoints(games: Game[]): { teamA: number; teamB: number } {
  const standardGames = games.filter((g) => g.slot !== 'TIEBREAKER');

  return standardGames.reduce(
    (acc, game) => ({
      teamA: acc.teamA + (game.teamAScore ?? 0),
      teamB: acc.teamB + (game.teamBScore ?? 0),
    }),
    { teamA: 0, teamB: 0 }
  );
}

/**
 * Builds the match outcome by inspecting all available data
 *
 * Classification rules (in priority order):
 * 1. Forfeit: overrides everything
 * 2. Games decided: 3+ wins in standard games
 * 3. Decided by points: tiebreakerStatus === 'DECIDED_POINTS'
 * 4. Decided by tiebreaker: tiebreakerStatus === 'DECIDED_TIEBREAKER' with winner
 * 5. Pending tiebreaker: Various statuses indicating tiebreaker in progress
 * 6. In progress: Any game has started but not completed
 * 7. Not started: No games have started
 */
export function buildMatchOutcome(match: Match | null | undefined): MatchOutcome {
  // Handle null/undefined match
  if (!match) {
    return {
      status: 'not_started',
      winnerTeamId: null,
      decidedBy: null,
      pendingTiebreaker: false,
      games: [],
    };
  }

  const games = match.games ?? [];
  const standardGames = games.filter((g) => g.slot !== 'TIEBREAKER');
  const tiebreakerGame = games.find((g) => g.slot === 'TIEBREAKER') ?? null;

  // Calculate total points (excluding tiebreaker game)
  const calculatedPoints = calculateTotalPoints(games);
  const totalPointsA = match.totalPointsTeamA ?? calculatedPoints.teamA;
  const totalPointsB = match.totalPointsTeamB ?? calculatedPoints.teamB;

  const teamAId = match.teamA?.id ?? match.teamAId ?? null;
  const teamBId = match.teamB?.id ?? match.teamBId ?? null;

  // Track game states
  const anyGameStarted = games.some(hasGameStarted);
  const anyGameInProgress = games.some((g) => hasGameStarted(g) && !isGameComplete(g));

  // Initialize outcome variables
  let status: MatchOutcome['status'] = 'not_started';
  let winnerTeamId: string | null = null;
  let decidedBy: MatchOutcome['decidedBy'] = null;
  let pendingTiebreaker = false;

  // ============================================
  // RULE 1: Forfeit overrides everything
  // ============================================
  if (match.forfeitTeam) {
    status = 'completed';
    decidedBy = 'FORFEIT';
    winnerTeamId = match.forfeitTeam === 'A' ? teamBId : teamAId;
  }

  // ============================================
  // RULE 2: Games decided (3+ wins in standard games)
  // ============================================
  if (!winnerTeamId) {
    let teamAWins = 0;
    let teamBWins = 0;

    standardGames.forEach((game) => {
      // Only count completed games
      if (isGameComplete(game) && game.teamAScore !== null && game.teamBScore !== null) {
        if (game.teamAScore > game.teamBScore) {
          teamAWins++;
        } else if (game.teamBScore > game.teamAScore) {
          teamBWins++;
        }
      }
    });

    if (teamAWins >= 3 || teamBWins >= 3) {
      winnerTeamId = teamAWins > teamBWins ? teamAId : teamBId;
      decidedBy = 'GAMES';
      status = 'completed';
    }
  }

  // ============================================
  // RULE 3-5: Handle tiebreaker statuses
  // Trust the backend's tiebreakerStatus as the source of truth
  // ============================================
  if (!winnerTeamId) {
    // Debug logging

    switch (match.tiebreakerStatus) {
      case 'DECIDED_POINTS':
        // Match decided by total points (admin decision or automatic)
        if (match.tiebreakerWinnerTeamId) {
          winnerTeamId = match.tiebreakerWinnerTeamId;
          decidedBy = 'POINTS';
          status = 'completed';
        } else if (totalPointsA !== totalPointsB) {
          // Fallback: derive winner from point totals
          winnerTeamId = totalPointsA > totalPointsB ? teamAId : teamBId;
          decidedBy = 'POINTS';
          status = 'completed';
        } else {
          // Data inconsistency: points equal but marked as decided by points
          console.warn(`Match ${match.id}: DECIDED_POINTS but points are equal`);
          pendingTiebreaker = true;
          status = 'in_progress';
        }
        break;

      case 'DECIDED_TIEBREAKER':
        // Match decided by tiebreaker game
        if (match.tiebreakerWinnerTeamId) {
          winnerTeamId = match.tiebreakerWinnerTeamId;
          decidedBy = 'TIEBREAKER';
          status = 'completed';
        } else if (tiebreakerGame && isGameComplete(tiebreakerGame)) {
          // Fallback: derive winner from tiebreaker game score
          const tieA = tiebreakerGame.teamAScore ?? 0;
          const tieB = tiebreakerGame.teamBScore ?? 0;
          if (tieA !== tieB) {
            winnerTeamId = tieA > tieB ? teamAId : teamBId;
            decidedBy = 'TIEBREAKER';
            status = 'completed';
          } else {
            // Data inconsistency: tiebreaker game tied
            console.warn(`Match ${match.id}: DECIDED_TIEBREAKER but tiebreaker game is tied`);
            pendingTiebreaker = true;
            status = 'in_progress';
          }
        } else {
          // Data inconsistency: marked as decided but no winner or incomplete game
          console.warn(`Match ${match.id}: DECIDED_TIEBREAKER but no winner found`);
          pendingTiebreaker = true;
          status = 'in_progress';
        }
        break;

      case 'PENDING_TIEBREAKER':
        // Tiebreaker game exists but hasn't been completed yet
        pendingTiebreaker = true;
        status = 'in_progress';
        break;

      case 'REQUIRES_TIEBREAKER':
        // Points are tied, tiebreaker game created but not started
        pendingTiebreaker = true;
        status = 'in_progress';
        break;

      case 'NEEDS_DECISION':
        // 2-2 game split with unequal points - awaiting admin decision
        pendingTiebreaker = true;
        status = 'in_progress';
        break;

      case 'NONE':
      case undefined:
      case null:
        // No tiebreaker situation - continue to general status logic below
        break;

      default:
        // Unknown tiebreaker status
        console.warn(`Match ${match.id}: Unknown tiebreakerStatus '${match.tiebreakerStatus}'`);
        break;
    }
  }

  // ============================================
  // RULE 6-7: General status determination (if not already decided)
  // ============================================
  if (!winnerTeamId && status !== 'completed' && !pendingTiebreaker) {
    if (anyGameInProgress || anyGameStarted) {
      status = 'in_progress';
    } else {
      status = 'not_started';
    }
  }

  // ============================================
  // Normalize games array
  // Filter out unused tiebreaker games (created but not played)
  // ============================================
  const shouldIncludeGame = (game: any): boolean => {
    // Always include standard games
    if (game.slot !== 'TIEBREAKER') return true;

    // Include tiebreaker if it has scores (was actually played)
    if (game.teamAScore !== null || game.teamBScore !== null) return true;

    // Include tiebreaker if match is pending tiebreaker
    if (pendingTiebreaker) return true;

    // Include tiebreaker if match was decided by tiebreaker
    if (decidedBy === 'TIEBREAKER') return true;

    // Otherwise exclude (tiebreaker was created but decision went another way)
    return false;
  };

  const normalizedGames: NormalizedGame[] = games
    .filter(shouldIncludeGame)
    .map((game) => ({
      game,
      started: hasGameStarted(game),
      completed: isGameComplete(game),
      pendingTiebreaker: game.slot === 'TIEBREAKER' && pendingTiebreaker,
    }));

  const outcome = {
    status,
    winnerTeamId,
    decidedBy,
    pendingTiebreaker,
    games: normalizedGames,
  };


  return outcome;
}

/**
 * Helper: Get all match outcomes for a stop
 */
export function getMatchOutcomes(stop: any): Record<string, MatchOutcome> {
  const outcomes: Record<string, MatchOutcome> = {};

  stop?.rounds?.forEach((round: any) => {
    round.matches?.forEach((match: any) => {
      outcomes[match.id] = buildMatchOutcome(match);
    });
  });

  return outcomes;
}
