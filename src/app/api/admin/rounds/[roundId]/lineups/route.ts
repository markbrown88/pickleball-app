// src/app/api/admin/rounds/[roundId]/lineups/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Gender, GameSlot } from '@prisma/client';

type Params = { roundId: string };

function label(p: { firstName?: string | null; lastName?: string | null; name?: string | null }) {
  const fn = (p.firstName ?? '').trim();
  const ln = (p.lastName ?? '').trim();
  const full = [fn, ln].filter(Boolean).join(' ');
  return full || (p.name ?? 'Unknown');
}

function computeAge(y?: number | null, m?: number | null, d?: number | null): number | null {
  if (!y || !m || !d) return null;
  try {
    const today = new Date();
    let age = today.getFullYear() - y;
    const mm = (m ?? 1) - 1;
    if (today.getMonth() < mm || (today.getMonth() === mm && today.getDate() < (d ?? 1))) age -= 1;
    return age;
  } catch { return null; }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<Params> }) {
  // Use singleton prisma instance
  try {
    const { roundId } = await ctx.params;

    // Round → Stop (for roster) + Tournament check context
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      select: {
        id: true,
        stopId: true,
        stop: { select: { id: true, tournamentId: true } },
      },
    });
    if (!round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    // All teams that appear in this round (from matches)
    const matches = await prisma.match.findMany({
      where: { roundId },
      include: {
        teamA: {
          include: {
            club: { select: { id: true, name: true } },
            bracket: { select: { id: true, name: true } },
          },
        },
        teamB: {
          include: {
            club: { select: { id: true, name: true } },
            bracket: { select: { id: true, name: true } },
          },
        },
      },
    });

    const teamMeta = new Map<
      string,
      { id: string; name: string; club: { id: string; name: string } | null; bracket: { id: string; name: string } | null }
    >();

    for (const matchRecord of matches) {
      const { teamAId, teamBId, teamA, teamB } = matchRecord;
      if (teamAId && teamA) {
        teamMeta.set(teamAId, {
          id: teamA.id,
          name: teamA.name,
          club: teamA.club ? { id: teamA.club.id, name: teamA.club.name } : null,
          bracket: teamA.bracket ? { id: teamA.bracket.id, name: teamA.bracket.name } : null,
        });
      }
      if (teamBId && teamB) {
        teamMeta.set(teamBId, {
          id: teamB.id,
          name: teamB.name,
          club: teamB.club ? { id: teamB.club.id, name: teamB.club.name } : null,
          bracket: teamB.bracket ? { id: teamB.bracket.id, name: teamB.bracket.name } : null,
        });
      }
    }
    const teamIds = Array.from(teamMeta.keys());
    if (teamIds.length === 0) {
      // No games (yet) → nothing to lineup; still return a shape for the UI.
      return NextResponse.json({ roundId, stopId: round.stopId, lineups: [] });
    }

    // Ensure a Lineup row exists for each team in this round
    const existing = await prisma.lineup.findMany({
      where: { roundId, teamId: { in: teamIds } },
      select: { id: true, teamId: true },
    });
    const existingSet = new Set(existing.map((x) => x.teamId));
    const toCreate = teamIds.filter((id) => !existingSet.has(id));

    if (toCreate.length) {
      for (const teamId of toCreate) {
        await prisma.lineup.create({ data: { roundId, teamId, bracketId: null, stopId: round.stopId } });
      }
    }

    // Fetch lineups (now guaranteed to exist) with entries & team info
    const lineups = await prisma.lineup.findMany({
      where: { roundId, teamId: { in: teamIds } },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            club: { select: { id: true, name: true } },
            bracket: { select: { id: true, name: true } },
          },
        },
        entries: {
          orderBy: { slot: 'asc' },
          include: {
            player1: { select: { id: true, firstName: true, lastName: true, name: true, gender: true } },
            player2: { select: { id: true, firstName: true, lastName: true, name: true, gender: true } },
          },
        },
      },
    });

    // Fetch all rosters for these teams at this stop in one shot
    const rosterRows = await prisma.stopTeamPlayer.findMany({
      where: { stopId: round.stopId, teamId: { in: teamIds } },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            gender: true,
            duprDoubles: true,
            duprSingles: true,
            birthdayYear: true,
            birthdayMonth: true,
            birthdayDay: true,
          },
        },
      },
      orderBy: [{ teamId: 'asc' }, { createdAt: 'asc' }],
    });

    const rosterByTeam = new Map<string, Array<{
      id: string;
      firstName?: string | null;
      lastName?: string | null;
      name?: string | null;
      gender: Gender;
      dupr: number | null;
      age: number | null;
    }>>();

    for (const r of rosterRows) {
      const p = r.player;
      const arr = rosterByTeam.get(r.teamId) ?? [];
      arr.push({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        name: p.name ?? label(p),
        gender: p.gender,
        dupr: p.duprDoubles ?? null, // Default to doubles DUPR for lineup generation
        age: computeAge(p.birthdayYear, p.birthdayMonth, p.birthdayDay),
      });
      rosterByTeam.set(r.teamId, arr);
    }

    // Shape response
    const shaped = lineups
      .sort((a, b) => a.team.name.localeCompare(b.team.name))
      .map((lu) => ({
        lineupId: lu.id,
        team: {
          id: lu.team.id,
          name: lu.team.name,
          club: lu.team.club ? { id: lu.team.club.id, name: lu.team.club.name } : null,
          bracket: lu.team.bracket ? { id: lu.team.bracket.id, name: lu.team.bracket.name } : null,
        },
        roster: rosterByTeam.get(lu.team.id) ?? [],
        entries: lu.entries.map((e) => ({
          id: e.id,
          slot: e.slot,
          player1: {
            id: e.player1.id,
            firstName: e.player1.firstName,
            lastName: e.player1.lastName,
            name: e.player1.name ?? label(e.player1),
            gender: e.player1.gender,
          },
          player2: {
            id: e.player2.id,
            firstName: e.player2.firstName,
            lastName: e.player2.lastName,
            name: e.player2.name ?? label(e.player2),
            gender: e.player2.gender,
          },
        })),
      }));

    return NextResponse.json({
      roundId,
      stopId: round.stopId,
      lineups: shaped,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to load round lineups', detail: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<Params> }) {
  // Use singleton prisma instance
  try {
    const { roundId } = await ctx.params;
    const { action } = await req.json();

    if (action === 'generate') {
      // Generate lineups for all teams in this round
      return await generateLineupsForRound(roundId, prisma);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to process request', detail: message }, { status: 500 });
  }
}

async function generateLineupsForRound(roundId: string, prismaClient: typeof prisma) {
  const round = await prismaClient.round.findUnique({
    where: { id: roundId },
    include: {
      stop: {
        select: { id: true, tournamentId: true }
      }
    }
  });

  if (!round) {
    return NextResponse.json({ error: 'Round not found' }, { status: 404 });
  }

  const matches = await prismaClient.match.findMany({
    where: { roundId },
    include: {
      teamA: { select: { id: true, name: true } },
      teamB: { select: { id: true, name: true } },
    },
  });

  const teamNameById = new Map<string, string>();
  matches.forEach((matchRecord) => {
    if (matchRecord.teamAId) {
      teamNameById.set(matchRecord.teamAId, matchRecord.teamA?.name ?? 'Unknown Team');
    }
    if (matchRecord.teamBId) {
      teamNameById.set(matchRecord.teamBId, matchRecord.teamB?.name ?? 'Unknown Team');
    }
  });

  const teamIds = Array.from(teamNameById.keys());
  if (teamIds.length === 0) {
    return NextResponse.json({ error: 'No teams found in this round' }, { status: 400 });
  }

  const rosters = await prismaClient.stopTeamPlayer.findMany({
    where: {
      stopId: round.stopId,
      teamId: { in: teamIds },
    },
    include: {
      player: {
        select: {
          id: true,
          gender: true,
          duprDoubles: true,
          duprSingles: true,
        },
      },
    },
    orderBy: [{ teamId: 'asc' }, { createdAt: 'asc' }],
  });

  const rosterByTeam = new Map<string, Array<{ id: string; gender: Gender; dupr: number | null }>>();
  rosters.forEach((row) => {
    const bucket = rosterByTeam.get(row.teamId) ?? [];
    bucket.push({ id: row.player.id, gender: row.player.gender, dupr: row.player.duprDoubles ?? null });
    rosterByTeam.set(row.teamId, bucket);
  });

  const generatedLineups: Array<{
    teamId: string;
    teamName: string;
    entries: Array<{ slot: GameSlot; player1Id: string; player2Id: string }>;
  }> = [];

  rosterByTeam.forEach((teamRoster, teamId) => {
    const teamName = teamNameById.get(teamId) ?? 'Unknown Team';

    const lineup = generateOptimalLineup(teamRoster);
    generatedLineups.push({ teamId, teamName, entries: lineup });
  });

  const savedLineups = [] as typeof generatedLineups;
  for (const lineup of generatedLineups) {
    // Find or create lineup (can't use upsert with null in unique constraint)
    let lineupRecord = await prismaClient.lineup.findFirst({
      where: {
        roundId,
        teamId: lineup.teamId,
        bracketId: null,
      },
      select: { id: true, teamId: true },
    });

    if (!lineupRecord) {
      lineupRecord = await prismaClient.lineup.create({
        data: {
          roundId,
          teamId: lineup.teamId,
          bracketId: null,
          stopId: round.stopId,
        },
        select: { id: true, teamId: true },
      });
    }

    await prismaClient.lineupEntry.deleteMany({ where: { lineupId: lineupRecord.id } });

    if (lineup.entries.length > 0) {
      await prismaClient.lineupEntry.createMany({
        data: lineup.entries.map((entry) => ({
          lineupId: lineupRecord.id,
          slot: entry.slot,
          player1Id: entry.player1Id,
          player2Id: entry.player2Id,
        })),
      });
    }

    savedLineups.push(lineup);
  }

  return NextResponse.json({
    success: true,
    message: `Generated lineups for ${savedLineups.length} teams`,
    lineups: savedLineups,
  });
}

function generateOptimalLineup(roster: Array<{ id: string; gender: Gender; dupr: number | null }>): Array<{
  slot: GameSlot;
  player1Id: string;
  player2Id: string;
}> {
  if (roster.length < 4) {
    return [];
  }

  const malePlayers = roster.filter((p) => p.gender === 'MALE');
  const femalePlayers = roster.filter((p) => p.gender === 'FEMALE');

  if (malePlayers.length < 2 || femalePlayers.length < 2) {
    return [];
  }

  const sortPlayers = (players: Array<{ id: string; dupr: number | null }>) => {
    return [...players].sort((a, b) => {
      if (a.dupr != null && b.dupr != null) {
        return b.dupr - a.dupr;
      }
      if (a.dupr != null) return -1;
      if (b.dupr != null) return 1;
      return a.id.localeCompare(b.id);
    });
  };

  const sortedMales = sortPlayers(malePlayers);
  const sortedFemales = sortPlayers(femalePlayers);

  const [man1, man2] = sortedMales;
  const [woman1, woman2] = sortedFemales;

  const entries: Array<{ slot: GameSlot; player1Id: string; player2Id: string }> = [
    { slot: 'MENS_DOUBLES', player1Id: man1.id, player2Id: man2.id },
    { slot: 'WOMENS_DOUBLES', player1Id: woman1.id, player2Id: woman2.id },
    { slot: 'MIXED_1', player1Id: man1.id, player2Id: woman1.id },
    { slot: 'MIXED_2', player1Id: man2.id, player2Id: woman2.id },
  ];

  const usedPlayers = new Set([man1.id, man2.id, woman1.id, woman2.id]);
  const availablePlayers = roster.filter((p) => !usedPlayers.has(p.id));

  // Skip tiebreaker - it doesn't have specific players assigned

  return entries;
}
