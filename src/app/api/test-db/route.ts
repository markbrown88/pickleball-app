import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('Testing database connection in API route...');
    
    // Test basic connection
    const playerCount = await prisma.player.count();
    console.log(`Found ${playerCount} players`);
    
    // Test tournaments
    const tournamentCount = await prisma.tournament.count();
    console.log(`Found ${tournamentCount} tournaments`);
    
    // Test a simple tournament query
    const tournaments = await prisma.tournament.findMany({
      take: 3,
      select: {
        id: true,
        name: true,
        createdAt: true
      }
    });
    
    return NextResponse.json({
      success: true,
      playerCount,
      tournamentCount,
      tournaments
    });
  } catch (error) {
    console.error('Database test error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      details: error.toString()
    }, { status: 500 });
  }
}