// src/app/api/captain/[playerId]/games/[gameId]/scores/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { GameSlot } from '@prisma/client';

type Params = { playerId: string; gameId: string }; // Note: gameId is actually matchId in the UI

type AuthOk = {
  ok: true;
  game: {
    id: string;
    isBye: boolean;
    teamA: { id: string; clubId: string | null } | null;
    teamB: { id: string; clubId: string | null } | null;
    round: { stop: { tournamentId: string } };
  };
  tournamentId: string;
};
type AuthErr = { ok: false; status: number; msg: string };

// helper: auth to edit scores for this match (gameId is actually matchId)
async function canEditScores(prismaClient: typeof prisma, playerId: string, gameId: string): Promise<AuthOk | AuthErr> {
  // Load match scope (teams & tournament) - gameId is actually matchId
  const match = await prismaClient.match.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      isBye: true,
      teamA: { select: { id: true, clubId: true } },
      teamB: { select: { id: true, clubId: true } },
      round: { select: { stop: { select: { tournamentId: true } } } },
    },
  });
  if (!match) return { ok: false, status: 404, msg: 'Match not found' };

  const tournamentId = match.round.stop.tournamentId;
  const clubIds = [match.teamA?.clubId, match.teamB?.clubId].filter(Boolean) as string[];
  const teamIds = [match.teamA?.id, match.teamB?.id].filter(Boolean) as string[];

  // Event Managers for stop
  const isEventMgr =
    (await prismaClient.stop.findFirst({
      where: { 
        tournamentId, 
        eventManagerId: playerId 
      },
      select: { id: true },
    })) != null;

  // Tournament Admins (optional)
  const isAdmin =
    (await prismaClient.tournamentAdmin.findFirst({
      where: { tournamentId, playerId },
      select: { playerId: true },
    })) != null;

  // Captains of either team's club in this tournament
  const isCaptainForClub =
    clubIds.length > 0 &&
    (await prismaClient.tournamentCaptain.findFirst({
      where: { tournamentId, playerId, clubId: { in: clubIds } },
      select: { playerId: true },
    })) != null;

  // Legacy team captains (either teamA/teamB)
  const isLegacyTeamCaptain =
    teamIds.length > 0 &&
    (await prismaClient.team.findFirst({
      where: { id: { in: teamIds }, captainId: playerId },
      select: { id: true },
    })) != null;

  const allowed = isEventMgr || isAdmin || isCaptainForClub || isLegacyTeamCaptain;

  if (!allowed) return { ok: false, status: 403, msg: 'Not authorized' };
  return { ok: true, game: match, tournamentId };
}

// --------------- GET ---------------
// Returns the per-slot scores for a game.
export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  // Use singleton prisma instance
  const { playerId, gameId } = await ctx.params;

  try {
    // We allow viewing for anyone who can edit; tighten/loosen as needed.
    const auth = await canEditScores(prisma, playerId, gameId);
    if (!auth.ok) {
      return NextResponse.json({ error: (auth as AuthErr).msg }, { status: (auth as AuthErr).status });
    }

    const games = await prisma.game.findMany({
      where: { matchId: gameId },
      select: { slot: true, teamAScore: true, teamBScore: true },
      orderBy: { slot: 'asc' },
    });

    return NextResponse.json({
      gameId,
      isBye: auth.game.isBye ?? false,
      slots: games.map((g) => ({
        slot: g.slot,
        teamAScore: g.teamAScore,
        teamBScore: g.teamBScore,
      })),
      teams: {
        teamA: auth.game.teamA ? { id: auth.game.teamA.id, clubId: auth.game.teamA.clubId } : null,
        teamB: auth.game.teamB ? { id: auth.game.teamB.id, clubId: auth.game.teamB.clubId } : null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to load scores', detail: message }, { status: 500 });
  }
}

// --------------- PUT ---------------
// Body: { scores: Array<{ slot: GameSlot, teamAScore: number|null, teamBScore: number|null }> }
export async function PUT(req: Request, ctx: { params: Promise<Params> }) {
  // Use singleton prisma instance
  const { playerId, gameId } = await ctx.params;

  try {
    const body = await req.json().catch(() => ({}));
    const scores: Array<{ slot: GameSlot; teamAScore: number | null; teamBScore: number | null }> = Array.isArray(
      body?.scores
    )
      ? body.scores
      : [];

    const auth = await canEditScores(prisma, playerId, gameId);
    if (!auth.ok) return NextResponse.json({ error: (auth as AuthErr).msg }, { status: (auth as AuthErr).status });
    if (auth.game.isBye) {
      return NextResponse.json({ error: 'Cannot set scores for a BYE game' }, { status: 400 });
    }

    // Validate payload
    for (const s of scores) {
      const a = s.teamAScore;
      const b = s.teamBScore;
      const validNum = (v: any) => v === null || (Number.isInteger(v) && v >= 0 && v <= 1000);
      if (!s.slot) {
        return NextResponse.json({ error: 'slot is required for each score entry' }, { status: 400 });
      }
      if (!validNum(a) || !validNum(b)) {
        return NextResponse.json({ error: 'Scores must be null or non-negative integers ≤ 1000' }, { status: 400 });
      }
    }

    // Upsert per-slot scores
    await prisma.$transaction(async (tx) => {
      for (const s of scores) {
        await tx.game.upsert({
          where: { matchId_slot: { matchId: gameId, slot: s.slot } },
          update: { teamAScore: s.teamAScore, teamBScore: s.teamBScore },
          create: { matchId: gameId, slot: s.slot, teamAScore: s.teamAScore, teamBScore: s.teamBScore },
        });
      }
    });

    // Return fresh state
    const games = await prisma.game.findMany({
      where: { matchId: gameId },
      select: { slot: true, teamAScore: true, teamBScore: true },
      orderBy: { slot: 'asc' },
    });

    return NextResponse.json({
      ok: true,
      gameId,
      slots: games.map((g) => ({
        slot: g.slot,
        teamAScore: g.teamAScore,
        teamBScore: g.teamBScore,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to save scores', detail: message }, { status: 500 });
  }
}
