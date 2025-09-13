// src/app/api/admin/games/[gameId]/matches/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import type { GameSlot } from '@prisma/client';

type Params = { gameId: string };

type PutBody = {
  /** Array of slot score updates; omitted scores are treated as null (cleared). */
  scores: Array<{
    slot: GameSlot;
    teamAScore?: number | null;
    teamBScore?: number | null;
  }>;
};

function isIntOrNull(v: unknown): v is number | null {
  if (v === null || v === undefined) return true;
  return Number.isInteger(v) && Number(v) >= 0;
}

/** GET -> list of matches (slots) for a game, sorted by slot. */
export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  const prisma = getPrisma();
  try {
    const { gameId } = await ctx.params;

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        isBye: true,
        round: { select: { id: true, stopId: true } },
        teamAId: true,
        teamBId: true,
        matches: {
          orderBy: { slot: 'asc' },
          select: { id: true, slot: true, teamAScore: true, teamBScore: true },
        },
      },
    });

    if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });

    return NextResponse.json({
      gameId: game.id,
      isBye: game.isBye,
      roundId: game.round.id,
      stopId: game.round.stopId,
      teamAId: game.teamAId,
      teamBId: game.teamBId,
      matches: game.matches,
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to load game matches', detail: e?.message ?? '' }, { status: 500 });
  }
}

/** PUT -> replace/merge scores for slots of a game. */
export async function PUT(req: Request, ctx: { params: Promise<Params> }) {
  const prisma = getPrisma();
  try {
    const { gameId } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as PutBody;

    if (!Array.isArray(body?.scores)) {
      return NextResponse.json({ error: 'scores must be an array' }, { status: 400 });
    }

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, isBye: true },
    });
    if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    if (game.isBye) {
      return NextResponse.json({ error: 'Cannot score a BYE game' }, { status: 400 });
    }

    // Validate payload
    for (const s of body.scores) {
      if (!s || !s.slot) {
        return NextResponse.json({ error: 'Each score item must include a valid slot' }, { status: 400 });
      }
      if (!isIntOrNull(s.teamAScore) || !isIntOrNull(s.teamBScore)) {
        return NextResponse.json({ error: 'Scores must be non-negative integers or null' }, { status: 400 });
      }
    }

    // Apply upserts for each slot; null/undefined clears scores
    await prisma.$transaction(async (tx) => {
      for (const s of body.scores) {
        await tx.match.upsert({
          where: { gameId_slot: { gameId, slot: s.slot } },
          update: {
            teamAScore: s.teamAScore ?? null,
            teamBScore: s.teamBScore ?? null,
          },
          create: {
            gameId,
            slot: s.slot,
            teamAScore: s.teamAScore ?? null,
            teamBScore: s.teamBScore ?? null,
          },
        });
      }
    });

    // Return fresh list
    const matches = await prisma.match.findMany({
      where: { gameId },
      orderBy: { slot: 'asc' },
      select: { id: true, slot: true, teamAScore: true, teamBScore: true },
    });

    return NextResponse.json({ ok: true, gameId, matches });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to save scores', detail: e?.message ?? '' }, { status: 500 });
  }
}
