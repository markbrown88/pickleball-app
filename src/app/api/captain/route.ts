export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    const body = (await req.json()) as { name?: string; captainPlayerId?: string; tournamentId?: string|null };
    const name = body?.name?.trim();
    if (!name || !body?.captainPlayerId) return NextResponse.json({ error: 'name and captainPlayerId required' }, { status: 400 });

    const team = await prisma.$transaction(async (tx) => {
      const t = await tx.team.create({
        data: { name, captainId: body.captainPlayerId, tournamentId: body?.tournamentId ?? null }
      });
      // make sure captain is also a member
      await tx.teamPlayer.upsert({
        where: { teamId_playerId: { teamId: t.id, playerId: body.captainPlayerId } },
        create: { teamId: t.id, playerId: body.captainPlayerId },
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
