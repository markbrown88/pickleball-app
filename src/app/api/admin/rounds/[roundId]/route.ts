// src/app/api/admin/rounds/[roundId]/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ roundId: string }> };

type PatchBody = {
  /** New zero-based position for this round within its stop. */
  idx?: number;
};

// ---------- GET /api/admin/rounds/:roundId ----------
export async function GET(_req: Request, ctx: Ctx) {
  const prisma = getPrisma();
  const { roundId } = await ctx.params;

  try {
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        stop: {
          select: {
            id: true,
            name: true,
            tournamentId: true,
            tournament: { select: { id: true, name: true } },
          },
        },
        matches: {
          orderBy: { id: 'asc' },
          include: {
            teamA: {
              select: {
                id: true,
                name: true,
                club: { select: { id: true, name: true } },
                bracket: { select: { id: true, name: true, idx: true } },
              },
            },
            teamB: {
              select: {
                id: true,
                name: true,
                club: { select: { id: true, name: true } },
                bracket: { select: { id: true, name: true, idx: true } },
              },
            },
            games: {
              orderBy: { slot: 'asc' },
              select: { id: true, slot: true, teamAScore: true, teamBScore: true, createdAt: true },
            },
          },
        },
      },
    });

    if (!round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: round.id,
      idx: round.idx,
      stop: {
        id: round.stop.id,
        name: round.stop.name,
        tournamentId: round.stop.tournamentId,
        tournamentName: round.stop.tournament?.name ?? null,
      },
      matches: round.matches.map((m) => ({
        id: m.id,
        isBye: m.isBye,
        bracketName: m.teamA?.bracket?.name ?? m.teamB?.bracket?.name ?? null,
        teamA: m.teamA
          ? {
            id: m.teamA.id,
            name: m.teamA.name,
            clubName: m.teamA.club?.name ?? null,
            bracketName: m.teamA.bracket?.name ?? null,
          }
          : null,
        teamB: m.teamB
          ? {
            id: m.teamB.id,
            name: m.teamB.name,
            clubName: m.teamB.club?.name ?? null,
            bracketName: m.teamB.bracket?.name ?? null,
          }
          : null,
        games: m.games,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed to load round' }, { status: 500 });
  }
}

// ---------- PATCH /api/admin/rounds/:roundId ----------
export async function PATCH(req: Request, ctx: Ctx) {
  const prisma = getPrisma();
  const { roundId } = await ctx.params;

  try {
    const body = (await req.json().catch(() => ({}))) as PatchBody;

    if (!Number.isInteger(body.idx) || (body.idx as number) < 0) {
      return NextResponse.json(
        { error: 'idx must be a non-negative integer' },
        { status: 400 }
      );
    }
    const targetIdx = body.idx as number;

    const round = await prisma.round.findUnique({
      where: { id: roundId },
      select: { id: true, idx: true, stopId: true },
    });
    if (!round) return NextResponse.json({ error: 'Round not found' }, { status: 404 });

    // Count how many rounds in this stop to clamp the target index
    const total = await prisma.round.count({ where: { stopId: round.stopId } });
    const maxIdx = Math.max(0, total - 1);
    const clampedIdx = Math.min(targetIdx, maxIdx);

    if (clampedIdx === round.idx) {
      return NextResponse.json({ ok: true, id: round.id, idx: round.idx });
    }

    await prisma.$transaction(async (tx) => {
      if (clampedIdx < round.idx) {
        // Move up: shift [clampedIdx, round.idx - 1] down by +1
        await tx.round.updateMany({
          where: { stopId: round.stopId, idx: { gte: clampedIdx, lt: round.idx } },
          data: { idx: { increment: 1 } },
        });
      } else {
        // Move down: shift (round.idx, clampedIdx] up by -1
        await tx.round.updateMany({
          where: { stopId: round.stopId, idx: { gt: round.idx, lte: clampedIdx } },
          data: { idx: { decrement: 1 } },
        });
      }
      await tx.round.update({ where: { id: round.id }, data: { idx: clampedIdx } });
    });

    return NextResponse.json({ ok: true, id: round.id, idx: clampedIdx });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed to update round' }, { status: 500 });
  }
}

// ---------- DELETE /api/admin/rounds/:roundId ----------
export async function DELETE(_req: Request, ctx: Ctx) {
  const prisma = getPrisma();
  const { roundId } = await ctx.params;

  try {
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      select: { id: true, idx: true, stopId: true },
    });
    if (!round) return NextResponse.json({ error: 'Round not found' }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      // Deleting the round will cascade to its games and matches per Prisma schema.
      await tx.round.delete({ where: { id: round.id } });

      // Close the gap by shifting down any rounds that were after the deleted one.
      await tx.round.updateMany({
        where: { stopId: round.stopId, idx: { gt: round.idx } },
        data: { idx: { decrement: 1 } },
      });
    });

    return NextResponse.json({ ok: true, deletedId: round.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed to delete round' }, { status: 500 });
  }
}
