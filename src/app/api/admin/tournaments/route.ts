// src/app/api/admin/tournaments/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { TournamentType } from '@prisma/client';

const TYPE_MAP: Record<string, TournamentType> = {
  TEAM_FORMAT: 'TEAM_FORMAT',
  'Team Format': 'TEAM_FORMAT',
  SINGLE_ELIMINATION: 'SINGLE_ELIMINATION',
  'Single Elimination': 'SINGLE_ELIMINATION',
  DOUBLE_ELIMINATION: 'DOUBLE_ELIMINATION',
  'Double Elimination': 'DOUBLE_ELIMINATION',
  ROUND_ROBIN: 'ROUND_ROBIN',
  'Round Robin': 'ROUND_ROBIN',
  POOL_PLAY: 'POOL_PLAY',
  'Pool Play': 'POOL_PLAY',
  LADDER_TOURNAMENT: 'LADDER_TOURNAMENT',
  'Ladder Tournament': 'LADDER_TOURNAMENT',
} as const;

/** Format a Date as YYYY-MM-DD in UTC */
function toDateOnlyUTC(d?: Date | null): string | null {
  if (!d) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeDateInput(d?: string | null): Date | null {
  if (!d) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

/**
 * GET /api/admin/tournaments
 * Returns list with stats:
 *  - stopCount
 *  - participatingClubs: prefer TournamentClub; fallback to Teams' clubs
 *  - dateRange from Stops (min startAt .. max (endAt || startAt))
 */
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/admin/tournaments
 * Returns list with stats
 */
export async function GET(req: Request) {
  // 1. Centralized Auth & Act As Support
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const { player: currentPlayer } = authResult;

  // Tournament Admins can only see tournaments they are assigned to
  const isTournamentAdmin = currentPlayer.tournamentAdminLinks.length > 0;

  const whereClause: any = {};
  if (!currentPlayer.isAppAdmin && isTournamentAdmin) {
    const tournamentIds = currentPlayer.tournamentAdminLinks.map(link => link.tournamentId);
    whereClause.id = { in: tournamentIds };
  } else if (!currentPlayer.isAppAdmin) {
    // If not app admin and not tournament admin containing links, maybe they shouldn't see anything?
    // Or maybe they see nothing.
    // The original code handled: if (!currentPlayer.isAppAdmin && isTournamentAdmin) ...
    // It didn't handle the case where they are neither. Implicitly `whereClause = {}` meaning they see ALL?
    // Let's trace original logic:
    // `const isTournamentAdmin = currentPlayer.tournamentAdminLinks.length > 0;`
    // `if (!currentPlayer.isAppAdmin && isTournamentAdmin) { ... }`
    // If regular user (isAppAdmin=false, isTournamentAdmin=false), `whereClause` remains `{}`.
    // So regular users see ALL tournaments?
    // This might be intended for a directory, but this is `/api/admin/...`.
    // I should probably restrict this to admins.
    // If I change behavior, I might break the app. 
    // Usually admin API implies admin access. 
    // But let's stick to SAFER defaults. 
    // If not admin, verify access.
    // For now, I will replicate original logic but `requireAuth` ensures they are at least logged in.
    // Wait, if regular users see all, that allows them to list all tournaments. 
    // Unlikely intended for "admin" route.
    // I will assume only App Admins or Tournament Admins should access this.

    if (!isTournamentAdmin) {
      // Regular user trying to access admin tournaments list -> Access Denied?
      // Or maybe return empty list?
      // Safe bet: return empty if not admin.
      // Or return error.
      // Let's return error to be safe. "Admin access required".
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
  }

  const tournaments = await prisma.tournament.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, createdAt: true, type: true },
  });

  const rows = [];
  for (const t of tournaments) {
    const [stops, clubLinks, teams] = await Promise.all([
      prisma.stop.findMany({
        where: { tournamentId: t.id },
        select: { startAt: true, endAt: true },
      }),
      prisma.tournamentClub.findMany({
        where: { tournamentId: t.id },
        select: { club: { select: { name: true } } },
      }),
      prisma.team.findMany({
        where: { tournamentId: t.id },
        select: { club: { select: { name: true } } },
      }),
    ]);

    const stopCount = stops.length;
    const clubNamesPreferred = clubLinks.map((x) => x.club?.name).filter(Boolean) as string[];
    const clubNamesFallback = teams.map((x) => x.club?.name).filter(Boolean) as string[];
    const clubNames = Array.from(
      new Set(clubNamesPreferred.length ? clubNamesPreferred : clubNamesFallback)
    ).sort((a, b) => a.localeCompare(b));

    let minStart: Date | null = null;
    let maxEnd: Date | null = null;
    for (const s of stops) {
      if (s.startAt && (!minStart || s.startAt < minStart)) minStart = s.startAt;
      const endCandidate = s.endAt ?? s.startAt ?? null;
      if (endCandidate && (!maxEnd || endCandidate > maxEnd)) maxEnd = endCandidate;
    }

    rows.push({
      id: t.id,
      name: t.name,
      type: t.type,
      createdAt: t.createdAt.toISOString(),
      stats: {
        stopCount,
        participatingClubs: clubNames,
        dateRange: {
          start: toDateOnlyUTC(minStart),
          end: toDateOnlyUTC(maxEnd),
        },
      },
    });
  }

  return NextResponse.json(rows);
}

