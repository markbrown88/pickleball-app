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
        paymentStatus: tournament.registrationType === 'FREE' ? 'COMPLETED' : 'PENDING',
        amountPaid: tournament.registrationType === 'FREE' ? 0 : null,
      },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        registeredAt: true,
      },
    });

    // TODO: Send confirmation email
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
      select: { id: true },
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

    // Update registration to withdrawn
    await prisma.tournamentRegistration.update({
      where: { id: registration.id },
      data: {
        status: 'WITHDRAWN',
        withdrawnAt: new Date(),
      },
    });

    // TODO: Process refund if paid
    // TODO: Send withdrawal confirmation email
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
