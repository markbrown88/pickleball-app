// src/app/api/admin/matches/[matchId]/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = { matchId: string };
type Ctx = { params: Promise<Params> };

type PutBody = {
  teamAScore?: number | null;
  teamBScore?: number | null;
};

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

function isValidScore(v: unknown) {
  // allow undefined (not provided), null (clear), or non-negative integers
  return v === undefined || v === null || (Number.isInteger(v) && Number(v) >= 0);
}

async function updateMatchScores(matchId: string, body: PutBody) {
  // Use singleton prisma instance

  if (!isValidScore(body.teamAScore) || !isValidScore(body.teamBScore)) {
    return bad('Scores must be non-negative integers or null');
  }

  const hasA = Object.prototype.hasOwnProperty.call(body, 'teamAScore');
  const hasB = Object.prototype.hasOwnProperty.call(body, 'teamBScore');

  // If nothing to update, return current
  if (!hasA && !hasB) {
    const current = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        slot: true,
        teamAScore: true,
        teamBScore: true,
        game: {
          select: {
            id: true,
            teamA: { select: { id: true, name: true } },
            teamB: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!current) return bad('Match not found', 404);
    return NextResponse.json({
      ok: true,
      match: {
        id: current.id,
        slot: current.slot,
        teamAScore: current.teamAScore,
        teamBScore: current.teamBScore,
        gameId: current.game?.id ?? null,
        teamA: current.game?.teamA ? { id: current.game.teamA.id, name: current.game.teamA.name } : null,
        teamB: current.game?.teamB ? { id: current.game.teamB.id, name: current.game.teamB.name } : null,
      },
    });
  }

  try {
    // Build only provided fields; Prisma ignores missing keys
    const data: { teamAScore?: number | null; teamBScore?: number | null } = {};
    if (hasA) data.teamAScore = body.teamAScore ?? null;
    if (hasB) data.teamBScore = body.teamBScore ?? null;

    const updated = await prisma.match.update({
      where: { id: matchId },
      data,
      select: {
        id: true,
        slot: true,
        teamAScore: true,
        teamBScore: true,
        game: {
          select: {
            id: true,
            teamA: { select: { id: true, name: true } },
            teamB: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      match: {
        id: updated.id,
        slot: updated.slot,
        teamAScore: updated.teamAScore,
        teamBScore: updated.teamBScore,
        gameId: updated.game?.id ?? null,
        teamA: updated.game?.teamA ? { id: updated.game.teamA.id, name: updated.game.teamA.name } : null,
        // ✅ fixed (was updated.game.gameB?.name)
        teamB: updated.game?.teamB ? { id: updated.game.teamB.id, name: updated.game.teamB.name } : null,
      },
    });
  } catch (e: any) {
    if (e?.code === 'P2025' || /record to update not found/i.test(String(e?.message))) {
      return bad('Match not found', 404);
    }
    return NextResponse.json({ error: e?.message ?? 'Failed to update match' }, { status: 500 });
  }
}

// ---------- GET /api/admin/matches/:matchId ----------
export async function GET(_req: Request, ctx: Ctx) {
  const { matchId } = await ctx.params;
  // Use singleton prisma instance

  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        game: {
          select: {
            id: true,
            isBye: true,
            teamA: { select: { id: true, name: true } },
            teamB: { select: { id: true, name: true } },
            round: {
              select: {
                id: true,
                idx: true,
                stop: { select: { id: true, name: true, tournamentId: true } },
              },
            },
          },
        },
      },
    });
    if (!match) return bad('Match not found', 404);

    return NextResponse.json({
      id: match.id,
      slot: match.slot,
      teamAScore: match.teamAScore,
      teamBScore: match.teamBScore,
      game: {
        id: match.game?.id ?? null,
        isBye: match.game?.isBye ?? false,
        teamA: match.game?.teamA ? { id: match.game.teamA.id, name: match.game.teamA.name } : null,
        teamB: match.game?.teamB ? { id: match.game.teamB.id, name: match.game.teamB.name } : null,
        round: match.game?.round
          ? {
              id: match.game.round.id,
              idx: match.game.round.idx,
              stopId: match.game.round.stop.id,
              stopName: match.game.round.stop.name,
              tournamentId: match.game.round.stop.tournamentId,
            }
          : null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed to load match' }, { status: 500 });
  }
}

// ---------- PUT /api/admin/matches/:matchId ----------
export async function PUT(req: Request, ctx: Ctx) {
  const { matchId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as PutBody;
  return updateMatchScores(matchId, body);
}

// ---------- PATCH /api/admin/matches/:matchId ----------
export async function PATCH(req: Request, ctx: Ctx) {
  const { matchId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as PutBody;
  return updateMatchScores(matchId, body);
}
