import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Test basic tournaments query with simple include
    const tournaments = await prisma.tournament.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        brackets: true,
        stops: true
      }
    });
    
    console.log('Basic tournaments query successful:', tournaments.length);
    
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
    console.error('Basic tournaments test error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      details: error.toString()
    }, { status: 500 });
  }
}
