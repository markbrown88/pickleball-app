// src/app/api/admin/players/search/route.ts

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const squeeze = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * GET /api/admin/players/search
 *   ?term=...
 *   &tournamentId=...
 *   &teamId=...
 *   &stopId=...          // if present, use stop-specific filtering instead of tournament-wide
 *   &clubId=...          // if present AND for=captain, we constrain results to this club
 *   &excludeIds=a,b,c
 *   &for=captain|roster  // default: roster
 *   &enforceCap=1        // optional; when at cap for teamId, returns { items:[], cap:{reached:true,...} }
 *
 * Behavior:
 * - for=roster:
 *     If stopId is provided, exclude players who are rostered on ANY OTHER team
 *     for that specific stop (using StopTeamPlayer rows). This allows players to be
 *     on different teams for different stops in the same tournament.
 *     If tournamentId is provided (without stopId), exclude players who are rostered on ANY OTHER team
 *     in that tournament (using TeamPlayer rows). If teamId is omitted, exclude anyone
 *     already on any team in that tournament.
 * - for=captain:
 *     If tournamentId is provided, exclude players already assigned as a captain for a
 *     different club in the same tournament (TournamentCaptain in that tournament where clubId != provided clubId).
 *     If clubId is provided, we additionally filter results to players from that club.
 * - enforceCap:
 *     If on (and teamId provided), compute tournament.maxTeamSize (per team/bracket cap) and the team's
 *     current roster size. When count >= cap, return empty results and a cap hint so the UI can block adds.
 */
export async function GET(req: Request) {
  try {
    // Use singleton prisma instance
    const { searchParams } = new URL(req.url);

    const rawTerm = searchParams.get('term') || '';
    const term = squeeze(rawTerm);

    let tournamentId = searchParams.get('tournamentId') || undefined;
    const teamId = searchParams.get('teamId') || undefined;
    const clubId = searchParams.get('clubId') || undefined;
    const stopId = searchParams.get('stopId') || undefined;
    const mode = (searchParams.get('for') || 'roster').toLowerCase(); // 'roster' | 'captain'
    const enforceCap = searchParams.get('enforceCap') === '1';

    const excludeIdsParam = searchParams.get('excludeIds') || '';
    const excludeIds = excludeIdsParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (term.length < 3) {
      return NextResponse.json({ items: [], hint: 'Type at least 3 characters' });
    }

    // If we need tournament context and only have teamId, resolve it.
    if ((!tournamentId || enforceCap) && teamId) {
      const tinfo = await prisma.team.findUnique({
        where: { id: teamId },
        select: { tournamentId: true },
      });
      if (tinfo?.tournamentId && !tournamentId) {
        tournamentId = tinfo.tournamentId;
      }
    }

    // --- Cap enforcement (independent of mode) ---
    let teamCapLimit: number | null = null;
    let teamRosterCount = 0;
    if (enforceCap && teamId) {
      // per-team/bracket cap stored on Tournament.maxTeamSize
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { tournament: { select: { maxTeamSize: true } } },
      });
      teamCapLimit = team?.tournament?.maxTeamSize ?? null;

      if (stopId) {
        // Count players for this specific stop
        teamRosterCount = await prisma.stopTeamPlayer.count({ 
          where: { teamId, stopId } 
        });
      } else {
        // Count players across all stops (legacy behavior)
        teamRosterCount = await prisma.teamPlayer.count({ where: { teamId } });
      }

      if (teamCapLimit !== null && teamRosterCount >= teamCapLimit) {
        return NextResponse.json({
          items: [],
          cap: {
            reached: true,
            limit: teamCapLimit,
            count: teamRosterCount,
            message: `This bracket is at the limit for ${stopId ? 'this stop' : 'all stops'} (${teamRosterCount}/${teamCapLimit}).`,
          },
        });
      }
    }

    // --- Build an exclusion set that doesn't depend on Player relation field names ---
    const excludeSet = new Set<string>(excludeIds);

    if (mode !== 'captain' && tournamentId) {
      if (stopId) {
        // Stop-specific roster uniqueness:
        // exclude players already on any other team for this specific stop.
        const rosteredElsewhere = await prisma.stopTeamPlayer.findMany({
          where: {
            stopId,
            ...(teamId ? { NOT: { teamId } } : {}),
          },
          select: { playerId: true },
        });
        for (const r of rosteredElsewhere) excludeSet.add(r.playerId);
      }
    }

    if (mode === 'captain' && tournamentId) {
      // Captain uniqueness across the tournament:
      // exclude players already a captain for a *different* club in this tournament.
      const captainRows = await prisma.tournamentCaptain.findMany({
        where: {
          tournamentId,
          ...(clubId ? { NOT: { clubId } } : {}),
        },
        select: { playerId: true },
      });
      for (const r of captainRows) excludeSet.add(r.playerId);
    }

    // Optional filter: when picking captains and a clubId is given,
    // prefer returning only players from that club.
    const constrainToClub =
      mode === 'captain' && clubId ? { clubId } : {};

    const items = await prisma.player.findMany({
      where: {
        id: { notIn: excludeSet.size ? Array.from(excludeSet) : [] },
        ...constrainToClub,
        OR: [
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
          { name: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 20,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        gender: true,
        dupr: true,
        age: true,
      },
    });

    return NextResponse.json({
      items,
      ...(enforceCap
        ? { cap: { reached: false, limit: teamCapLimit, count: teamRosterCount } }
        : {}),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
