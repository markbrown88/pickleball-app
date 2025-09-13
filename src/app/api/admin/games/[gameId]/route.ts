// src/app/api/admin/games/[gameId]/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import type { GameSlot } from '@prisma/client';
import { GameSlot as GameSlotEnum } from '@prisma/client';

type Params = { gameId: string };

type PutBody = {
  teamAId?: string | null;
  teamBId?: string | null;
  isBye?: boolean;
  // optional bulk match updates
  matches?: Array<{
    slot: GameSlot;
    teamAScore: number | null;
    teamBScore: number | null;
  }>;
};

function isValidSlot(v: unknown): v is GameSlot {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(GameSlotEnum, v);
}

function isValidScore(v: unknown): v is number | null {
  if (v === null) return true;
  return Number.isInteger(v) && Number(v) >= 0;
}

function summarize(
  matches: Array<{ slot: GameSlot; teamAScore: number | null; teamBScore: number | null }>,
  isBye: boolean
) {
  if (isBye) return { status: 'BYE', slotsTotal: 0, slotsCompleted: 0, winsA: 0, winsB: 0 };

  let winsA = 0;
  let winsB = 0;
  let completed = 0;

  for (const m of matches) {
    if (m.teamAScore == null || m.teamBScore == null) continue;
    completed++;
    if (m.teamAScore > m.teamBScore) winsA++;
    else if (m.teamBScore > m.teamAScore) winsB++;
  }

  const total = matches.length;
  const status = completed === 0 ? 'PENDING' : completed < total ? 'IN_PROGRESS' : 'COMPLETED';
  return { status, slotsTotal: total, slotsCompleted: completed, winsA, winsB };
}

const DEFAULT_SLOTS: GameSlot[] = [
  GameSlotEnum.MENS_DOUBLES,
  GameSlotEnum.WOMENS_DOUBLES,
  GameSlotEnum.MIXED_1,
  GameSlotEnum.MIXED_2,
  GameSlotEnum.TIEBREAKER,
];

// ---------- GET ----------
export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  const { gameId } = await ctx.params;
  const prisma = getPrisma();

  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        round: {
          select: {
            id: true,
            stopId: true,
            idx: true,
            stop: { select: { id: true, name: true, tournamentId: true } },
          },
        },
        teamA: {
          select: { id: true, name: true, clubId: true, bracket: { select: { id: true, name: true } } },
        },
        teamB: {
          select: { id: true, name: true, clubId: true, bracket: { select: { id: true, name: true } } },
        },
        matches: {
          orderBy: { slot: 'asc' },
          select: { id: true, slot: true, teamAScore: true, teamBScore: true },
        },
      },
    });
    if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });

    const summary = summarize(
      game.matches.map((m) => ({ slot: m.slot, teamAScore: m.teamAScore, teamBScore: m.teamBScore })),
      game.isBye
    );

    return NextResponse.json({
      ...game,
      // convenience fields (non-breaking additions)
      bracketId: game.teamA?.bracket?.id ?? game.teamB?.bracket?.id ?? null,
      bracketName: game.teamA?.bracket?.name ?? game.teamB?.bracket?.name ?? null,
      stopName: game.round.stop?.name ?? null,
      tournamentId: game.round.stop?.tournamentId ?? null,
      summary,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Failed' }, { status: 500 });
  }
}

