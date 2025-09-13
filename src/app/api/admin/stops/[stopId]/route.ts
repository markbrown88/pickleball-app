// src/app/api/admin/stops/[stopId]/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

/** DELETE /api/admin/stops/:stopId */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ stopId: string }> }
) {
  const prisma = getPrisma();
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
        const games = await tx.game.findMany({
          where: { roundId: { in: roundIds } },
          select: { id: true },
        });
        const gameIds = games.map((g) => g.id);

        if (gameIds.length) {
          // 1a-i) Matches under those games
          await tx.match.deleteMany({
            where: { gameId: { in: gameIds } },
          });

          // 1a-ii) Delete games
          await tx.game.deleteMany({
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
