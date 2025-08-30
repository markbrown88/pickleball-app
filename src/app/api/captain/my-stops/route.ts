export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get('teamId');
    if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 });

    const rows = await prisma.stopTeam.findMany({
      where: { teamId },
      include: { stop: { include: { tournament: true } } },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(rows);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
