import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Test with explicit null handling for club
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
            clubId: true,
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
    
    console.log('Tournaments with null club handling successful:', tournaments.length);
    
    return NextResponse.json({
      success: true,
      tournamentCount: tournaments.length,
      stopsWithClubs: tournaments[0]?.stops.filter(stop => stop.club).length || 0,
      stopsWithoutClubs: tournaments[0]?.stops.filter(stop => !stop.club).length || 0
    });
  } catch (error) {
    console.error('Tournaments null club test error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      details: error.toString()
    }, { status: 500 });
  }
}
