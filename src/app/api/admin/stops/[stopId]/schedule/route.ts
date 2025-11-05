// src/app
//  /route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { getActAsHeaderFromRequest, getEffectivePlayer } from '@/lib/actAs';
import { evaluateMatchTiebreaker } from '@/lib/matchTiebreaker';
import { getCached, cacheKeys, CACHE_TTL } from '@/lib/cache';

type Ctx = { params: Promise<{ stopId: string }> };

/** Coerce a possibly-empty or "null" string into a nullable id. */
function normalizeBracketId(v: unknown): string | null | undefined {
  if (v === undefined) return undefined; // means "all brackets"
  if (v === null) return null;
  const s = String(v).trim();
  if (s === '' || s.toLowerCase() === 'null') return null;
  return s;
}

/**
 * Minimal DB shape for helpers that run both on PrismaClient and TransactionClient.
 * Using delegates avoids the "Omit<PrismaClient,...> is not assignable to PrismaClient" TS2345.
 */
type DB = {
  round: Prisma.RoundDelegate<any>;
};

/** Delete empty rounds and compact round idx for a stop (0..n-1). */
async function pruneAndCompact(db: DB, stopId: string, opts?: { prune?: boolean; compact?: boolean }) {
  const doPrune = !!opts?.prune;
  const doCompact = !!opts?.compact;

  if (doPrune) {
    const empties = await db.round.findMany({
      where: { stopId, matches: { none: {} } },
      select: { id: true },
    });
    if (empties.length) {
      await db.round.deleteMany({ where: { id: { in: empties.map(e => e.id) } } });
    }
  }

  if (doCompact) {
    const rounds = await db.round.findMany({
      where: { stopId },
      orderBy: { idx: 'asc' },
      select: { id: true },
    });
    for (let i = 0; i < rounds.length; i++) {
      await db.round.update({ where: { id: rounds[i].id }, data: { idx: i } });
    }
  }
}

