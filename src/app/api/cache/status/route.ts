import { NextResponse } from 'next/server';
import { isCacheAvailable } from '@/lib/cache';
import redis from '@/lib/cache';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cache/status
 * Check Redis cache connection status
 */
export async function GET() {
  const isAvailable = isCacheAvailable();

  if (!isAvailable) {
    return NextResponse.json({
      status: 'disconnected',
      message: 'Redis not available - application using database directly (graceful degradation)',
      env: {
        redisUrlConfigured: !!process.env.REDIS_URL,
        redisUrl: process.env.REDIS_URL ? 'configured (hidden)' : 'not set'
      }
    });
  }

  try {
    // Test Redis connection
    if (!redis) {
      return NextResponse.json({
        status: 'disconnected',
        message: 'Redis client not initialized',
        env: {
          redisUrlConfigured: !!process.env.REDIS_URL
        }
      });
    }

    const pingResult = await redis.ping();

    // Get some basic stats
    const infoStats = await redis.info('stats');
    const keyspace = await redis.info('keyspace');
    const totalKeys = await redis.dbsize();

    // Parse instantaneous ops/sec
    const opsMatch = infoStats.match(/instantaneous_ops_per_sec:(\d+)/);
    const opsPerSec = opsMatch ? parseInt(opsMatch[1]) : 0;

    // Parse hit rate
    const hitsMatch = infoStats.match(/keyspace_hits:(\d+)/);
    const missesMatch = infoStats.match(/keyspace_misses:(\d+)/);
    const hits = hitsMatch ? parseInt(hitsMatch[1]) : 0;
    const misses = missesMatch ? parseInt(missesMatch[1]) : 0;
    const total = hits + misses;
    const hitRate = total > 0 ? ((hits / total) * 100).toFixed(2) : '0.00';

    return NextResponse.json({
      status: 'connected',
      message: '✅ Redis cache is working!',
      ping: pingResult,
      stats: {
        totalKeys,
        opsPerSec,
        hitRate: `${hitRate}%`,
        hits,
        misses
      },
      keyspace: keyspace.split('\n').filter(line => line.includes('db')),
      env: {
        redisUrlConfigured: true,
        redisUrl: 'Upstash Redis (connected)'
      }
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: 'Redis connection error',
      error: error instanceof Error ? error.message : 'Unknown error',
      env: {
        redisUrlConfigured: !!process.env.REDIS_URL
      }
    }, { status: 500 });
  }
}

