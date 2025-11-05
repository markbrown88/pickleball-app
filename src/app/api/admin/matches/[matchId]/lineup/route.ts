// src/app/api/admin/matches/[matchId]/lineup/route.ts
//
// DEPRECATED: This route used the old JSON-based lineup storage system.
// Lineups are now stored in Lineup/LineupEntry tables.
// Use /api/admin/stops/[stopId]/lineups instead.
//
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = { matchId: string };
type Ctx = { params: Promise<Params> };

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

// ---------- GET /api/admin/matches/:matchId/lineup ----------
// Returns empty lineup data (deprecated)
export async function GET(_req: Request, ctx: Ctx) {
  const { matchId } = await ctx.params;

  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        teamA: { select: { id: true, name: true } },
        teamB: { select: { id: true, name: true } },
      },
    });

    if (!match) {
      return bad('Match not found', 404);
    }

    // Return empty lineup structure for backward compatibility
    return NextResponse.json({
      id: match.id,
      teamALineup: null,
      teamBLineup: null,
      lineupConfirmed: false,
      game: {
        id: match.id,
        teamA: match.teamA ? { id: match.teamA.id, name: match.teamA.name } : null,
        teamB: match.teamB ? { id: match.teamB.id, name: match.teamB.name } : null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed to load lineup' }, { status: 500 });
  }
}

// ---------- PATCH /api/admin/matches/:matchId/lineup ----------
// No-op endpoint (deprecated - lineups are managed via Lineup/LineupEntry tables)
export async function PATCH(_req: Request, ctx: Ctx) {
  const { matchId } = await ctx.params;

  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        teamA: { select: { id: true, name: true } },
        teamB: { select: { id: true, name: true } },
      },
    });

    if (!match) {
      return bad('Match not found', 404);
    }

    // Return success but don't actually update anything
    // Frontend should use /api/admin/stops/[stopId]/lineups instead
    return NextResponse.json({
      ok: true,
      message: 'This endpoint is deprecated. Use /api/admin/stops/[stopId]/lineups instead.',
      match: {
        id: match.id,
        slot: null,
        teamALineup: null,
        teamBLineup: null,
        lineupConfirmed: false,
        game: {
          id: match.id,
          teamA: match.teamA ? { id: match.teamA.id, name: match.teamA.name } : null,
          teamB: match.teamB ? { id: match.teamB.id, name: match.teamB.name } : null,
        },
      },
    });
  } catch (e: any) {
    if (e?.code === 'P2025' || /record to update not found/i.test(String(e?.message))) {
      return bad('Match not found', 404);
    }
    return NextResponse.json({ error: e?.message ?? 'Failed to update lineup' }, { status: 500 });
  }
}
