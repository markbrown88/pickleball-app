import type { Tournament } from '@/types';
import { formatDateRangeUTC, formatDateUTC } from '@/lib/utils';

export function formatDateRange(start?: string | null, end?: string | null) {
  return formatDateRangeUTC(start, end);
}

export function nextStopLabel(tournament: Tournament) {
  const firstStop = tournament.stops?.[0];
  if (!firstStop) return 'Schedule coming soon';
  // Convert Date to ISO string for formatDateUTC
  const dateString = firstStop.startAt instanceof Date
    ? firstStop.startAt.toISOString()
    : firstStop.startAt;
  return `Next stop: ${formatDateUTC(dateString)}`;
}



