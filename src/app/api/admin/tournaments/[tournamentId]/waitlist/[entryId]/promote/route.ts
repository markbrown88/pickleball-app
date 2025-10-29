import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type CtxPromise = Promise<{ params: { tournamentId: string; entryId: string } }>;

/**
 * POST /api/admin/tournaments/[tournamentId]/waitlist/[entryId]/promote
 * Promote a player from waitlist to registered
 */
export async function POST(req: Request, ctx: CtxPromise) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tournamentId, entryId } = await ctx.params;

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

    // Get the waitlist entry
    const waitlistEntry = await prisma.tournamentWaitlist.findUnique({
      where: { id: entryId },
      include: {
        player: {
          select: {
            id: true,
            email: true,
            name: true,
            firstName: true,
            lastName: true,
          },
        },
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

    if (waitlistEntry.tournamentId !== tournamentId) {
      return NextResponse.json(
        { error: 'Waitlist entry does not belong to this tournament' },
        { status: 400 }
      );
    }

    if (waitlistEntry.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: `Waitlist entry status is ${waitlistEntry.status}, expected ACTIVE` },
        { status: 400 }
      );
    }

    // Check if player is already registered
    const existingRegistration = await prisma.tournamentRegistration.findUnique({
      where: {
        tournamentId_playerId: {
          tournamentId,
          playerId: waitlistEntry.playerId,
        },
      },
    });

    if (existingRegistration) {
      return NextResponse.json(
        { error: 'Player is already registered for this tournament' },
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

    // Notify the player - update waitlist status to NOTIFIED
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.tournamentWaitlist.update({
      where: { id: entryId },
      data: {
        status: 'NOTIFIED',
        notifiedAt: new Date(),
        notificationExpiresAt: expiresAt,
      },
    });

    // Send waitlist spot available email
    if (waitlistEntry.player.email) {
      const playerName =
        waitlistEntry.player.name ||
        (waitlistEntry.player.firstName && waitlistEntry.player.lastName
          ? `${waitlistEntry.player.firstName} ${waitlistEntry.player.lastName}`
          : waitlistEntry.player.firstName || 'Player');

      try {
        const { sendWaitlistSpotAvailableEmail } = await import('@/server/email');

        // Get tournament details for email
        const tournamentDetails = await prisma.tournament.findUnique({
          where: { id: tournamentId },
          include: {
            stops: {
              take: 1,
              orderBy: { startAt: 'asc' },
              select: {
                startAt: true,
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

          await sendWaitlistSpotAvailableEmail({
            to: waitlistEntry.player.email,
            playerName,
            tournamentName: waitlistEntry.tournament.name,
            tournamentId,
            expiresAt,
            tournamentStartDate: firstStop?.startAt || null,
            location,
            isPaid: waitlistEntry.tournament.registrationType !== 'FREE',
            cost: waitlistEntry.tournament.registrationCost || null,
          });
        }
      } catch (emailError) {
        console.error('Failed to send waitlist spot available email:', emailError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Player notified of available spot',
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Error promoting waitlist entry:', error);
    return NextResponse.json(
      { error: 'Failed to promote waitlist entry' },
      { status: 500 }
    );
  }
}
