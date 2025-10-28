import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST - Cancel an invitation
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string; inviteId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { tournamentId, inviteId } = await params;

    // Check for act-as-player-id cookie
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const actAsPlayerId = cookieStore.get('act-as-player-id')?.value;

    let currentPlayer;
    if (actAsPlayerId) {
      currentPlayer = await prisma.player.findUnique({
        where: { id: actAsPlayerId },
        select: {
          id: true,
          isAppAdmin: true,
          tournamentAdminLinks: {
            where: { tournamentId },
            select: { tournamentId: true },
          },
          TournamentEventManager: {
            where: { tournamentId },
            select: { tournamentId: true },
          },
        },
      });
    } else {
      currentPlayer = await prisma.player.findUnique({
        where: { clerkUserId: userId },
        select: {
          id: true,
          isAppAdmin: true,
          tournamentAdminLinks: {
            where: { tournamentId },
            select: { tournamentId: true },
          },
          TournamentEventManager: {
            where: { tournamentId },
            select: { tournamentId: true },
          },
        },
      });
    }

    if (!currentPlayer) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Check if user is Tournament Admin for this tournament or App Admin
    const isTournamentAdmin =
      currentPlayer.tournamentAdminLinks.length > 0 ||
      currentPlayer.TournamentEventManager.length > 0;

    if (!currentPlayer.isAppAdmin && !isTournamentAdmin) {
      return NextResponse.json(
        { error: 'Access denied. Tournament Admin access required.' },
        { status: 403 }
      );
    }

    // Find the invitation
    const invitation = await prisma.tournamentInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    if (invitation.tournamentId !== tournamentId) {
      return NextResponse.json({ error: 'Invalid invitation' }, { status: 400 });
    }

    if (invitation.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Only pending invitations can be cancelled' },
        { status: 400 }
      );
    }

    // Update the invitation status to CANCELLED
    await prisma.tournamentInvite.update({
      where: { id: inviteId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    return NextResponse.json({ message: 'Invitation cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling invitation:', error);
    return NextResponse.json(
      { error: 'Failed to cancel invitation' },
      { status: 500 }
    );
  }
}
