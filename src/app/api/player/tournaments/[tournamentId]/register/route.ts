export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

type CtxPromise = { params: Promise<{ tournamentId: string }> };

/**
 * POST /api/player/tournaments/[tournamentId]/register
 * Register the current player for a tournament
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
      select: { id: true },
    });

    if (!player) {
      return NextResponse.json({ error: 'Player profile not found' }, { status: 404 });
    }

    // Get tournament with registration settings
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        name: true,
        registrationStatus: true,
        registrationType: true,
        registrationCost: true,
        maxPlayers: true,
        isWaitlistEnabled: true,
        _count: {
          select: {
            registrations: {
              where: {
                status: 'REGISTERED',
              },
            },
          },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Check if registration is open
    if (tournament.registrationStatus !== 'OPEN') {
      return NextResponse.json(
        { error: 'This tournament is not open for registration' },
        { status: 400 }
      );
    }

    // Check if already registered
    const existingRegistration = await prisma.tournamentRegistration.findUnique({
      where: {
        tournamentId_playerId: {
          tournamentId: tournament.id,
          playerId: player.id,
        },
      },
    });

    if (existingRegistration) {
      return NextResponse.json(
        { error: 'You are already registered for this tournament' },
        { status: 400 }
      );
    }

    // Check if tournament is full
    const registeredCount = tournament._count.registrations;
    const isFull = tournament.maxPlayers !== null && registeredCount >= tournament.maxPlayers;

    if (isFull) {
      return NextResponse.json(
        {
          error: 'This tournament is full',
          waitlistAvailable: tournament.isWaitlistEnabled,
        },
        { status: 400 }
      );
    }

    // Create registration
    const registration = await prisma.tournamentRegistration.create({
      data: {
        tournamentId: tournament.id,
        playerId: player.id,
        status: 'REGISTERED',
        paymentStatus: tournament.registrationType === 'FREE' ? 'PAID' : 'PENDING',
        amountPaid: tournament.registrationType === 'FREE' ? 0 : null,
      },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        registeredAt: true,
      },
    });

    // Get player details for email
    const playerDetails = await prisma.player.findUnique({
      where: { id: player.id },
      select: {
        email: true,
        name: true,
        firstName: true,
        lastName: true,
      },
    });

    // Get tournament details for email
    const tournamentDetails = await prisma.tournament.findUnique({
      where: { id: tournament.id },
      include: {
        stops: {
          take: 1,
          orderBy: { startAt: 'asc' },
          select: {
            startAt: true,
            endAt: true,
            club: {
              select: {
                name: true,
                city: true,
                region: true,
              },
            },
          },
        },
      },
    });

    // Send confirmation email to player
    if (playerDetails?.email && tournamentDetails) {
      const playerName =
        playerDetails.name ||
        (playerDetails.firstName && playerDetails.lastName
          ? `${playerDetails.firstName} ${playerDetails.lastName}`
          : playerDetails.firstName || 'Player');

      const firstStop = tournamentDetails.stops[0];
      const location = firstStop?.club
        ? [firstStop.club.name, firstStop.club.city, firstStop.club.region]
            .filter(Boolean)
            .join(', ')
        : null;

      try {
        const { sendRegistrationConfirmationEmail } = await import('@/server/email');
        await sendRegistrationConfirmationEmail({
          to: playerDetails.email,
          playerName,
          tournamentName: tournament.name,
          tournamentId: tournament.id,
          startDate: firstStop?.startAt || null,
          endDate: firstStop?.endAt || null,
          location,
          isPaid: tournament.registrationType === 'FREE',
          amountPaid: tournament.registrationType === 'FREE' ? 0 : null,
          registrationDate: registration.registeredAt,
        });
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
        // Don't fail the registration if email fails
      }
    }

    // Send notification email to tournament admins
    try {
      const admins = await prisma.tournamentAdmin.findMany({
        where: { tournamentId: tournament.id },
        include: {
          player: {
            select: {
              email: true,
              name: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (admins.length > 0 && playerDetails) {
        const { sendAdminNotificationEmail } = await import('@/server/email');
        const playerName =
          playerDetails.name ||
          (playerDetails.firstName && playerDetails.lastName
            ? `${playerDetails.firstName} ${playerDetails.lastName}`
            : playerDetails.firstName || 'Player');

        for (const admin of admins) {
          if (!admin.player.email) continue;

          const adminName =
            admin.player.name ||
            (admin.player.firstName && admin.player.lastName
              ? `${admin.player.firstName} ${admin.player.lastName}`
              : admin.player.firstName || 'Admin');

          try {
            await sendAdminNotificationEmail({
              to: admin.player.email,
              adminName,
              playerName,
              playerEmail: playerDetails.email || 'N/A',
              tournamentName: tournament.name,
              tournamentId: tournament.id,
              action: 'registered',
              isPaid: tournament.registrationType === 'FREE',
              amountPaid: tournament.registrationType === 'FREE' ? 0 : null,
            });
          } catch (adminEmailError) {
            console.error(`Failed to send admin notification to ${admin.player.email}:`, adminEmailError);
          }
        }
      }
    } catch (adminError) {
      console.error('Failed to send admin notifications:', adminError);
      // Don't fail the registration if admin emails fail
    }

    // TODO: If PAID, return payment URL/info

    return NextResponse.json({
      success: true,
      registration: {
        id: registration.id,
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        status: registration.status,
        paymentStatus: registration.paymentStatus,
        registeredAt: registration.registeredAt,
        requiresPayment: tournament.registrationType === 'PAID',
        amount: tournament.registrationCost,
      },
    });
  } catch (error) {
    console.error('Error registering for tournament:', error);
    return NextResponse.json(
      { error: 'Failed to register for tournament' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/player/tournaments/[tournamentId]/register
 * Withdraw from a tournament
 */
