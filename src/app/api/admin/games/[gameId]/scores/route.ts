// src/app/api/admin/games/[gameId]/scores/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import type { GameSlot } from '@prisma/client';
import { GameSlot as GameSlotEnum } from '@prisma/client';

type Ctx = { params: Promise<{ gameId: string }> };

type PutBody = {
  /** Partial update is allowed; only provided slots are upserted. */
  scores: Array<{
    slot: GameSlot;
    teamAScore: number | null;
    teamBScore: number | null;
  }>;
};

function isValidSlot(v: unknown): v is GameSlot {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(GameSlotEnum, v);
}

function isValidScore(v: unknown): v is number | null {
  if (v === null) return true;
  if (typeof v !== 'number' || !Number.isFinite(v)) return false;
  if (!Number.isInteger(v)) return false;
  return v >= 0;
}

function summarize(matches: Array<{ slot: GameSlot; teamAScore: number | null; teamBScore: number | null }>, isBye: boolean) {
  if (isBye) {
    return { status: 'BYE', slotsTotal: 0, slotsCompleted: 0, winsA: 0, winsB: 0 };
  }
  let winsA = 0;
  let winsB = 0;
  let completed = 0;
  for (const m of matches) {
    if (m.teamAScore == null || m.teamBScore == null) continue;
    completed++;
    if (m.teamAScore > m.teamBScore) winsA++;
    else if (m.teamBScore > m.teamAScore) winsB++;
  }
  const total = matches.length;
  const status =
    completed === 0 ? 'PENDING' :
    completed < total ? 'IN_PROGRESS' : 'COMPLETED';
  return { status, slotsTotal: total, slotsCompleted: completed, winsA, winsB };
}

export async function PUT(req: Request, ctx: Ctx) {
  const prisma = getPrisma();
  const { gameId } = await ctx.params;

  try {
    const body = (await req.json().catch(() => ({}))) as PutBody;
    if (!Array.isArray(body?.scores)) {
      return NextResponse.json({ error: 'scores must be an array' }, { status: 400 });
    }

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: { matches: true },
    });
    if (!game) {
      return NextResponse.json({ error: `Game not found: ${gameId}` }, { status: 404 });
    }
    if (game.isBye) {
      return NextResponse.json({ error: 'Cannot enter scores for a BYE game' }, { status: 400 });
    }

    // Validate payload
    const seen = new Set<GameSlot>();
    for (const row of body.scores) {
      if (!row || !isValidSlot(row.slot)) {
        return NextResponse.json({ error: 'Each score row must include a valid slot' }, { status: 400 });
      }
      if (seen.has(row.slot)) {
        return NextResponse.json({ error: `Duplicate slot: ${row.slot}` }, { status: 400 });
      }
      seen.add(row.slot);

      if (!isValidScore(row.teamAScore) || !isValidScore(row.teamBScore)) {
        return NextResponse.json({ error: 'Scores must be integers ≥ 0 or null' }, { status: 400 });
      }
    }

    // Upsert each slot’s score
    const updated: { slot: GameSlot; teamAScore: number | null; teamBScore: number | null }[] = [];
    await prisma.$transaction(async (tx) => {
      for (const row of body.scores) {
        const m = await tx.match.upsert({
          where: { gameId_slot: { gameId, slot: row.slot } },
          update: { teamAScore: row.teamAScore, teamBScore: row.teamBScore },
          create: { gameId, slot: row.slot, teamAScore: row.teamAScore, teamBScore: row.teamBScore },
          select: { slot: true, teamAScore: true, teamBScore: true },
        });
        updated.push(m);
      }
    });

    // Return fresh game view
    const fresh = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        round: { select: { id: true, idx: true, stopId: true } },
        teamA: { select: { id: true, name: true } },
        teamB: { select: { id: true, name: true } },
        matches: { orderBy: { slot: 'asc' } },
      },
    });

    const matches = (fresh?.matches ?? []).map((m) => ({
      id: m.id,
      slot: m.slot,
      teamAScore: m.teamAScore,
      teamBScore: m.teamBScore,
    }));
    const summary = summarize(matches, fresh?.isBye ?? false);

    return NextResponse.json({
      ok: true,
      id: fresh?.id ?? gameId,
      roundId: fresh?.round?.id ?? null,
      teamA: fresh?.teamA ? { id: fresh.teamA.id, name: fresh.teamA.name } : null,
      teamB: fresh?.teamB ? { id: fresh.teamB.id, name: fresh.teamB.name } : null,
      matches,
      summary,
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to save scores', detail: e?.message ?? '' }, { status: 500 });
  }
}
