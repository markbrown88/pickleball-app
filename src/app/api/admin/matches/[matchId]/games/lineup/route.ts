// src/app/api/admin/matches/[matchId]/games/lineup/route.ts
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
  teamALineup: PlayerLite[];
  teamBLineup: PlayerLite[];
}

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

// ---------- PATCH /api/admin/matches/:matchId/games/lineup ----------
// Updates lineups for ALL games in a match
export async function PATCH(req: Request, ctx: Ctx) {
  const { matchId } = await ctx.params;

  try {
    const body = (await req.json().catch(() => ({}))) as LineupData;

    // Validate lineup data
    if (!body.teamALineup || !Array.isArray(body.teamALineup) || body.teamALineup.length !== 4) {
      return bad('teamALineup must be an array of 4 players');
    }
    if (!body.teamBLineup || !Array.isArray(body.teamBLineup) || body.teamBLineup.length !== 4) {
      return bad('teamBLineup must be an array of 4 players');
    }

    // Check if match exists
    const existingMatch = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        games: { select: { id: true } }
      },
    });

    if (!existingMatch) {
      return bad('Match not found', 404);
    }

    if (existingMatch.games.length === 0) {
      return bad('No games found for this match');
    }

    // Update ALL games in the match with the same lineup
    await prisma.game.updateMany({
      where: { matchId },
      data: {
        teamALineup: body.teamALineup as any,
        teamBLineup: body.teamBLineup as any,
        lineupConfirmed: true,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Updated ${existingMatch.games.length} games with new lineups`,
      gamesUpdated: existingMatch.games.length,
    });
  } catch (e: any) {
    if (e?.code === 'P2025' || /record to update not found/i.test(String(e?.message))) {
      return bad('Match not found', 404);
    }
    console.error('Error updating game lineups:', e);
    return NextResponse.json({ error: e?.message ?? 'Failed to update lineups' }, { status: 500 });
  }
}
