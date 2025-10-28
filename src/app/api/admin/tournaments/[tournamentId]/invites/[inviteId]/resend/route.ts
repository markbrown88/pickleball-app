import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST - Resend an invitation
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
      include: {
        player: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            name: true,
          },
        },
        tournament: {
          select: {
            id: true,
            name: true,
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
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    if (invitation.tournamentId !== tournamentId) {
      return NextResponse.json({ error: 'Invalid invitation' }, { status: 400 });
    }

    if (invitation.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Only pending invitations can be resent' },
        { status: 400 }
      );
    }

    // Send invitation email
    const recipientEmail = invitation.player?.email || invitation.inviteEmail;
    const recipientName =
      invitation.player?.name ||
      invitation.player?.firstName ||
      invitation.inviteName ||
      'there';

    const invitedByName =
      invitation.invitedByPlayer.name ||
      `${invitation.invitedByPlayer.firstName} ${invitation.invitedByPlayer.lastName}`.trim() ||
      'A tournament organizer';

    if (recipientEmail) {
      const { sendTournamentInviteEmail } = await import('@/server/email');

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3010';
      const registrationLink = `${baseUrl}/tournament/${invitation.tournament.id}`;
      const signupLink = invitation.inviteToken
        ? `${baseUrl}/signup?invite=${invitation.inviteToken}`
        : undefined;

      try {
        await sendTournamentInviteEmail({
          to: recipientEmail,
          recipientName,
          tournamentName: invitation.tournament.name,
          invitedByName,
          expiresAt: invitation.expiresAt,
          registrationLink,
          signupLink,
          notes: invitation.notes || undefined,
        });
      } catch (error) {
        console.error('Failed to resend invitation email:', error);
        return NextResponse.json(
          { error: 'Failed to resend invitation email' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ message: 'Invitation resent successfully' });
  } catch (error) {
    console.error('Error resending invitation:', error);
    return NextResponse.json(
      { error: 'Failed to resend invitation' },
      { status: 500 }
    );
  }
}
