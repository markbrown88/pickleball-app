import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCached, cacheKeys, CACHE_TTL } from '@/lib/cache';

function formatLocation(details?: { name: string | null; city: string | null; region: string | null } | null) {
  if (!details) return null;
  const parts = [details.name, details.city, details.region].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

/**
 * GET /api/tournaments
 * Get all tournaments with their brackets and stops for public viewing
 */
export async function GET(req: NextRequest) {
  try {
    // Check if database is configured
    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL is not set');
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Use cache to reduce database load (10 minute TTL)
    const formattedTournaments = await getCached(
      cacheKeys.tournaments(),
      async () => {
        const tournaments = await prisma.tournament.findMany({
          orderBy: { createdAt: 'desc' },
          include: {
            brackets: {
              select: {
                id: true,
                name: true,
                idx: true
              },
              orderBy: { idx: 'asc' }
            },
            stops: {
              select: {
                id: true,
                name: true,
                startAt: true,
                endAt: true,
                club: {
                  select: {
                    name: true,
                    city: true,
                    region: true
                  }
                }
              },
              orderBy: { startAt: 'asc' }
            },
            _count: {
              select: {
                registrations: {
                  where: {
                    status: 'REGISTERED'
                  }
                }
              }
            }
          }
        });

        // Format the response to match what the frontend expects
        return tournaments.map((tournament: any) => {
      // Calculate start and end dates from stops
      const startDate = tournament.stops.length > 0 ? tournament.stops[0].startAt : null;
      const endDate = tournament.stops.length > 0 
        ? tournament.stops[tournament.stops.length - 1].endAt || tournament.stops[tournament.stops.length - 1].startAt
        : null;
      
      // Get location from first stop's club details if available
      const location = tournament.stops.length > 0
        ? formatLocation(tournament.stops[0].club)
        : null;
      
      return {
        id: tournament.id,
        name: tournament.name,
        type: tournament.type,
        createdAt: tournament.createdAt,
        startDate,
        endDate,
        location,
        // Registration settings
        registrationStatus: tournament.registrationStatus,
        registrationType: tournament.registrationType,
        registrationCost: tournament.registrationCost,
        maxPlayers: tournament.maxPlayers,
        restrictionNotes: tournament.restrictionNotes,
        isWaitlistEnabled: tournament.isWaitlistEnabled,
        registeredCount: tournament._count.registrations,
        brackets: tournament.brackets,
        stops: tournament.stops.map((stop: any) => ({
          id: stop.id,
          name: stop.name,
          startAt: stop.startAt,
          endAt: stop.endAt,
          locationName: formatLocation(stop.club)
        }))
      };
        });
      },
      CACHE_TTL.TOURNAMENTS
    );

    return NextResponse.json({
      tournaments: formattedTournaments
    });
  } catch (error) {
    console.error('Error fetching tournaments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tournaments' },
      { status: 500 }
    );
  }
}
