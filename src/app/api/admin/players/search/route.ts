// src/app/api/admin/players/search/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

const squeeze = (s: string) => s.replace(/\s+/g, ' ').trim();

export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
    const { searchParams } = new URL(req.url);

    const rawTerm = searchParams.get('term') || '';
    const term = squeeze(rawTerm);
    const tournamentId = searchParams.get('tournamentId') || undefined;

    // Optional: comma-separated ids to hide (already selected in the client)
    const excludeIdsParam = searchParams.get('excludeIds') || '';
    const excludeIds = excludeIdsParam
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (term.length < 3) {
      return NextResponse.json({ items: [], hint: 'Type at least 3 characters' });
    }

    // players already used as captains in this tournament
    const usedCaptainIds = tournamentId
      ? (await prisma.team.findMany({
          where: { tournamentId },
          select: { captainId: true },
        }))
          .map(t => t.captainId)
          .filter((v): v is string => !!v)
      : [];

    // Merge excludes (dedupe)
    const notInIds = Array.from(new Set([...usedCaptainIds, ...excludeIds]));

    const items = await prisma.player.findMany({
      where: {
        // Exclude players who already captain a team in the tournament
        id: notInIds.length ? { notIn: notInIds } : undefined,
        OR: [
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName:  { contains: term, mode: 'insensitive' } },
          { name:      { contains: term, mode: 'insensitive' } },
          { email:     { contains: term, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 20,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        gender: true,
        clubId: true,
      },
    });

    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
