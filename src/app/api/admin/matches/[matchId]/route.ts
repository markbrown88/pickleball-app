// src/app/api/admin/matches/[matchId]/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { evaluateMatchTiebreaker } from '@/lib/matchTiebreaker';
import { invalidateCache, cacheKeys } from '@/lib/cache';
import { advanceTeamsInBracket } from '@/lib/bracketAdvancement';

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

import { requireAuth, requireStopAccess } from '@/lib/auth';

// ...

// ---------- GET /api/admin/matches/:matchId ----------
export async function GET(_req: Request, ctx: Ctx) {
  const { matchId } = await ctx.params;

  // 1. Authenticate
  const authResult = await requireAuth('tournament_admin');
  if (authResult instanceof NextResponse) return authResult;

  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        // ... select fields ...
        round: {
          select: {
            id: true,
            idx: true,
            stop: { select: { id: true, name: true, tournamentId: true } },
          },
        },
        // ...
      },
    });
    if (!match) return bad('Match not found', 404);

    // 2. Authorize
    if (match.round) {
      const stopAccessResult = await requireStopAccess(authResult, match.round.stop.id);
      if (stopAccessResult instanceof NextResponse) return stopAccessResult;
    }

    // ... rest of GET ...

    // ---------- PUT /api/admin/matches/:matchId ----------
    export async function PUT(req: Request, ctx: Ctx) {
      const { matchId } = await ctx.params;

      // 1. Authenticate
      const authResult = await requireAuth('tournament_admin');
      if (authResult instanceof NextResponse) return authResult;

      // 2. Authorize (Fetch minimal info)
      const matchAuth = await prisma.match.findUnique({
        where: { id: matchId },
        select: { round: { select: { stopId: true } } }
      });
      if (!matchAuth) return bad('Match not found', 404);
      if (matchAuth.round) {
        const stopAccessResult = await requireStopAccess(authResult, matchAuth.round.stopId);
        if (stopAccessResult instanceof NextResponse) return stopAccessResult;
      }

      const body = (await req.json().catch(() => ({}))) as PutBody;
      return updateMatchScores(matchId, body);
    }

    // ---------- PATCH /api/admin/matches/:matchId ----------
    export async function PATCH(req: Request, ctx: Ctx) {
      const { matchId } = await ctx.params;

      // 1. Authenticate
      const authResult = await requireAuth('tournament_admin');
      if (authResult instanceof NextResponse) return authResult;

      // 2. Authorize (Fetch minimal info)
      const matchAuth = await prisma.match.findUnique({
        where: { id: matchId },
        select: { round: { select: { stopId: true } } }
      });
      if (!matchAuth) return bad('Match not found', 404);
      if (matchAuth.round) {
        const stopAccessResult = await requireStopAccess(authResult, matchAuth.round.stopId);
        if (stopAccessResult instanceof NextResponse) return stopAccessResult;
      }

      const body = (await req.json().catch(() => ({}))) as PutBody | ForfeitBody | MatchUpdateBody;

      // ... rest of PATCH ...

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

      try {
        // Validate forfeit team value
        if (body.forfeitTeam !== null && body.forfeitTeam !== 'A' && body.forfeitTeam !== 'B') {
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
          return bad('Match not found', 404);
        }

        if (match.isBye) {
          return bad('Cannot forfeit a BYE match', 400);
        }


        // If forfeitTeam is null, just clear the forfeit
        if (body.forfeitTeam === null) {
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
        // Use a transaction to ensure atomicity
        const result = await prisma.$transaction(async (tx) => {
          // Determine winning team based on forfeit
          const winningTeamId = body.forfeitTeam === 'A' ? match.teamB?.id : match.teamA?.id;
          const losingTeamId = body.forfeitTeam === 'A' ? match.teamA?.id : match.teamB?.id;

          if (!winningTeamId) {
            throw new Error('Cannot determine winning team');
          }

          // Update the match with forfeit information and current timestamp
          const currentTime = new Date();

          // Update all games for this match to reflect the forfeit (excluding Tiebreaker)
          await tx.game.updateMany({
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
              endedAt: currentTime // Set the endedAt time to the forfeit time
            }
          });

          // Get match with round info for bracket advancement
          const matchWithRound = await tx.match.findUnique({
            where: { id: matchId },
            select: {
              id: true,
              winnerId: true,
              teamAId: true,
              teamBId: true,
              round: {
                select: {
                  stopId: true,
                  bracketType: true,
                  depth: true,
                },
              },
            },
          });

          if (!matchWithRound) {
            throw new Error('Match not found');
          }

          // Update the match with forfeit information, winner, and timestamp
          const updatedMatch = await tx.match.update({
            where: { id: matchId },
            data: {
              forfeitTeam: body.forfeitTeam,
              winnerId: winningTeamId, // Set the winner to trigger bracket progression
              updatedAt: currentTime // Update the timestamp to current time
            },
            select: {
              id: true,
              forfeitTeam: true,
              winnerId: true,
              updatedAt: true,
              round: {
                select: {
                  stopId: true
                }
              }
            }
          });

          // Evaluate tiebreaker status (will set to DECIDED by forfeit)
          await evaluateMatchTiebreaker(tx, matchId);

          // Advance teams in bracket using shared utility
          const advancementResult = await advanceTeamsInBracket(
            tx,
            matchId,
            winningTeamId,
            losingTeamId || null,
            matchWithRound
          );

          console.log('[FORFEIT] Bracket advancement completed:', {
            winnerId: advancementResult.winnerId,
            loserId: advancementResult.loserId,
            advancedWinnerMatches: advancementResult.advancedWinnerMatches,
            advancedLoserMatches: advancementResult.advancedLoserMatches,
          });

          return { updatedMatch, advancementResult, winningTeamId };
        });

        // Invalidate schedule cache
        await invalidateMatchCache(matchId);

        return NextResponse.json({
          ok: true,
          match: {
            id: matchId,
            forfeitTeam: body.forfeitTeam,
            winnerId: result.winningTeamId,
            tiebreakerStatus: 'NONE',
            tiebreakerWinnerTeamId: result.winningTeamId,
            totalPointsTeamA: 0,
            totalPointsTeamB: 0,
          },
          advancementResult: {
            advancedWinnerMatches: result.advancementResult.advancedWinnerMatches,
            advancedLoserMatches: result.advancementResult.advancedLoserMatches,
          },
        });
      } catch (e: any) {
        console.error(`[FORFEIT] Error processing forfeit for match ${matchId}:`, e);
        return NextResponse.json({ error: e?.message ?? 'Failed to update forfeit status' }, { status: 500 });
      }
    }

    async function decideMatchByPoints(matchId: string) {
      try {

        const match = await prisma.match.findUnique({
          where: { id: matchId },
          include: {
            teamA: { select: { id: true, name: true } },
            teamB: { select: { id: true, name: true } },
            games: true,
          },
        });

        if (!match) {
          return bad('Match not found', 404);
        }


        // Get standard games (not tiebreakers)
        const standardGames = match.games.filter((g) =>
          ['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_1', 'MIXED_2'].includes(g.slot ?? ''),
        );

        // Check if this is a DE Clubs tournament (games have bracketId)
        const isDEClubs = standardGames.some(g => g.bracketId != null);

        if (isDEClubs) {
          // For DE Clubs, we need ALL games across ALL brackets to be completed
          // Each bracket has 4 games, so we should have 4 * number of brackets
          if (standardGames.length === 0 || standardGames.some((g) => g.teamAScore == null || g.teamBScore == null)) {
            return bad('All standard games across all brackets must be completed before deciding by points.');
          }
        } else {
          // For regular tournaments, we need exactly 4 standard games
          if (standardGames.length !== 4 || standardGames.some((g) => g.teamAScore == null || g.teamBScore == null)) {
            return bad('Standard games must be completed before deciding by points.');
          }
        }

        // Calculate total points and wins across all games (whether DE Clubs or regular)
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


        // Check if points are equal - if so, can't decide by points
        if (tally.pointsA === tally.pointsB) {
          return bad('Total points are tied; a tiebreaker game is required.');
        }

        // Points are unequal - decide by points
        const winnerTeamId = tally.pointsA > tally.pointsB ? match.teamAId : match.teamBId;
        const loserTeamId = tally.pointsA > tally.pointsB ? match.teamBId : match.teamAId;

        if (!winnerTeamId) {
          return bad('Cannot determine winner team ID');
        }

        // Use a transaction to atomically update match and advance teams in bracket
        const result = await prisma.$transaction(async (tx) => {
          // Get match with round info for bracket advancement
          const matchWithRound = await tx.match.findUnique({
            where: { id: matchId },
            select: {
              id: true,
              winnerId: true,
              teamAId: true,
              teamBId: true,
              round: {
                select: {
                  stopId: true,
                  bracketType: true,
                  depth: true,
                },
              },
            },
          });

          if (!matchWithRound) {
            throw new Error('Match not found');
          }

          // Update match with winner and tiebreaker info
          const updatedMatch = await tx.match.update({
            where: { id: matchId },
            data: {
              winnerId: winnerTeamId, // Set the actual winner to trigger bracket progression
              tiebreakerStatus: 'DECIDED_POINTS',
              tiebreakerWinnerTeamId: winnerTeamId,
              totalPointsTeamA: tally.pointsA,
              totalPointsTeamB: tally.pointsB,
              tiebreakerDecidedAt: new Date(),
            },
            select: {
              id: true,
              winnerId: true,
              tiebreakerStatus: true,
              tiebreakerWinnerTeamId: true,
              totalPointsTeamA: true,
              totalPointsTeamB: true,
            },
          });

          // Advance teams in bracket using shared utility
          const advancementResult = await advanceTeamsInBracket(
            tx,
            matchId,
            winnerTeamId,
            loserTeamId || null,
            matchWithRound
          );

          console.log('[DECIDE_BY_POINTS] Bracket advancement completed:', {
            winnerId: advancementResult.winnerId,
            loserId: advancementResult.loserId,
            advancedWinnerMatches: advancementResult.advancedWinnerMatches,
            advancedLoserMatches: advancementResult.advancedLoserMatches,
          });

          return { updatedMatch, advancementResult };
        });

        // Invalidate match cache
        await invalidateMatchCache(matchId);

        // DO NOT call evaluateMatchTiebreaker here - it will recalculate and override DECIDED_POINTS status
        // The match is now in a decided state and should not be re-evaluated

        return NextResponse.json({
          ok: true,
          match: result.updatedMatch,
          advancementResult: {
            advancedWinnerMatches: result.advancementResult.advancedWinnerMatches,
            advancedLoserMatches: result.advancementResult.advancedLoserMatches,
          },
        });
      } catch (error) {
        console.error('[DECIDE_BY_POINTS] Error:', error);
        return NextResponse.json({ error: 'Failed to decide match by points' }, { status: 500 });
      }
    }
