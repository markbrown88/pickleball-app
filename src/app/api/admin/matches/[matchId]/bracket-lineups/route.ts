// src/app/api/admin/matches/[matchId]/bracket-lineups/route.ts
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
// Updates lineups for games grouped by bracket
export async function PATCH(req: Request, ctx: Ctx) {
  const { matchId } = await ctx.params;

  try {
    const body = (await req.json().catch(() => ({}))) as LineupData;

    if (!body.lineupsByBracket || typeof body.lineupsByBracket !== 'object') {
      return bad('lineupsByBracket is required and must be an object');
    }

    // Validate lineup data structure
    for (const [bracketId, teamsLineups] of Object.entries(body.lineupsByBracket)) {
      if (typeof teamsLineups !== 'object') {
        return bad(`Invalid lineups for bracket ${bracketId}`);
      }
      for (const [teamId, lineup] of Object.entries(teamsLineups)) {
        if (!Array.isArray(lineup) || lineup.length !== 4) {
          return bad(`Lineup for team ${teamId} in bracket ${bracketId} must be an array of 4 players`);
        }
      }
    }

    // Check if match exists
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

    if (existingMatch.games.length === 0) {
      return bad('No games found for this match');
    }

    // Update games for each bracket
    let totalUpdated = 0;
    for (const [bracketId, teamsLineups] of Object.entries(body.lineupsByBracket)) {
      const teamAId = existingMatch.teamA?.id;
      const teamBId = existingMatch.teamB?.id;

      if (!teamAId || !teamBId) {
        continue;
      }

      const teamALineup = teamsLineups[teamAId];
      const teamBLineup = teamsLineups[teamBId];

      if (!teamALineup || !teamBLineup) {
        continue;
      }

      // Update all games with this bracketId
      const result = await prisma.game.updateMany({
        where: {
          matchId,
          bracketId,
        },
        data: {
          teamALineup: teamALineup as any,
          teamBLineup: teamBLineup as any,
          lineupConfirmed: true,
        },
      });

      totalUpdated += result.count;
    }

    return NextResponse.json({
      ok: true,
      message: `Updated ${totalUpdated} games with bracket-specific lineups`,
      gamesUpdated: totalUpdated,
    });
  } catch (e: any) {
    if (e?.code === 'P2025' || /record to update not found/i.test(String(e?.message))) {
      return bad('Match not found', 404);
    }
    console.error('Error updating bracket lineups:', e);
    return NextResponse.json({ error: e?.message ?? 'Failed to update lineups' }, { status: 500 });
  }
}
