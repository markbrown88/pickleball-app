export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

type CtxPromise = { params: Promise<{ tournamentId: string }> };

/**
 * POST /api/player/tournaments/[tournamentId]/request-invite
 * Request an invite for an INVITE_ONLY tournament
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
      select: { id: true, firstName: true, lastName: true },
    });

    if (!player) {
      return NextResponse.json({ error: 'Player profile not found' }, { status: 404 });
    }

    // Get tournament
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        name: true,
        registrationStatus: true,
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Check if registration status is INVITE_ONLY
    if (tournament.registrationStatus !== 'INVITE_ONLY') {
      return NextResponse.json(
        { error: 'This tournament does not require invite requests' },
        { status: 400 }
      );
    }

    // Check if already requested
    const existingRequest = await prisma.inviteRequest.findUnique({
      where: {
        tournamentId_playerId: {
          tournamentId: tournament.id,
          playerId: player.id,
        },
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: 'You have already requested an invite for this tournament', status: existingRequest.status },
        { status: 400 }
      );
    }

    // Check if already has an invite
    const existingInvite = await prisma.tournamentInvite.findUnique({
      where: {
        tournamentId_playerId: {
          tournamentId: tournament.id,
          playerId: player.id,
        },
      },
    });

    if (existingInvite) {
      return NextResponse.json(
        { error: 'You already have an invite for this tournament', inviteStatus: existingInvite.status },
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

    // Create invite request
    const inviteRequest = await prisma.inviteRequest.create({
      data: {
        tournamentId: tournament.id,
        playerId: player.id,
        status: 'PENDING',
      },
      select: {
        id: true,
        status: true,
        requestedAt: true,
      },
    });

    // TODO: Notify tournament admins about the request

    return NextResponse.json({
      success: true,
      inviteRequest: {
        id: inviteRequest.id,
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        status: inviteRequest.status,
        requestedAt: inviteRequest.requestedAt,
      },
    });
  } catch (error) {
    console.error('Error requesting tournament invite:', error);
    return NextResponse.json(
      { error: 'Failed to request invite' },
      { status: 500 }
    );
  }
}
