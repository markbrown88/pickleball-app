import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not defined in environment variables');
}

/**
 * Stripe client instance
 * Initialized with secret key and API version
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-10-29.clover',
  typescript: true,
});

/**
 * Stripe configuration constants
 */
export const STRIPE_CONFIG = {
  /**
   * Currency for all transactions (USD)
   */
  currency: 'usd' as const,

  /**
   * Checkout session configuration
   */
  checkout: {
    /**
     * Allowed payment methods
     * Stripe automatically shows Apple Pay and Google Pay when available
     * when 'card' is enabled (no need to specify them separately)
     */
    paymentMethodTypes: ['card'] as Stripe.Checkout.SessionCreateParams.PaymentMethodType[],

    /**
     * Session mode (payment for one-time charges)
     */
    mode: 'payment' as const,

    /**
     * URLs for success and cancel redirects
     */
    successUrl: (tournamentId: string, sessionId: string) =>
      `${process.env.NEXT_PUBLIC_APP_URL}/register/${tournamentId}/payment/success?session_id=${sessionId}`,

    cancelUrl: (tournamentId: string) =>
      `${process.env.NEXT_PUBLIC_APP_URL}/register/${tournamentId}/payment/cancel`,
  },

  /**
   * Webhook configuration
   */
  webhook: {
    /**
     * Events to listen for
     */
    events: [
      'checkout.session.completed',
      'checkout.session.expired',
      'payment_intent.succeeded',
      'payment_intent.payment_failed',
      'charge.refunded',
    ] as const,
  },
};

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
