// src/app/api/manager/[playerId]/tournaments/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEffectivePlayer, getActAsHeaderFromRequest } from '@/lib/actAs';

type Params = { playerId: string };

/* Small date helper (date-only ISO) */
function toYMD(d?: Date | null): string | null {
  if (!d) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * GET /api/manager/[playerId]/tournaments
 *
 * Lists tournaments where the given player is a Tournament Event Manager,
 * along with their stops and light schedule stats (games & matches counts).
 *
 * Shape:
 * {
 *   items: [{
 *     tournamentId, tournamentName, type, maxTeamSize,
 *     roles: { manager: true, admin: boolean, captainOfClubs: string[] },
 *     clubs: [{ id, name }],
 *     stops: [{
 *       stopId, stopName, locationName, startAt, endAt,
 *       rounds: [{ roundId, idx, gameCount, matchCount }]
 *     }]
 *   }]
 * }
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<Params> }
) {
  try {
    const { playerId } = await ctx.params;

    // Support Act As functionality
    const actAsPlayerId = getActAsHeaderFromRequest(req);
    const effectivePlayer = await getEffectivePlayer(actAsPlayerId);

    // Use the effective player ID (either real or acting as)
    const targetPlayerId = effectivePlayer.targetPlayerId;

    // Verify the requested playerId matches the effective player (or user is admin)
    if (playerId !== targetPlayerId && !effectivePlayer.isAppAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Find tournaments where the player is an event manager
    // 1. Via Stop.eventManagerId (stop-level assignment)
    const managedStops = await prisma.stop.findMany({
      where: {
        eventManagerId: targetPlayerId
      },
      select: { tournamentId: true },
    });

    // 2. Via TournamentEventManager table (tournament-level assignment)
    const tournamentEventManagers = await prisma.tournamentEventManager.findMany({
      where: {
        playerId: targetPlayerId
      },
      select: { tournamentId: true },
    });

    const tournamentIds = [
      ...new Set([
        ...managedStops.map(s => s.tournamentId),
        ...tournamentEventManagers.map(tem => tem.tournamentId),
      ])
    ];

    if (tournamentIds.length === 0) {
      return NextResponse.json({ items: [] });
    }

    // Build a set of tournament IDs where player is a tournament-level manager
    const tournamentLevelManagerIds = new Set(tournamentEventManagers.map(tem => tem.tournamentId));

    // Now get only the tournaments that have stops managed by this player
    const tournaments = await prisma.tournament.findMany({
      where: { id: { in: tournamentIds } },
      include: {
        clubs: {
          select: { clubId: true, club: { select: { id: true, name: true } } },
        },
        stops: {
          // If tournament-level manager, show all stops; otherwise only their assigned stops
          where: tournamentLevelManagerIds.size > 0 ? undefined : {
            eventManagerId: targetPlayerId
          },
          orderBy: { startAt: 'asc' },
          include: {
            club: { select: { id: true, name: true } },
            rounds: {
              orderBy: { idx: 'asc' },
              include: {
                matches: {
                  select: { id: true },
                },
              },
            },
          },
        },
        admins: { select: { playerId: true } },
        TournamentCaptain: { select: { playerId: true, clubId: true } },
      },
    });

    const items = tournaments.map((t: any) => {
      const stops = (t.stops ?? []).map((s: any) => ({
        stopId: s.id,
        stopName: s.name,
        locationName: s.club?.name ?? null,
        startAt: toYMD(s.startAt),
        endAt: toYMD(s.endAt),
        lineupDeadline: s.lineupDeadline ? s.lineupDeadline.toISOString() : null,
        rounds: (s.rounds ?? []).map((r: any) => {
          const matchCount = r.matches?.length || 0;
          return { roundId: r.id, idx: r.idx, gameCount: 0, matchCount };
        }),
      }));

      const clubs = t.clubs.map((c: any) => ({ id: c.club.id, name: c.club.name }));

      return {
        tournamentId: t.id,
        tournamentName: t.name,
        type: t.type,
        maxTeamSize: t.maxTeamSize ?? null,
        roles: {
          manager: true,
          admin: !!t.admins.find((a: any) => a.playerId === targetPlayerId),
          captainOfClubs: t.TournamentCaptain.filter((c: any) => c.playerId === targetPlayerId).map((c: any) => c.clubId),
        },
        clubs,
        stops,
      };
    });

    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