// ---------- PUT ----------
export async function PUT(req: Request, ctx: { params: Promise<Params> }) {
  const { gameId } = await ctx.params;
  const prisma = getPrisma();

  try {
    const body = (await req.json().catch(() => ({}))) as PutBody;

    // Validate match payload early (if present)
    if (Array.isArray(body.matches)) {
      for (const m of body.matches) {
        if (!m || !isValidSlot(m.slot)) {
          return NextResponse.json({ error: 'Each match row must include a valid slot' }, { status: 400 });
        }
        if (!isValidScore(m.teamAScore) || !isValidScore(m.teamBScore)) {
          return NextResponse.json({ error: 'Scores must be non-negative integers or null' }, { status: 400 });
        }
      }
    }

    // Load current game context (tournament for validations)
    const current = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        round: { select: { stop: { select: { tournamentId: true } }, id: true, stopId: true, idx: true } },
        matches: true,
      },
    });
    if (!current) return NextResponse.json({ error: 'Game not found' }, { status: 404 });

    const tournamentId = current.round.stop.tournamentId;

    // Validate team changes if provided
    let nextIsBye = current.isBye;
    if (typeof body.isBye === 'boolean') nextIsBye = body.isBye;

    if (body.teamAId !== undefined || body.teamBId !== undefined) {
      // If a team id is provided (non-null), verify it exists and belongs to the same tournament
      const checkIds = [body.teamAId, body.teamBId].filter((x): x is string => typeof x === 'string' && x.length > 0);
      if (checkIds.length) {
        const teams = await prisma.team.findMany({
          where: { id: { in: checkIds } },
          select: { id: true, tournamentId: true },
        });
        const byId = new Map(teams.map((t) => [t.id, t.tournamentId]));
        for (const tid of checkIds) {
          if (!byId.has(tid)) {
            return NextResponse.json({ error: `Unknown team id: ${tid}` }, { status: 400 });
          }
          if (byId.get(tid) !== tournamentId) {
            return NextResponse.json({ error: `Team ${tid} does not belong to this tournament` }, { status: 400 });
          }
        }
      }
      // Team A and B cannot be the same non-null team
      if (body.teamAId && body.teamBId && body.teamAId === body.teamBId) {
        return NextResponse.json({ error: 'teamAId and teamBId cannot be the same team' }, { status: 400 });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1) Update base game fields if provided
      if (
        body.teamAId !== undefined ||
        body.teamBId !== undefined ||
        body.isBye !== undefined
      ) {
        await tx.game.update({
          where: { id: gameId },
          data: {
            teamAId: body.teamAId !== undefined ? body.teamAId : undefined,
            teamBId: body.teamBId !== undefined ? body.teamBId : undefined,
            isBye: body.isBye !== undefined ? body.isBye : undefined,
          },
        });
      }

      // If the game is (or becomes) a BYE, delete all matches and block score updates
      if (nextIsBye) {
        await tx.match.deleteMany({ where: { gameId } });
        if (Array.isArray(body.matches) && body.matches.length) {
          throw new Error('Cannot set scores on a BYE game');
        }
      } else {
        // If no matches exist yet, seed standard slots (idempotent)
        const existingCount = await tx.match.count({ where: { gameId } });
        if (existingCount === 0) {
          await tx.match.createMany({
            data: DEFAULT_SLOTS.map((slot) => ({ gameId, slot })),
            skipDuplicates: true,
          });
        }

        // 2) Upsert per-slot scores if provided
        if (Array.isArray(body.matches) && body.matches.length) {
          for (const m of body.matches) {
            await tx.match.upsert({
              where: { gameId_slot: { gameId, slot: m.slot } },
              update: { teamAScore: m.teamAScore, teamBScore: m.teamBScore },
              create: {
                gameId,
                slot: m.slot,
                teamAScore: m.teamAScore ?? null,
                teamBScore: m.teamBScore ?? null,
              },
            });
          }
        }
      }

      // 3) Return fresh game
      return tx.game.findUnique({
        where: { id: gameId },
        include: {
          round: {
            select: {
              id: true,
              stopId: true,
              idx: true,
              stop: { select: { id: true, name: true, tournamentId: true } },
            },
          },
          teamA: {
            select: { id: true, name: true, clubId: true, bracket: { select: { id: true, name: true } } },
          },
          teamB: {
            select: { id: true, name: true, clubId: true, bracket: { select: { id: true, name: true } } },
          },
          matches: {
            orderBy: { slot: 'asc' },
            select: { id: true, slot: true, teamAScore: true, teamBScore: true },
          },
        },
      });
    });

    if (!updated) return NextResponse.json({ error: 'Game not found after update' }, { status: 404 });

    const summary = summarize(
      updated.matches.map((m) => ({ slot: m.slot, teamAScore: m.teamAScore, teamBScore: m.teamBScore })),
      updated.isBye
    );

    return NextResponse.json({
      ok: true,
      game: {
        ...updated,
        bracketId: updated.teamA?.bracket?.id ?? updated.teamB?.bracket?.id ?? null,
        bracketName: updated.teamA?.bracket?.name ?? updated.teamB?.bracket?.name ?? null,
        stopName: updated.round.stop?.name ?? null,
        tournamentId: updated.round.stop?.tournamentId ?? null,
        summary,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Failed to update game' }, { status: 500 });
  }
}
