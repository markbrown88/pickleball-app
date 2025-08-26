export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
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
    const prisma = getPrisma();
    const body = (await req.json()) as { name?: string; tournamentId?: string };
    if (!body?.name || !body?.tournamentId) return NextResponse.json({ error: 'name and tournamentId required' }, { status: 400 });
    const t = await prisma.team.create({ data: { name: body.name.trim(), tournamentId: body.tournamentId } });
    return NextResponse.json(t, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
