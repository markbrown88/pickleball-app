/**
 * Utility for persisting the last selected tournament across page reloads.
 * Uses localStorage to remember which tournament the user was managing.
 */

const STORAGE_KEY = 'lastSelectedTournament';

export function saveSelectedTournament(tournamentId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, tournamentId);
  } catch (error) {
    console.warn('Failed to save selected tournament to localStorage:', error);
  }
}

export function getLastSelectedTournament(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to read selected tournament from localStorage:', error);
    return null;
  }
}

export function clearSelectedTournament(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear selected tournament from localStorage:', error);
  }
}
