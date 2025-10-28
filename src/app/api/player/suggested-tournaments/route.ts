import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET - Fetch suggested tournaments for a new player
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get the current player
    const currentPlayer = await prisma.player.findUnique({
      where: { clerkUserId: userId },
      select: {
        id: true,
        email: true,
        clubId: true,
      },
    });

    if (!currentPlayer) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const now = new Date();

    // Build where clause for tournament suggestions
    const where: any = {
      // Only show tournaments that haven't ended yet
      OR: [
        { endDate: { gte: now } },
        { endDate: null },
      ],
      // Only show active tournaments
      status: 'ACTIVE',
    };

    // If player has a club, prioritize tournaments from their club
    if (currentPlayer.clubId) {
      where.clubId = currentPlayer.clubId;
    }

    // Fetch suggested tournaments
    const tournaments = await prisma.tournament.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        startDate: true,
        endDate: true,
        registrationDeadline: true,
        registrationOpens: true,
        status: true,
        club: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            registrations: true,
          },
        },
      },
      orderBy: [
        { startDate: 'asc' },
        { createdAt: 'desc' },
      ],
      take: 10, // Limit to 10 suggestions
    });

    // Check if player has any pending invitations
    const pendingInvitations = await prisma.tournamentInvite.findMany({
      where: {
        OR: [
          { playerId: currentPlayer.id },
          { inviteEmail: currentPlayer.email || undefined },
        ],
        status: 'PENDING',
        expiresAt: { gte: now },
      },
      select: {
        id: true,
        tournamentId: true,
        tournament: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            club: {
              select: {
                id: true,
                name: true,
              },
            },
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
        notes: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Check which tournaments the player is already registered for
    const existingRegistrations = await prisma.tournamentRegistration.findMany({
      where: { playerId: currentPlayer.id },
      select: { tournamentId: true },
    });

    const registeredTournamentIds = new Set(
      existingRegistrations.map((r) => r.tournamentId)
    );

    // Filter out tournaments the player is already registered for
    const availableTournaments = tournaments.filter(
      (t) => !registeredTournamentIds.has(t.id)
    );

    // Format the response
    const formattedTournaments = availableTournaments.map((tournament) => {
      const registrationOpen =
        tournament.registrationOpens &&
        new Date(tournament.registrationOpens) <= now;

      const registrationClosed =
        tournament.registrationDeadline &&
        new Date(tournament.registrationDeadline) < now;

      return {
        id: tournament.id,
        name: tournament.name,
        description: tournament.description,
        startDate: tournament.startDate?.toISOString() || null,
        endDate: tournament.endDate?.toISOString() || null,
        registrationDeadline: tournament.registrationDeadline?.toISOString() || null,
        registrationOpen,
        registrationClosed,
        clubName: tournament.club?.name || null,
        registrationCount: tournament._count.registrations,
      };
    });

    const formattedInvitations = pendingInvitations.map((invite) => {
      const inviterName =
        invite.invitedByPlayer.name ||
        `${invite.invitedByPlayer.firstName} ${invite.invitedByPlayer.lastName}`.trim() ||
        'Tournament Admin';

      return {
        id: invite.id,
        tournamentId: invite.tournament.id,
        tournamentName: invite.tournament.name,
        tournamentStartDate: invite.tournament.startDate?.toISOString() || null,
        tournamentEndDate: invite.tournament.endDate?.toISOString() || null,
        clubName: invite.tournament.club?.name || null,
        invitedBy: inviterName,
        notes: invite.notes,
        expiresAt: invite.expiresAt.toISOString(),
      };
    });

    return NextResponse.json({
      tournaments: formattedTournaments,
      invitations: formattedInvitations,
    });
  } catch (error) {
    console.error('Error fetching suggested tournaments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tournament suggestions' },
      { status: 500 }
    );
  }
}