export async function GET(req: Request, ctx: Ctx) {
  try {
    // Authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Support Act As functionality
    const actAsPlayerId = getActAsHeaderFromRequest(req);
    const effectivePlayer = await getEffectivePlayer(actAsPlayerId);

    const { stopId } = await ctx.params;
    // Use singleton prisma instance
    const { searchParams } = new URL(req.url);
    const bracketFilter = normalizeBracketId(searchParams.get('bracketId'));

    // Validate stop (nice 404 if wrong id)
    const stop = await prisma.stop.findUnique({
      where: { id: stopId },
      select: { id: true, tournamentId: true, tournament: { select: { type: true } } },
    });
    if (!stop) {
      return NextResponse.json({ error: `Stop not found: ${stopId}` }, { status: 404 });
    }

    // Check if this is a double elimination tournament (they use game-level lineups, not round-level)
    const isDoubleElimination = stop.tournament?.type === 'DOUBLE_ELIMINATION' || stop.tournament?.type === 'DOUBLE_ELIMINATION_CLUBS';

    // Authorization: Check if user is admin or event manager for this stop
    if (!effectivePlayer.isAppAdmin) {
      const isEventManager = await prisma.stop.findFirst({
        where: {
          id: stopId,
          eventManagerId: effectivePlayer.targetPlayerId
        }
      });

      const isTournamentEventManager = await prisma.tournamentEventManager.findFirst({
        where: {
          tournamentId: stop.tournamentId,
          playerId: effectivePlayer.targetPlayerId
        }
      });

      if (!isEventManager && !isTournamentEventManager) {
        return NextResponse.json({ error: 'Not authorized to view this schedule' }, { status: 403 });
      }
    }

    // Cache the schedule data (60 second TTL)
    // Cache key includes bracketFilter to cache different bracket views separately
    const cacheKey = bracketFilter
      ? `${cacheKeys.stopSchedule(stopId)}:bracket:${bracketFilter}`
      : cacheKeys.stopSchedule(stopId);

    const filteredRounds = await getCached(
      cacheKey,
      async () => {
        const roundsRaw = await prisma.round.findMany({
      where: { stopId },
      orderBy: { idx: 'asc' },
      include: {
        matches: {
          orderBy: { id: 'asc' },
          select: {
            id: true,
            isBye: true,
            forfeitTeam: true,
            roundId: true,
            teamAId: true,
            teamBId: true,
            sourceMatchAId: true,
            sourceMatchBId: true,
            winnerId: true,
            seedA: true,
            seedB: true,
            teamA: {
              select: {
                id: true,
                name: true,
                clubId: true,
                bracket: { select: { id: true, name: true } },
              },
            },
            teamB: {
              select: {
                id: true,
                name: true,
                clubId: true,
                bracket: { select: { id: true, name: true } },
              },
            },
            games: {
              orderBy: [
                { bracket: { idx: 'asc' } },
                { slot: 'asc' }
              ],
              select: {
                id: true,
                slot: true,
                bracketId: true,
                bracket: {
                  select: {
                    id: true,
                    name: true,
                  }
                },
                teamAScore: true,
                teamBScore: true,
                courtNumber: true,
                isComplete: true,
                startedAt: true,
                endedAt: true,
                createdAt: true,
                teamAScoreSubmitted: true,
                teamBScoreSubmitted: true,
                teamASubmittedScore: true,
                teamBSubmittedScore: true,
              }
            },
            tiebreakerStatus: true,
            tiebreakerWinnerTeamId: true,
            tiebreakerGameId: true,
            tiebreakerDecidedAt: true,
            totalPointsTeamA: true,
            totalPointsTeamB: true,
          },
        },
        lineups: isDoubleElimination ? undefined : {
          include: {
            entries: {
              include: {
                player1: {
                  select: {
                    id: true,
                    name: true,
                    firstName: true,
                    lastName: true,
                    gender: true
                  }
                },
                player2: {
                  select: {
                    id: true,
                    name: true,
                    firstName: true,
                    lastName: true,
                    gender: true
                  }
                }
              }
            }
          }
        }
      },
    });

    // Build a map of lineups by roundId and teamId (only for non-DE tournaments)
    const lineupMap = new Map<string, any[]>();
    if (!isDoubleElimination && roundsRaw[0]?.lineups) {
      roundsRaw.forEach((round) => {
        round.lineups?.forEach((lineup: any) => {
          const key = `${round.id}-${lineup.teamId}`;
          const players: any[] = [];

          // Extract players from lineup entries in order: [Man1, Man2, Woman1, Woman2]
          const mensDoubles = lineup.entries?.find((e: any) => e.slot === 'MENS_DOUBLES');
          const womensDoubles = lineup.entries?.find((e: any) => e.slot === 'WOMENS_DOUBLES');

          if (mensDoubles) {
            if (mensDoubles.player1) {
              players[0] = {
                id: mensDoubles.player1.id,
                name: mensDoubles.player1.name || `${mensDoubles.player1.firstName || ''} ${mensDoubles.player1.lastName || ''}`.trim(),
                gender: mensDoubles.player1.gender
              };
            }
            if (mensDoubles.player2) {
              players[1] = {
                id: mensDoubles.player2.id,
                name: mensDoubles.player2.name || `${mensDoubles.player2.firstName || ''} ${mensDoubles.player2.lastName || ''}`.trim(),
                gender: mensDoubles.player2.gender
              };
            }
          }

          if (womensDoubles) {
            if (womensDoubles.player1) {
              players[2] = {
                id: womensDoubles.player1.id,
                name: womensDoubles.player1.name || `${womensDoubles.player1.firstName || ''} ${womensDoubles.player1.lastName || ''}`.trim(),
                gender: womensDoubles.player1.gender
              };
            }
            if (womensDoubles.player2) {
              players[3] = {
                id: womensDoubles.player2.id,
                name: womensDoubles.player2.name || `${womensDoubles.player2.firstName || ''} ${womensDoubles.player2.lastName || ''}`.trim(),
                gender: womensDoubles.player2.gender
              };
            }
          }

          // Only add to map if we have a complete lineup (4 players)
          if (players[0] && players[1] && players[2] && players[3]) {
            lineupMap.set(key, players);
          }
        });
      });
    }


    const rounds = await Promise.all(
      roundsRaw.map(async (r) => {
        const matches = await Promise.all(
          r.matches.map(async (match) => {
              // Do NOT re-evaluate tiebreaker status when loading - just return current database state
              const resolved = match;
              const games = resolved.games ?? match.games ?? [];

              const inferredBracketId =
                match.teamA?.bracket?.id ?? match.teamB?.bracket?.id ?? null;
              const inferredBracketName =
                match.teamA?.bracket?.name ?? match.teamB?.bracket?.name ?? null;

              if (
                bracketFilter !== undefined &&
                bracketFilter !== null &&
                inferredBracketId !== bracketFilter
              ) {
                return null;
              }

              const baseMatchStatus = (() => {
                if (games.some((g) => g.startedAt && !g.endedAt && !g.isComplete)) return 'in_progress';
                if (games.every((g) => g.isComplete)) return 'completed';
                if (games.some((g) => g.teamAScoreSubmitted || g.teamBScoreSubmitted)) return 'in_progress';
                return 'not_started';
              })();

              const matchStatus = (() => {
                switch (resolved.tiebreakerStatus) {
                  case 'NEEDS_DECISION':
                  case 'REQUIRES_TIEBREAKER':
                  case 'PENDING_TIEBREAKER':
                    return 'in_progress';
                  case 'DECIDED_POINTS':
                  case 'DECIDED_TIEBREAKER':
                    return 'completed';
                  default:
                    return baseMatchStatus;
                }
              })();

              const teamALineupKey = resolved.teamAId ? `${r.id}-${resolved.teamAId}` : null;
              const teamBLineupKey = resolved.teamBId ? `${r.id}-${resolved.teamBId}` : null;
              const roundLevelTeamALineup = teamALineupKey ? lineupMap.get(teamALineupKey) || null : null;
              const roundLevelTeamBLineup = teamBLineupKey ? lineupMap.get(teamBLineupKey) || null : null;

              // For games with lineup data stored directly on them, use that instead of round-level lineups
              // This is used for DE/Club tournaments
              // Note: Game-level lineups are stored as JSON fields and will be included automatically
              const firstGameWithLineup = games.find((g: any) => (g as any).teamALineup && (g as any).teamBLineup);
              const gameLevelTeamALineup = firstGameWithLineup ? (firstGameWithLineup as any).teamALineup : null;
              const gameLevelTeamBLineup = firstGameWithLineup ? (firstGameWithLineup as any).teamBLineup : null;

              // Prefer game-level lineups over round-level lineups (game-level is for DE, round-level is for Team)
              const teamALineup = gameLevelTeamALineup || roundLevelTeamALineup;
              const teamBLineup = gameLevelTeamBLineup || roundLevelTeamBLineup;

              return {
                id: match.id,
                teamA: match.teamA,
                teamB: match.teamB,
                isBye: match.isBye,
                forfeitTeam: match.forfeitTeam,
                sourceMatchAId: match.sourceMatchAId,
                sourceMatchBId: match.sourceMatchBId,
                winnerId: match.winnerId,
                seedA: match.seedA,
                seedB: match.seedB,
                bracketId: inferredBracketId,
                bracketName: inferredBracketName,
                tiebreakerStatus: resolved.tiebreakerStatus,
                tiebreakerWinnerTeamId: resolved.tiebreakerWinnerTeamId,
                tiebreakerGameId: resolved.tiebreakerGameId,
                tiebreakerDecidedAt: resolved.tiebreakerDecidedAt,
                totalPointsTeamA: resolved.totalPointsTeamA,
                totalPointsTeamB: resolved.totalPointsTeamB,
                matchStatus,
                games: games.map((game: any) => ({
                  id: game.id,
                  slot: game.slot,
                  bracketId: game.bracketId,
                  bracket: game.bracket,
                  teamAScore: game.teamAScore,
                  teamBScore: game.teamBScore,
                  courtNumber: game.courtNumber,
                  isComplete: game.isComplete,
                  startedAt: game.startedAt,
                  endedAt: game.endedAt,
                  teamALineup: game.teamALineup || null,
                  teamBLineup: game.teamBLineup || null,
                  createdAt: game.createdAt,
                  teamAScoreSubmitted: game.teamAScoreSubmitted,
                  teamBScoreSubmitted: game.teamBScoreSubmitted,
                  teamASubmittedScore: game.teamASubmittedScore,
                  teamBSubmittedScore: game.teamBSubmittedScore,
                })),
              };
            })
          );

          return {
            ...r,
            matches: matches.filter(Boolean),
          };
        })
    );

        const filteredRounds = rounds.filter(
          (r) => r.matches.length > 0 || bracketFilter === undefined,
        );

        return filteredRounds;
      },
      CACHE_TTL.SCHEDULE // 60 seconds
    );

    return NextResponse.json(filteredRounds);
  } catch (e) {
    console.error('Schedule API error:', e);
    const msg = e instanceof Error ? e.message : 'error';
    const stack = e instanceof Error ? e.stack : undefined;
    return NextResponse.json({ error: msg, stack, details: String(e) }, { status: 500 });
  }
}

