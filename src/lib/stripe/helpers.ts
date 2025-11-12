/**
 * Stripe helper functions that can be used in both server and client components
 * These don't depend on environment variables or the Stripe client
 */

/**
 * Helper to format amount for Stripe (cents)
 */
export function formatAmountForStripe(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Helper to format amount from Stripe (dollars)
 */
export function formatAmountFromStripe(amount: number): number {
  return amount / 100;
}
