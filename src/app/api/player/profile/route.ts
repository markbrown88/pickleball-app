export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    // Use singleton prisma instance
    const { searchParams } = new URL(req.url);
    const playerId = searchParams.get('playerId');
    if (!playerId) return NextResponse.json({ error: 'playerId required' }, { status: 400 });

    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) return NextResponse.json({ error: 'not found' }, { status: 404 });

    const teams = await prisma.teamPlayer.findMany({
      where: { playerId },
      include: {
        team: { include: { captain: true } }
      }
    });

    const stops = await prisma.stopTeamPlayer.findMany({
      where: { playerId },
      include: {
        stop: { include: { tournament: true } },
        team: { include: { captain: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      player,
      teams: teams.map(x => x.team),
      stops
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // Use singleton prisma instance
    const body = (await req.json()) as { playerId?: string; name?: string; gender?: 'MALE'|'FEMALE' };
    if (!body?.playerId || !body?.name || !body?.gender) {
      return NextResponse.json({ error: 'playerId, name, gender required' }, { status: 400 });
    }
    const p = await prisma.player.update({
      where: { id: body.playerId },
      data: { name: body.name.trim(), gender: body.gender }
    });
    return NextResponse.json(p);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
