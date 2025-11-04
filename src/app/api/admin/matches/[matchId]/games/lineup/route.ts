// src/app/api/admin/matches/[matchId]/games/lineup/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mapLineupToEntries } from '@/lib/lineupSlots';
import type { GameSlot } from '@prisma/client';

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
// Updates lineups for a match by writing to Lineup/LineupEntry tables (single source of truth)
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

    // Get match with round and team info
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        roundId: true,
        teamAId: true,
        teamBId: true,
        round: {
          select: {
            stopId: true
          }
        }
      },
    });

    if (!match) {
      return bad('Match not found', 404);
    }

    if (!match.teamAId || !match.teamBId) {
      return bad('Match must have both teams');
    }

    // Update lineups using Lineup/LineupEntry tables (single source of truth)
    await prisma.$transaction(async (tx) => {
      // Update Team A lineup
      // Delete existing lineup for this team in this round
      await tx.lineup.deleteMany({
        where: {
          roundId: match.roundId,
          teamId: match.teamAId!
        }
      });

      // Create new lineup
      const lineupA = await tx.lineup.create({
        data: {
          roundId: match.roundId,
          teamId: match.teamAId!,
          stopId: match.round.stopId
        }
      });

      // Create lineup entries
      const entriesA = mapLineupToEntries(body.teamALineup);
      await tx.lineupEntry.createMany({
        data: entriesA.map((entry) => ({
          lineupId: lineupA.id,
          slot: entry.slot as GameSlot,
          player1Id: entry.player1Id!,
          player2Id: entry.player2Id!,
        })),
      });

      // Update Team B lineup
      // Delete existing lineup for this team in this round
      await tx.lineup.deleteMany({
        where: {
          roundId: match.roundId,
          teamId: match.teamBId!
        }
      });

      // Create new lineup
      const lineupB = await tx.lineup.create({
        data: {
          roundId: match.roundId,
          teamId: match.teamBId!,
          stopId: match.round.stopId
        }
      });

      // Create lineup entries
      const entriesB = mapLineupToEntries(body.teamBLineup);
      await tx.lineupEntry.createMany({
        data: entriesB.map((entry) => ({
          lineupId: lineupB.id,
          slot: entry.slot as GameSlot,
          player1Id: entry.player1Id!,
          player2Id: entry.player2Id!,
        })),
      });
    });

    return NextResponse.json({
      ok: true,
      message: 'Updated lineups in Lineup/LineupEntry tables',
    });
  } catch (e: any) {
    if (e?.code === 'P2025' || /record to update not found/i.test(String(e?.message))) {
      return bad('Match not found', 404);
    }
    console.error('Error updating game lineups:', e);
    return NextResponse.json({ error: e?.message ?? 'Failed to update lineups' }, { status: 500 });
  }
}
