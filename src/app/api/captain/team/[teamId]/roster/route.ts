// src/app/api/captain/team/[teamId]/roster/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ teamId: string }> };

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function safeJson<T>(req: NextRequest): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    const text = await req.text();
    if (!text) return { ok: true, value: {} as T };
    return { ok: true, value: JSON.parse(text) as T };
  } catch {
    return { ok: false, error: 'Invalid JSON body' };
  }
}

/** Ensure the player isn’t rostered on another team in the same tournament. */
async function assertEligible(
  prisma: ReturnType<typeof getPrisma>,
  playerId: string,
  tournamentId: string,
  currentTeamId: string
) {
  const clash = await prisma.teamPlayer.findFirst({
    where: {
      playerId,
      team: { tournamentId, NOT: { id: currentTeamId } },
    },
    select: { teamId: true },
  });
  if (clash) throw new Error('Player is already rostered on another team in this tournament');
  return true;
}

/** POST: add a player (and optionally add them to a specific stop). */
export async function POST(req: NextRequest, ctx: Ctx) {
  const prisma = getPrisma();
  const { teamId } = await ctx.params;

  // Allow query or JSON body
  const url = new URL(req.url);
  let playerId = url.searchParams.get('playerId') ?? undefined;
  let stopId = url.searchParams.get('stopId') ?? undefined;

  if (!playerId) {
    const parsed = await safeJson<{ playerId?: string; stopId?: string }>(req);
    if (!parsed.ok) return bad(parsed.error);
    playerId = parsed.value.playerId ?? undefined;
    stopId = parsed.value.stopId ?? stopId;
  }
  if (!playerId) return bad('playerId is required');

  try {
    // Load team + tournament
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, tournamentId: true },
    });
    if (!team) return bad('Team not found', 404);
    if (!team.tournamentId) return bad('Team is not associated with a tournament');

    // Validate player exists
    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { id: true } });
    if (!player) return bad('Player not found', 404);

    // If a stop is given, validate it and ensure same tournament
    if (stopId) {
      const stop = await prisma.stop.findUnique({
        where: { id: stopId },
        select: { id: true, tournamentId: true },
      });
      if (!stop) return bad('Stop not found', 404);
      if (stop.tournamentId !== team.tournamentId) {
        return bad('Stop and Team belong to different tournaments');
      }
    }

    // Uniqueness at tournament level
    await assertEligible(prisma, playerId, team.tournamentId, teamId);

    await prisma.$transaction(async (tx) => {
      // Tournament claim
      await tx.teamPlayer.upsert({
        where: { teamId_playerId: { teamId, playerId } },
        update: {},
        create: { teamId, playerId, tournamentId: team.tournamentId! },
      });

      // Optional stop-level row (if provided)
      if (stopId) {
        await tx.stopTeamPlayer.upsert({
          where: { stopId_teamId_playerId: { stopId, teamId, playerId } },
          update: {},
          create: { stopId, teamId, playerId },
        });
      }
    });

    return NextResponse.json({ ok: true, teamId, playerId, stopId: stopId ?? null });
  } catch (e: any) {
    return bad(e?.message ?? 'Failed to add player');
  }
}

/**
 * DELETE: remove a player from the team.
 * - If stopId is provided → remove lineup entries + StopTeamPlayer for that stop; then release TeamPlayer rows
 *   if the player is now on no stops in the tournament; otherwise remove TeamPlayer just for this team.
 * - If stopId is NOT provided → remove lineup entries + all StopTeamPlayer rows for this team; then do the same release logic.
 */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const prisma = getPrisma();
  const { teamId } = await ctx.params;

  const url = new URL(req.url);
  let playerId = url.searchParams.get('playerId') ?? undefined;
  let stopId = url.searchParams.get('stopId') ?? undefined;

  if (!playerId) {
    const parsed = await safeJson<{ playerId?: string; stopId?: string }>(req);
    if (!parsed.ok) return bad(parsed.error);
    playerId = parsed.value.playerId ?? undefined;
    stopId = parsed.value.stopId ?? stopId;
  }
  if (!playerId) return bad('playerId is required');

  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, tournamentId: true },
    });
    if (!team) return bad('Team not found', 404);
    if (!team.tournamentId) return bad('Team is not associated with a tournament');

    await prisma.$transaction(async (tx) => {
      // 1) Remove lineup entries under this team (optionally scoped to stop)
      await tx.lineupEntry.deleteMany({
        where: {
          OR: [{ player1Id: playerId }, { player2Id: playerId }],
          lineup: { teamId, ...(stopId ? { stopId } : {}) },
        },
      });

      // 2) Remove stop-level roster row(s)
      if (stopId) {
        await tx.stopTeamPlayer.deleteMany({ where: { stopId, teamId, playerId } });
      } else {
        await tx.stopTeamPlayer.deleteMany({ where: { teamId, playerId } });
      }

      // 3) Release TeamPlayer for this team now (always)
      await tx.teamPlayer.deleteMany({ where: { teamId, playerId } });

      // 4) If player is now on NO stops in this tournament, fully release all tournament claims
      const stillOnAnyStop = await tx.stopTeamPlayer.findFirst({
        where: { playerId, stop: { tournamentId: team.tournamentId! } },
      });

      if (!stillOnAnyStop) {
        await tx.teamPlayer.deleteMany({
          where: { playerId, team: { tournamentId: team.tournamentId! } },
        });
      }
    });

    return new NextResponse(null, { status: 204 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed to remove player' }, { status: 400 });
  }
}
