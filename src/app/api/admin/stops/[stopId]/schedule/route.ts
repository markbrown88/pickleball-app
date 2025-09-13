// src/app
//  /route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

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
    const { stopId } = await ctx.params;
    const prisma = getPrisma();
    const { searchParams } = new URL(req.url);
    const bracketFilter = normalizeBracketId(searchParams.get('bracketId'));

    // Validate stop (nice 404 if wrong id)
    const stop = await prisma.stop.findUnique({
      where: { id: stopId },
      select: { id: true },
    });
    if (!stop) {
      return NextResponse.json({ error: `Stop not found: ${stopId}` }, { status: 404 });
    }

    const roundsRaw = await prisma.round.findMany({
      where: { stopId },
      orderBy: { idx: 'asc' },
      include: {
        matches: {
          orderBy: { id: 'asc' },
          include: {
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
              orderBy: { slot: 'asc' }, // enum order
            },
          },
        },
      },
    });

    // Apply bracket filter and return matches directly (no transformation needed)
    const rounds = roundsRaw
      .map((r) => {
        const matches = r.matches
          .map((match) => {
            const inferredBracketId =
              match.teamA?.bracket?.id ?? match.teamB?.bracket?.id ?? null;
            const inferredBracketName =
              match.teamA?.bracket?.name ?? match.teamB?.bracket?.name ?? null;

            // Skip if bracket filter doesn't match
            if (bracketFilter !== undefined && bracketFilter !== null && inferredBracketId !== bracketFilter) {
              return null;
            }

            return {
              id: match.id,
              teamA: match.teamA,
              teamB: match.teamB,
              isBye: match.isBye,
              bracketId: inferredBracketId,
              bracketName: inferredBracketName,
              games: match.games?.map((game) => ({
                id: game.id,
                slot: game.slot,
                teamAScore: game.teamAScore,
                teamBScore: game.teamBScore,
                createdAt: game.createdAt
              })) || []
            };
          })
          .filter(Boolean); // Remove null entries

        return { ...r, matches };
      })
      .filter((r) => r.matches.length > 0 || bracketFilter === undefined); // drop empty rounds only if filtered


    return NextResponse.json(rounds);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** DELETE: wipe schedule for a stop.
 *  - Without ?bracketId= → delete all rounds (cascade → games → matches).
 *  - With ?bracketId= (supports "null") → delete only games of that bracket, then prune empty rounds and compact idx.
 */
export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const { stopId } = await ctx.params;
    const prisma = getPrisma();
    const { searchParams } = new URL(req.url);
    const bracketFilter = normalizeBracketId(searchParams.get('bracketId'));
    const compact = searchParams.get('compact') !== '0'; // default true

    // Validate stop
    const stop = await prisma.stop.findUnique({ where: { id: stopId }, select: { id: true } });
    if (!stop) return NextResponse.json({ error: `Stop not found: ${stopId}` }, { status: 404 });

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

/** PATCH: maintenance actions on a stop’s schedule.
 *  Body: { pruneEmpty?: boolean, compact?: boolean }
 *  - pruneEmpty: delete rounds with no games
 *  - compact: reindex round idx to 0..n-1
 */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { stopId } = await ctx.params;
    const prisma = getPrisma();

    const body = await req.json().catch(() => ({}));
    const pruneEmpty = !!body?.pruneEmpty;
    const compact = !!body?.compact;

    // Validate stop
    const stop = await prisma.stop.findUnique({ where: { id: stopId }, select: { id: true } });
    if (!stop) return NextResponse.json({ error: `Stop not found: ${stopId}` }, { status: 404 });

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
export function makeRoundRobin<T>(teams: T[]): Array<Array<[T, T]>> {
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
