import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/tournaments
 * Get all tournaments with their brackets and stops for public viewing
 */
export async function GET(req: NextRequest) {
  try {
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
    const formattedTournaments = tournaments.map((tournament: any) => ({
      id: tournament.id,
      name: tournament.name,
      type: tournament.type,
      createdAt: tournament.createdAt,
      brackets: tournament.brackets,
      stops: tournament.stops.map((stop: any) => ({
        id: stop.id,
        name: stop.name,
        startAt: stop.startAt,
        endAt: stop.endAt,
        locationName: stop.club ? `${stop.club.name}${stop.club.city ? `, ${stop.club.city}` : ''}${stop.club.region ? `, ${stop.club.region}` : ''}` : null
      }))
    }));

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