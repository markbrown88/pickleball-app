import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCached, cacheKeys, CACHE_TTL } from '@/lib/cache';
import { captainPortalLimiter, getClientIp, checkRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ token: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    // Rate limiting to prevent brute force attacks on tokens
    const clientIp = getClientIp(request);
    const rateLimitResult = await checkRateLimit(captainPortalLimiter, clientIp);

    if (rateLimitResult && !rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many requests. Please try again later.',
          retryAfter: rateLimitResult.reset
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
            'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString()
          }
        }
      );
    }

    const { token } = await params;

    // Find tournament club by access token
    const tournamentClub = await prisma.tournamentClub.findUnique({
      where: { captainAccessToken: token },
      include: {
        tournament: {
          select: {
            id: true,
            name: true
          }
        },
        club: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!tournamentClub) {
      return NextResponse.json(
        { error: 'Invalid access token' },
        { status: 404 }
      );
    }

    // Use cache to reduce database load (1 minute TTL for captain portal)
    // Cache key includes token to ensure captain-specific data
    const result = await getCached(
      cacheKeys.captainPortal(token),
      async () => {
        // Get teams for this club in this tournament (used for filtering)
        const teams = await prisma.team.findMany({
          where: {
            tournamentId: tournamentClub.tournamentId,
            clubId: tournamentClub.clubId
          },
          select: { id: true }
        });

        const teamIds = teams.map(t => t.id);

        // Get all stops WITH all games in a single query (eliminates N+1 problem)
        // This replaces 3 queries per stop with 1 total query
        const stopsWithGames = await prisma.stop.findMany({
      where: {
        tournamentId: tournamentClub.tournamentId
      },
      orderBy: { startAt: 'asc' },
      select: {
        id: true,
        name: true,
        startAt: true,
        endAt: true,
        lineupDeadline: true,
        club: {
          select: {
            id: true,
            name: true
          }
        },
        rounds: {
          select: {
            matches: {
              where: {
                OR: [
                  { teamAId: { in: teamIds } },
                  { teamBId: { in: teamIds } }
                ]
              },
              select: {
                teamAId: true,
                teamBId: true,
                games: {
                  select: {
                    id: true
                  }
                }
              }
            }
          }
        }
      }
    });

    // Process data in memory (much faster than multiple DB queries)
    const now = new Date();
    const stopsWithStatus = stopsWithGames.map((stop) => {
      // Determine status
      // Dates are stored as ISO strings but represent dates in local timezone
      // We parse just the date part (YYYY-MM-DD) and ignore time/timezone
      const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      let status: 'completed' | 'upcoming' | 'current' = 'upcoming';

      if (stop.endAt) {
        // Parse ISO date string to get just the date part (YYYY-MM-DD)
        const endDateStr = stop.endAt.toISOString().split('T')[0]; // "2025-11-02"
        const [year, month, day] = endDateStr.split('-').map(Number);
        const stopEndDate = new Date(year, month - 1, day); // month is 0-indexed
        // Add one day to make it inclusive (stop is open through entire end date)
        stopEndDate.setDate(stopEndDate.getDate() + 1);

        if (nowDate >= stopEndDate) {
          status = 'completed';
        } else if (stop.startAt) {
          const startDateStr = stop.startAt.toISOString().split('T')[0];
          const [y, m, d] = startDateStr.split('-').map(Number);
          const stopStartDate = new Date(y, m - 1, d);
          if (nowDate >= stopStartDate) {
            status = 'current';
          }
        }
      } else if (stop.startAt) {
        const startDateStr = stop.startAt.toISOString().split('T')[0];
        const [y, m, d] = startDateStr.split('-').map(Number);
        const stopStartDate = new Date(y, m - 1, d);
        if (nowDate >= stopStartDate) {
          status = 'current';
        }
      }

      // Note: Lineup completion checking removed as lineups are now in Lineup/LineupEntry tables
      // This would require additional queries to check lineup completion
      const lineupsComplete = false; // TODO: Implement lineup checking with new schema

      return {
        id: stop.id,
        name: stop.name,
        startAt: stop.startAt,
        endAt: stop.endAt,
        lineupDeadline: stop.lineupDeadline,
        status,
        lineupsComplete,
        club: stop.club
      };
        });

        return {
          tournament: {
            id: tournamentClub.tournament.id,
            name: tournamentClub.tournament.name
          },
          club: {
            id: tournamentClub.club.id,
            name: tournamentClub.club.name
          },
          stops: stopsWithStatus
        };
      },
      CACHE_TTL.CAPTAIN_PORTAL
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Captain portal error:', error);
    return NextResponse.json(
      { error: 'Failed to load captain portal data' },
      { status: 500 }
    );
  }
}
