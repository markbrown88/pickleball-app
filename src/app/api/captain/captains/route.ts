// src/app/api/captain/captains/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';

type CaptainOut = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  gender: 'MALE' | 'FEMALE';
  tournaments: { id: string; name: string }[];
};

function addCaptain(acc: Map<string, CaptainOut>, p: any, t?: any) {
  if (!p?.id) return;
  const existing =
    acc.get(p.id) ??
    ({
      id: p.id,
      firstName: p.firstName ?? null,
      lastName: p.lastName ?? null,
      name: p.name ?? null,
      gender: p.gender as 'MALE' | 'FEMALE',
      tournaments: [],
    } as CaptainOut);

  if (t?.id && !existing.tournaments.find((x) => x.id === t.id)) {
    existing.tournaments.push({ id: t.id, name: t.name });
  }
  acc.set(p.id, existing);
}

function resolvePrisma(): PrismaClient {
  // 1) Preferred: project helper
  try {
    const p = typeof getPrisma === 'function' ? (getPrisma() as unknown as PrismaClient | undefined) : undefined;
    if (p) return p;
  } catch {/* ignore */}
  // 2) Optional singleton (if your project exports it)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const maybe = require('@/server/db')?.prisma as PrismaClient | undefined;
    if (maybe) return maybe;
  } catch {/* ignore */}
  // 3) Safe process-wide singleton
  const g = globalThis as any;
  if (!g.__PRISMA_SINGLETON__) g.__PRISMA_SINGLETON__ = new PrismaClient();
  return g.__PRISMA_SINGLETON__ as PrismaClient;
}

export async function GET(req: Request) {
  const prisma = resolvePrisma();

  const url = new URL(req.url);
  const debug = url.searchParams.get('debug') === '1';

  const captains = new Map<string, CaptainOut>();
  const diag: Record<string, any> = {
    sourceA: { ok: false, count: 0, error: null as string | null }, // TournamentCaptain
    sourceB: { ok: false, count: 0, error: null as string | null }, // (legacy) Team.captainId
  };

  // A) Canonical: TournamentCaptain
  try {
    const conf = await prisma.tournamentCaptain.findMany({
      include: {
        player: { select: { id: true, firstName: true, lastName: true, name: true, gender: true } },
        tournament: { select: { id: true, name: true } },
      },
    });
    for (const c of conf) addCaptain(captains, c.player, c.tournament);
    diag.sourceA.ok = true;
    diag.sourceA.count = conf.length;
  } catch (e: any) {
    diag.sourceA.error = e?.message ?? String(e);
  }

  // B) Legacy assist: Teams with captainId set
  try {
    const teams = await prisma.team.findMany({
      where: { captainId: { not: null } },
      select: {
        captain: { select: { id: true, firstName: true, lastName: true, name: true, gender: true } },
        tournament: { select: { id: true, name: true } },
      },
    });
    for (const tm of teams) addCaptain(captains, tm.captain, tm.tournament);
    diag.sourceB.ok = true;
    diag.sourceB.count = teams.length;
  } catch (e: any) {
    diag.sourceB.error = e?.message ?? String(e);
  }

  if (!diag.sourceA.ok && !diag.sourceB.ok) {
    return NextResponse.json({ error: 'Failed to list captains', detail: diag }, { status: 500 });
  }

  const items = [...captains.values()].sort((a, b) => {
    const an = (a.firstName ?? a.name ?? '').toLowerCase();
    const bn = (b.firstName ?? b.name ?? '').toLowerCase();
    return an.localeCompare(bn);
  });

  return NextResponse.json(debug ? { items, _debug: diag } : { items });
}
