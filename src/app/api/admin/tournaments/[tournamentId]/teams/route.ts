// src/app/api/admin/tournaments/[tournamentId]/teams/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { getDefaultStopName } from '@/lib/tournamentTypeConfig';

type Id = string;

// ----- helpers -----
function toYMD(d?: Date | null): string | null {
  if (!d) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toPlayerLite(p: any) {
  return {
    id: p.id as string,
    firstName: p.firstName ?? null,
    lastName: p.lastName ?? null,
    name: p.name ?? null,
    gender: p.gender,
    dupr: p.duprDoubles ?? null, // Default to doubles DUPR
    age: p.age ?? null,
  };
}

/** Ensure DEFAULT bracket if none; return all brackets ordered. */
async function ensureBrackets(prisma: PrismaClient, tournamentId: string) {
  let brackets = await prisma.tournamentBracket.findMany({
    where: { tournamentId },
    orderBy: { idx: 'asc' },
    select: { id: true, name: true, idx: true },
  });
  if (brackets.length === 0) {
    const def = await prisma.tournamentBracket.upsert({
      where: { tournamentId_name: { tournamentId, name: 'DEFAULT' } },
      update: {},
      create: { tournamentId, name: 'DEFAULT', idx: 0 },
    });
    brackets = [{ id: def.id, name: def.name, idx: 0 }];
  }
  return brackets;
}

/** Ensure at least one Stop exists. */
async function ensureStops(prisma: PrismaClient, tournamentId: string) {
  const t = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, name: true, type: true, createdAt: true, stops: { select: { id: true } } },
  });
  if (!t) throw new Error('Tournament not found');
  if (!t.stops || t.stops.length === 0) {
    const safe = t.createdAt ?? new Date();
    const defaultStopName = getDefaultStopName(t.type);
    await prisma.stop.create({
      data: { tournamentId: t.id, name: defaultStopName, startAt: safe, endAt: safe },
    });
  }
}

/** For a (tournament, team) make sure StopTeam exists for every Stop of the tournament. */
async function ensureStopLinks(prisma: PrismaClient, tournamentId: string, teamId: string) {
  const stops = await prisma.stop.findMany({ where: { tournamentId }, select: { id: true } });
  for (const s of stops) {
    await prisma.stopTeam.upsert({
      where: { stopId_teamId: { stopId: s.id, teamId } },
      update: {},
      create: { stopId: s.id, teamId },
    });
  }
}

/** Create a team for a bracket. */
async function createTeam(
  prisma: PrismaClient,
  data: { name: string; tournamentId: string; clubId: string; bracketId: string }
): Promise<string> {
  const created = await prisma.team.create({ 
    data: { ...data, division: null }, 
    select: { id: true } 
  });
  return created.id;
}


/** Ensure teams exist for (club × each bracket) in a tournament, with sensible names. */
async function ensureTeamsForClubAcrossBrackets(
  prisma: PrismaClient,
  tournamentId: string,
  clubId: string
) {
  const [brackets, club] = await Promise.all([
    ensureBrackets(prisma, tournamentId),
    prisma.club.findUnique({ where: { id: clubId }, select: { name: true } }),
  ]);
  const clubName = club?.name ?? 'Team';

  const existingTeams = await prisma.team.findMany({
    where: { tournamentId, clubId },
    select: { id: true, name: true, bracketId: true },
  });
  const byBracketId = new Map<string, { id: string; name: string }>();
  const unbracketed: { id: string; name: string }[] = [];

  for (const t of existingTeams) {
    if (t.bracketId) byBracketId.set(t.bracketId, { id: t.id, name: t.name });
    else unbracketed.push({ id: t.id, name: t.name });
  }

  const ensuredIds: string[] = [];

  for (const br of brackets) {
    const hit = byBracketId.get(br.id);
    if (hit) {
      ensuredIds.push(hit.id);
      continue;
    }
    const reuse = unbracketed.shift();
    const label = br.name === 'DEFAULT' ? clubName : `${clubName} ${br.name}`;
    if (reuse) {
      await prisma.team.update({
        where: { id: reuse.id },
        data: { bracketId: br.id, name: label },
      });
      ensuredIds.push(reuse.id);
      byBracketId.set(br.id, { id: reuse.id, name: label });
      continue;
    }
    const createdId = await createTeam(prisma, {
      name: label, tournamentId, clubId, bracketId: br.id,
    });
    ensuredIds.push(createdId);
    byBracketId.set(br.id, { id: createdId, name: label });
  }

  const teams = await prisma.team.findMany({
    where: { id: { in: ensuredIds } },
    include: {
      club: true,
      bracket: { select: { id: true, name: true, idx: true } },
      tournament: {
        select: { id: true, name: true, maxTeamSize: true, stops: { include: { club: true } } },
      },
      playerLinks: { include: { player: true }, orderBy: { createdAt: 'asc' } },
    },
    orderBy: [{ bracket: { idx: 'asc' } }, { name: 'asc' }],
  });

  // Ensure stops & stop-links exist for each ensured team
  for (const tm of teams as any[]) {
    const tid: string | null =
      (tm.tournament?.id as string | undefined) ?? (tm.tournamentId as string | undefined) ?? null;
    if (!tid) throw new Error(`Invariant: Team ${tm.id} is missing tournamentId`);
    await ensureStops(prisma, tid);
    await ensureStopLinks(prisma, tid, tm.id as string);
  }

  return teams;
}

