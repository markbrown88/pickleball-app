// src/app/api/admin/games/[gameId]/matches/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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
  // Use singleton prisma instance
  try {
    const { gameId } = await ctx.params;

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        match: {
          select: {
            id: true,
            isBye: true,
            round: { select: { id: true, stopId: true } },
            teamAId: true,
            teamBId: true,
          }
        }
      }
    });

    if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });

    return NextResponse.json({
      gameId: game.id,
      isBye: game.match.isBye,
      roundId: game.match.round.id,
      stopId: game.match.round.stopId,
      teamAId: game.match.teamAId,
      teamBId: game.match.teamBId,
      matches: [game], // This is a single game, not multiple games
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to load game matches', detail: e?.message ?? '' }, { status: 500 });
  }
}

/** PUT -> replace/merge scores for slots of a game. */
export async function PUT(req: Request, ctx: { params: Promise<Params> }) {
  // Use singleton prisma instance
  try {
    const { gameId } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as PutBody;

    if (!Array.isArray(body?.scores)) {
      return NextResponse.json({ error: 'scores must be an array' }, { status: 400 });
    }

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        match: {
          select: { id: true, isBye: true }
        }
      }
    });
    if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    if (game.match.isBye) {
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

    // Apply updates for each slot; null/undefined clears scores
    await prisma.$transaction(async (tx) => {
      for (const s of body.scores) {
        // Find the game by matchId and slot (and bracketId if applicable)
        const existingGame = await tx.game.findFirst({
          where: {
            matchId: game.match.id,
            slot: s.slot,
            // For club tournaments, we'd need to know the bracketId
            // For now, update the first matching game
          },
        });

        if (existingGame) {
          // Update existing game
          await tx.game.update({
            where: { id: existingGame.id },
            data: {
              teamAScore: s.teamAScore ?? null,
              teamBScore: s.teamBScore ?? null,
            },
          });
        } else {
          // Create new game if it doesn't exist
          await tx.game.create({
            data: {
              matchId: game.match.id,
              slot: s.slot,
              teamAScore: s.teamAScore ?? null,
              teamBScore: s.teamBScore ?? null,
            },
          });
        }
      }
    });

    // Return fresh list
    const matches = await prisma.game.findMany({
      where: { matchId: game.match.id },
      orderBy: { slot: 'asc' },
      select: { id: true, slot: true, teamAScore: true, teamBScore: true },
    });

    return NextResponse.json({ ok: true, gameId, matches });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to save scores', detail: e?.message ?? '' }, { status: 500 });
  }
}
