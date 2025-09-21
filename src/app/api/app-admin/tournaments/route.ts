import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if user is App Admin
    const currentPlayer = await prisma.player.findUnique({
      where: { clerkUserId: userId },
      select: { isAppAdmin: true }
    });

    if (!currentPlayer?.isAppAdmin) {
      return NextResponse.json({ error: 'Access denied. App Admin required.' }, { status: 403 });
    }

    // Get all tournaments with their admins, stops, and stats
    const tournaments = await prisma.tournament.findMany({
      include: {
        admins: {
          include: {
            player: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        },
        stops: {
          select: {
            startAt: true,
            endAt: true
          },
          orderBy: {
            startAt: 'asc'
          }
        },
        _count: {
          select: {
            teams: true,
            stops: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calculate start and end dates for each tournament
    const tournamentsWithDates = tournaments.map(tournament => {
      const startDate = tournament.stops.length > 0 ? tournament.stops[0].startAt : null;
      const endDate = tournament.stops.length > 0 
        ? tournament.stops[tournament.stops.length - 1].endAt || tournament.stops[tournament.stops.length - 1].startAt
        : null;
      
      // Calculate status based on dates
      let status = 'Draft'; // Default status
      if (startDate && endDate) {
        const today = new Date();
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (today < start) {
          status = 'Upcoming';
        } else if (today >= start && today <= end) {
          status = 'In Progress';
        } else if (today > end) {
          status = 'Complete';
        }
      } else if (startDate) {
        const today = new Date();
        const start = new Date(startDate);
        
        if (today < start) {
          status = 'Upcoming';
        } else {
          status = 'In Progress';
        }
      }
      
      return {
        ...tournament,
        startDate,
        endDate,
        status
      };
    });

    return NextResponse.json({ tournaments: tournamentsWithDates });
  } catch (error) {
    console.error('Error fetching tournaments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tournaments' },
      { status: 500 }
    );
  }
}
