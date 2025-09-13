// src/app/api/admin/tournaments/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import type { Division, TournamentType } from '@prisma/client';

function divLabel(d: Division) {
  return d === 'INTERMEDIATE' ? 'Intermediate' : 'Advanced';
}

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
export async function GET() {
  const prisma = getPrisma();

  const tournaments = await prisma.tournament.findMany({
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
 *   // legacy participants (optional)
 *   participants?: Array<{ clubId: string, intermediateCaptainId?: string, advancedCaptainId?: string }>,
 *
 *   // Optional at creation time (stops can be added later via /config):
 *   // Single-stop "details" (Location + dates)...
 *   details?: { clubId: string; startAt: string; endAt?: string },
 *   // ...or explicit multi-stops (name optional; endAt defaults to startAt)
 *   stops?: Array<{ name?: string; clubId: string; startAt: string; endAt?: string }>
 * }
 */
export async function POST(req: Request) {
  const prisma = getPrisma();
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
        data: { name, type },
        select: { id: true, name: true },
      });

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

      // Legacy: create/update two division-based teams if participants supplied.
      if (participants.length) {
        for (const p of participants) {
          const clubId = String(p.clubId);
          const iCap = p.intermediateCaptainId ? String(p.intermediateCaptainId) : '';
          const aCap = p.advancedCaptainId ? String(p.advancedCaptainId) : '';

          for (const division of ['INTERMEDIATE', 'ADVANCED'] as Division[]) {
            const captainId = division === 'INTERMEDIATE' ? iCap : aCap;
            // Find existing team for (tournament, club, division)
            let team = await tx.team.findFirst({
              where: { tournamentId: t.id, clubId, division },
              select: { id: true, captainId: true },
            });

            if (!team) {
              const club = await tx.club.findUnique({ where: { id: clubId }, select: { name: true } });
              const defaultName = `${club?.name ?? 'Club'} ${divLabel(division)}`;
              team = await tx.team.create({
                data: {
                  name: defaultName,
                  division,
                  tournament: { connect: { id: t.id } },
                  club: { connect: { id: clubId } },
                  ...(captainId ? { captain: { connect: { id: captainId } } } : {}),
                },
                select: { id: true, captainId: true },
              });
            } else if (captainId && team.captainId !== captainId) {
              await tx.team.update({ where: { id: team.id }, data: { captainId } });
            }

            // Keep captain on roster if given
            if (captainId) {
              const existing = await tx.teamPlayer.findFirst({
                where: { teamId: team.id, playerId: captainId },
                select: { teamId: true },
              });
              if (!existing) {
                await tx.teamPlayer.create({
                  data: {
                    team: { connect: { id: team.id } },
                    player: { connect: { id: captainId } },
                    tournament: { connect: { id: t.id } },
                  },
                });
              }
            }
          }
        }
      }

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
