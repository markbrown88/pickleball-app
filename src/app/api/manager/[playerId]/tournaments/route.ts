// src/app/api/manager/[playerId]/tournaments/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

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
  _req: Request,
  ctx: { params: Promise<Params> }
) {
  try {
    const { playerId } = await ctx.params;

    const prisma = getPrisma();

    // First find stops where the player is an event manager
    const managedStops = await prisma.stop.findMany({
      where: { 
        // @ts-ignore - eventManagerId field exists but TypeScript doesn't recognize it
        eventManagerId: playerId 
      },
      select: { tournamentId: true },
    });

    const tournamentIds = [...new Set(managedStops.map(s => s.tournamentId))];

    if (tournamentIds.length === 0) {
      return NextResponse.json({ items: [] });
    }

    // Now get only the tournaments that have stops managed by this player
    const tournaments = await prisma.tournament.findMany({
      where: { id: { in: tournamentIds } },
      include: {
        clubs: {
          select: { clubId: true, club: { select: { id: true, name: true } } },
        },
        stops: {
          where: { 
            // @ts-ignore - eventManagerId field exists but TypeScript doesn't recognize it
            eventManagerId: playerId 
          }, // Only get stops managed by this player
          orderBy: { startAt: 'asc' },
          include: {
            club: { select: { id: true, name: true } },
            rounds: {
              orderBy: { idx: 'asc' },
              include: {
                matches: {
                  include: {
                    games: { select: { id: true } },
                  },
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
        rounds: (s.rounds ?? []).map((r: any) => {
          const matchCount = r.matches.length;  // r.matches are team vs team matchups
          const gameCount = r.matches.reduce((acc: number, m: any) => acc + m.games.length, 0);  // m.games are individual game slots
          return { roundId: r.id, idx: r.idx, gameCount, matchCount };
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
          admin: !!t.admins.find((a: any) => a.playerId === playerId),
          captainOfClubs: t.TournamentCaptain.filter((c: any) => c.playerId === playerId).map((c: any) => c.clubId),
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
