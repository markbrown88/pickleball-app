// src/app/api/admin/rounds/[roundId]/teams/[teamId]/lineup/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

type Params = { roundId: string; teamId: string };

function displayName(p: { firstName?: string | null; lastName?: string | null; name?: string | null }) {
  const fn = (p.firstName ?? '').trim();
  const ln = (p.lastName ?? '').trim();
  const full = [fn, ln].filter(Boolean).join(' ');
  return full || (p.name ?? 'Unknown');
}

export async function GET(_req: NextRequest, ctx: { params: Promise<Params> }) {
  const prisma = getPrisma();
  try {
    const { roundId, teamId } = await ctx.params;

    // Verify round (for stopId)
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      select: { id: true, stopId: true },
    });
    if (!round) return NextResponse.json({ error: 'Round not found' }, { status: 404 });

    // Ensure a lineup row exists for (roundId, teamId)
    let lineup = await prisma.lineup.findFirst({
      where: { roundId, teamId },
      select: { id: true },
    });
    if (!lineup) {
      lineup = await prisma.lineup.create({
        data: { roundId, teamId, stopId: round.stopId },
        select: { id: true },
      });
    }

    // Load full lineup
    const full = await prisma.lineup.findUnique({
      where: { id: lineup.id },
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

    // Roster for this team at this stop
    const rosterRows = await prisma.stopTeamPlayer.findMany({
      where: { stopId: round.stopId, teamId },
      include: { player: { select: { id: true, firstName: true, lastName: true, name: true, gender: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const roster = rosterRows.map((r) => ({
      id: r.player.id,
      firstName: r.player.firstName,
      lastName: r.player.lastName,
      name: displayName(r.player),
      gender: r.player.gender,
    }));

    return NextResponse.json({
      roundId,
      stopId: round.stopId,
      lineup: full
        ? {
            id: full.id,
            team: {
              id: full.team.id,
              name: full.team.name,
              club: full.team.club ? { id: full.team.club.id, name: full.team.club.name } : null,
              bracket: full.team.bracket ? { id: full.team.bracket.id, name: full.team.bracket.name } : null,
            },
            entries: full.entries.map((e) => ({
              id: e.id,
              slot: e.slot,
              player1: {
                id: e.player1.id,
                firstName: e.player1.firstName,
                lastName: e.player1.lastName,
                name: displayName(e.player1),
                gender: e.player1.gender,
              },
              player2: {
                id: e.player2.id,
                firstName: e.player2.firstName,
                lastName: e.player2.lastName,
                name: displayName(e.player2),
                gender: e.player2.gender,
              },
            })),
            roster,
          }
        : null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed to load team lineup' }, { status: 500 });
  }
}
