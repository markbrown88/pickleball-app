// src/app/api/admin/tournaments/[tournamentId]/detail/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

function toDateOnly(d?: Date | null): string | null {
  if (!d) return null;
  // format as YYYY-MM-DD in UTC to satisfy <input type="date">
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function personLabel(p?: { firstName?: string | null; lastName?: string | null; name?: string | null } | null) {
  if (!p) return '—';
  const fn = (p.firstName ?? '').trim();
  const ln = (p.lastName ?? '').trim();
  const full = [fn, ln].filter(Boolean).join(' ');
  return full || (p.name ?? '—');
}

/**
 * GET /api/admin/tournaments/:tournamentId/detail
 * {
 *   id, name,
 *   participants: [{
 *     clubId, clubName,
 *     intermediateCaptainId, intermediateCaptainName, // <-- added Name
 *     advancedCaptainId,     advancedCaptainName      // <-- added Name
 *   }],
 *   stops: [{ id, name, clubId, startAt, endAt }] // dates as YYYY-MM-DD or null
 * }
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ tournamentId: string }> }
) {
  const prisma = getPrisma();
  const { tournamentId } = await ctx.params;

  // Load tournament, participating clubs (pivot), any teams (with captain names), and stops
  const t = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      name: true,

      // Canonical participants list (preferred)
      TournamentClub: {
        select: { clubId: true, club: { select: { id: true, name: true } } },
      },

      // Teams give us division/captain info per club (overlay onto participants)
      teams: {
        select: {
          division: true,
          captainId: true,
          captain: { select: { id: true, firstName: true, lastName: true, name: true } }, // include captain names
          clubId: true,
          club: { select: { id: true, name: true } },
        },
      },

      // Stops for date range editor
      stops: {
        select: { id: true, name: true, clubId: true, startAt: true, endAt: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  type P = {
    clubId: string;
    clubName: string;
    intermediateCaptainId: string | null;
    intermediateCaptainName: string | null; // NEW
    advancedCaptainId: string | null;
    advancedCaptainName: string | null;     // NEW
  };
  const byClub: Record<string, P> = {};

  // 1) Seed from TournamentClub (preferred)
  for (const link of t.TournamentClub) {
    const clubId = link.clubId;
    if (!clubId) continue;
    byClub[clubId] = {
      clubId,
      clubName: link.club?.name ?? 'Club',
      intermediateCaptainId: null,
      intermediateCaptainName: null,
      advancedCaptainId: null,
      advancedCaptainName: null,
    };
  }

  // 2) Overlay captain per division from existing teams (with names)
  for (const tm of t.teams) {
    const clubId = tm.clubId;
    if (!clubId) continue;
    if (!byClub[clubId]) {
      // Fallback: if no TournamentClub row (legacy), initialize from teams
      byClub[clubId] = {
        clubId,
        clubName: tm.club?.name ?? 'Club',
        intermediateCaptainId: null,
        intermediateCaptainName: null,
        advancedCaptainId: null,
        advancedCaptainName: null,
      };
    }
    if (tm.division === 'INTERMEDIATE') {
      byClub[clubId].intermediateCaptainId = tm.captainId ?? null;
      byClub[clubId].intermediateCaptainName = tm.captain ? personLabel(tm.captain) : null;
    }
    if (tm.division === 'ADVANCED') {
      byClub[clubId].advancedCaptainId = tm.captainId ?? null;
      byClub[clubId].advancedCaptainName = tm.captain ? personLabel(tm.captain) : null;
    }
  }

  // 3) Absolute legacy fallback: if both TournamentClub and teams are empty,
  // try to infer via StopTeam -> Team -> Club (kept for robustness).
  if (Object.keys(byClub).length === 0) {
    const viaStops = await prisma.stopTeam.findMany({
      where: { stop: { tournamentId } },
      select: {
        team: {
          select: {
            division: true,
            captainId: true,
            captain: { select: { id: true, firstName: true, lastName: true, name: true } },
            clubId: true,
            club: { select: { id: true, name: true } },
          },
        },
      },
      take: 2000, // safety cap
    });
    for (const s of viaStops) {
      const tm = s.team;
      if (!tm?.clubId) continue;
      if (!byClub[tm.clubId]) {
        byClub[tm.clubId] = {
          clubId: tm.clubId,
          clubName: tm.club?.name ?? 'Club',
          intermediateCaptainId: null,
          intermediateCaptainName: null,
          advancedCaptainId: null,
          advancedCaptainName: null,
        };
      }
      if (tm.division === 'INTERMEDIATE') {
        byClub[tm.clubId].intermediateCaptainId = tm.captainId ?? null;
        byClub[tm.clubId].intermediateCaptainName = tm.captain ? personLabel(tm.captain) : null;
      }
      if (tm.division === 'ADVANCED') {
        byClub[tm.clubId].advancedCaptainId = tm.captainId ?? null;
        byClub[tm.clubId].advancedCaptainName = tm.captain ? personLabel(tm.captain) : null;
      }
    }
  }

  return NextResponse.json({
    id: t.id,
    name: t.name,
    participants: Object.values(byClub),
    stops: t.stops.map(s => ({
      id: s.id,
      name: s.name,
      clubId: s.clubId,
      startAt: toDateOnly(s.startAt),
      endAt: toDateOnly(s.endAt),
    })),
  });
}
