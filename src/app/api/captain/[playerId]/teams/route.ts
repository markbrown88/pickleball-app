export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

type Id = string;

export async function GET(_req: Request, { params }: { params: { playerId: string } }) {
  try {
    const prisma = getPrisma();
    const captainId = params.playerId;

    // All teams where this player is captain, with team roster & stop links
    const teams = await prisma.team.findMany({
      where: { captainId },
      include: {
        club: true,
        playerLinks: {
          include: {
            player: {
              include: { club: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        stopLinks: {
          include: {
            stop: {
              include: {
                tournament: { select: { id: true, name: true } },
                // If you have Stop.clubId as location, you can include it too:
                // club: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (teams.length === 0) {
      return NextResponse.json({ teams: [] });
    }

    const teamIds = teams.map(t => t.id);

    // For all stops these teams are in, load the STOP-LEVEL roster (players selected for that stop)
    const stopTeamPlayers = await prisma.stopTeamPlayer.findMany({
      where: { teamId: { in: teamIds } },
      include: {
        player: true,
        stop: true,
        team: true,
      },
      orderBy: [{ stopId: 'asc' }, { createdAt: 'asc' }],
    });

    // Build a map: key = `${teamId}:${stopId}` -> players[]
    const stopRosterMap = new Map<string, any[]>();
    for (const stp of stopTeamPlayers) {
      const key = `${stp.teamId}:${stp.stopId}`;
      const arr = stopRosterMap.get(key) ?? [];
      arr.push(stp.player);
      stopRosterMap.set(key, arr);
    }

    // Shape the response
    const shaped = teams.map(t => {
      const roster = t.playerLinks.map(pl => pl.player);
      const stops = t.stopLinks.map(link => {
        const s = link.stop as any;
        const key = `${t.id}:${s.id}`;
        const stopRoster = stopRosterMap.get(key) ?? [];
        return {
          stopId: s.id,
          stopName: s.name,
          startAt: s.startAt ?? null,
          endAt: s.endAt ?? null,
          tournamentId: s.tournament?.id ?? null,
          tournamentName: s.tournament?.name ?? null,
          stopRoster, // players selected for this stop
        };
      });
      return {
        id: t.id,
        name: t.name,
        club: t.club,
        roster,      // team roster (max 8 enforced elsewhere)
        stops,       // each with tournament and stop roster
      };
    });

    return NextResponse.json({ teams: shaped });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}


