// src/app/api/admin/stops/[stopId]/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/** PUT /api/admin/stops/:stopId */
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ stopId: string }> }
) {
  const { stopId } = await ctx.params;

  if (!stopId) return NextResponse.json({ error: 'stopId required' }, { status: 400 });

  try {
    const body = await req.json();
    const { lineupDeadline } = body;

    // Validate and parse the deadline
    let deadlineDate: Date | null = null;
    if (lineupDeadline) {
      deadlineDate = new Date(lineupDeadline);
      if (isNaN(deadlineDate.getTime())) {
        return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
      }
    }

    const updated = await prisma.stop.update({
      where: { id: stopId },
      data: { lineupDeadline: deadlineDate },
      select: {
        id: true,
        name: true,
        lineupDeadline: true,
      }
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      lineupDeadline: updated.lineupDeadline ? updated.lineupDeadline.toISOString() : null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** DELETE /api/admin/stops/:stopId */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ stopId: string }> }
) {
  // Use singleton prisma instance
  const { stopId } = await ctx.params;

  if (!stopId) return new NextResponse(null, { status: 400 });

  // If it's already gone, respond 204
  const exists = await prisma.stop.findUnique({
    where: { id: stopId },
    select: { id: true },
  });
  if (!exists) return new NextResponse(null, { status: 204 });

  try {
    // Most installs should succeed here thanks to onDelete: Cascade on relations.
    await prisma.stop.delete({ where: { id: stopId } });
  } catch {
    // Fallback manual cascade in case of FK constraints or older DBs
    await prisma.$transaction(async (tx) => {
      // 1) Rounds for this stop
      const rounds = await tx.round.findMany({
        where: { stopId },
        select: { id: true },
      });
      const roundIds = rounds.map((r) => r.id);

      if (roundIds.length) {
        // 1a) Games under those rounds
        const games = await tx.match.findMany({
          where: { roundId: { in: roundIds } },
          select: { id: true },
        });
        const gameIds = games.map((g) => g.id);

        if (gameIds.length) {
          // 1a-i) Delete matches
          await tx.match.deleteMany({
            where: { id: { in: gameIds } },
          });
        }

        // 1b) Lineups and entries under those rounds
        const lineups = await tx.lineup.findMany({
          where: { roundId: { in: roundIds } },
          select: { id: true },
        });
        const lineupIds = lineups.map((l) => l.id);

        if (lineupIds.length) {
          await tx.lineupEntry.deleteMany({ where: { lineupId: { in: lineupIds } } });
          await tx.lineup.deleteMany({ where: { id: { in: lineupIds } } });
        }

        // 1c) Delete rounds
        await tx.round.deleteMany({ where: { id: { in: roundIds } } });
      }

      // 2) Stop roster & team links
      await tx.stopTeamPlayer.deleteMany({ where: { stopId } });
      await tx.stopTeam.deleteMany({ where: { stopId } });

      // 3) Finally delete the stop
      await tx.stop.delete({ where: { id: stopId } });
    });
  }

  // Verify
  const stillThere = await prisma.stop.findUnique({
    where: { id: stopId },
    select: { id: true },
  });
  if (stillThere) {
    return NextResponse.json(
      { error: 'Failed to delete stop due to database constraints.' },
      { status: 409 }
    );
  }

  return new NextResponse(null, { status: 204 });
}
