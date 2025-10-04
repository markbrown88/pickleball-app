// src/app/api/captain/team/[teamId]/stops/[stopId]/roster/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ teamId: string; playerId: string }> };

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

async function assertEligibleForTournament(
  prisma: any,
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
}

/* POST → add player to THIS stop (and create TeamPlayer claim) */
export async function POST(req: NextRequest, ctx: Ctx) {
  // Use singleton prisma instance
  const { teamId, playerId } = await ctx.params;

  // stopId via query or body
  const url = new URL(req.url);
  let stopId = url.searchParams.get('stopId') ?? undefined;
  if (!stopId) {
    const parsed = await safeJson<{ stopId?: string }>(req);
    if (!parsed.ok) return bad(parsed.error);
    stopId = parsed.value.stopId ?? undefined;
  }
  if (!stopId) return bad('stopId is required');

  try {
    const [stop, team, player] = await Promise.all([
      prisma.stop.findUnique({ where: { id: stopId }, select: { id: true, tournamentId: true } }),
      prisma.team.findUnique({ where: { id: teamId }, select: { id: true, tournamentId: true } }),
      prisma.player.findUnique({ where: { id: playerId }, select: { id: true } }),
    ]);

    if (!stop || !stop.tournamentId) return bad('Stop not found', 404);
    if (!team || !team.tournamentId) return bad('Team not found', 404);
    if (!player) return bad('Player not found', 404);
    if (team.tournamentId !== stop.tournamentId) return bad('Team and Stop belong to different tournaments');

    await assertEligibleForTournament(prisma, playerId, stop.tournamentId, teamId);

    await prisma.$transaction(async (tx) => {
      await tx.teamPlayer.upsert({
        where: { teamId_playerId: { teamId, playerId } },
        update: {},
        create: { teamId, playerId, tournamentId: stop.tournamentId! },
      });

      await tx.stopTeamPlayer.upsert({
        where: { stopId_teamId_playerId: { stopId, teamId, playerId } },
        update: {},
        create: { stopId, teamId, playerId },
      });
    });

    return NextResponse.json({ ok: true, teamId, stopId, playerId });
  } catch (e: any) {
    return bad(e?.message ?? 'Failed to add player');
  }
}

/* DELETE → remove player from THIS stop, and release tournament claim if no other stops remain */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  // Use singleton prisma instance
  const { teamId, playerId } = await ctx.params;

  const url = new URL(req.url);
  let stopId = url.searchParams.get('stopId') ?? undefined;
  if (!stopId) {
    const parsed = await safeJson<{ stopId?: string }>(req);
    if (!parsed.ok) return bad(parsed.error);
    stopId = parsed.value.stopId ?? undefined;
  }
  if (!stopId) return bad('stopId is required');

  try {
    const stop = await prisma.stop.findUnique({
      where: { id: stopId },
      select: { id: true, tournamentId: true },
    });
    if (!stop || !stop.tournamentId) return bad('Stop not found', 404);

    await prisma.$transaction(async (tx) => {
      // Delete lineup entries only for this stop/team
      await tx.lineupEntry.deleteMany({
        where: {
          OR: [{ player1Id: playerId }, { player2Id: playerId }],
          lineup: { teamId, stopId },
        },
      });

      // Remove stop-level row
      await tx.stopTeamPlayer.deleteMany({ where: { stopId, teamId, playerId } });

      // If player is on no other stops in the same tournament, fully release all TeamPlayer rows for that tournament
      const stillOnAnyStop = await tx.stopTeamPlayer.findFirst({
        where: { playerId, stop: { tournamentId: stop.tournamentId } },
      });

      if (!stillOnAnyStop) {
        await tx.teamPlayer.deleteMany({
          where: { playerId, team: { tournamentId: stop.tournamentId } },
        });
      } else {
        // Otherwise, at least remove the claim for THIS team
        await tx.teamPlayer.deleteMany({ where: { playerId, teamId } });
      }
    });

    return new NextResponse(null, { status: 204 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed to remove player' }, { status: 400 });
  }
}
