export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

type CtxPromise = { params: Promise<{ tournamentId: string }> };

/**
 * POST /api/player/tournaments/[tournamentId]/join-waitlist
 * Join the waitlist for a full tournament
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
        maxPlayers: true,
        isWaitlistEnabled: true,
        _count: {
          select: {
            registrations: {
              where: {
                status: 'REGISTERED',
              },
            },
            waitlist: {
              where: {
                status: 'ACTIVE',
              },
            },
          },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Check if waitlist is enabled
    if (!tournament.isWaitlistEnabled) {
      return NextResponse.json(
        { error: 'Waitlist is not available for this tournament' },
        { status: 400 }
      );
    }

    // Check if tournament is actually full
    const registeredCount = tournament._count.registrations;
    const isFull = tournament.maxPlayers !== null && registeredCount >= tournament.maxPlayers;

    if (!isFull) {
      return NextResponse.json(
        { error: 'Tournament is not full. Please register directly.' },
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

    // Check if already on waitlist
    const existingWaitlist = await prisma.tournamentWaitlist.findUnique({
      where: {
        tournamentId_playerId: {
          tournamentId: tournament.id,
          playerId: player.id,
        },
      },
    });

    if (existingWaitlist && existingWaitlist.status === 'ACTIVE') {
      return NextResponse.json(
        { error: 'You are already on the waitlist for this tournament', position: existingWaitlist.position },
        { status: 400 }
      );
    }

    // Calculate waitlist position (next available position)
    const waitlistCount = tournament._count.waitlist;
    const position = waitlistCount + 1;

    // Add to waitlist
    const waitlistEntry = await prisma.tournamentWaitlist.create({
      data: {
        tournamentId: tournament.id,
        playerId: player.id,
        position,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        position: true,
        status: true,
        joinedAt: true,
      },
    });

    // Send waitlist confirmation email
    const playerDetails = await prisma.player.findUnique({
      where: { id: player.id },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        name: true,
      },
    });

    if (playerDetails?.email) {
      try {
        const playerName =
          playerDetails.name ||
          (playerDetails.firstName && playerDetails.lastName
            ? `${playerDetails.firstName} ${playerDetails.lastName}`
            : playerDetails.firstName || 'Player');

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

        if (tournamentDetails) {
          const firstStop = tournamentDetails.stops?.[0];
          const location = firstStop?.club
            ? [firstStop.club.name, firstStop.club.city, firstStop.club.region]
                .filter(Boolean)
                .join(', ')
            : null;

          const { sendWaitlistConfirmationEmail } = await import('@/server/email');
          await sendWaitlistConfirmationEmail({
            to: playerDetails.email,
            playerName,
            tournamentName: tournament.name,
            tournamentId: tournamentId,
            position: waitlistEntry.position,
            startDate: firstStop?.startAt || null,
            endDate: firstStop?.endAt || null,
            location,
          });

          console.log('Waitlist confirmation email sent');
        }
      } catch (emailError) {
        console.error('Failed to send waitlist confirmation email:', emailError);
      }
    }

    return NextResponse.json({
      success: true,
      waitlist: {
        id: waitlistEntry.id,
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        position: waitlistEntry.position,
        status: waitlistEntry.status,
        joinedAt: waitlistEntry.joinedAt,
      },
    });
  } catch (error) {
    console.error('Error joining tournament waitlist:', error);
    return NextResponse.json(
      { error: 'Failed to join waitlist' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/player/tournaments/[tournamentId]/join-waitlist
 * Leave the waitlist
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

    // Get waitlist entry
    const waitlistEntry = await prisma.tournamentWaitlist.findUnique({
      where: {
        tournamentId_playerId: {
          tournamentId,
          playerId: player.id,
        },
      },
    });

    if (!waitlistEntry) {
      return NextResponse.json(
        { error: 'Not on waitlist for this tournament' },
        { status: 404 }
      );
    }

    if (waitlistEntry.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Waitlist entry is not active' },
        { status: 400 }
      );
    }

    // Remove from waitlist
    await prisma.tournamentWaitlist.update({
      where: { id: waitlistEntry.id },
      data: {
        status: 'REMOVED',
        removedAt: new Date(),
      },
    });

    // TODO: Reorder remaining waitlist positions

    return NextResponse.json({
      success: true,
      message: 'Successfully left waitlist',
    });
  } catch (error) {
    console.error('Error leaving tournament waitlist:', error);
    return NextResponse.json(
      { error: 'Failed to leave waitlist' },
      { status: 500 }
    );
  }
}
