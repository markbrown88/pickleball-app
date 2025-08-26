export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    const body = (await req.json()) as { tournamentId?: string; name?: string; teamIds?: string[] };
    const { tournamentId, name, teamIds } = body || {};
    if (!tournamentId || !name) return NextResponse.json({ error: 'tournamentId and name required' }, { status: 400 });

    const stop = await prisma.stop.create({ data: { tournamentId, name } });

    if (Array.isArray(teamIds) && teamIds.length) {
      await prisma.stopTeam.createMany({
        data: teamIds.map(tid => ({ stopId: stop.id, teamId: tid })),
        skipDuplicates: true
      });
    }

    return NextResponse.json(stop, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
