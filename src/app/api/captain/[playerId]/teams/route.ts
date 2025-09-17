// src/app/api/captain/[playerId]/teams/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Id = string;

/* ---------------- utils ---------------- */

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
    dupr: p.dupr ?? null,
    age: p.age ?? null,
  };
}

/** Type guard to narrow objects that definitely have a non-null `tournament`. */
function hasTournament<T extends { tournament: unknown | null }>(
  tm: T
): tm is T & { tournament: NonNullable<T['tournament']> } {
  return tm.tournament != null;
}

// Use singleton prisma instance

/* ---------------- ensure helpers ---------------- */

async function ensureStops(prisma: PrismaClient, tournamentId: string) {
  const t = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { stops: true },
  });
  if (!t) throw new Error('Tournament not found');

  if (!t.stops || t.stops.length === 0) {
    const safe = (t as any).createdAt ?? new Date();
    await prisma.stop.create({
      data: { tournamentId: t.id, name: t.name, startAt: safe, endAt: safe },
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

/** Ensure a DEFAULT bracket if none; return all brackets (ordered). */
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

/** Try creating a team; if the legacy unique (tournamentId,clubId,division) still exists, retry with a safe division. */
async function createTeamWithLegacyFallback(
  prisma: PrismaClient,
  data: { name: string; tournamentId: string; clubId: string; bracketId: string }
): Promise<string> {
  try {
    const created = await prisma.team.create({ data, select: { id: true } });
    return created.id;
  } catch (e: any) {
    const msg = e?.message ?? '';
    const isUnique =
      e?.code === 'P2002' ||
      /unique constraint/i.test(msg) ||
      /duplicate key value violates unique constraint/i.test(msg);
    if (!isUnique) throw e;
  }

  const existing = await prisma.team.findMany({
    where: { tournamentId: data.tournamentId, clubId: data.clubId },
    select: { id: true, division: true },
  });
  const used = new Set(existing.map((t) => String(t.division)));
  const pick = (['INTERMEDIATE', 'ADVANCED'] as const).find((d) => !used.has(d));
  if (!pick) {
    throw new Error(
      `Cannot create another team for this club in this tournament: both legacy divisions are in use. ` +
      `Either drop the legacy unique (tournamentId,clubId,division) or reuse an existing team for this bracket.`
    );
  }

  const created = await prisma.team.create({
    data: { ...data, division: pick as any },
    select: { id: true },
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

  // Snapshot existing teams (note: use ONLY `select` to avoid Prisma include/select conflict)
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

    const createdId = await createTeamWithLegacyFallback(prisma, {
      name: label,
      tournamentId,
      clubId,
      bracketId: br.id,
    });
    ensuredIds.push(createdId);
    byBracketId.set(br.id, { id: createdId, name: label });
  }

  // Load full teams (with tournament relation to be safe)
  const teams = await prisma.team.findMany({
    where: { id: { in: ensuredIds } },
    include: {
      club: true,
      bracket: { select: { id: true, name: true, idx: true } },
      tournament: {
        select: {
          id: true,
          name: true,
          maxTeamSize: true,
          stops: { include: { club: true } },
        },
      },
      playerLinks: { include: { player: true } },
    },
    orderBy: { name: 'asc' },
  });

  // Ensure stop links for each team — only when tournament is present
  const withTournament = teams.filter(hasTournament);
  for (const tm of withTournament) {
    await ensureStops(prisma, tm.tournament.id);
    await ensureStopLinks(prisma, tm.tournament.id, tm.id);
  }

  return teams;
}

/* ---------------- route ---------------- */

export async function GET(
  req: Request,
  ctx: { params: { playerId: string } } | { params: Promise<{ playerId: string }> }
) {
  const url = new URL(req.url);
  const wantDebug = url.searchParams.get('debug') === '1';

  const { client: prisma, diag } = prisma;
  if (!prisma) {
    return NextResponse.json(
      { error: 'Prisma client could not be created', detail: diag },
      { status: 500 }
    );
  }

  const envDiag: any = { connected: false, counts: {} as Record<string, any> };
  try {
    await prisma.$connect();
    envDiag.connected = true;
    try { envDiag.counts.Team = await prisma.team.count(); } catch (e: any) { envDiag.counts.Team = `ERR: ${e?.message}`; }
    try { envDiag.counts.Tournament = await prisma.tournament.count(); } catch (e: any) { envDiag.counts.Tournament = `ERR: ${e?.message}`; }
    try { envDiag.counts.TournamentBracket = await prisma.tournamentBracket.count(); } catch (e: any) { envDiag.counts.TournamentBracket = `ERR: ${e?.message}`; }
    try { envDiag.counts.TournamentCaptain = await (prisma as any).tournamentCaptain?.count?.() ?? 'N/A'; } catch (e: any) { envDiag.counts.TournamentCaptain = `ERR: ${e?.message}`; }
  } catch (e: any) {
    envDiag.connected = `ERR: ${e?.message ?? String(e)}`;
  }

  try {
    // Next 13/14 vs 15 param shapes
    const raw: any = (ctx as any).params;
    const { playerId } = typeof raw?.then === 'function' ? await raw : raw;

    // Canonical governance: (tournament, club) via TournamentCaptain
    const assignments =
      (await (prisma as any).tournamentCaptain?.findMany?.({
        where: { playerId },
        select: { tournamentId: true, clubId: true },
        orderBy: [{ tournamentId: 'asc' }],
      })) ?? [];

    // Legacy assist (if some tournaments still rely on captainId on a team)
    const legacyTeams = await prisma.team.findMany({
      where: { captainId: playerId, tournamentId: { not: null }, clubId: { not: null } },
      select: { tournamentId: true, clubId: true },
    });

    const governed = new Map<string, { tournamentId: string; clubId: string }>();
    for (const a of assignments) governed.set(`${a.tournamentId}:${a.clubId}`, a);
    for (const t of legacyTeams) {
      if (t.tournamentId && t.clubId) {
        governed.set(`${t.tournamentId}:${t.clubId}`, { tournamentId: t.tournamentId, clubId: t.clubId });
      }
    }

    if (governed.size === 0) {
      const payload: any = { teams: [] };
      if (wantDebug) payload._debug = { prisma: diag, env: envDiag, playerId, confCount: 0 };
      return NextResponse.json(payload);
    }

    // Ensure & load teams for every bracket for each governed club/tournament
    const allTeams: any[] = [];
    for (const { tournamentId, clubId } of governed.values()) {
      const teams = await ensureTeamsForClubAcrossBrackets(prisma, tournamentId, clubId);
      allTeams.push(...teams);
    }

    // Keep only teams that have a tournament relation
    const teamsWithTournament = allTeams.filter(hasTournament);

    // Stop rosters (once) for those teams
    const stopTeamPlayers = await prisma.stopTeamPlayer.findMany({
      where: { teamId: { in: teamsWithTournament.map((t: any) => t.id) } },
      include: { player: true, stop: true },
      orderBy: { stopId: 'asc' },
    });
    const stopRosterMap = new Map<string, any[]>();
    for (const stp of stopTeamPlayers) {
      const key = `${stp.teamId}:${stp.stopId}`;
      const arr = stopRosterMap.get(key) ?? [];
      arr.push(stp.player);
      stopRosterMap.set(key, arr);
    }

    const shaped = teamsWithTournament.map((t: any) => {
      const tournament = t.tournament; // narrowed by filter
      const bracketLimit = (tournament as any).maxTeamSize ?? null; // per-bracket/team limit

      // Build stops with rosters
      const stops = (tournament.stops ?? [])
        .map((s: any) => {
          const key = `${t.id}:${s.id}`;
          const stopRoster = (stopRosterMap.get(key) ?? []).map(toPlayerLite);
          return {
            stopId: s.id as Id,
            stopName: (s.name as string) ?? tournament.name,
            locationName: s.club?.name ?? null,
            startAt: toYMD(s.startAt ?? null),
            endAt: toYMD(s.endAt ?? null),
            tournamentId: tournament.id as Id,
            tournamentName: tournament.name as string,
            stopRoster,
          };
        });

      // Unique players across all stops for THIS team (bracket)
      const uniqueAcrossStops = new Set<string>();
      for (const st of stops) for (const p of st.stopRoster) uniqueAcrossStops.add(p.id);
      const bracketUniqueCount = uniqueAcrossStops.size;

      return {
        id: t.id as Id,
        name: t.name as string,
        club: t.club
          ? { id: t.club.id as Id, name: t.club.name as string, city: (t.club.city ?? null) as string | null }
          : null,
        bracketName: t.bracket?.name ?? null,
        tournament: {
          id: tournament.id as string,
          name: tournament.name as string,
          maxTeamSize: bracketLimit, // legacy field name; kept for compatibility
        },
        tournamentId: tournament.id as string,
        roster: (t.playerLinks ?? []).map((pl: any) => toPlayerLite(pl.player)),
        stops,

        // NEW: bracket-level fields used by Captain UI
        bracketLimit,          // number | null
        bracketUniqueCount,    // number
      };
    });

    const okPayload: any = { teams: shaped };
    if (wantDebug) okPayload._debug = { prisma: diag, env: envDiag, playerId, confCount: assignments.length };
    return NextResponse.json(okPayload);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message, detail: { prisma: diag, env: envDiag } },
      { status: 500 }
    );
  }
}
