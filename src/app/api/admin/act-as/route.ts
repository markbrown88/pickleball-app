import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get the player record for the authenticated user
    const currentPlayer = await prisma.player.findUnique({
      where: { clerkUserId: userId },
      select: { id: true, isAppAdmin: true }
    });

    if (!currentPlayer) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Check if user is App Admin
    if (!currentPlayer.isAppAdmin) {
      return NextResponse.json({ error: 'Access denied. App Admin required.' }, { status: 403 });
    }

    // Get all players for the "Act As" dropdown
    const players = await prisma.player.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isAppAdmin: true
      },
      orderBy: [
        { isAppAdmin: 'desc' },
        { lastName: 'asc' },
        { firstName: 'asc' }
      ]
    });

    return NextResponse.json({ players });

  } catch (error) {
    console.error('Error fetching players for act-as:', error);
    return NextResponse.json(
      { error: 'Failed to fetch players' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get the player record for the authenticated user
    const currentPlayer = await prisma.player.findUnique({
      where: { clerkUserId: userId },
      select: { id: true, isAppAdmin: true }
    });

    if (!currentPlayer) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Check if user is App Admin
    if (!currentPlayer.isAppAdmin) {
      return NextResponse.json({ error: 'Access denied. App Admin required.' }, { status: 403 });
    }

    const body = await req.json();
    const { targetPlayerId } = body;

    if (!targetPlayerId) {
      return NextResponse.json({ error: 'targetPlayerId required' }, { status: 400 });
    }

    // Get the target player's information
    const targetPlayer = await prisma.player.findUnique({
      where: { id: targetPlayerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isAppAdmin: true,
        club: {
          select: {
            id: true,
            name: true,
            city: true
          }
        }
      }
    });

    if (!targetPlayer) {
      return NextResponse.json({ error: 'Target player not found' }, { status: 404 });
    }

    // Return the target player's information for impersonation
    return NextResponse.json({
      success: true,
      targetPlayer,
      message: `Now acting as ${targetPlayer.firstName} ${targetPlayer.lastName}`
    });

  } catch (error) {
    console.error('Error in act-as:', error);
    return NextResponse.json(
      { error: 'Failed to act as player' },
      { status: 500 }
    );
  }
}

