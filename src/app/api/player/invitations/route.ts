import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET - List all invitations for the authenticated player
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get the current player
    const currentPlayer = await prisma.player.findUnique({
      where: { clerkUserId: userId },
      select: { id: true, email: true },
    });

    if (!currentPlayer) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Fetch invitations for this player (by playerId or by email)
    const invitations = await prisma.tournamentInvite.findMany({
      where: {
        OR: [
          { playerId: currentPlayer.id },
          { inviteEmail: currentPlayer.email || undefined },
        ],
      },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
          },
        },
        invitedByPlayer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Check for expired invitations and update them
    const now = new Date();
    const expiredInvites = invitations.filter(
      (inv) => inv.status === 'PENDING' && inv.expiresAt < now
    );

    if (expiredInvites.length > 0) {
      await prisma.tournamentInvite.updateMany({
        where: {
          id: { in: expiredInvites.map((inv) => inv.id) },
        },
        data: { status: 'EXPIRED' },
      });
    }

    // Format the response
    const formattedInvitations = invitations.map((invite) => {
      const isExpired = invite.status === 'PENDING' && invite.expiresAt < now;

      return {
        id: invite.id,
        tournamentId: invite.tournament.id,
        tournamentName: invite.tournament.name,
        tournamentStartDate: invite.tournament.startDate?.toISOString() || null,
        tournamentEndDate: invite.tournament.endDate?.toISOString() || null,
        status: isExpired ? 'EXPIRED' : invite.status,
        invitedBy: invite.invitedByPlayer.name ||
          `${invite.invitedByPlayer.firstName} ${invite.invitedByPlayer.lastName}`.trim() ||
          'Tournament Admin',
        createdAt: invite.createdAt.toISOString(),
        expiresAt: invite.expiresAt.toISOString(),
        respondedAt: invite.respondedAt?.toISOString() || null,
        notes: invite.notes,
      };
    });

    return NextResponse.json(formattedInvitations);
  } catch (error) {
    console.error('Error fetching player invitations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
      { status: 500 }
    );
  }
}
