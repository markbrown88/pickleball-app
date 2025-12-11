/**
 * Formatting Utilities
 *
 * Utilities for formatting dates, names, and other display text.
 */

import { formatDateUTC, formatDateRangeUTC } from '@/lib/utils';

/**
 * Shorten a lineup name for display
 */
export function shortenLineupName(name?: string | null): string {
  if (!name) return 'Team';
  return name.length > 18 ? `${name.slice(0, 15)}…` : name;
}

/**
 * Shorten a general name for display
 */
export function shorten(name?: string | null): string {
  if (!name) return '';
  return name.length > 18 ? `${name.slice(0, 15)}…` : name;
}

/**
 * Format a date string using UTC formatting
 */
export function formatDate(dateStr: string | null): string {
  return formatDateUTC(dateStr);
}

/**
 * Format a date range using UTC formatting
 */
export function formatDateRange(startAt: string | null, endAt: string | null): string {
  return formatDateRangeUTC(startAt, endAt);
}

/**
 * Format a deadline date for display
 */
export function formatDeadline(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Get display name for tournament type
 */
export function getTournamentTypeDisplayName(type: string): string {
  const typeMap: Record<string, string> = {
    'TEAM_FORMAT': 'Club Round-Robin',
    'SINGLE_ELIMINATION': 'Single Elimination',
    'DOUBLE_ELIMINATION': 'Double Elimination',
    'DOUBLE_ELIMINATION_CLUBS': 'Club Double Elimination',
    'ROUND_ROBIN': 'Round Robin',
    'POOL_PLAY': 'Pool Play',
    'LADDER_TOURNAMENT': 'Ladder Tournament',
  };
  return typeMap[type] || type;
}
