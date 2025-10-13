// src/app/api/admin/games/[gameId]/scores/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { GameSlot } from '@prisma/client';
import { GameSlot as GameSlotEnum } from '@prisma/client';
import { evaluateMatchTiebreaker } from '@/lib/matchTiebreaker';
import { invalidateCache } from '@/lib/cache';
import { z } from 'zod';
import { scoreSubmissionLimiter, getClientIp, checkRateLimit } from '@/lib/rateLimit';

type Ctx = { params: Promise<{ gameId: string }> };

// Zod schema for score validation (SEC-004)
const ScoreSchema = z.object({
  scores: z.array(
    z.object({
      slot: z.enum(['GAME_1', 'GAME_2', 'GAME_3', 'GAME_4', 'GAME_5']),
      teamAScore: z.number().int().nonnegative().nullable(),
      teamBScore: z.number().int().nonnegative().nullable(),
    })
  ).min(1).refine(
    (scores) => {
      const slots = scores.map(s => s.slot);
      return new Set(slots).size === slots.length;
    },
    { message: 'Duplicate slots are not allowed' }
  ),
});

type PutBody = z.infer<typeof ScoreSchema>;

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
  // Use singleton prisma instance
  const { gameId } = await ctx.params;

  try {
    // Rate limiting to prevent rapid score manipulation (SEC-002)
    const clientIp = getClientIp(req);
    const rateLimitResult = await checkRateLimit(scoreSubmissionLimiter, clientIp);

    if (rateLimitResult && !rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many score submissions. Please try again later.',
          retryAfter: rateLimitResult.reset
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
            'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString()
          }
        }
      );
    }

    // Parse and validate request body with Zod (SEC-004)
    const rawBody = await req.json().catch(() => ({}));
    const validation = ScoreSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validation.error.issues.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      );
    }

    const body = validation.data;

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        match: {
          include: {
            games: true
          }
        }
      }
    });
    if (!game) {
      return NextResponse.json({ error: `Game not found: ${gameId}` }, { status: 404 });
    }
    if (game.match.isBye) {
      return NextResponse.json({ error: 'Cannot enter scores for a BYE game' }, { status: 400 });
    }

    // Upsert each slot's score
    const updated: { slot: GameSlot; teamAScore: number | null; teamBScore: number | null }[] = [];
    await prisma.$transaction(async (tx) => {
      for (const row of body.scores) {
        const m = await tx.game.upsert({
          where: { matchId_slot: { matchId: game.match.id, slot: row.slot as GameSlot } },
          update: { teamAScore: row.teamAScore, teamBScore: row.teamBScore },
          create: { matchId: game.match.id, slot: row.slot as GameSlot, teamAScore: row.teamAScore, teamBScore: row.teamBScore },
          select: { slot: true, teamAScore: true, teamBScore: true },
        });
        if (m.slot) {
          updated.push(m as { slot: GameSlot; teamAScore: number | null; teamBScore: number | null });
        }
      }

      await evaluateMatchTiebreaker(tx, game.match.id);
    });

    // Return fresh game view
    const fresh = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        match: {
          include: {
            round: { select: { id: true, idx: true, stopId: true } },
            teamA: { select: { id: true, name: true } },
            teamB: { select: { id: true, name: true } },
            games: { orderBy: { slot: 'asc' } }
          }
        }
      }
    });

    const matches = (fresh?.match?.games ?? [])
      .filter(m => m.slot !== null)
      .map((m) => ({
        id: m.id,
        slot: m.slot!,
        teamAScore: m.teamAScore,
        teamBScore: m.teamBScore,
      }));
    const summary = summarize(matches, fresh?.match?.isBye ?? false);

    // Invalidate scoreboard cache for this stop (scores changed)
    const stopId = fresh?.match?.round?.stopId;
    if (stopId) {
      await invalidateCache(`stop:${stopId}:*`);
      await invalidateCache(`captain:*:stop:${stopId}`);
    }

    return NextResponse.json({
      ok: true,
      id: fresh?.id ?? gameId,
      roundId: fresh?.match?.round?.id ?? null,
      teamA: fresh?.match?.teamA ? { id: fresh.match.teamA.id, name: fresh.match.teamA.name } : null,
      teamB: fresh?.match?.teamB ? { id: fresh.match.teamB.id, name: fresh.match.teamB.name } : null,
      matches,
      summary,
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to save scores', detail: e?.message ?? '' }, { status: 500 });
  }
}
