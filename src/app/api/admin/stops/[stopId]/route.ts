// src/app/api/admin/stops/[stopId]/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

export async function DELETE(
  _req: Request,
  ctx: { params: { stopId: string } } // params is sync in Next.js App Router
) {
  const prisma = getPrisma();
  const { stopId } = ctx.params;

  // 404 if not found
  const exists = await prisma.stop.findUnique({
    where: { id: stopId },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: 'Stop not found' }, { status: 404 });
  }

  // Try simple delete (relies on ON DELETE CASCADE from your schema)
  try {
    await prisma.stop.delete({ where: { id: stopId } });
  } catch {
    // Manual cascade fallback (current schema order)
    await prisma.$transaction(async (tx) => {
      const rounds = await tx.round.findMany({
        where: { stopId },
        select: { id: true },
      });
      const roundIds = rounds.map((r) => r.id);

      if (roundIds.length) {
        const matches = await tx.match.findMany({
          where: { roundId: { in: roundIds } },
          select: { id: true },
        });
        const matchIds = matches.map((m) => m.id);

        if (matchIds.length) {
          await tx.game.deleteMany({ where: { matchId: { in: matchIds } } });
          await tx.match.deleteMany({ where: { id: { in: matchIds } } });
        }

        const lineups = await tx.lineup.findMany({
          where: { roundId: { in: roundIds } },
          select: { id: true },
        });
        const lineupIds = lineups.map((l) => l.id);
        if (lineupIds.length) {
          await tx.lineupEntry.deleteMany({ where: { lineupId: { in: lineupIds } } });
          await tx.lineup.deleteMany({ where: { id: { in: lineupIds } } });
        }

        await tx.round.deleteMany({ where: { id: { in: roundIds } } });
      }

      await tx.stopTeamPlayer.deleteMany({ where: { stopId } });
      await tx.stopTeam.deleteMany({ where: { stopId } });

      await tx.stop.delete({ where: { id: stopId } });
    });
  }

  // Hard verification: ensure the row is truly gone
  const check = await prisma.stop.findUnique({
    where: { id: stopId },
    select: { id: true },
  });
  if (check) {
    // If you somehow land here, a constraint prevented deletion.
    // Surface a hard error so the UI doesn't “pretend” it worked.
    return NextResponse.json(
      { error: 'Failed to delete stop due to database constraints.' },
      { status: 409 }
    );
  }

  // Success
  return new NextResponse(null, { status: 204 });
}
