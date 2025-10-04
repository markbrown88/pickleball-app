'use client';

/**
 * Client-side fetch wrapper that includes Act As headers
 */

export function getActAsPlayerId(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem('act-as-user');
    if (stored) {
      const actAsUser = JSON.parse(stored);
      return actAsUser.id || null;
    }
  } catch (error) {
    console.error('Failed to parse act-as user from localStorage:', error);
  }

  return null;
}

export async function fetchWithActAs(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const actAsPlayerId = getActAsPlayerId();

  const headers = new Headers(options?.headers);

  // Add Act As header if we're impersonating someone
  if (actAsPlayerId) {
    headers.set('x-act-as-player-id', actAsPlayerId);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
