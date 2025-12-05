import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

// Configure Redis (will use environment variables UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN)
// Fallback to in-memory if not configured (for dev/test without Redis)
const redis = process.env.UPSTASH_REDIS_REST_URL
  ? Redis.fromEnv()
  : null;

// Different limits for different endpoint types
export const rateLimits = {
  // Public endpoints - strict limits
  public: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 m'), // 20 requests per minute
    analytics: true,
    prefix: '@upstash/ratelimit:public'
  }) : null,

  // Authenticated users - moderate limits
  authenticated: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 req/min
    analytics: true,
    prefix: '@upstash/ratelimit:auth'
  }) : null,

  // Admin routes - higher limits but still protected
  admin: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(200, '1 m'), // 200 req/min
    analytics: true,
    prefix: '@upstash/ratelimit:admin'
  }) : null,

  // Score submission - very strict (prevent spam)
  scoreSubmission: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 req/min
    analytics: true,
    prefix: '@upstash/ratelimit:scores'
  }) : null,

  // Login/Attempt limits (for captain portal access)
  authAttempts: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '15 m'), // 5 attempts per 15 mins
    analytics: true,
    prefix: '@upstash/ratelimit:auth_attempts'
  }) : null
};

export function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'unknown';
}


export async function applyRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<NextResponse | null> {
  // If Redis is not configured, we skip rate limiting (development mode fallback)
  // In production, this should be treated as a configuration error if strict security is needed
  if (!limiter) return null;

  try {
    const { success, limit, remaining, reset } = await limiter.limit(identifier.replaceAll(' ', '_'));

    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString()
          }
        }
      );
    }
  } catch (error) {
    console.warn('Rate limiting failed, allowing request:', error);
    // Fail open to avoid blocking legitimate users during Redis outages
  }

  return null; // Success - continue
}

// Aliases for compatibility
export const scoreSubmissionLimiter = rateLimits.scoreSubmission;
export const checkRateLimit = applyRateLimit;
export const paymentRetryLimiter = rateLimits.public;
export const lineupSubmissionLimiter = rateLimits.scoreSubmission;
export const paymentCheckoutLimiter = rateLimits.public;
export const refundLimiter = rateLimits.admin;
export const captainPortalLimiter = rateLimits.authenticated;
