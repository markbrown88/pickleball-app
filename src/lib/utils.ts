import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date string to avoid timezone conversion issues
 * Handles both ISO strings and YYYY-MM-DD format dates
 */
export function formatDateUTC(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  
  // Check if it's a simple YYYY-MM-DD format
  const simpleDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (simpleDateMatch) {
    const year = parseInt(simpleDateMatch[1]);
    const month = parseInt(simpleDateMatch[2]) - 1; // Month is 0-indexed
    const day = parseInt(simpleDateMatch[3]);
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return `${monthNames[month]} ${day}, ${year}`;
  }
  
  // Handle ISO strings
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '—';
  
  // Use UTC methods to avoid timezone conversion
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  return `${monthNames[month]} ${day}, ${year}`;
}

/**
 * Format a date range using UTC methods
 */
export function formatDateRangeUTC(start?: string | null, end?: string | null): string {
  if (!start && !end) return '—';
  
  const startFormatted = formatDateUTC(start);
  const endFormatted = formatDateUTC(end);
  
  if (start && end && start !== end) {
    return `${startFormatted} – ${endFormatted}`;
  }
  
  return startFormatted;
}