/* ---------- GET /api/admin/tournaments/:tournamentId/teams ---------- */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ tournamentId: string }> }) {
  // Use singleton prisma instance
  const { tournamentId } = await ctx.params;

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const player = await prisma.player.findUnique({
      where: { clerkUserId: userId },
      select: { id: true, isAppAdmin: true },
    });

    if (!player) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!player.isAppAdmin) {
      const adminLink = await prisma.tournamentAdmin.findUnique({
        where: { tournamentId_playerId: { tournamentId, playerId: player.id } },
        select: { playerId: true },
      });

      if (!adminLink) {
        const captainLink = await prisma.tournamentCaptain.findUnique({
          where: { tournamentId_playerId: { tournamentId, playerId: player.id } },
          select: { playerId: true },
        });

        if (!captainLink) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, name: true, maxTeamSize: true },
    });
    if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });

    const hasCaptains =
      (await prisma.tournamentCaptain.count({ where: { tournamentId } })) > 0;

    const [clubLinks, stops] = await Promise.all([
      prisma.tournamentClub.findMany({
        where: { tournamentId },
        include: { club: true },
      }),
      prisma.stop.findMany({
        where: { tournamentId },
        orderBy: { startAt: 'asc' },
        include: { club: true },
      }),
    ]);

    const clubsOut: Array<{
      clubId: string;
      clubName: string;
      brackets: Array<{
        teamId: string;
        bracketName: string | null;
        roster: ReturnType<typeof toPlayerLite>[];
        stops: Array<{
          stopId: string;
          stopName: string;
          locationName: string | null;
          startAt: string | null;
          endAt: string | null;
          stopRoster: ReturnType<typeof toPlayerLite>[];
        }>;
      }>;
    }> = [];

    for (const link of clubLinks) {
      const teams = await ensureTeamsForClubAcrossBrackets(prisma as PrismaClient, tournamentId, link.clubId);

      // Load stop rosters once per club batch
      const stopTeamPlayers = await prisma.stopTeamPlayer.findMany({
        where: { teamId: { in: teams.map((t: any) => t.id) } },
        include: { player: true, stop: true },
        orderBy: [{ stopId: 'asc' }, { createdAt: 'asc' }],
      });
      const stMap = new Map<string, any[]>();
      for (const stp of stopTeamPlayers) {
        const key = `${stp.teamId}:${stp.stopId}`;
        const arr = stMap.get(key) ?? [];
        arr.push(stp.player);
        stMap.set(key, arr);
      }

      const brackets = teams.map((t: any) => {
        const stopsShaped = stops.map((s) => {
          const key = `${t.id}:${s.id}`;
          const stopRoster = (stMap.get(key) ?? []).map(toPlayerLite);
          return {
            stopId: s.id,
            stopName: s.name,
            locationName: s.club?.name ?? null,
            startAt: toYMD(s.startAt ?? null),
            endAt: toYMD(s.endAt ?? null),
            stopRoster,
          };
        });

        return {
          teamId: t.id as string,
          bracketName: t.bracket?.name ?? null,
          roster: (t.playerLinks ?? []).map((pl: any) => toPlayerLite(pl.player)),
          stops: stopsShaped,
        };
      });

      clubsOut.push({
        clubId: link.clubId,
        clubName: link.club?.name ?? 'Club',
        brackets,
      });
    }

    return NextResponse.json({
      tournamentId,
      tournamentName: tournament.name,
      maxTeamSize: tournament.maxTeamSize ?? null,
      hasCaptains,
      stops: stops.map((s) => ({
        stopId: s.id,
        stopName: s.name,
        locationName: s.club?.name ?? null,
        startAt: toYMD(s.startAt ?? null),
        endAt: toYMD(s.endAt ?? null),
      })),
      clubs: clubsOut,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
