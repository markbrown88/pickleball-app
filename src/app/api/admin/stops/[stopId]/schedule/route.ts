// src/app/api/admin/stops/[stopId]/schedule/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

type Params = { stopId: string };

export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  try {
    const { stopId } = await ctx.params;
    const prisma = getPrisma();

    const rounds = await prisma.round.findMany({
      where: { stopId },
      orderBy: { idx: 'asc' },
      include: {
        matches: {
          orderBy: { id: 'asc' }, // stable ordering per round
          include: {
            teamA: { select: { id: true, name: true, clubId: true } },
            teamB: { select: { id: true, name: true, clubId: true } },
            games: {
              orderBy: { slot: 'asc' }, // slots: MENS_DOUBLES, WOMENS_DOUBLES, MIXED_1, MIXED_2, TIEBREAKER?
            },
          },
        },
      },
    });

    return NextResponse.json(rounds);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
