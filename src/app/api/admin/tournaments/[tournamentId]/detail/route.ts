// src/app/api/admin/tournaments/[tournamentId]/detail/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import type { Division } from '@prisma/client';

type Params = { tournamentId: string };

function personLabel(p: { firstName?: string | null; lastName?: string | null; name?: string | null }) {
  const fn = (p.firstName ?? '').trim();
  const ln = (p.lastName ?? '').trim();
  const full = [fn, ln].filter(Boolean).join(' ');
  return full || (p.name ?? 'Unknown');
}

export async function GET(_req: Request, ctx: { params: Params } | { params: Promise<Params> }) {
  try {
    // Next 15 compatibility: params may be a Promise
    const raw: any = (ctx as any).params;
    const { tournamentId } = typeof raw?.then === 'function' ? await raw : raw;

    const prisma = getPrisma();

    const t = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        // Participating clubs via config table
        clubs: {
          include: {
            club: { select: { id: true, name: true } },
          },
        },
        // Teams so we can surface legacy captain info by division if present
        teams: {
          select: {
            id: true,
            clubId: true,
            division: true,
            captainId: true,
            captain: { select: { id: true, firstName: true, lastName: true, name: true } },
          },
          orderBy: [{ clubId: 'asc' }],
        },
        // Stops for dates/locations
        stops: {
          orderBy: { startAt: 'asc' },
          select: { id: true, name: true, clubId: true, startAt: true, endAt: true },
        },
        // If you ever want single-captain-per-club governance:
        TournamentCaptain: {
          select: { clubId: true, playerId: true, player: { select: { firstName: true, lastName: true, name: true } } },
        },
      },
    });

    if (!t) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // ---- Legacy "participants" shape expected by the admin page ----
    // It wants intermediate & advanced captains per club (old model).
    // We’ll try to derive from Team.captain by Division; fall back to TournamentCaptain if present.
    const byClubDivCaptain = new Map<
      string,
      { intermediate?: { id: string; label: string }; advanced?: { id: string; label: string } }
    >();

    for (const tm of t.teams) {
      if (!tm.clubId) continue;
      const cap = tm.captainId && tm.captain ? { id: tm.captain.id, label: personLabel(tm.captain) } : undefined;
      if (!cap) continue;
      const entry = byClubDivCaptain.get(tm.clubId) ?? {};
      if (tm.division === 'INTERMEDIATE') entry.intermediate = cap;
      else if (tm.division === 'ADVANCED') entry.advanced = cap;
      byClubDivCaptain.set(tm.clubId, entry);
    }

    // If using the new TournamentCaptain (single per club), populate intermediate if missing
    for (const tc of t.TournamentCaptain) {
      const cap = { id: tc.playerId, label: personLabel(tc.player) };
      const entry = byClubDivCaptain.get(tc.clubId) ?? {};
      if (!entry.intermediate && !entry.advanced) {
        // put it in 'intermediate' slot as a harmless legacy fallback
        entry.intermediate = cap;
      }
      byClubDivCaptain.set(tc.clubId, entry);
    }

    const participants = t.clubs.map((link) => {
      const clubId = link.club.id;
      const clubName = link.club.name;
      const divs = byClubDivCaptain.get(clubId) ?? {};
      return {
        clubId,
        clubName,
        intermediateCaptainId: divs.intermediate?.id ?? null,
        intermediateCaptainName: divs.intermediate?.label ?? null,
        advancedCaptainId: divs.advanced?.id ?? null,
        advancedCaptainName: divs.advanced?.label ?? null,
      };
    });

    const stops = t.stops.map((s) => ({
      id: s.id,
      name: s.name,
      clubId: s.clubId ?? null,
      startAt: s.startAt ? s.startAt.toISOString() : null,
      endAt: s.endAt ? s.endAt.toISOString() : null,
    }));

    return NextResponse.json({
      id: t.id,
      name: t.name,
      participants,
      stops,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
