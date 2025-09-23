import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
        }
      }
    });

    // Format the response to match what the frontend expects
    const formattedTournaments = tournaments.map((tournament: any) => {
      // Calculate start and end dates from stops
      const startDate = tournament.stops.length > 0 ? tournament.stops[0].startAt : null;
      const endDate = tournament.stops.length > 0 
        ? tournament.stops[tournament.stops.length - 1].endAt || tournament.stops[tournament.stops.length - 1].startAt
        : null;
      
      // Get location from first stop
      const location = tournament.stops.length > 0 && tournament.stops[0].locationName 
        ? tournament.stops[0].locationName 
        : null;
      
      return {
        id: tournament.id,
        name: tournament.name,
        type: tournament.type,
        createdAt: tournament.createdAt,
        startDate,
        endDate,
        location,
        brackets: tournament.brackets,
        stops: tournament.stops.map((stop: any) => ({
          id: stop.id,
          name: stop.name,
          startAt: stop.startAt,
          endAt: stop.endAt,
          locationName: stop.club ? `${stop.club.name}${stop.club.city ? `, ${stop.club.city}` : ''}${stop.club.region ? `, ${stop.club.region}` : ''}` : null
        }))
      };
    });

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