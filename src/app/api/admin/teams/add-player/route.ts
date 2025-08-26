export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    const body = (await req.json()) as { teamId?: string; playerId?: string };
    if (!body?.teamId || !body?.playerId) return NextResponse.json({ error: 'teamId and playerId required' }, { status: 400 });

    const count = await prisma.teamPlayer.count({ where: { teamId: body.teamId } });
    if (count >= 8) return NextResponse.json({ error: 'team already has 8 players' }, { status: 400 });

    const link = await prisma.teamPlayer.create({ data: { teamId: body.teamId, playerId: body.playerId } });
    return NextResponse.json(link, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
