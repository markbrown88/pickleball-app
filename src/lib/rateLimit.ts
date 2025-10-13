/**
 * Rate limiting utility using Upstash Redis
 *
 * Protects against brute force attacks on captain portal tokens
 * and other sensitive endpoints.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Redis client for rate limiting
// Upstash requires REST API endpoint, not redis:// URL
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

/**
 * Rate limiter for captain portal access
 * Allows 10 requests per 10 seconds per IP
 *
 * This prevents brute force attacks on 5-character tokens:
 * - 36^5 = 60,466,176 possible tokens
 * - At 10 req/10s = 1 req/s
 * - Would take ~700 days to brute force
 */
export const captainPortalLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '10 s'),
      analytics: true,
      prefix: '@ratelimit/captain-portal',
    })
  : null;

/**
 * Rate limiter for score submission
 * Allows 30 requests per minute per user
 *
 * Protects against rapid score manipulation
 */
export const scoreSubmissionLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '1 m'),
      analytics: true,
      prefix: '@ratelimit/score-submission',
    })
  : null;

/**
 * Rate limiter for lineup submission
 * Allows 20 requests per minute per user
 *
 * Protects against rapid lineup changes
 */
export const lineupSubmissionLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '1 m'),
      analytics: true,
      prefix: '@ratelimit/lineup-submission',
    })
  : null;

/**
 * Helper to get client IP from request
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  return 'unknown';
}

/**
 * Helper to check rate limit and return appropriate response
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<{ success: boolean; limit: number; remaining: number; reset: number } | null> {
  if (!limiter) {
    // Rate limiting not configured, allow request
    return null;
  }

  const result = await limiter.limit(identifier);

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}
