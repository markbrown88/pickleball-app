import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parse a date string and return a Date object using UTC methods
 */
function parseDateUTC(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;
  
  // Check if it's a simple YYYY-MM-DD format
  const simpleDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (simpleDateMatch) {
    const year = parseInt(simpleDateMatch[1]);
    const month = parseInt(simpleDateMatch[2]) - 1; // Month is 0-indexed
    const day = parseInt(simpleDateMatch[3]);
    return new Date(Date.UTC(year, month, day));
  }
  
  // Handle ISO strings
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Format a single date using standardized format
 * Format: "Nov. 23, 2025"
 */
function formatSingleDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  
  const monthNames = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.',
                     'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];
  
  return `${monthNames[month]} ${day}, ${year}`;
}

/**
 * Format a date string using standardized format
 * Format: "Aug 23, 2025"
 */
export function formatDateUTC(dateString: string | null | undefined): string {
  const date = parseDateUTC(dateString);
  if (!date) return '—';
  
  return formatSingleDate(date);
}

/**
 * Format a date range using standardized format
 * Same month: "Nov. 21 - 23, 2025"
 * Different months, same year: "Nov. 21 - Dec. 23, 2025"
 * Different years: "Nov. 21, 2025 - Jan. 23, 2026"
 * Same day: "Nov. 21, 2025"
 */
export function formatDateRangeUTC(start?: string | null, end?: string | null): string {
  if (!start && !end) return '—';
  
  const startDate = parseDateUTC(start);
  const endDate = parseDateUTC(end);
  
  if (!startDate) return '—';
  if (!endDate) return formatSingleDate(startDate);
  
  // Check if same day
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();
  if (startTime === endTime) {
    return formatSingleDate(startDate);
  }
  
  const startYear = startDate.getUTCFullYear();
  const endYear = endDate.getUTCFullYear();
  const startMonth = startDate.getUTCMonth();
  const endMonth = endDate.getUTCMonth();
  const startDay = startDate.getUTCDate();
  const endDay = endDate.getUTCDate();
  
  const monthNames = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.',
                     'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];
  
  // Different years - show year for both
  if (startYear !== endYear) {
    return `${monthNames[startMonth]} ${startDay}, ${startYear} - ${monthNames[endMonth]} ${endDay}, ${endYear}`;
  }
  
  // Same month - only show month once: "Nov. 21 - 23, 2025"
  if (startMonth === endMonth) {
    return `${monthNames[startMonth]} ${startDay} - ${endDay}, ${startYear}`;
  }
  
  // Different months, same year - show both months: "Nov. 21 - Dec. 23, 2025"
  return `${monthNames[startMonth]} ${startDay} - ${monthNames[endMonth]} ${endDay}, ${startYear}`;
}