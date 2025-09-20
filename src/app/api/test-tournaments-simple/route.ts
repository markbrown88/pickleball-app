import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Test simple tournament query first
    const tournaments = await prisma.tournament.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        createdAt: true
      }
    });
    
    console.log('Simple tournaments query successful:', tournaments.length);
    
    // Test with brackets include
    const tournamentsWithBrackets = await prisma.tournament.findMany({
      select: {
        id: true,
        name: true,
        brackets: {
          select: {
            id: true,
            name: true,
            idx: true
          }
        }
      }
    });
    
    console.log('Tournaments with brackets query successful:', tournamentsWithBrackets.length);
    
    // Test with stops include
    const tournamentsWithStops = await prisma.tournament.findMany({
      select: {
        id: true,
        name: true,
        stops: {
          select: {
            id: true,
            name: true,
            startAt: true,
            endAt: true
          }
        }
      }
    });
    
    console.log('Tournaments with stops query successful:', tournamentsWithStops.length);
    
    return NextResponse.json({
      success: true,
      simpleCount: tournaments.length,
      withBracketsCount: tournamentsWithBrackets.length,
      withStopsCount: tournamentsWithStops.length
    });
  } catch (error) {
    console.error('Tournaments test error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      details: error.toString()
    }, { status: 500 });
  }
}
