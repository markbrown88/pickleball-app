import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export async function GET() {
  try {
    // Test with simplified URL (remove pgbouncer parameter)
    const simplifiedUrl = process.env.DATABASE_URL?.replace('&pgbouncer=true', '');
    
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: simplifiedUrl,
        },
      },
    });
    
    const playerCount = await prisma.player.count();
    console.log(`Found ${playerCount} players with simplified URL`);
    
    await prisma.$disconnect();
    
    return NextResponse.json({
      success: true,
      playerCount,
      usedUrl: simplifiedUrl?.substring(0, 50) + '...'
    });
  } catch (error) {
    console.error('Database test error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      originalUrl: process.env.DATABASE_URL?.substring(0, 50) + '...'
    }, { status: 500 });
  }
}
