import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type CtxPromise = Promise<{ params: { tournamentId: string } }>;

/**
 * POST /api/player/tournaments/[tournamentId]/claim-waitlist-spot
 * Claim a waitlist spot and register for the tournament
 */
export async function POST(req: Request, ctx: CtxPromise) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tournamentId } = await ctx.params;

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

    // Get waitlist entry
    const waitlistEntry = await prisma.tournamentWaitlist.findUnique({
      where: {
        tournamentId_playerId: {
          tournamentId,
          playerId: player.id,
        },
      },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            registrationType: true,
            registrationCost: true,
            maxPlayers: true,
          },
        },
      },
    });

    if (!waitlistEntry) {
      return NextResponse.json({ error: 'Waitlist entry not found' }, { status: 404 });
    }

    // Check if notification has expired
    if (
      waitlistEntry.status !== 'NOTIFIED' ||
      !waitlistEntry.notificationExpiresAt ||
      new Date() > waitlistEntry.notificationExpiresAt
    ) {
      return NextResponse.json(
        { error: 'This waitlist notification has expired' },
        { status: 400 }
      );
    }

    // Check if player is already registered
    const existingRegistration = await prisma.tournamentRegistration.findUnique({
      where: {
        tournamentId_playerId: {
          tournamentId,
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
    if (waitlistEntry.tournament.maxPlayers) {
      const registeredCount = await prisma.tournamentRegistration.count({
        where: {
          tournamentId,
          status: 'REGISTERED',
        },
      });

      if (registeredCount >= waitlistEntry.tournament.maxPlayers) {
        return NextResponse.json(
          { error: 'Tournament is at maximum capacity' },
          { status: 400 }
        );
      }
    }

    // Create registration
    const registration = await prisma.tournamentRegistration.create({
      data: {
        tournamentId,
        playerId: player.id,
        status: 'REGISTERED',
        paymentStatus:
          waitlistEntry.tournament.registrationType === 'FREE' ? 'PAID' : 'PENDING',
        amountPaid: waitlistEntry.tournament.registrationType === 'FREE' ? 0 : null,
      },
    });

    // Update waitlist status to REGISTERED
    await prisma.tournamentWaitlist.update({
      where: { id: waitlistEntry.id },
      data: {
        status: 'REGISTERED',
        movedToRegisteredAt: new Date(),
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

        // Get tournament details for email
        const tournamentDetails = await prisma.tournament.findUnique({
          where: { id: tournamentId },
          include: {
            stops: {
              take: 1,
              orderBy: { startAt: 'asc' },
              select: {
                startAt: true,
                endAt: true,
                club: { select: { name: true, city: true, region: true } },
              },
            },
          },
        });

        if (tournamentDetails) {
          const firstStop = tournamentDetails.stops[0];
          const location = firstStop?.club
            ? [firstStop.club.name, firstStop.club.city, firstStop.club.region]
                .filter(Boolean)
                .join(', ')
            : null;

          await sendRegistrationConfirmationEmail({
            to: player.email,
            playerName,
            tournamentName: waitlistEntry.tournament.name,
            tournamentId,
            startDate: firstStop?.startAt || null,
            endDate: firstStop?.endAt || null,
            location,
            isPaid: waitlistEntry.tournament.registrationType === 'FREE',
            amountPaid: waitlistEntry.tournament.registrationType === 'FREE' ? 0 : null,
            registrationDate: registration.registeredAt,
          });
        }
      } catch (emailError) {
        console.error('Failed to send registration confirmation email:', emailError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully claimed waitlist spot and registered!',
      registration: {
        id: registration.id,
        tournamentId,
        tournamentName: waitlistEntry.tournament.name,
        status: registration.status,
        paymentStatus: registration.paymentStatus,
        registeredAt: registration.registeredAt,
        requiresPayment: waitlistEntry.tournament.registrationType === 'PAID',
        amount: waitlistEntry.tournament.registrationCost,
      },
    });
  } catch (error) {
    console.error('Error claiming waitlist spot:', error);
    return NextResponse.json(
      { error: 'Failed to claim waitlist spot' },
      { status: 500 }
    );
  }
}
