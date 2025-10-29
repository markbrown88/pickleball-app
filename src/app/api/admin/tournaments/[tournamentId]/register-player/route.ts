import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type CtxPromise = Promise<{ params: { tournamentId: string } }>;

/**
 * POST /api/admin/tournaments/[tournamentId]/register-player
 * Manually register a player for a tournament (admin only)
 * Body: { playerId: string, notes?: string }
 */
export async function POST(req: Request, ctx: CtxPromise) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tournamentId } = await ctx.params;
    const body = await req.json();
    const { playerId, notes } = body;

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID is required' }, { status: 400 });
    }

    // Verify user is admin of this tournament
    const admin = await prisma.player.findUnique({
      where: { clerkUserId: userId },
      select: { id: true },
    });

    if (!admin) {
      return NextResponse.json({ error: 'Admin profile not found' }, { status: 404 });
    }

    const isAdmin = await prisma.tournamentAdmin.findUnique({
      where: {
        tournamentId_playerId: {
          tournamentId,
          playerId: admin.id,
        },
      },
    });

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'You are not an admin of this tournament' },
        { status: 403 }
      );
    }

    // Get tournament details
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        name: true,
        registrationStatus: true,
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
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Get player details
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Check if player is already registered
    const existingRegistration = await prisma.tournamentRegistration.findUnique({
      where: {
        tournamentId_playerId: {
          tournamentId,
          playerId,
        },
      },
    });

    if (existingRegistration) {
      return NextResponse.json(
        { error: 'Player is already registered for this tournament' },
        { status: 400 }
      );
    }

    // Check tournament capacity (admins can override but warn)
    let capacityWarning = null;
    if (tournament.maxPlayers) {
      const registeredCount = await prisma.tournamentRegistration.count({
        where: {
          tournamentId,
          status: 'REGISTERED',
        },
      });

      if (registeredCount >= tournament.maxPlayers) {
        capacityWarning = `Tournament is at capacity (${registeredCount}/${tournament.maxPlayers}). Registration allowed as admin override.`;
      }
    }

    // Create registration
    const registration = await prisma.tournamentRegistration.create({
      data: {
        tournamentId,
        playerId,
        status: 'REGISTERED',
        paymentStatus: tournament.registrationType === 'FREE' ? 'PAID' : 'PENDING',
        amountPaid: tournament.registrationType === 'FREE' ? 0 : null,
        notes,
      },
    });

    // Remove from waitlist if they were on it
    await prisma.tournamentWaitlist.updateMany({
      where: {
        tournamentId,
        playerId,
        status: { in: ['ACTIVE', 'NOTIFIED'] },
      },
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

        const firstStop = tournament.stops[0];
        const location = firstStop?.club
          ? [firstStop.club.name, firstStop.club.city, firstStop.club.region]
              .filter(Boolean)
              .join(', ')
          : null;

        await sendRegistrationConfirmationEmail({
          to: player.email,
          playerName,
          tournamentName: tournament.name,
          tournamentId,
          startDate: firstStop?.startAt || null,
          endDate: firstStop?.endAt || null,
          location,
          isPaid: tournament.registrationType === 'FREE',
          amountPaid: tournament.registrationType === 'FREE' ? 0 : null,
          registrationDate: registration.registeredAt,
        });
      } catch (emailError) {
        console.error('Failed to send registration confirmation email:', emailError);
      }
    }

    return NextResponse.json({
      success: true,
      message: capacityWarning || 'Player registered successfully',
      warning: capacityWarning,
      registration: {
        id: registration.id,
        tournamentId,
        playerId,
        status: registration.status,
        paymentStatus: registration.paymentStatus,
        registeredAt: registration.registeredAt,
      },
    });
  } catch (error) {
    console.error('Error registering player:', error);
    return NextResponse.json(
      { error: 'Failed to register player' },
      { status: 500 }
    );
  }
}
