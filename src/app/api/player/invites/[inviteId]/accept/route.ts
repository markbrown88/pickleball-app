import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type CtxPromise = Promise<{ params: { inviteId: string } }>;

/**
 * POST /api/player/invites/[inviteId]/accept
 * Accept a tournament invite
 */
export async function POST(req: Request, ctx: CtxPromise) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { inviteId } = await ctx.params;

    // Get player profile
    const player = await prisma.player.findUnique({
      where: { clerkUserId: userId },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!player) {
      return NextResponse.json({ error: 'Player profile not found' }, { status: 404 });
    }

    // Get invite
    const invite = await prisma.tournamentInvite.findUnique({
      where: { id: inviteId },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            registrationType: true,
            registrationCost: true,
            maxPlayers: true,
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

    if (new Date() > invite.expiresAt) {
      // Mark as expired
      await prisma.tournamentInvite.update({
        where: { id: inviteId },
        data: { status: 'EXPIRED' },
      });
      return NextResponse.json({ error: 'Invite has expired' }, { status: 400 });
    }

    // Check if player is already registered
    const existingRegistration = await prisma.tournamentRegistration.findUnique({
      where: {
        tournamentId_playerId: {
          tournamentId: invite.tournamentId,
          playerId: player.id,
        },
      },
    });

    if (existingRegistration) {
      return NextResponse.json(
        { error: 'Already registered for this tournament' },
        { status: 400 }
      );
    }

    // Check tournament capacity
    if (invite.tournament.maxPlayers) {
      const registeredCount = await prisma.tournamentRegistration.count({
        where: {
          tournamentId: invite.tournamentId,
          status: 'REGISTERED',
        },
      });

      if (registeredCount >= invite.tournament.maxPlayers) {
        return NextResponse.json(
          { error: 'Tournament is at maximum capacity' },
          { status: 400 }
        );
      }
    }

    // Update invite to accepted
    await prisma.tournamentInvite.update({
      where: { id: inviteId },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        respondedAt: new Date(),
      },
    });

    // Create registration
    const registration = await prisma.tournamentRegistration.create({
      data: {
        tournamentId: invite.tournamentId,
        playerId: player.id,
        status: 'REGISTERED',
        paymentStatus: invite.tournament.registrationType === 'FREE' ? 'PAID' : 'PENDING',
        amountPaid: invite.tournament.registrationType === 'FREE' ? 0 : null,
      },
    });

    // Send confirmation email
    if (player.email) {
      const playerName =
        player.name ||
        (player.firstName && player.lastName
          ? `${player.firstName} ${player.lastName}`
          : player.firstName || 'Player');

      try {
        const { sendRegistrationConfirmationEmail } = await import('@/server/email');

        const firstStop = invite.tournament.stops[0];
        const location = firstStop?.club
          ? [firstStop.club.name, firstStop.club.city, firstStop.club.region]
              .filter(Boolean)
              .join(', ')
          : null;

        await sendRegistrationConfirmationEmail({
          to: player.email,
          playerName,
          tournamentName: invite.tournament.name,
          tournamentId: invite.tournamentId,
          startDate: firstStop?.startAt || null,
          endDate: firstStop?.endAt || null,
          location,
          isPaid: invite.tournament.registrationType === 'FREE',
          amountPaid: invite.tournament.registrationType === 'FREE' ? 0 : null,
          registrationDate: registration.registeredAt,
        });
      } catch (emailError) {
        console.error('Failed to send registration confirmation email:', emailError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Invite accepted and registered successfully!',
      registration: {
        id: registration.id,
        tournamentId: invite.tournamentId,
        tournamentName: invite.tournament.name,
        status: registration.status,
        paymentStatus: registration.paymentStatus,
        registeredAt: registration.registeredAt,
        requiresPayment: invite.tournament.registrationType === 'PAID',
        amount: invite.tournament.registrationCost,
      },
    });
  } catch (error) {
    console.error('Error accepting invite:', error);
    return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 });
  }
}