/** DELETE: wipe schedule for a stop.
 *  - Without ?bracketId= → delete all rounds (cascade → games → matches).
 *  - With ?bracketId= (supports "null") → delete only games of that bracket, then prune empty rounds and compact idx.
 */
export async function DELETE(req: Request, ctx: Ctx) {
  try {
    // Authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Support Act As functionality
    const actAsPlayerId = getActAsHeaderFromRequest(req);
    const effectivePlayer = await getEffectivePlayer(actAsPlayerId);

    const { stopId } = await ctx.params;
    // Use singleton prisma instance
    const { searchParams } = new URL(req.url);
    const bracketFilter = normalizeBracketId(searchParams.get('bracketId'));
    const compact = searchParams.get('compact') !== '0'; // default true

    // Validate stop
    const stop = await prisma.stop.findUnique({ where: { id: stopId }, select: { id: true, tournamentId: true } });
    if (!stop) return NextResponse.json({ error: `Stop not found: ${stopId}` }, { status: 404 });

    // Authorization: Check if user is admin or event manager for this stop
    if (!effectivePlayer.isAppAdmin) {
      const isEventManager = await prisma.stop.findFirst({
        where: {
          id: stopId,
          eventManagerId: effectivePlayer.targetPlayerId
        }
      });

      const isTournamentEventManager = await prisma.tournamentEventManager.findFirst({
        where: {
          tournamentId: stop.tournamentId,
          playerId: effectivePlayer.targetPlayerId
        }
      });

      if (!isEventManager && !isTournamentEventManager) {
        return NextResponse.json({ error: 'Not authorized to modify this schedule' }, { status: 403 });
      }
    }

    if (bracketFilter === undefined) {
      // Delete everything (fast path)
      const deleted = await prisma.round.deleteMany({ where: { stopId } });
      return NextResponse.json({
        ok: true,
        deletedRounds: deleted.count,
        deletedScope: 'all',
        compacted: false,
      });
    }

    // Bracket-specific delete: remove only matches for that bracket
    const result = await prisma.$transaction(async (tx) => {
      // Delete games for targeted matches first (to avoid relying on onDelete in some setups)
      const targetMatches = await tx.match.findMany({
        where: {
          round: { stopId },
          OR:
            bracketFilter === null
              ? [
                  { teamA: { bracketId: { equals: null } } },
                  { teamB: { bracketId: { equals: null } } },
                ]
              : [
                  { teamA: { bracketId: bracketFilter } },
                  { teamB: { bracketId: bracketFilter } },
                ],
        },
        select: { id: true },
      });

      if (targetMatches.length) {
        await tx.game.deleteMany({ where: { matchId: { in: targetMatches.map((m) => m.id) } } });
        await tx.match.deleteMany({ where: { id: { in: targetMatches.map((m) => m.id) } } });
      }

      // Optionally prune & compact (tx conforms to DB via its round delegate)
      await pruneAndCompact({ round: tx.round }, stopId, { prune: true, compact });

      // Return counts
      const remainingRounds = await tx.round.count({ where: { stopId } });
      return { matchesRemoved: targetMatches.length, remainingRounds };
    });

    return NextResponse.json({
      ok: true,
      deletedScope: 'bracket',
      bracketId: bracketFilter,
      matchesRemoved: result.matchesRemoved,
      remainingRounds: result.remainingRounds,
      compacted: compact,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** PATCH: maintenance actions on a stop's schedule.
 *  Body: { pruneEmpty?: boolean, compact?: boolean }
 *  - pruneEmpty: delete rounds with no games
 *  - compact: reindex round idx to 0..n-1
 */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    // Authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Support Act As functionality
    const actAsPlayerId = getActAsHeaderFromRequest(req);
    const effectivePlayer = await getEffectivePlayer(actAsPlayerId);

    const { stopId } = await ctx.params;
    // Use singleton prisma instance

    const body = await req.json().catch(() => ({}));
    const pruneEmpty = !!body?.pruneEmpty;
    const compact = !!body?.compact;

    // Validate stop
    const stop = await prisma.stop.findUnique({ where: { id: stopId }, select: { id: true, tournamentId: true } });
    if (!stop) return NextResponse.json({ error: `Stop not found: ${stopId}` }, { status: 404 });

    // Authorization: Check if user is admin or event manager for this stop
    if (!effectivePlayer.isAppAdmin) {
      const isEventManager = await prisma.stop.findFirst({
        where: {
          id: stopId,
          eventManagerId: effectivePlayer.targetPlayerId
        }
      });

      const isTournamentEventManager = await prisma.tournamentEventManager.findFirst({
        where: {
          tournamentId: stop.tournamentId,
          playerId: effectivePlayer.targetPlayerId
        }
      });

      if (!isEventManager && !isTournamentEventManager) {
        return NextResponse.json({ error: 'Not authorized to modify this schedule' }, { status: 403 });
      }
    }

    await pruneAndCompact({ round: prisma.round }, stopId, { prune: pruneEmpty, compact });

    const roundCount = await prisma.round.count({ where: { stopId } });
    return NextResponse.json({
      ok: true,
      actions: { pruneEmpty, compact },
      roundCount,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Simple round-robin pairing generator (circle method). */
function makeRoundRobin<T>(teams: T[]): Array<Array<[T, T]>> {
  const arr = [...teams];
  const hasBye = arr.length % 2 === 1;
  if (hasBye) arr.push(null as unknown as T);

  const n = arr.length;
  const rounds: Array<Array<[T, T]>> = [];

  for (let r = 0; r < n - 1; r++) {
    const pairs: Array<[T, T]> = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      if (a && b) pairs.push([a, b]);
    }
    rounds.push(pairs);

    // rotate except first element fixed: move last into position 1
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop()!);
    arr.splice(0, arr.length, fixed, ...rest);
  }
  return rounds;
}
