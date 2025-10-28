import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST - Accept a tournament invitation
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { inviteId } = await params;

    // Get the current player
    const currentPlayer = await prisma.player.findUnique({
      where: { clerkUserId: userId },
      select: { id: true, email: true },
    });

    if (!currentPlayer) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Find the invitation
    const invitation = await prisma.tournamentInvite.findUnique({
      where: { id: inviteId },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Verify this invitation belongs to the current player
    const isForThisPlayer =
      invitation.playerId === currentPlayer.id ||
      invitation.inviteEmail === currentPlayer.email;

    if (!isForThisPlayer) {
      return NextResponse.json(
        { error: 'This invitation is not for you' },
        { status: 403 }
      );
    }

    // Check if invitation is still valid
    if (invitation.status !== 'PENDING') {
      return NextResponse.json(
        { error: `This invitation has already been ${invitation.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    // Check if invitation has expired
    if (invitation.expiresAt < new Date()) {
      await prisma.tournamentInvite.update({
        where: { id: inviteId },
        data: { status: 'EXPIRED' },
      });
      return NextResponse.json(
        { error: 'This invitation has expired' },
        { status: 400 }
      );
    }

    // Update the invitation status
    await prisma.tournamentInvite.update({
      where: { id: inviteId },
      data: {
        status: 'ACCEPTED',
        respondedAt: new Date(),
        acceptedAt: new Date(),
        // Link the invitation to the player if it was an email invite
        playerId: currentPlayer.id,
      },
    });

    return NextResponse.json({
      message: 'Invitation accepted successfully',
      tournamentId: invitation.tournament.id,
      tournamentName: invitation.tournament.name,
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 }
    );
  }
}
