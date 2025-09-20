import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Test the exact query from tournaments route
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
    
    console.log('Full tournaments query successful:', tournaments.length);
    
    return NextResponse.json({
      success: true,
      tournamentCount: tournaments.length,
      firstTournament: tournaments[0] ? {
        id: tournaments[0].id,
        name: tournaments[0].name,
        bracketsCount: tournaments[0].brackets.length,
        stopsCount: tournaments[0].stops.length
      } : null
    });
  } catch (error) {
    console.error('Tournaments club test error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      details: error.toString()
    }, { status: 500 });
  }
}
