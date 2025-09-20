import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Test stops directly
    const stops = await prisma.stop.findMany({
      select: {
        id: true,
        name: true,
        clubId: true,
        club: {
          select: {
            id: true,
            name: true,
            city: true,
            region: true
          }
        }
      },
      take: 5
    });
    
    console.log('Stops query successful:', stops.length);
    
    return NextResponse.json({
      success: true,
      stopCount: stops.length,
      stops: stops.map(stop => ({
        id: stop.id,
        name: stop.name,
        clubId: stop.clubId,
        hasClub: !!stop.club,
        clubName: stop.club?.name || null
      }))
    });
  } catch (error) {
    console.error('Stops test error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      details: error.toString()
    }, { status: 500 });
  }
}
