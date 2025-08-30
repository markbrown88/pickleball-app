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
  'TEAM_FORMAT': 'TEAM_FORMAT',
  'Team Format': 'TEAM_FORMAT',
  'SINGLE_ELIMINATION': 'SINGLE_ELIMINATION',
  'Single Elimination': 'SINGLE_ELIMINATION',
  'DOUBLE_ELIMINATION': 'DOUBLE_ELIMINATION',
  'Double Elimination': 'DOUBLE_ELIMINATION',
  'ROUND_ROBIN': 'ROUND_ROBIN',
  'Round Robin': 'ROUND_ROBIN',
  'POOL_PLAY': 'POOL_PLAY',
  'Pool Play': 'POOL_PLAY',
  'LADDER_TOURNAMENT': 'LADDER_TOURNAMENT',
  'Ladder Tournament': 'LADDER_TOURNAMENT',
} as const;

/** Format a Date as YYYY-MM-DD in UTC (prevents off-by-one in local time UIs) */
function toDateOnlyUTC(d?: Date | null): string | null {
  if (!d) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * GET /api/admin/tournaments
 * Returns list with stats:
 *  - stopCount
 *  - participatingClubs: prefer TournamentClub; fallback to Teams' clubs
 *  - dateRange from Stops (min startAt .. max (endAt || startAt)) as YYYY-MM-DD strings
 */
export async function GET() {
  const prisma = getPrisma();

  const tournaments = await prisma.tournament.findMany({
    orderBy: { createdAt: 'desc' },
    // Include type since you return it below
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

    // participating clubs: prefer TournamentClub rows, else dedupe from team.club
    const clubNamesPreferred = clubLinks.map((x) => x.club?.name).filter(Boolean) as string[];
    const clubNamesFallback = teams.map((x) => x.club?.name).filter(Boolean) as string[];

    const clubNames = Array.from(
      new Set(clubNamesPreferred.length ? clubNamesPreferred : clubNamesFallback)
    ).sort((a, b) => a.localeCompare(b));

    // Compute min start across startAt; max end across (endAt ?? startAt)
    let minStart: Date | null = null;
    let maxEnd: Date | null = null;

    for (const s of stops) {
      if (s.startAt) {
        if (!minStart || s.startAt < minStart) minStart = s.startAt;
      }
      const endCandidate = s.endAt ?? s.startAt ?? null;
      if (endCandidate) {
        if (!maxEnd || endCandidate > maxEnd) maxEnd = endCandidate;
      }
    }

    rows.push({
      id: t.id,
      name: t.name,
      type: t.type, // now selected above
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
 * Body: {
 *   name: string,
 *   type?: TournamentType | "Team Format" | "Single Elimination" | ...
 *   participants?: Array<{ clubId: string, intermediateCaptainId: string, advancedCaptainId: string }>
 * }
 */
export async function POST(req: Request) {
  const prisma = getPrisma();
  const body = await req.json().catch(() => ({}));

  const name = String(body.name ?? '').trim();
  if (!name) {
    return NextResponse.json({ error: 'Tournament name is required' }, { status: 400 });
  }

  // Optional type (compatible with enum value or human label)
  const typeInput = body.type as TournamentType | string | undefined;
  const type: TournamentType =
    typeInput && TYPE_MAP[String(typeInput)]
      ? TYPE_MAP[String(typeInput)]
      : 'TEAM_FORMAT';

  const participants: Array<{
    clubId: string;
    intermediateCaptainId: string;
    advancedCaptainId: string;
  }> = Array.isArray(body.participants) ? body.participants : [];

  try {
    const created = await prisma.$transaction(async (tx) => {
      const t = await tx.tournament.create({
        data: { name, type },
        select: { id: true, name: true },
      });

      if (participants.length) {
        // Insert TournamentClub links for these clubs (dedup, skip duplicates)
        const uniqueClubIds = Array.from(
          new Set(participants.map((p) => String(p.clubId)).filter(Boolean))
        );

        // Validate all clubs exist (nice errors)
        const clubs = await tx.club.findMany({
          where: { id: { in: uniqueClubIds } },
          select: { id: true, name: true },
        });
        const foundIds = new Set(clubs.map((c) => c.id));
        const missing = uniqueClubIds.filter((id) => !foundIds.has(id));
        if (missing.length) {
          throw new Error(`Club(s) not found: ${missing.join(', ')}`);
        }

        await tx.tournamentClub.createMany({
          data: uniqueClubIds.map((cid) => ({ tournamentId: t.id, clubId: cid })),
          skipDuplicates: true,
        });

        // For each club, create/update two teams (INTERMEDIATE/ADVANCED) & captain roster
        for (const p of participants) {
          const clubId = String(p.clubId);
          const iCap = String(p.intermediateCaptainId || '');
          const aCap = String(p.advancedCaptainId || '');

          const club = clubs.find((c) => c.id === clubId);
          const clubName = club?.name ?? 'Club';

          for (const division of ['INTERMEDIATE', 'ADVANCED'] as Division[]) {
            const captainId = division === 'INTERMEDIATE' ? iCap : aCap;
            if (!captainId) {
              throw new Error(
                `Missing ${divLabel(division)} captain for the selected club.`
              );
            }

            // Captain already on a team in this tournament?
            const conflict = await tx.teamPlayer.findFirst({
              where: { tournamentId: t.id, playerId: captainId },
              select: { teamId: true },
            });
            if (conflict) {
              throw new Error(
                `Player is already on a team in this tournament (division: ${divLabel(
                  division
                )}).`
              );
            }

            // Find or create team (tournament, club, division)
            let team = await tx.team.findFirst({
              where: { tournamentId: t.id, clubId, division },
              select: { id: true, captainId: true },
            });

            if (!team) {
              const defaultName = `${clubName} ${divLabel(division)}`;
              team = await tx.team.create({
                data: {
                  name: defaultName,
                  division,
                  tournament: { connect: { id: t.id } },
                  club: { connect: { id: clubId } },
                  captain: { connect: { id: captainId } },
                },
                select: { id: true, captainId: true },
              });
            } else if (team.captainId !== captainId) {
              await tx.team.update({ where: { id: team.id }, data: { captainId } });
            }

            // Ensure captain is on roster for this team/tournament
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
