// src/app/api/admin/tournaments/[tournamentId]/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { TournamentType } from '@prisma/client';

const TYPE_MAP: Record<string, TournamentType> = {
  TEAM_FORMAT: 'TEAM_FORMAT',
  'Team Format': 'TEAM_FORMAT',
  SINGLE_ELIMINATION: 'SINGLE_ELIMINATION',
  'Single Elimination': 'SINGLE_ELIMINATION',
  DOUBLE_ELIMINATION: 'DOUBLE_ELIMINATION',
  'Double Elimination': 'DOUBLE_ELIMINATION',
  ROUND_ROBIN: 'ROUND_ROBIN',
  'Round Robin': 'ROUND_ROBIN',
  POOL_PLAY: 'POOL_PLAY',
  'Pool Play': 'POOL_PLAY',
  LADDER_TOURNAMENT: 'LADDER_TOURNAMENT',
  'Ladder Tournament': 'LADDER_TOURNAMENT',
} as const;

/** DELETE /api/admin/tournaments/:tournamentId */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ tournamentId: string }> }
) {
  // Use singleton prisma instance
  const { tournamentId } = await ctx.params;

  const exists = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true },
  });
  if (!exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.tournament.delete({ where: { id: tournamentId } });
  return new NextResponse(null, { status: 204 });
}

/**
 * PUT /api/admin/tournaments/:tournamentId
 * Body:
 * {
 *   name: string,
 *   type?: TournamentType | "Team Format" | ...,
 *   syncParticipants?: boolean
 * }
 *
 * Reconciliation:
 * - Ensures a DEFAULT bracket (TournamentBracket) if none.
 * - Ensures teams for each (club × bracket).
 * - Ensures StopTeam links for every Stop × Team.
 */
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ tournamentId: string }> }
) {
  // Use singleton prisma instance
  const { tournamentId } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? '').trim();
  const typeInput = body.type as (TournamentType | string | undefined);
  const type: TournamentType | undefined =
    typeInput && TYPE_MAP[String(typeInput)] ? TYPE_MAP[String(typeInput)] : undefined;

  const syncParticipants = !!body.syncParticipants;

  if (!name) {
    return NextResponse.json({ error: 'Tournament name is required' }, { status: 400 });
  }

  const t = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true },
  });
  if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1) Basic update
      await tx.tournament.update({
        where: { id: tournamentId },
        data: { name, ...(type ? { type } : {}) },
      });

      // Note: TournamentClub management is now handled through the /config endpoint.

      // Note: Legacy division-based team creation removed.
      // Teams are now created through the modern bracket system via /config endpoint.

      // 4) Reconciliation: brackets + StopTeams
      const full = await tx.tournament.findUnique({
        where: { id: tournamentId },
        include: {
          clubs: { include: { club: true } },    // TournamentClub[]
          brackets: { orderBy: { idx: 'asc' } }, // TournamentBracket[]
          stops: true,                            // Stop[]
        },
      });
      if (!full) throw new Error('Tournament not found during reconciliation');

      // Ensure DEFAULT bracket if none exist
      let brackets = full.brackets;
      if (!brackets || brackets.length === 0) {
        const def = await tx.tournamentBracket.upsert({
          where: { tournamentId_name: { tournamentId, name: 'DEFAULT' } },
          update: {},
          create: { tournamentId, name: 'DEFAULT', idx: 0 },
        });
        brackets = [def];
      }

      // Ensure StopTeam links for all teams across all stops
      const allStops = await tx.stop.findMany({ where: { tournamentId: full.id } });
      const allTeams = await tx.team.findMany({ where: { tournamentId: full.id } });

      for (const team of allTeams) {
        for (const stop of allStops) {
          await tx.stopTeam.upsert({
            where: { stopId_teamId: { stopId: stop.id, teamId: team.id } },
            update: {},
            create: { stopId: stop.id, teamId: team.id },
          });
        }
      }

      return { ok: true };
    });

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed to update tournament' }, { status: 400 });
  }
}
