export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    const body = (await req.json()) as { stopId?: string; teamId?: string; playerIds?: string[] };
    const { stopId, teamId, playerIds } = body || {};
    if (!stopId || !teamId || !Array.isArray(playerIds)) {
      return NextResponse.json({ error: 'stopId, teamId, playerIds[] required' }, { status: 400 });
    }
    if (playerIds.length > 8) {
      return NextResponse.json({ error: 'max 8 players per stop' }, { status: 400 });
    }

    // Ensure this team is in the stop
    const inStop = await prisma.stopTeam.findUnique({ where: { stopId_teamId: { stopId, teamId } } });
    if (!inStop) return NextResponse.json({ error: 'team not in this stop' }, { status: 400 });

    // Ensure every player belongs to the team
    const countBelong = await prisma.teamPlayer.count({ where: { teamId, playerId: { in: playerIds } } });
    if (countBelong !== playerIds.length) return NextResponse.json({ error: 'all players must belong to this team' }, { status: 400 });

    // Replace roster
    await prisma.$transaction(async (tx) => {
      await tx.stopTeamPlayer.deleteMany({ where: { stopId, teamId } });
      if (playerIds.length) {
        await tx.stopTeamPlayer.createMany({
          data: playerIds.map(pid => ({ stopId, teamId, playerId: pid })),
        });
      }
    });

    return NextResponse.json({ ok: true, count: playerIds.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