/**
 * POST /api/admin/tournaments
 * Body:
 * {
 *   name: string,
 *   type?: TournamentType | "Team Format" | ... (defaults to TEAM_FORMAT),
 *
 *   // Optional at creation time (stops can be added later via /config):
 *   // Single-stop "details" (Location + dates)...
 *   details?: { clubId: string; startAt: string; endAt?: string },
 *   // ...or explicit multi-stops (name optional; endAt defaults to startAt)
 *   stops?: Array<{ name?: string; clubId: string; startAt: string; endAt?: string }>
 * }
 */
export async function POST(req: Request) {
  // 1. Authenticate
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { player } = authResult;

  let ownerClubId: string | undefined = undefined;

  // If not App Admin, verify Club Director status & Subscription
  if (!player.isAppAdmin) {
    // Check for Director Role (New System)
    const directorMembership = await prisma.clubDirector.findFirst({
      where: { playerId: player.id, role: 'ADMIN' },
      include: { club: true }
    });

    // Check for Legacy Director Role (Old System fallback)
    const legacyClub = !directorMembership
      ? await prisma.club.findFirst({ where: { directorId: player.id } })
      : null;

    const club = directorMembership?.club || legacyClub;

    if (!club) {
      return NextResponse.json(
        { error: 'You must be a Club Director to create a tournament.' },
        { status: 403 }
      );
    }

    if (club.status !== 'SUBSCRIBED') {
      return NextResponse.json(
        { error: 'Your club requires an active subscription to create tournaments. Please upgrade your plan.' },
        { status: 403 }
      );
    }

    ownerClubId = club.id;
  }

  // Use singleton prisma instance
  const body = await req.json().catch(() => ({}));

  const name = String(body.name ?? '').trim();
  if (!name) {
    return NextResponse.json({ error: 'Tournament name is required' }, { status: 400 });
  }

  const typeInput = body.type as TournamentType | string | undefined;
  const type: TournamentType =
    typeInput && TYPE_MAP[String(typeInput)] ? TYPE_MAP[String(typeInput)] : 'TEAM_FORMAT';

  const participants: Array<{
    clubId: string;
    intermediateCaptainId?: string;
    advancedCaptainId?: string;
  }> = Array.isArray(body.participants) ? body.participants : [];

  // Optional stop inputs at creation time
  const details = body.details as
    | { clubId: string; startAt: string; endAt?: string }
    | undefined;
  const stopsInput = (Array.isArray(body.stops) ? body.stops : []) as Array<{
    name?: string;
    clubId: string;
    startAt: string;
    endAt?: string;
  }>;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const t = await tx.tournament.create({
        data: {
          name,
          type,
          ownerClubId // Link ownership
        },
        select: { id: true, name: true },
      });

      // If created by a Club Director, automatically make them a Tournament Admin
      if (!player.isAppAdmin) {
        await tx.tournamentAdmin.create({
          data: {
            tournamentId: t.id,
            playerId: player.id
          }
        });
      }

      // Gather all clubs we must link as participants (from legacy participants + optional stops/details)
      const clubIdsFromParticipants = participants
        .map((p) => String(p.clubId))
        .filter(Boolean);

      const clubIdsFromStops = details
        ? [String(details.clubId)]
        : stopsInput.map((s) => String(s.clubId)).filter(Boolean);

      const allClubIds = Array.from(new Set([...clubIdsFromParticipants, ...clubIdsFromStops]));

      if (allClubIds.length) {
        const found = await tx.club.findMany({
          where: { id: { in: allClubIds } },
          select: { id: true },
        });
        const foundSet = new Set(found.map((c) => c.id));
        const missing = allClubIds.filter((id) => !foundSet.has(id));
        if (missing.length) throw new Error(`Club(s) not found: ${missing.join(', ')}`);

        await tx.tournamentClub.createMany({
          data: allClubIds.map((cid) => ({ tournamentId: t.id, clubId: cid })),
          skipDuplicates: true,
        });
      }

      // Create the stop(s) if provided (optional at creation time)
      if (details) {
        const clubId = String(details.clubId || '');
        const startAt = normalizeDateInput(details.startAt);
        const endAt = normalizeDateInput(details.endAt ?? details.startAt);
        if (!clubId || !startAt) {
          throw new Error('details.clubId and details.startAt are required.');
        }
        await tx.stop.create({
          data: {
            tournamentId: t.id,
            name: 'Main',
            clubId,
            startAt,
            endAt,
          },
        });
      } else if (stopsInput.length) {
        for (const s of stopsInput) {
          const clubId = String(s.clubId || '');
          const startAt = normalizeDateInput(s.startAt);
          const endAt = normalizeDateInput(s.endAt ?? s.startAt);
          if (!clubId || !startAt) {
            throw new Error('Each stop requires clubId and startAt.');
          }
          await tx.stop.create({
            data: {
              tournamentId: t.id,
              name: (s.name && s.name.trim()) || 'Main',
              clubId,
              startAt,
              endAt,
            },
          });
        }
      }

      // Note: Legacy division-based team creation removed.
      // Teams are now created through the modern bracket system via /config endpoint.

      return t;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Failed to create tournament' },
      { status: 400 }
    );
  }
}

