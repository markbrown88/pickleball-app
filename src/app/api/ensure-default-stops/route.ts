export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET so you can open it in the browser
export async function GET() {
  // Use singleton prisma instance

  try {
    const tournaments = await prisma.tournament.findMany({
      include: { stops: true },
    });

    const created: Array<{ tournamentId: string; stopId: string }> = [];

    for (const t of tournaments) {
      if (t.stops.length === 0) {
        const s = await prisma.stop.create({
          data: {
            tournamentId: t.id,
            name: t.name,  // default stop name = tournament name
            startAt: null,
            endAt: null,
          },
          select: { id: true },
        });
        created.push({ tournamentId: t.id, stopId: s.id });
      }
    }

    return NextResponse.json({ ok: true, created: created.length, items: created });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'failed' }, { status: 500 });
  }
}
