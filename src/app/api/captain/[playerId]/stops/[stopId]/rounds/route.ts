// src/app/api/captain/[playerId]/stops/[stopId]/rounds/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = { playerId: string; stopId: string };

export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  // Use singleton prisma instance

  try {
    const { playerId, stopId } = await ctx.params;

    // Stop -> tournament scope
    const stop = await prisma.stop.findUnique({
      where: { id: stopId },
      select: { id: true, tournamentId: true },
    });
    if (!stop) {
      return NextResponse.json({ error: 'Stop not found' }, { status: 404 });
    }

    // Governance: preferred via TournamentCaptain, legacy via Team.captainId
    const [caps, legacy] = await Promise.all([
      prisma.tournamentCaptain.findMany({
        where: { tournamentId: stop.tournamentId, playerId },
        select: { clubId: true },
      }),
      prisma.team.findMany({
        where: { tournamentId: stop.tournamentId, captainId: playerId },
        select: { clubId: true },
      }),
    ]);

    const governedClubIds = new Set<string>();
    for (const c of caps) if (c.clubId) governedClubIds.add(c.clubId);
    for (const t of legacy) if (t.clubId) governedClubIds.add(t.clubId);

    if (governedClubIds.size === 0) {
      // Not a captain for any club in this tournament; return empty but not an error
      return NextResponse.json({ stopId, tournamentId: stop.tournamentId, rounds: [] });
    }

    // Pull rounds + games + minimal team info
    const rounds = await (prisma.round.findMany as any)({
      where: { stopId },
      orderBy: { idx: 'asc' },
      select: {
        id: true,
        idx: true,
        games: {
          orderBy: { id: 'asc' },
          select: {
            id: true,
            isBye: true,
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
        },
      },
    });

    // Shape + annotate which sides this captain can edit
    const shaped = rounds.map((r: any) => ({
      roundId: r.id,
      idx: r.idx,
      games: (r as any).games.map((g: any) => {
        const aClubId = g.teamA?.club?.id ?? null;
        const bClubId = g.teamB?.club?.id ?? null;
        const canEditA = !!(aClubId && governedClubIds.has(aClubId));
        const canEditB = !!(bClubId && governedClubIds.has(bClubId));
        return {
          gameId: g.id,
          isBye: g.isBye,
          teamA: g.teamA
            ? {
                id: g.teamA.id,
                name: g.teamA.name,
                club: g.teamA.club ? { id: g.teamA.club.id, name: g.teamA.club.name } : null,
                bracket: g.teamA.bracket ? { id: g.teamA.bracket.id, name: g.teamA.bracket.name } : null,
                canEdit: canEditA,
              }
            : null,
          teamB: g.teamB
            ? {
                id: g.teamB.id,
                name: g.teamB.name,
                club: g.teamB.club ? { id: g.teamB.club.id, name: g.teamB.club.name } : null,
                bracket: g.teamB.bracket ? { id: g.teamB.bracket.id, name: g.teamB.bracket.name } : null,
                canEdit: canEditB,
              }
            : null,
          // Optional convenience if you want it in the UI:
          canEditTeamIds: [
            ...(canEditA && g.teamA ? [g.teamA.id] : []),
            ...(canEditB && g.teamB ? [g.teamB.id] : []),
          ],
        };
      }),
    }));

    return NextResponse.json({
      stopId,
      tournamentId: stop.tournamentId,
      rounds: shaped,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Failed to load captain rounds', detail: e?.message ?? '' },
      { status: 500 }
    );
  }
}
