/**
 * Utility functions for captain portal access tokens
 */

/**
 * Generate a 5-character random alphanumeric token
 */
export function generateCaptainToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 5; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Build captain portal URL
 */
export function buildCaptainPortalUrl(token: string, tournamentSlug?: string, clubSlug?: string): string {
  if (tournamentSlug && clubSlug) {
    return `/captain/${tournamentSlug}/${clubSlug}/${token}`;
  }
  return `/captain/${token}`;
}
