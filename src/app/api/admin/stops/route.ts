// src/app/api/admin/stops/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type CreateBody = {
  tournamentId: string;
  name?: string;
  clubId?: string | null;
  startAt?: string | null; // "YYYY-MM-DD" or ISO (optional in multi-stops mode)
  endAt?: string | null;   // "YYYY-MM-DD" or ISO (optional; defaults to startAt if startAt provided)
};

function normalizeDateInput(d?: string | null): Date | null {
  if (!d) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

/** GET /api/admin/stops?tournamentId=... */
export async function GET(req: Request) {
  try {
    // Use singleton prisma instance
    const url = new URL(req.url);
    const tournamentId = url.searchParams.get('tournamentId') ?? undefined;

    const where = tournamentId ? { tournamentId } : {};
    const rows = await prisma.stop.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        tournamentId: true,
        clubId: true,
        club: { select: { id: true, name: true, city: true } },
        startAt: true,
        endAt: true,
      },
    });

    return NextResponse.json(
      rows.map((s) => ({
        id: s.id,
        name: s.name,
        tournamentId: s.tournamentId,
        clubId: s.clubId ?? null,
        club: s.club ? { id: s.club.id, name: s.club.name, city: s.club.city ?? null } : null,
        startAt: s.startAt ? s.startAt.toISOString() : null,
        endAt: s.endAt ? s.endAt.toISOString() : null,
      }))
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/admin/stops  (create a new stop)
 * - In Multiple Stops mode, only Name is required; Club and dates are optional.
 * - If startAt provided but endAt missing, endAt defaults to startAt.
 * - Idempotent by (tournamentId, name, clubId, startAt, endAt).
 */
export async function POST(req: Request) {
  try {
    // Use singleton prisma instance
    const body = (await req.json().catch(() => ({}))) as CreateBody;

    const tournamentId = String(body.tournamentId || '').trim();
    const name = (String(body.name ?? '') || 'Main').trim();
    const clubId = body.clubId ? String(body.clubId) : null;
    const startAt = normalizeDateInput(body.startAt ?? null);
    const endAtRaw = normalizeDateInput(body.endAt ?? null);
    const endAt = endAtRaw ?? startAt ?? null;

    if (!tournamentId) {
      return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const t = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true },
    });
    if (!t) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });

    // Dedupe by the composite tuple (including possible nulls)
    const existing = await prisma.stop.findFirst({
      where: { tournamentId, name, clubId, startAt: startAt ?? null, endAt: endAt ?? null },
      select: { id: true },
    });

    if (existing) {
      const s = await prisma.stop.findUnique({
        where: { id: existing.id },
        select: { id: true, name: true, tournamentId: true, clubId: true, startAt: true, endAt: true },
      });
      return NextResponse.json({
        id: s!.id,
        name: s!.name,
        tournamentId: s!.tournamentId,
        clubId: s!.clubId ?? null,
        startAt: s!.startAt ? s!.startAt.toISOString() : null,
        endAt: s!.endAt ? s!.endAt.toISOString() : null,
        deduped: true,
      });
    }

    const created = await prisma.stop.create({
      data: { name, tournamentId, clubId, startAt, endAt },
      select: { id: true, name: true, tournamentId: true, clubId: true, startAt: true, endAt: true },
    });

    return NextResponse.json(
      {
        id: created.id,
        name: created.name,
        tournamentId: created.tournamentId,
        clubId: created.clubId ?? null,
        startAt: created.startAt ? created.startAt.toISOString() : null,
        endAt: created.endAt ? created.endAt.toISOString() : null,
      },
      { status: 201 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
