// src/app/api/admin/matches/[matchId]/lineup/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { GameSlot } from '@prisma/client';

type Params = { matchId: string };
type Ctx = { params: Promise<Params> };

type LineupData = {
  teamALineup?: Array<{
    slot: GameSlot;
    player1Id: string | null;
    player2Id: string | null;
  }> | null;
  teamBLineup?: Array<{
    slot: GameSlot;
    player1Id: string | null;
    player2Id: string | null;
  }> | null;
  lineupConfirmed?: boolean;
};

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

function isValidSlot(v: unknown): v is GameSlot {
  return typeof v === 'string' && ['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_1', 'MIXED_2', 'TIEBREAKER'].includes(v);
}

// ---------- GET /api/admin/matches/:matchId/lineup ----------
export async function GET(_req: Request, ctx: Ctx) {
  const { matchId } = await ctx.params;
  // Use singleton prisma instance

  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        teamA: { select: { id: true, name: true } },
        teamB: { select: { id: true, name: true } },
        games: {
          select: {
            id: true,
            slot: true,
            teamALineup: true,
            teamBLineup: true,
            lineupConfirmed: true,
          }
        }
      },
    });

    if (!match) {
      return bad('Match not found', 404);
    }

    // Combine lineups from first game (they should all have same lineups)
    const teamALineup = match.games[0]?.teamALineup || null;
    const teamBLineup = match.games[0]?.teamBLineup || null;
    const lineupConfirmed = match.games[0]?.lineupConfirmed || false;

    return NextResponse.json({
      id: match.id,
      teamALineup,
      teamBLineup,
      lineupConfirmed,
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
export async function PATCH(req: Request, ctx: Ctx) {
  const { matchId } = await ctx.params;
  // Use singleton prisma instance

  try {
    const body = (await req.json().catch(() => ({}))) as LineupData;

    // Validate lineup data if provided
    if (body.teamALineup !== undefined) {
      if (body.teamALineup !== null && !Array.isArray(body.teamALineup)) {
        return bad('teamALineup must be an array or null');
      }
      if (Array.isArray(body.teamALineup)) {
        for (const entry of body.teamALineup) {
          if (!entry || typeof entry !== 'object') {
            return bad('Each lineup entry must be an object');
          }
          if (!isValidSlot(entry.slot)) {
            return bad(`Invalid slot: ${entry.slot}`);
          }
          if (entry.player1Id !== null && typeof entry.player1Id !== 'string') {
            return bad('player1Id must be a string or null');
          }
          if (entry.player2Id !== null && typeof entry.player2Id !== 'string') {
            return bad('player2Id must be a string or null');
          }
        }
      }
    }

    if (body.teamBLineup !== undefined) {
      if (body.teamBLineup !== null && !Array.isArray(body.teamBLineup)) {
        return bad('teamBLineup must be an array or null');
      }
      if (Array.isArray(body.teamBLineup)) {
        for (const entry of body.teamBLineup) {
          if (!entry || typeof entry !== 'object') {
            return bad('Each lineup entry must be an object');
          }
          if (!isValidSlot(entry.slot)) {
            return bad(`Invalid slot: ${entry.slot}`);
          }
          if (entry.player1Id !== null && typeof entry.player1Id !== 'string') {
            return bad('player1Id must be a string or null');
          }
          if (entry.player2Id !== null && typeof entry.player2Id !== 'string') {
            return bad('player2Id must be a string or null');
          }
        }
      }
    }

    // Check if match exists
    const existingMatch = await prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true },
    });

    if (!existingMatch) {
      return bad('Match not found', 404);
    }

    // Update the first game in the match (assuming single game per match for now)
    const games = await prisma.game.findMany({
      where: { matchId },
      select: { id: true }
    });

    if (games.length === 0) {
      return bad('No games found for this match');
    }

    const gameId = games[0].id;
    const updated = await prisma.game.update({
      where: { id: gameId },
      data: {
        teamALineup: body.teamALineup !== undefined ? body.teamALineup as any : undefined,
        teamBLineup: body.teamBLineup !== undefined ? body.teamBLineup as any : undefined,
        lineupConfirmed: body.lineupConfirmed !== undefined ? body.lineupConfirmed : undefined,
      },
      select: {
        id: true,
        slot: true,
        teamALineup: true,
        teamBLineup: true,
        lineupConfirmed: true,
        match: {
          select: {
            id: true,
            teamA: { select: { id: true, name: true } },
            teamB: { select: { id: true, name: true } },
          }
        }
      },
    });

    return NextResponse.json({
      ok: true,
      match: {
        id: updated.match.id,
        slot: updated.slot,
        teamALineup: updated.teamALineup,
        teamBLineup: updated.teamBLineup,
        lineupConfirmed: updated.lineupConfirmed,
        game: {
          id: updated.id,
          teamA: updated.match.teamA ? { id: updated.match.teamA.id, name: updated.match.teamA.name } : null,
          teamB: updated.match.teamB ? { id: updated.match.teamB.id, name: updated.match.teamB.name } : null,
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
