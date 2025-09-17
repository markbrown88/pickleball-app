// src/app/api/admin/games/[gameId]/results/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { GameSlot } from '@prisma/client';
import { GameSlot as GameSlotEnum } from '@prisma/client';

type Ctx = { params: Promise<{ gameId: string }> };

type ScoreItem =
  | { slot: GameSlot; a?: number | null; b?: number | null }
  | { slot: GameSlot; teamAScore?: number | null; teamBScore?: number | null };

type PutBody =
  | { scores: ScoreItem[] }
  | {
      [K in GameSlot]?: {
        a?: number | null;
        b?: number | null;
        teamAScore?: number | null;
        teamBScore?: number | null;
      };
    };

const VALID_SLOTS = new Set<GameSlot>(Object.values(GameSlotEnum) as GameSlot[]);

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

function normScore(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error('Scores must be non-negative numbers or null.');
  return Math.floor(n);
}

function extractScores(payload: unknown) {
  const body = (payload ?? {}) as PutBody;

  // Array form
  if (Array.isArray((body as any).scores)) {
    return (body as any).scores.map((s: ScoreItem) => {
      const slot = s.slot as GameSlot;
      if (!VALID_SLOTS.has(slot)) throw new Error(`Invalid slot: ${s.slot}`);
      const teamAScore = 'a' in s ? normScore((s as any).a) : normScore((s as any).teamAScore);
      const teamBScore = 'b' in s ? normScore((s as any).b) : normScore((s as any).teamBScore);
      return { slot, teamAScore, teamBScore };
    });
  }

  // Map form
  const out: Array<{ slot: GameSlot; teamAScore: number | null; teamBScore: number | null }> = [];
  for (const key of Object.keys(body)) {
    const slot = key as GameSlot;
    if (!VALID_SLOTS.has(slot)) continue;
    const entry: any = (body as any)[key];
    const teamAScore = 'a' in entry ? normScore(entry.a) : normScore(entry.teamAScore);
    const teamBScore = 'b' in entry ? normScore(entry.b) : normScore(entry.teamBScore);
    out.push({ slot, teamAScore, teamBScore });
  }
  return out;
}

function summarize(matches: Array<{ teamAScore: number | null; teamBScore: number | null }>) {
  let aWins = 0;
  let bWins = 0;
  let ties = 0;

  for (const m of matches) {
    if (m.teamAScore == null || m.teamBScore == null) continue;
    if (m.teamAScore > m.teamBScore) aWins++;
    else if (m.teamBScore > m.teamAScore) bWins++;
    else ties++;
  }

  let winner: 'A' | 'B' | null = null;
  if (aWins > bWins) winner = 'A';
  else if (bWins > aWins) winner = 'B';

  return { aWins, bWins, ties, decided: winner !== null, winner };
}

// ---------- GET ----------
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { gameId } = await ctx.params;
    // Use singleton prisma instance

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        round: { select: { id: true, stopId: true, stop: { select: { tournamentId: true } } } },
        teamA: { select: { id: true, name: true } },
        teamB: { select: { id: true, name: true } },
        matches: { orderBy: { slot: 'asc' } },
      },
    });
    if (!game) return bad('Game not found', 404);

    const matches = game.matches.map((m) => ({
      id: m.id,
      slot: m.slot,
      teamAScore: m.teamAScore ?? null,
      teamBScore: m.teamBScore ?? null,
    }));

    return NextResponse.json({
      gameId: game.id,
      roundId: game.roundId,
      stopId: game.round?.stopId ?? null,
      tournamentId: game.round?.stop?.tournamentId ?? null,
      isBye: !!game.isBye,
      teamA: game.teamA ? { id: game.teamA.id, name: game.teamA.name } : null,
      teamB: game.teamB ? { id: game.teamB.id, name: game.teamB.name } : null,
      matches,
      summary: summarize(matches),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed to load results' }, { status: 500 });
  }
}

// ---------- PUT ----------
export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { gameId } = await ctx.params;
    // Use singleton prisma instance

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, isBye: true },
    });
    if (!game) return bad('Game not found', 404);
    if (game.isBye) return bad('Cannot submit results for a BYE game');

    const updates = extractScores(await req.json().catch(() => ({})));
    if (!updates.length) return bad('No scores provided');

    await prisma.$transaction(async (tx) => {
      for (const u of updates) {
        await tx.match.upsert({
          where: { gameId_slot: { gameId, slot: u.slot } },
          update: { teamAScore: u.teamAScore, teamBScore: u.teamBScore },
          create: { gameId, slot: u.slot, teamAScore: u.teamAScore, teamBScore: u.teamBScore },
        });
      }
    });

    const after = await prisma.game.findUnique({
      where: { id: gameId },
      include: { matches: { orderBy: { slot: 'asc' } } },
    });

    const matches = (after?.matches ?? []).map((m) => ({
      id: m.id,
      slot: m.slot,
      teamAScore: m.teamAScore ?? null,
      teamBScore: m.teamBScore ?? null,
    }));

    return NextResponse.json({
      ok: true,
      gameId,
      matches,
      summary: summarize(matches),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed to submit results' }, { status: 500 });
  }
}
