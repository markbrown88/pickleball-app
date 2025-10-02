import type { Tournament } from '@/types';

export function formatDateRange(start?: string | null, end?: string | null) {
  if (!start && !end) return '—';
  const format = (value: string) => new Date(value).toLocaleDateString();
  if (start && end) {
    return `${format(start)} – ${format(end)}`;
  }
  return format(start ?? end!);
}

export function nextStopLabel(tournament: Tournament) {
  const firstStop = tournament.stops?.[0];
  if (!firstStop) return 'Schedule coming soon';
  return `Next stop: ${new Date(firstStop.startAt).toLocaleDateString()}`;
}


