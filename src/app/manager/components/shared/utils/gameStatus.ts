/**
 * Game and Match Status Utilities
 *
 * Utilities for determining game status, match status, and related operations.
 */

export type MatchStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'tied_pending'
  | 'tied_requires_tiebreaker'
  | 'needs_decision'
  | 'decided_points'
  | 'decided_tiebreaker';

/**
 * Derive game status from isComplete and startedAt fields
 */
export function getGameStatus(game: any): 'not_started' | 'in_progress' | 'completed' {
  if (game.isComplete) return 'completed';
  if (game.startedAt) return 'in_progress';
  return 'not_started';
}

/**
 * Normalize tiebreaker status from various formats to consistent MatchStatus
 */
export function normalizeTiebreakerStatus(status?: string | null): MatchStatus | null {
  switch (status) {
    case 'PENDING_TIEBREAKER':
      return 'tied_pending';
    case 'NEEDS_DECISION':
      return 'needs_decision';
    case 'REQUIRES_TIEBREAKER':
      return 'tied_requires_tiebreaker';
    case 'DECIDED_POINTS':
      return 'decided_points';
    case 'DECIDED_TIEBREAKER':
      return 'decided_tiebreaker';
    case 'tied_pending':
    case 'tied_requires_tiebreaker':
    case 'needs_decision':
    case 'decided_points':
    case 'decided_tiebreaker':
      return status as MatchStatus;
    default:
      return null;
  }
}

/**
 * Derive match status from match data
 */
export function deriveMatchStatus(match: any): MatchStatus {
  if (!match) return 'not_started';

  const tiebreakerStatus = normalizeTiebreakerStatus(match.tiebreakerStatus);

  if (tiebreakerStatus) {
    return tiebreakerStatus;
  }

  if (match.matchStatus === 'in_progress') return 'in_progress';
  if (match.matchStatus === 'completed') return 'completed';
  return 'not_started';
}

/**
 * Check if a match is completed (one team has >= 3 wins and they're not tied)
 */
export function isMatchComplete(match: any, games: Record<string, any[]>): boolean {
  const status = deriveMatchStatus(match);
  if (status === 'completed' || status === 'decided_points' || status === 'decided_tiebreaker') {
    return true;
  }

  const matchGames = games[match.id] ?? match.games ?? [];
  if (matchGames.length === 0) return false;

  let teamAWins = 0;
  let teamBWins = 0;

  for (const game of matchGames) {
    if (!game) continue;
    const status = getGameStatus(game);
    if (status === 'in_progress') {
      return false;
    }

    const a = game.teamAScore;
    const b = game.teamBScore;

    if (a != null && b != null) {
      if (a > b) teamAWins += 1;
      else if (b > a) teamBWins += 1;
    }
  }

  return (teamAWins >= 3 || teamBWins >= 3) && teamAWins !== teamBWins;
}

/**
 * Check if any match in a round has started
 */
export function hasAnyMatchStarted(round: any): boolean {
  const matches = round.matches || [];
  for (const m of matches) {
    if (!m.games || m.games.length === 0) continue;
    for (const g of m.games) {
      if (g.startedAt) return true;
    }
  }
  return false;
}
