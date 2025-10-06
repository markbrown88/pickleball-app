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

type ForfeitBody = {
  forfeitTeam?: 'A' | 'B' | null;
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
        teamA: { select: { id: true, name: true } },
        teamB: { select: { id: true, name: true } },
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
        gameId: current.id,
        teamA: current.teamA ? { id: current.teamA.id, name: current.teamA.name } : null,
        teamB: current.teamB ? { id: current.teamB.id, name: current.teamB.name } : null,
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
        teamA: { select: { id: true, name: true } },
        teamB: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      ok: true,
      match: {
        id: updated.id,
        slot: updated.slot,
        teamAScore: updated.teamAScore,
        teamBScore: updated.teamBScore,
        gameId: updated.id,
        teamA: updated.teamA ? { id: updated.teamA.id, name: updated.teamA.name } : null,
        teamB: updated.teamB ? { id: updated.teamB.id, name: updated.teamB.name } : null,
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
      select: {
        id: true,
        isBye: true,
        teamAScore: true,
        teamBScore: true,
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
    });
    if (!match) return bad('Match not found', 404);

    return NextResponse.json({
      id: match.id,
      teamAScore: match.teamAScore,
      teamBScore: match.teamBScore,
      game: {
        id: match.id,
        isBye: match.isBye,
        teamA: match.teamA ? { id: match.teamA.id, name: match.teamA.name } : null,
        teamB: match.teamB ? { id: match.teamB.id, name: match.teamB.name } : null,
        round: match.round
          ? {
              id: match.round.id,
              idx: match.round.idx,
              stopId: match.round.stop.id,
              stopName: match.round.stop.name,
              tournamentId: match.round.stop.tournamentId,
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
  const body = (await req.json().catch(() => ({}))) as PutBody | ForfeitBody;
  
  // Check if this is a forfeit request
  if ('forfeitTeam' in body) {
    return handleForfeit(matchId, body as ForfeitBody);
  }
  
  // Otherwise, handle as score update
  return updateMatchScores(matchId, body as PutBody);
}

async function handleForfeit(matchId: string, body: ForfeitBody) {
  console.log(`[FORFEIT] Starting forfeit process for match ${matchId}, forfeitTeam: ${body.forfeitTeam}`);
  
  try {
    // Validate forfeit team value
    if (body.forfeitTeam !== null && body.forfeitTeam !== 'A' && body.forfeitTeam !== 'B') {
      console.log(`[FORFEIT] Invalid forfeitTeam value: ${body.forfeitTeam}`);
      return bad('forfeitTeam must be "A", "B", or null');
    }

    // Get match with all related data
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { 
        id: true, 
        isBye: true,
        teamAId: true,
        teamBId: true,
        teamA: { select: { id: true, name: true } },
        teamB: { select: { id: true, name: true } }
      }
    });

    if (!match) {
      console.log(`[FORFEIT] Match not found: ${matchId}`);
      return bad('Match not found', 404);
    }

    if (match.isBye) {
      console.log(`[FORFEIT] Cannot forfeit BYE match: ${matchId}`);
      return bad('Cannot forfeit a BYE match', 400);
    }

    console.log(`[FORFEIT] Match found: ${matchId}, Team A: ${match.teamA?.name}, Team B: ${match.teamB?.name}`);

    // If forfeitTeam is null, just clear the forfeit
    if (body.forfeitTeam === null) {
      console.log(`[FORFEIT] Clearing forfeit for match ${matchId}`);
      await prisma.match.update({
        where: { id: matchId },
        data: { 
          forfeitTeam: null,
          updatedAt: new Date() // Update the timestamp to current time
        }
      });
      
      return NextResponse.json({ 
        ok: true, 
        matchId, 
        forfeitTeam: null,
        message: 'Forfeit cleared'
      });
    }

    // Handle actual forfeit - mark all games as complete and give win to non-forfeiting team
    console.log(`[FORFEIT] Processing forfeit: Team ${body.forfeitTeam} forfeits`);
    
    // Get all games for this match
    const games = await prisma.game.findMany({
      where: { matchId: matchId },
      select: {
        id: true,
        slot: true
      }
    });

    console.log(`[FORFEIT] Found ${games.length} games for match ${matchId}`);

    // Update the match with forfeit information and current timestamp
    const currentTime = new Date();
    console.log(`[FORFEIT] Updating match ${matchId} with forfeitTeam: ${body.forfeitTeam}, updatedAt: ${currentTime.toISOString()}`);
    
    const updatedMatch = await prisma.match.update({
      where: { id: matchId },
      data: { 
        forfeitTeam: body.forfeitTeam,
        updatedAt: currentTime // Update the timestamp to current time
      },
      select: {
        id: true,
        forfeitTeam: true,
        updatedAt: true
      }
    });
    
    console.log(`[FORFEIT] Match updated successfully:`, updatedMatch);

    // Mark all games for this match as complete with appropriate scores
    console.log(`[FORFEIT] Updating games for match ${matchId} (${match.teamA?.name} vs ${match.teamB?.name})`);
    
    // Determine winning team based on forfeit
    const winningTeamId = body.forfeitTeam === 'A' ? match.teamB?.id : match.teamA?.id;
    const losingTeamId = body.forfeitTeam === 'A' ? match.teamA?.id : match.teamB?.id;
    
    console.log(`[FORFEIT] Match ${matchId}: Winner=${winningTeamId}, Loser=${losingTeamId}`);
    
    // Set the forfeit time for all games
    const forfeitTime = currentTime;
    
    // Update all games for this match to reflect the forfeit (excluding Tiebreaker)
    await prisma.game.updateMany({
      where: { 
        matchId: matchId,
        slot: {
          not: 'TIEBREAKER' // Skip tiebreaker games
        }
      },
      data: {
        teamAScore: body.forfeitTeam === 'A' ? 0 : 1, // Forfeiting team gets 0, winning team gets 1
        teamBScore: body.forfeitTeam === 'B' ? 0 : 1, // Forfeiting team gets 0, winning team gets 1
        isComplete: true, // Mark games as complete
        endedAt: forfeitTime // Set the endedAt time to the forfeit time
      }
    });

    console.log(`[FORFEIT] Successfully processed forfeit for match ${matchId}`);
    
    return NextResponse.json({ 
      ok: true, 
      matchId, 
      forfeitTeam: body.forfeitTeam,
      gamesUpdated: games.length,
      message: `Team ${body.forfeitTeam} forfeited. ${games.length} games marked as complete.`
    });
  } catch (e: any) {
    console.error(`[FORFEIT] Error processing forfeit for match ${matchId}:`, e);
    return NextResponse.json({ error: e?.message ?? 'Failed to update forfeit status' }, { status: 500 });
  }
}
