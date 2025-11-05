// src/app/api/admin/stops/[stopId]/has-bracket/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { getActAsHeaderFromRequest, getEffectivePlayer } from '@/lib/actAs';

type Ctx = { params: Promise<{ stopId: string }> };

/**
 * GET /api/admin/stops/[stopId]/has-bracket
 * 
 * Lightweight endpoint to check if a stop has a bracket (rounds) without loading all schedule data.
 * Returns { hasBracket: boolean }
 */
export async function GET(req: Request, ctx: Ctx) {
  try {
    // Authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Support Act As functionality
    const actAsPlayerId = getActAsHeaderFromRequest(req);
    const effectivePlayer = await getEffectivePlayer(actAsPlayerId);

    const { stopId } = await ctx.params;

    // Validate stop
    const stop = await prisma.stop.findUnique({
      where: { id: stopId },
      select: { id: true, tournamentId: true },
    });
    if (!stop) {
      return NextResponse.json({ error: `Stop not found: ${stopId}` }, { status: 404 });
    }

    // Authorization: Check if user is admin or event manager for this stop
    if (!effectivePlayer.isAppAdmin) {
      const isEventManager = await prisma.stop.findFirst({
        where: {
          id: stopId,
          eventManagerId: effectivePlayer.targetPlayerId
        }
      });

      const isTournamentEventManager = await prisma.tournamentEventManager.findFirst({
        where: {
          tournamentId: stop.tournamentId,
          playerId: effectivePlayer.targetPlayerId
        }
      });

      if (!isEventManager && !isTournamentEventManager) {
        return NextResponse.json({ error: 'Not authorized to view this stop' }, { status: 403 });
      }
    }

    // Just count rounds - much faster than loading all data
    const roundCount = await prisma.round.count({
      where: { stopId },
    });

    return NextResponse.json({ hasBracket: roundCount > 0 });
  } catch (e) {
    console.error('Error in /api/admin/stops/[stopId]/has-bracket:', e);
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

