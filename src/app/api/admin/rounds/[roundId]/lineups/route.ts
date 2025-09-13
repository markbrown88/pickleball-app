// src/app/api/admin/rounds/[roundId]/lineups/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

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
  const prisma = getPrisma();
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

    // All teams that appear in this round (from games)
    const games = await prisma.game.findMany({
      where: { roundId },
      select: {
        teamAId: true,
        teamBId: true,
        teamA: {
          select: {
            id: true,
            name: true,
            club: { select: { id: true, name: true } },
            bracket: { select: { id: true, name: true } },
          },
        },
        teamB: {
          select: {
            id: true,
            name: true,
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

    for (const g of games) {
      if (g.teamAId && g.teamA) {
        teamMeta.set(g.teamAId, {
          id: g.teamA.id,
          name: g.teamA.name,
          club: g.teamA.club ? { id: g.teamA.club.id, name: g.teamA.club.name } : null,
          bracket: g.teamA.bracket ? { id: g.teamA.bracket.id, name: g.teamA.bracket.name } : null,
        });
      }
      if (g.teamBId && g.teamB) {
        teamMeta.set(g.teamBId, {
          id: g.teamB.id,
          name: g.teamB.name,
          club: g.teamB.club ? { id: g.teamB.club.id, name: g.teamB.club.name } : null,
          bracket: g.teamB.bracket ? { id: g.teamB.bracket.id, name: g.teamB.bracket.name } : null,
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
        await prisma.lineup.create({ data: { roundId, teamId, stopId: round.stopId } });
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
            dupr: true,
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
      gender: any;
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
        dupr: p.dupr ?? null,
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
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to load round lineups', detail: e?.message ?? '' }, { status: 500 });
  }
}
