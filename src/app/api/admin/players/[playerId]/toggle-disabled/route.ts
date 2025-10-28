import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { playerId } = await params;

    // Check for act-as-player-id cookie
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const actAsPlayerId = cookieStore.get('act-as-player-id')?.value;

    let currentPlayer;
    if (actAsPlayerId) {
      currentPlayer = await prisma.player.findUnique({
        where: { id: actAsPlayerId },
        select: { id: true, isAppAdmin: true }
      });
    } else {
      currentPlayer = await prisma.player.findUnique({
        where: { clerkUserId: userId },
        select: { id: true, isAppAdmin: true }
      });
    }

    if (!currentPlayer) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Only App Admins can disable/enable players
    if (!currentPlayer.isAppAdmin) {
      return NextResponse.json({ error: 'Access denied. App Admin required.' }, { status: 403 });
    }

    // Get the target player
    const targetPlayer = await prisma.player.findUnique({
      where: { id: playerId },
      select: { id: true, disabled: true }
    });

    if (!targetPlayer) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Toggle the disabled status
    const newDisabledStatus = !targetPlayer.disabled;

    const updatedPlayer = await prisma.player.update({
      where: { id: playerId },
      data: {
        disabled: newDisabledStatus,
        disabledAt: newDisabledStatus ? new Date() : null,
        disabledBy: newDisabledStatus ? currentPlayer.id : null
      },
      select: {
        id: true,
        disabled: true,
        disabledAt: true
      }
    });

    return NextResponse.json(updatedPlayer);

  } catch (error) {
    console.error('Error toggling player disabled status:', error);
    return NextResponse.json(
      { error: 'Failed to toggle player status' },
      { status: 500 }
    );
  }
}
