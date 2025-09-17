// src/app/api/public/stops/[stopId]/scoreboard/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = { stopId: string };

function ymd(d?: Date | null): string | null {
  if (!d) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  try {
    const { stopId } = await ctx.params;
    // Use singleton prisma instance

    // Stop header + context
    const stop = await prisma.stop.findUnique({
      where: { id: stopId },
      select: {
        id: true,
        name: true,
        startAt: true,
        endAt: true,
        club: { select: { name: true } },
        tournament: { select: { id: true, name: true } },
      },
    });

    if (!stop) {
      return NextResponse.json({ error: 'Stop not found' }, { status: 404 });
    }

    // Rounds → Matches → Games (correct hierarchy, no transformation needed)
    const rounds = await prisma.round.findMany({
      where: { stopId },
      orderBy: { idx: 'asc' },
      include: {
        matches: {
          orderBy: { id: 'asc' },
          include: {
            teamA: { select: { id: true, name: true, clubId: true } },
            teamB: { select: { id: true, name: true, clubId: true } },
            games: { orderBy: { slot: 'asc' } },
          },
        },
      },
    });

    // Shape & compute small summary (wins per match)
    const payload = {
      stop: {
        id: stop.id,
        name: stop.name,
        tournamentId: stop.tournament?.id ?? null,
        tournamentName: stop.tournament?.name ?? null,
        locationName: stop.club?.name ?? null,
        startAt: ymd(stop.startAt),
        endAt: ymd(stop.endAt),
      },
      rounds: rounds.map((r: any) => ({
        roundId: r.id,
        idx: r.idx,
        matches: r.matches.map((match: any) => {
          const wins = { a: 0, b: 0, ties: 0 };
          for (const game of match.games) {
            const a = game.teamAScore ?? null;
            const b = game.teamBScore ?? null;
            if (a == null || b == null) continue;
            if (a > b) wins.a += 1;
            else if (b > a) wins.b += 1;
            else wins.ties += 1;
          }

          return {
            matchId: match.id,
            isBye: match.isBye,
            teamA: match.teamA ? { id: match.teamA.id, name: match.teamA.name, clubId: match.teamA.clubId } : null,
            teamB: match.teamB ? { id: match.teamB.id, name: match.teamB.name, clubId: match.teamB.clubId } : null,
            games: match.games.map((game: any) => ({
              id: game.id,
              slot: game.slot, // GameSlot
              teamAScore: game.teamAScore,
              teamBScore: game.teamBScore,
            })),
            summary: wins,
          };
        }),
      })),
    };

    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
