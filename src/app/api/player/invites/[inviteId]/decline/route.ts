import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/player/invites/[inviteId]/decline
 * Decline a tournament invite
 */
export async function POST(
  req: Request,
  props: { params: Promise<{ inviteId: string }> }
) {
  try {
    const { userId} = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { inviteId } = await props.params;

    // Get player profile
    const player = await prisma.player.findUnique({
      where: { clerkUserId: userId },
      select: { id: true },
    });

    if (!player) {
      return NextResponse.json({ error: 'Player profile not found' }, { status: 404 });
    }

    // Get invite
    const invite = await prisma.tournamentInvite.findUnique({
      where: { id: inviteId },
      select: {
        id: true,
        tournamentId: true,
        playerId: true,
        status: true,
        expiresAt: true,
      },
    });

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    // Verify invite belongs to this player
    if (invite.playerId !== player.id) {
      return NextResponse.json(
        { error: 'This invite does not belong to you' },
        { status: 403 }
      );
    }

    // Check if invite is still valid
    if (invite.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Invite is already ${invite.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    // Update invite to declined
    await prisma.tournamentInvite.update({
      where: { id: inviteId },
      data: {
        status: 'DECLINED',
        declinedAt: new Date(),
        respondedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Invite declined successfully',
    });
  } catch (error) {
    console.error('Error declining invite:', error);
    return NextResponse.json({ error: 'Failed to decline invite' }, { status: 500 });
  }
}
