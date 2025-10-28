import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET - List all invitations for a tournament
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { tournamentId } = await params;

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

    // Fetch all invitations for the tournament
    const invitations = await prisma.tournamentInvite.findMany({
      where: { tournamentId },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
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
      orderBy: { createdAt: 'desc' },
    });

    // Format the response
    const formattedInvitations = invitations.map((invite) => ({
      id: invite.id,
      playerId: invite.playerId,
      playerName: invite.player
        ? invite.player.name || `${invite.player.firstName} ${invite.player.lastName}`
        : null,
      inviteEmail: invite.inviteEmail,
      inviteName: invite.inviteName,
      status: invite.status,
      invitedBy: invite.invitedBy,
      invitedByName: invite.invitedByPlayer.name ||
        `${invite.invitedByPlayer.firstName} ${invite.invitedByPlayer.lastName}`,
      createdAt: invite.createdAt.toISOString(),
      expiresAt: invite.expiresAt.toISOString(),
      respondedAt: invite.respondedAt?.toISOString() || null,
      notes: invite.notes,
    }));

    return NextResponse.json(formattedInvitations);
  } catch (error) {
    console.error('Error fetching tournament invitations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
      { status: 500 }
    );
  }
}

// POST - Create a new invitation
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { tournamentId } = await params;
    const body = await req.json();

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

    // Validate required fields
    const { playerId, inviteEmail, inviteName, expiryDays, notes } = body;

    if (!playerId && (!inviteEmail || !inviteName)) {
      return NextResponse.json(
        { error: 'Either playerId or both inviteEmail and inviteName are required' },
        { status: 400 }
      );
    }

    // Check if invitation already exists
    const existingInvite = await prisma.tournamentInvite.findFirst({
      where: {
        tournamentId,
        ...(playerId ? { playerId } : { inviteEmail }),
        status: 'PENDING',
      },
    });

    if (existingInvite) {
      return NextResponse.json(
        { error: 'An active invitation already exists for this player/email' },
        { status: 409 }
      );
    }

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expiryDays || 7));

    // Generate invite token for email invites
    const inviteToken = !playerId ? crypto.randomUUID() : null;

    // Create the invitation
    const invitation = await prisma.tournamentInvite.create({
      data: {
        tournamentId,
        playerId: playerId || null,
        inviteEmail: inviteEmail || null,
        inviteName: inviteName || null,
        inviteToken,
        invitedBy: currentPlayer.id,
        expiresAt,
        notes: notes || null,
      },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            email: true,
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
        console.error('Failed to send invitation email:', error);
        // Don't fail the request if email fails - invitation is still created
      }
    }

    return NextResponse.json(
      {
        id: invitation.id,
        message: 'Invitation sent successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating tournament invitation:', error);
    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 }
    );
  }
}
