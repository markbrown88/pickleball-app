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

/**
 * Roster tab persistence - tracks which stop tab was last active for each club accordion
 */
const ROSTER_TAB_STORAGE_KEY = 'rosterActiveStopTabs';

export function saveActiveStopTab(tournamentId: string, clubId: string, stopId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const stored = localStorage.getItem(ROSTER_TAB_STORAGE_KEY);
    const data = stored ? JSON.parse(stored) : {};
    const key = `${tournamentId}:${clubId}`;
    data[key] = stopId;
    localStorage.setItem(ROSTER_TAB_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to save active stop tab to localStorage:', error);
  }
}

export function getLastActiveStopTab(tournamentId: string, clubId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(ROSTER_TAB_STORAGE_KEY);
    if (!stored) return null;
    const data = JSON.parse(stored);
    const key = `${tournamentId}:${clubId}`;
    return data[key] ?? null;
  } catch (error) {
    console.warn('Failed to read active stop tab from localStorage:', error);
    return null;
  }
}

/**
 * Manager page tab persistence - tracks which stop tab was last active
 */
const MANAGER_STOP_TAB_STORAGE_KEY = 'managerActiveStopTab';

export function saveManagerActiveStopTab(tournamentId: string, stopId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const stored = localStorage.getItem(MANAGER_STOP_TAB_STORAGE_KEY);
    const data = stored ? JSON.parse(stored) : {};
    data[tournamentId] = stopId;
    localStorage.setItem(MANAGER_STOP_TAB_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to save manager active stop tab to localStorage:', error);
  }
}

export function getManagerLastActiveStopTab(tournamentId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(MANAGER_STOP_TAB_STORAGE_KEY);
    if (!stored) return null;
    const data = JSON.parse(stored);
    return data[tournamentId] ?? null;
  } catch (error) {
    console.warn('Failed to read manager active stop tab from localStorage:', error);
    return null;
  }
}
