import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/player/invites
 * Get all tournament invites for the authenticated player
 */
export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get player profile
    const player = await prisma.player.findUnique({
      where: { clerkUserId: userId },
      select: { id: true },
    });

    if (!player) {
      return NextResponse.json({ error: 'Player profile not found' }, { status: 404 });
    }

    // Get invites
    const invites = await prisma.tournamentInvite.findMany({
      where: {
        playerId: player.id,
      },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            registrationType: true,
            registrationCost: true,
            stops: {
              take: 1,
              orderBy: { startAt: 'asc' },
              select: {
                startAt: true,
                endAt: true,
                club: {
                  select: { name: true, city: true, region: true },
                },
              },
            },
          },
        },
        invitedByPlayer: {
          select: {
            name: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' }, // PENDING first
        { createdAt: 'desc' },
      ],
    });

    // Check for expired invites and update them
    const now = new Date();
    const expiredInviteIds = invites
      .filter(invite => invite.status === 'PENDING' && invite.expiresAt < now)
      .map(invite => invite.id);

    if (expiredInviteIds.length > 0) {
      await prisma.tournamentInvite.updateMany({
        where: { id: { in: expiredInviteIds } },
        data: { status: 'EXPIRED' },
      });
    }

    // Format response
    const formattedInvites = invites.map((invite) => {
      const firstStop = invite.tournament.stops[0];
      const location = firstStop?.club
        ? [firstStop.club.name, firstStop.club.city, firstStop.club.region]
            .filter(Boolean)
            .join(', ')
        : null;

      const invitedByName =
        invite.invitedByPlayer.name ||
        (invite.invitedByPlayer.firstName && invite.invitedByPlayer.lastName
          ? `${invite.invitedByPlayer.firstName} ${invite.invitedByPlayer.lastName}`
          : 'Tournament Admin');

      const isExpired = invite.status === 'PENDING' && invite.expiresAt < now;

      return {
        id: invite.id,
        tournamentId: invite.tournament.id,
        tournamentName: invite.tournament.name,
        startDate: firstStop?.startAt || null,
        endDate: firstStop?.endAt || null,
        location,
        registrationType: invite.tournament.registrationType,
        cost: invite.tournament.registrationCost,
        status: isExpired ? 'EXPIRED' : invite.status,
        invitedBy: invitedByName,
        createdAt: invite.createdAt,
        expiresAt: invite.expiresAt,
        respondedAt: invite.respondedAt,
        notes: invite.notes,
      };
    });

    return NextResponse.json({
      invites: formattedInvites,
      pending: formattedInvites.filter(i => i.status === 'PENDING').length,
      total: formattedInvites.length,
    });
  } catch (error) {
    console.error('Error fetching invites:', error);
    return NextResponse.json({ error: 'Failed to fetch invites' }, { status: 500 });
  }
}
