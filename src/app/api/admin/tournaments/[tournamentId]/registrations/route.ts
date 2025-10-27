export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type CtxPromise = { params: Promise<{ tournamentId: string }> };

function playerLabel(p?: { firstName?: string | null; lastName?: string | null; name?: string | null }) {
  const fn = (p?.firstName ?? '').trim();
  const ln = (p?.lastName ?? '').trim();
  return [fn, ln].filter(Boolean).join(' ') || (p?.name ?? 'Unknown');
}

/**
 * GET /api/admin/tournaments/[tournamentId]/registrations
 * Get all registrations, invites, requests, and waitlist entries for a tournament
 */
export async function GET(_req: Request, ctx: CtxPromise) {
  try {
    const { tournamentId } = await ctx.params;

    // Get tournament
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
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Get all registrations
    const registrations = await prisma.tournamentRegistration.findMany({
      where: { tournamentId },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { registeredAt: 'asc' },
    });

    // Get all invites
    const invites = await prisma.tournamentInvite.findMany({
      where: { tournamentId },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            email: true,
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
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get all invite requests
    const inviteRequests = await prisma.inviteRequest.findMany({
      where: { tournamentId },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            email: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
          },
        },
      },
      orderBy: { requestedAt: 'desc' },
    });

    // Get waitlist
    const waitlist = await prisma.tournamentWaitlist.findMany({
      where: { tournamentId },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { position: 'asc' },
    });

    // Format response
    return NextResponse.json({
      tournament: {
        id: tournament.id,
        name: tournament.name,
        registrationStatus: tournament.registrationStatus,
        registrationType: tournament.registrationType,
        registrationCost: tournament.registrationCost,
        maxPlayers: tournament.maxPlayers,
        isWaitlistEnabled: tournament.isWaitlistEnabled,
      },
      registrations: registrations.map((r) => ({
        id: r.id,
        player: {
          id: r.player.id,
          name: playerLabel(r.player),
          email: r.player.email,
        },
        status: r.status,
        paymentStatus: r.paymentStatus,
        amountPaid: r.amountPaid,
        registeredAt: r.registeredAt,
        withdrawnAt: r.withdrawnAt,
        rejectedAt: r.rejectedAt,
        rejectedBy: r.rejectedBy,
        rejectionReason: r.rejectionReason,
        notes: r.notes,
      })),
      invites: invites.map((i) => ({
        id: i.id,
        player: i.player
          ? {
              id: i.player.id,
              name: playerLabel(i.player),
              email: i.player.email,
            }
          : null,
        inviteEmail: i.inviteEmail,
        inviteName: i.inviteName,
        status: i.status,
        invitedBy: {
          id: i.invitedByPlayer.id,
          name: playerLabel(i.invitedByPlayer),
        },
        expiresAt: i.expiresAt,
        createdAt: i.createdAt,
        respondedAt: i.respondedAt,
        notes: i.notes,
      })),
      inviteRequests: inviteRequests.map((r) => ({
        id: r.id,
        player: {
          id: r.player.id,
          name: playerLabel(r.player),
          email: r.player.email,
        },
        status: r.status,
        requestedAt: r.requestedAt,
        reviewedAt: r.reviewedAt,
        reviewedBy: r.reviewer
          ? {
              id: r.reviewer.id,
              name: playerLabel(r.reviewer),
            }
          : null,
        notes: r.notes,
      })),
      waitlist: waitlist.map((w) => ({
        id: w.id,
        player: {
          id: w.player.id,
          name: playerLabel(w.player),
          email: w.player.email,
        },
        position: w.position,
        status: w.status,
        joinedAt: w.joinedAt,
        notifiedAt: w.notifiedAt,
        notificationExpiresAt: w.notificationExpiresAt,
        promotedAt: w.promotedAt,
        removedAt: w.removedAt,
      })),
      summary: {
        totalRegistered: registrations.filter((r) => r.status === 'REGISTERED').length,
        totalWithdrawn: registrations.filter((r) => r.status === 'WITHDRAWN').length,
        totalRejected: registrations.filter((r) => r.status === 'REJECTED').length,
        pendingInviteRequests: inviteRequests.filter((r) => r.status === 'PENDING').length,
        pendingInvites: invites.filter((i) => i.status === 'PENDING').length,
        activeWaitlist: waitlist.filter((w) => w.status === 'ACTIVE').length,
      },
    });
  } catch (error) {
    console.error('Error fetching tournament registrations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch registrations' },
      { status: 500 }
    );
  }
}