export async function DELETE(req: Request, ctx: CtxPromise) {
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

    // Get registration
    const registration = await prisma.tournamentRegistration.findUnique({
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
          },
        },
      },
    });

    if (!registration) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    if (registration.status === 'WITHDRAWN') {
      return NextResponse.json(
        { error: 'Already withdrawn from this tournament' },
        { status: 400 }
      );
    }

    // Check if refund is needed
    const wasRefunded = registration.paymentStatus === 'PAID' && registration.amountPaid && registration.amountPaid > 0;
    const refundAmount = wasRefunded ? registration.amountPaid : null;

    // Update registration to withdrawn
    await prisma.tournamentRegistration.update({
      where: { id: registration.id },
      data: {
        status: 'WITHDRAWN',
        withdrawnAt: new Date(),
        // TODO: Update paymentStatus to REFUNDED if paid
      },
    });

    // Send withdrawal confirmation email to player
    if (player.email) {
      const playerName =
        player.name ||
        (player.firstName && player.lastName
          ? `${player.firstName} ${player.lastName}`
          : player.firstName || 'Player');

      try {
        const { sendWithdrawalConfirmationEmail } = await import('@/server/email');
        await sendWithdrawalConfirmationEmail({
          to: player.email,
          playerName,
          tournamentName: registration.tournament.name,
          tournamentId: registration.tournament.id,
          wasRefunded: wasRefunded || false,
          refundAmount,
        });
      } catch (emailError) {
        console.error('Failed to send withdrawal email:', emailError);
        // Don't fail the withdrawal if email fails
      }
    }

    // Send notification email to tournament admins
    try {
      const admins = await prisma.tournamentAdmin.findMany({
        where: { tournamentId },
        include: {
          player: {
            select: {
              email: true,
              name: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (admins.length > 0 && player.email) {
        const { sendAdminNotificationEmail } = await import('@/server/email');
        const playerName =
          player.name ||
          (player.firstName && player.lastName
            ? `${player.firstName} ${player.lastName}`
            : player.firstName || 'Player');

        for (const admin of admins) {
          if (!admin.player.email) continue;

          const adminName =
            admin.player.name ||
            (admin.player.firstName && admin.player.lastName
              ? `${admin.player.firstName} ${admin.player.lastName}`
              : admin.player.firstName || 'Admin');

          try {
            await sendAdminNotificationEmail({
              to: admin.player.email,
              adminName,
              playerName,
              playerEmail: player.email,
              tournamentName: registration.tournament.name,
              tournamentId: registration.tournament.id,
              action: 'cancelled',
              isPaid: wasRefunded || false,
              amountPaid: refundAmount,
            });
          } catch (adminEmailError) {
            console.error(`Failed to send admin notification to ${admin.player.email}:`, adminEmailError);
          }
        }
      }
    } catch (adminError) {
      console.error('Failed to send admin notifications:', adminError);
      // Don't fail the withdrawal if admin emails fail
    }

    // TODO: Process refund if paid via Stripe
    // TODO: Promote someone from waitlist if available

    return NextResponse.json({
      success: true,
      message: 'Successfully withdrawn from tournament',
    });
  } catch (error) {
    console.error('Error withdrawing from tournament:', error);
    return NextResponse.json(
      { error: 'Failed to withdraw from tournament' },
      { status: 500 }
    );
  }
}
