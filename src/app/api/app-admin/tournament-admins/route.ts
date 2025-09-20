import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const { tournamentId, playerId } = body;

    if (!tournamentId || !playerId) {
      return NextResponse.json({ error: 'tournamentId and playerId required' }, { status: 400 });
    }

    // Create tournament admin link
    const tournamentAdmin = await prisma.tournamentAdmin.create({
      data: {
        tournamentId,
        playerId
      },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        tournament: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            updatedAt: true
          }
        }
      }
    });

    return NextResponse.json(tournamentAdmin);

  } catch (error) {
    console.error('Error creating tournament admin:', error);
    return NextResponse.json(
      { error: 'Failed to create tournament admin' },
      { status: 500 }
    );
  }
}