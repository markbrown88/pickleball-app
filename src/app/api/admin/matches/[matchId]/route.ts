// src/app/api/admin/matches/[matchId]/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { evaluateMatchTiebreaker } from '@/lib/matchTiebreaker';
import { invalidateCache, cacheKeys } from '@/lib/cache';

type Params = { matchId: string };
type Ctx = { params: Promise<Params> };

type PutBody = {
  teamAScore?: number | null;
  teamBScore?: number | null;
};

type ForfeitBody = {
  forfeitTeam?: 'A' | 'B' | null;
};

type MatchUpdateBody = {
  teamAId?: string | null;
  teamBId?: string | null;
};

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

function isValidScore(v: unknown) {
  // allow undefined (not provided), null (clear), or non-negative integers
  return v === undefined || v === null || (Number.isInteger(v) && Number(v) >= 0);
}

async function invalidateMatchCache(matchId: string) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { round: { select: { stopId: true } } }
    });

    if (match?.round.stopId) {
      await invalidateCache(`${cacheKeys.stopSchedule(match.round.stopId)}*`);
      console.log(`[Cache] Invalidated schedule cache for stop: ${match.round.stopId}`);
    }
  } catch (err) {
    console.warn('[Cache] Failed to invalidate match cache:', err);
  }
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
        teamAId: true,
        teamBId: true,
        teamA: { select: { id: true, name: true } },
        teamB: { select: { id: true, name: true } },
        games: {
          select: {
            id: true,
            slot: true,
            teamAScore: true,
            teamBScore: true,
          }
        }
      },
    });
    if (!current) return bad('Match not found', 404);
    // Return the first game's data (assuming single game per match for now)
    const firstGame = current.games[0];
    return NextResponse.json({
      ok: true,
      match: {
        id: current.id,
        slot: firstGame?.slot || null,
        teamAScore: firstGame?.teamAScore || null,
        teamBScore: firstGame?.teamBScore || null,
        gameId: firstGame?.id || current.id,
        teamA: current.teamA ? { id: current.teamA.id, name: current.teamA.name } : null,
        teamB: current.teamB ? { id: current.teamB.id, name: current.teamB.name } : null,
      },
    });
  }

  try {
    // Update the first game in the match (assuming single game per match for now)
    const games = await prisma.game.findMany({
      where: { matchId },
      select: { id: true }
    });

    if (games.length === 0) {
      return bad('No games found for this match');
    }

    const gameId = games[0].id;
    const data: { teamAScore?: number | null; teamBScore?: number | null } = {};
    if (hasA) data.teamAScore = body.teamAScore ?? null;
    if (hasB) data.teamBScore = body.teamBScore ?? null;

    const updated = await prisma.game.update({
      where: { id: gameId },
      data,
      select: {
        id: true,
        slot: true,
        teamAScore: true,
        teamBScore: true,
        match: {
          select: {
            id: true,
            teamA: { select: { id: true, name: true } },
            teamB: { select: { id: true, name: true } },
          }
        }
      },
    });

    // Invalidate schedule cache
    await invalidateMatchCache(matchId);

    return NextResponse.json({
      ok: true,
      match: {
        id: updated.match.id,
        slot: updated.slot,
        teamAScore: updated.teamAScore,
        teamBScore: updated.teamBScore,
        gameId: updated.id,
        teamA: updated.match.teamA ? { id: updated.match.teamA.id, name: updated.match.teamA.name } : null,
        teamB: updated.match.teamB ? { id: updated.match.teamB.id, name: updated.match.teamB.name } : null,
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
        forfeitTeam: true,
        tiebreakerStatus: true,
        tiebreakerWinnerTeamId: true,
        totalPointsTeamA: true,
        totalPointsTeamB: true,
        teamA: { select: { id: true, name: true } },
        teamB: { select: { id: true, name: true } },
        round: {
          select: {
            id: true,
            idx: true,
            stop: { select: { id: true, name: true, tournamentId: true } },
          },
        },
        games: {
          select: {
            id: true,
            slot: true,
            teamAScore: true,
            teamBScore: true,
          }
        }
      },
    });
    if (!match) return bad('Match not found', 404);

    // Get the first game's scores (assuming single game per match for now)
    const firstGame = match.games[0];

    return NextResponse.json({
      id: match.id,
      tiebreakerStatus: match.tiebreakerStatus,
      tiebreakerWinnerTeamId: match.tiebreakerWinnerTeamId,
      forfeitTeam: match.forfeitTeam,
      totalPointsTeamA: match.totalPointsTeamA,
      totalPointsTeamB: match.totalPointsTeamB,
      teamAScore: firstGame?.teamAScore || null,
      teamBScore: firstGame?.teamBScore || null,
      game: {
        id: firstGame?.id || match.id,
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
  const body = (await req.json().catch(() => ({}))) as PutBody | ForfeitBody | MatchUpdateBody;
  
  // Check if this is a match team update (teamAId/teamBId)
  if ('teamAId' in body || 'teamBId' in body) {
    return updateMatchTeams(matchId, body as MatchUpdateBody);
  }
  
  // Check if this is a forfeit request
  if ('forfeitTeam' in body) {
    return handleForfeit(matchId, body as ForfeitBody);
  }
  
  if ('decideByPoints' in body && (body as any).decideByPoints) {
    return decideMatchByPoints(matchId);
  }

  // Otherwise, handle as score update
  return updateMatchScores(matchId, body as PutBody);
}

async function updateMatchTeams(matchId: string, body: MatchUpdateBody) {
  try {
    const updateData: { teamAId?: string | null; teamBId?: string | null } = {};
    
    if ('teamAId' in body) {
      updateData.teamAId = body.teamAId === null ? null : body.teamAId;
    }
    
    if ('teamBId' in body) {
      updateData.teamBId = body.teamBId === null ? null : body.teamBId;
    }
    
    const updated = await prisma.match.update({
      where: { id: matchId },
      data: updateData,
      select: {
        id: true,
        teamAId: true,
        teamBId: true,
        teamA: { select: { id: true, name: true } },
        teamB: { select: { id: true, name: true } },
      },
    });
    
    // Invalidate schedule cache
    await invalidateMatchCache(matchId);
    
    return NextResponse.json({
      ok: true,
      match: updated,
    });
  } catch (e: any) {
    if (e?.code === 'P2025' || /record to update not found/i.test(String(e?.message))) {
      return bad('Match not found', 404);
    }
    return NextResponse.json({ error: e?.message ?? 'Failed to update match teams' }, { status: 500 });
  }
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

      // Invalidate schedule cache
      await invalidateMatchCache(matchId);

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

    await evaluateMatchTiebreaker(prisma, matchId);

    // Invalidate schedule cache
    await invalidateMatchCache(matchId);

    return NextResponse.json({ 
      ok: true, 
      match: {
        id: matchId,
        forfeitTeam: body.forfeitTeam,
        tiebreakerStatus: 'NONE',
        tiebreakerWinnerTeamId: winningTeamId,
        totalPointsTeamA: 0,
        totalPointsTeamB: 0,
      },
    });
  } catch (e: any) {
    console.error(`[FORFEIT] Error processing forfeit for match ${matchId}:`, e);
    return NextResponse.json({ error: e?.message ?? 'Failed to update forfeit status' }, { status: 500 });
  }
}

async function decideMatchByPoints(matchId: string) {
  try {
    console.log(`[DECIDE_BY_POINTS] Starting for match ${matchId}`);
    
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        teamA: { select: { id: true, name: true } },
        teamB: { select: { id: true, name: true } },
        games: true,
      },
    });

    if (!match) {
      console.log(`[DECIDE_BY_POINTS] Match not found: ${matchId}`);
      return bad('Match not found', 404);
    }

    console.log(`[DECIDE_BY_POINTS] Match found: ${match.teamA?.name} vs ${match.teamB?.name}`);
    console.log(`[DECIDE_BY_POINTS] Current status: ${match.tiebreakerStatus}`);

    const standardGames = match.games.filter((g) =>
      ['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_1', 'MIXED_2'].includes(g.slot ?? ''),
    );

    console.log(`[DECIDE_BY_POINTS] Found ${standardGames.length} standard games`);
    standardGames.forEach((g, i) => {
      console.log(`[DECIDE_BY_POINTS] Game ${i}: ${g.slot} - ${g.teamAScore} vs ${g.teamBScore}`);
    });

    if (standardGames.length !== 4 || standardGames.some((g) => g.teamAScore == null || g.teamBScore == null)) {
      console.log(`[DECIDE_BY_POINTS] Not all games complete - cannot decide`);
      return bad('Standard games must be completed before deciding by points.');
    }

    const tally = standardGames.reduce(
      (acc, game) => {
        const a = game.teamAScore ?? 0;
        const b = game.teamBScore ?? 0;
        acc.pointsA += a;
        acc.pointsB += b;
        if (a > b) acc.winsA += 1;
        else if (b > a) acc.winsB += 1;
        return acc;
      },
      { pointsA: 0, pointsB: 0, winsA: 0, winsB: 0 },
    );

    console.log(`[DECIDE_BY_POINTS] Tally: ${tally.pointsA} points vs ${tally.pointsB} points (${tally.winsA} wins vs ${tally.winsB} wins)`);

    // Check if points are equal - if so, can't decide by points
    if (tally.pointsA === tally.pointsB) {
      console.log(`[DECIDE_BY_POINTS] Points are equal - cannot decide`);
      return bad('Total points are tied; a tiebreaker game is required.');
    }

    // Points are unequal - decide by points
    const winnerTeamId = tally.pointsA > tally.pointsB ? match.teamAId : match.teamBId;
    const winnerName = tally.pointsA > tally.pointsB ? match.teamA?.name : match.teamB?.name;

    console.log(`[DECIDE_BY_POINTS] Winner: ${winnerName} (${winnerTeamId})`);
    console.log(`[DECIDE_BY_POINTS] Setting status to DECIDED_POINTS`);

    const updatedMatch = await prisma.match.update({
      where: { id: matchId },
      data: {
        tiebreakerStatus: 'DECIDED_POINTS',
        tiebreakerWinnerTeamId: winnerTeamId,
        totalPointsTeamA: tally.pointsA,
        totalPointsTeamB: tally.pointsB,
        tiebreakerDecidedAt: new Date(),
      },
      select: {
        id: true,
        tiebreakerStatus: true,
        tiebreakerWinnerTeamId: true,
        totalPointsTeamA: true,
        totalPointsTeamB: true,
      },
    });

    console.log(`[DECIDE_BY_POINTS] Match updated:`, updatedMatch);

    // DO NOT call evaluateMatchTiebreaker here - it will recalculate and override DECIDED_POINTS status
    // The match is now in a decided state and should not be re-evaluated
    console.log(`[DECIDE_BY_POINTS] Match decided by total points`);

    return NextResponse.json({
      ok: true,
      match: updatedMatch,
    });
  } catch (error) {
    console.error('[DECIDE_BY_POINTS] Error:', error);
    return NextResponse.json({ error: 'Failed to decide match by points' }, { status: 500 });
  }
}
