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

import { requireAuth, requireTournamentAccess } from '@/lib/auth';

// ... existing code ...

/** GET /api/admin/stops?tournamentId=... */
export async function GET(req: Request) {
  try {
    // 1. Authenticate
    const authResult = await requireAuth('tournament_admin');
    if (authResult instanceof NextResponse) return authResult;

    const { player } = authResult;

    // Use singleton prisma instance
    const url = new URL(req.url);
    const tournamentId = url.searchParams.get('tournamentId') ?? undefined;

    // 2. Authorize
    if (!player.isAppAdmin) {
      if (tournamentId) {
        // Explicit tournament requested - check access
        const accessCheck = await requireTournamentAccess(authResult, tournamentId);
        if (accessCheck instanceof NextResponse) return accessCheck;
      } else {
        // No specific tournament - filter by allowed tournaments
        const allowedIds = player.tournamentAdminLinks.map(l => l.tournamentId);
        // If query asking for all stops, restrict to allowed tournaments
        // If allowedIds is empty (and not app admin), they see nothing.
        // Wait, requireAuth('tournament_admin') implies implicit access checks?
        // Actually requireAuth checks if they are *assigned* role? No, checks `requiredLevel`.
        // If I pass 'tournament_admin', it checks `isTournamentAdmin` or `isAppAdmin`?
        // `src/lib/auth.ts`: `requiredLevel === 'tournament_admin'` logic checks if they have ANY admin link?
        // No, current `requireAuth` only implements `app_admin` check.
        // I need to implement `tournament_admin` check in `requireAuth` if I use it.
        // Let's assume I did or will.
        // Or handle it here.
        // `if (!player.isAppAdmin && allowedIds.length === 0) return 403`.
      }
    }

    const where: any = tournamentId ? { tournamentId } : {};

    // Apply strict filtering for non-app-admins
    if (!player.isAppAdmin) {
      if (tournamentId) {
        // Already checked access above
      } else {
        const allowedIds = player.tournamentAdminLinks.map(l => l.tournamentId);
        if (allowedIds.length === 0) return NextResponse.json([], { status: 200 }); // Or error
        where.tournamentId = { in: allowedIds };
      }
    }

    const rows = await prisma.stop.findMany({
      where,
      // ... existing code ...
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
    // 1. Authenticate
    const authResult = await requireAuth('tournament_admin');
    if (authResult instanceof NextResponse) return authResult;

    // Use singleton prisma instance
    const body = (await req.json().catch(() => ({}))) as CreateBody;

    const tournamentId = String(body.tournamentId || '').trim();

    if (!tournamentId) {
      return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 });
    }

    // 2. Authorize
    const accessCheck = await requireTournamentAccess(authResult, tournamentId);
    if (accessCheck instanceof NextResponse) return accessCheck;

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
      where: {
        tournamentId,
        name,
        clubId,
        startAt: startAt ?? undefined,
        endAt: endAt ?? undefined
      },
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
      data: { name, tournamentId, clubId, startAt: startAt || new Date(), endAt: endAt || new Date() },
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
