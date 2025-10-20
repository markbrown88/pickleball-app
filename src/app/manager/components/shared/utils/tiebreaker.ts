/**
 * Tiebreaker Utilities
 *
 * Utilities for handling tiebreaker logic, banners, and alerts.
 */

import type { MatchStatus } from './gameStatus';

export type TiebreakerBanner = {
  tone: 'warning' | 'info' | 'success';
  message: string;
} | null;

/**
 * Get tiebreaker banner based on match status
 */
export function getTiebreakerBanner(
  status: MatchStatus,
  matchLabel: string,
  winnerName?: string | null,
  totals?: { teamA: number | null; teamB: number | null },
): TiebreakerBanner {
  switch (status) {
    case 'tied_requires_tiebreaker':
      return {
        tone: 'warning' as const,
        message: `${matchLabel} is tied 2-2. Add and schedule a tiebreaker game to decide the winner.`,
      };
    case 'tied_pending':
      return {
        tone: 'info' as const,
        message: `${matchLabel} tiebreaker has been scheduled but is not complete yet.`,
      };
    case 'decided_points':
      return {
        tone: 'success' as const,
        message: `${matchLabel} decided via total points${winnerName ? ` – ${winnerName} wins.` : '.'}${
          totals ? ` (Total Points ${totals.teamA ?? 0} - ${totals.teamB ?? 0})` : ''
        }`,
      };
    case 'decided_tiebreaker':
      return {
        tone: 'success' as const,
        message: `${matchLabel} tiebreaker played${winnerName ? ` – ${winnerName} wins.` : '.'}`,
      };
    default:
      return null;
  }
}

/**
 * Format match label for display
 */
export function formatMatchLabel(match: any): string {
  const teamAName = match.teamA?.name || 'Team A';
  const teamBName = match.teamB?.name || 'Team B';
  return `${teamAName} vs ${teamBName}`;
}

/**
 * Gather tiebreaker alerts for all matches in a round
 */
export function gatherRoundTiebreakerAlerts(
  roundMatches: any[],
  statusResolver: (match: any) => MatchStatus,
): Array<{ tone: 'warning' | 'info' | 'success'; message: string }> {
  return roundMatches
    .map((match) => {
      const status = statusResolver(match);
      if (!status || ['not_started', 'in_progress', 'completed'].includes(status)) {
        return null;
      }
      const matchLabel = formatMatchLabel(match);
      const winnerName = match.tiebreakerWinnerTeamId
        ? match.tiebreakerWinnerTeamId === match.teamA?.id
          ? match.teamA?.name
          : match.teamB?.name
        : null;
      return getTiebreakerBanner(status, matchLabel, winnerName, {
        teamA: match.totalPointsTeamA ?? null,
        teamB: match.totalPointsTeamB ?? null,
      });
    })
    .filter(Boolean) as Array<{ tone: 'warning' | 'info' | 'success'; message: string }>;
}

/**
 * Check if total points disagree between teams
 */
export function totalPointsDisagree(
  pointsA: number | null | undefined,
  pointsB: number | null | undefined,
): boolean {
  if (pointsA == null || pointsB == null) return false;
  return pointsA !== pointsB;
}
