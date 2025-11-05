// src/app/api/admin/matches/[matchId]/bracket-lineups/route.ts
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

interface PlayerLite {
  id: string;
  name: string;
  gender: string;
}

interface LineupData {
  lineupsByBracket: Record<string, Record<string, PlayerLite[]>>; // bracketId -> teamId -> players
}

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

// ---------- PATCH /api/admin/matches/:matchId/bracket-lineups ----------
// No-op endpoint (deprecated - lineups are managed via Lineup/LineupEntry tables)
export async function PATCH(req: Request, ctx: Ctx) {
  const { matchId } = await ctx.params;

  try {
    // Validate that match exists
    const existingMatch = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        teamA: { select: { id: true } },
        teamB: { select: { id: true } },
        games: { select: { id: true, bracketId: true } }
      },
    });

    if (!existingMatch) {
      return bad('Match not found', 404);
    }

    // Return success but don't actually update anything
    // Frontend should use /api/admin/stops/[stopId]/lineups instead
    return NextResponse.json({
      ok: true,
      message: 'This endpoint is deprecated. Use /api/admin/stops/[stopId]/lineups instead.',
      gamesUpdated: 0,
    });
  } catch (e: any) {
    if (e?.code === 'P2025' || /record to update not found/i.test(String(e?.message))) {
      return bad('Match not found', 404);
    }
    console.error('Error in deprecated bracket-lineups endpoint:', e);
    return NextResponse.json({ error: e?.message ?? 'Failed to update lineups' }, { status: 500 });
  }
}
