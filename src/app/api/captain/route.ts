export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    // Use singleton prisma instance
    const body = (await req.json()) as { name?: string; captainPlayerId?: string; tournamentId?: string };
    const name = body?.name?.trim();
    const captainPlayerId = body?.captainPlayerId;
    const tournamentId = body?.tournamentId;
    if (!name || !captainPlayerId) return NextResponse.json({ error: 'name and captainPlayerId required' }, { status: 400 });
    if (!tournamentId) return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 });

    const team = await prisma.$transaction(async (tx) => {
      const t = await tx.team.create({
        data: { name, captainId: captainPlayerId, tournamentId }
      });
      // make sure captain is also a member
      await tx.teamPlayer.upsert({
        where: { teamId_playerId: { teamId: t.id, playerId: captainPlayerId } },
        create: { teamId: t.id, playerId: captainPlayerId, tournamentId },
        update: {},
      });
      return t;
    });

    return NextResponse.json(team, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
