import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ adminId: string }> }) {
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

    const { adminId } = await params;
    
    // Parse the composite key (tournamentId-playerId)
    const [tournamentId, playerId] = adminId.split('-');
    
    if (!tournamentId || !playerId) {
      return NextResponse.json({ error: 'Invalid admin ID format' }, { status: 400 });
    }

    // Delete the tournament admin link
    await prisma.tournamentAdmin.deleteMany({
      where: {
        tournamentId,
        playerId
      }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error removing tournament admin:', error);
    return NextResponse.json(
      { error: 'Failed to remove tournament admin' },
      { status: 500 }
    );
  }
}
