import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEffectivePlayer, getActAsHeaderFromRequest } from '@/lib/actAs';

type Ctx = { params: Promise<{ tournamentId: string; stopId: string; playerId: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { tournamentId, stopId, playerId } = await ctx.params;
    const { paymentMethod } = await request.json();

    // Validate paymentMethod
    if (!['STRIPE', 'MANUAL', 'UNPAID'].includes(paymentMethod)) {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
    }

    // Don't allow changing STRIPE payment method (it's automatic)
    if (paymentMethod === 'STRIPE') {
      return NextResponse.json(
        { error: 'Cannot manually set STRIPE payment method' },
        { status: 400 }
      );
    }

    // Support Act As functionality
    const actAsPlayerId = getActAsHeaderFromRequest(request);
    const effectivePlayer = await getEffectivePlayer(actAsPlayerId);

    const player = await prisma.player.findUnique({
      where: { id: effectivePlayer.targetPlayerId },
      select: {
        id: true,
        isAppAdmin: true,
        tournamentAdminLinks: { where: { tournamentId }, select: { tournamentId: true } },
        TournamentCaptain: { where: { tournamentId }, select: { tournamentId: true } },
      },
    });

    if (!player) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const isAppAdmin = player.isAppAdmin;
    const isTournamentAdmin = player.tournamentAdminLinks.length > 0;
    const isCaptain = player.TournamentCaptain.length > 0;

    if (!isAppAdmin && !isTournamentAdmin && !isCaptain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if the stop-team-player entry exists
    const stopTeamPlayer = await prisma.stopTeamPlayer.findFirst({
      where: {
        stopId,
        playerId,
      },
    });

    if (!stopTeamPlayer) {
      return NextResponse.json({ error: 'Player not found in stop roster' }, { status: 404 });
    }

    // Update payment method
    await prisma.stopTeamPlayer.updateMany({
      where: {
        stopId,
        playerId,
      },
      data: {
        paymentMethod,
      },
    });

    return NextResponse.json({ ok: true, paymentMethod });
  } catch (e: any) {
    console.error('[Payment Update API] Error:', e);
    return NextResponse.json(
      { error: e?.message ?? 'Failed to update payment method' },
      { status: 500 }
    );
  }
}
