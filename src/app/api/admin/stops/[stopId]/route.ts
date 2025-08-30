// src/app/api/admin/stops/[stopId]/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

/** DELETE /api/admin/stops/:stopId */
export async function DELETE(
  _req: Request,
  { params }: { params: { stopId: string } }
) {
  const prisma = getPrisma();
  const { stopId } = params;

  // Idempotent: if not found, return 204 so the UI stays happy.
  const exists = await prisma.stop.findUnique({
    where: { id: stopId },
    select: { id: true },
  });
  if (!exists) return new NextResponse(null, { status: 204 });

  try {
    // Prefer simple delete if your schema cascades handle it.
    await prisma.stop.delete({ where: { id: stopId } });
  } catch {
    // Manual cascade fallback when constraints block the simple delete.
    await prisma.$transaction(async (tx) => {
      // Collect rounds for this stop
      const rounds = await tx.round.findMany({
        where: { stopId },
        select: { id: true },
      });
      const roundIds = rounds.map(r => r.id);

      if (roundIds.length) {
        // Matches & Games under those rounds
        const matches = await tx.match.findMany({
          where: { roundId: { in: roundIds } },
          select: { id: true },
        });
        const matchIds = matches.map(m => m.id);

        if (matchIds.length) {
          await tx.game.deleteMany({ where: { matchId: { in: matchIds } } });
          await tx.match.deleteMany({ where: { id: { in: matchIds } } });
        }

        // Lineups & entries under those rounds
        const lineups = await tx.lineup.findMany({
          where: { roundId: { in: roundIds } },
          select: { id: true },
        });
        const lineupIds = lineups.map(l => l.id);

        if (lineupIds.length) {
          await tx.lineupEntry.deleteMany({ where: { lineupId: { in: lineupIds } } });
          await tx.lineup.deleteMany({ where: { id: { in: lineupIds } } });
        }

        // Finally delete the rounds
        await tx.round.deleteMany({ where: { id: { in: roundIds } } });
      }

      // Per-stop team links & rosters
      await tx.stopTeamPlayer.deleteMany({ where: { stopId } });
      await tx.stopTeam.deleteMany({ where: { stopId } });

      // The stop itself
      await tx.stop.delete({ where: { id: stopId } });
    });
  }

  // Verify it's gone; if not, surface a conflict
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
