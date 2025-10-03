export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    // Use singleton prisma instance
    const { searchParams } = new URL(req.url);
    const tournamentId = searchParams.get('tournamentId') ?? undefined;
    const rows = await prisma.team.findMany({
      where: tournamentId ? { tournamentId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { playerLinks: { include: { player: true } } }
    });
    return NextResponse.json(rows);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // Use singleton prisma instance
    const body = (await req.json()) as { name?: string; tournamentId?: string; clubId?: string };
    if (!body?.name || !body?.tournamentId || !body?.clubId) return NextResponse.json({ error: 'name, tournamentId, and clubId required' }, { status: 400 });
    const t = await prisma.team.create({ data: { name: body.name.trim(), tournamentId: body.tournamentId, clubId: body.clubId } });
    return NextResponse.json(t, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
