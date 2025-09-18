// src/app/api/admin/stops/[stopId]/teams/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/** GET /api/admin/stops/:stopId/teams */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ stopId: string }> }
) {
  try {
    const { stopId } = await ctx.params;
    // Use singleton prisma instance

    const stopTeams = await prisma.stopTeam.findMany({
      where: { stopId },
      include: {
        team: {
          include: {
            club: true,
            captain: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Get roster data for each team
    const rows = await Promise.all(
      stopTeams.map(async (stopTeam) => {
        const roster = await prisma.stopTeamPlayer.findMany({
          where: { stopId, teamId: stopTeam.teamId },
          include: {
            player: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                name: true,
                dupr: true,
                gender: true,
              },
            },
          },
        });

        return {
          ...stopTeam,
          roster: roster.map(r => r.player),
        };
      })
    );

    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** POST /api/admin/stops/:stopId/teams
 * Body: { teamId: string }
 * Adds a team to the stop (idempotent).
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ stopId: string }> }
) {
  try {
    const { stopId } = await ctx.params;
    const { teamId } = (await req.json()) as { teamId?: string };

    if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 });

    // Use singleton prisma instance

    const [stop, team] = await Promise.all([
      prisma.stop.findUnique({ where: { id: stopId }, select: { id: true, tournamentId: true } }),
      prisma.team.findUnique({ where: { id: teamId }, select: { id: true, tournamentId: true } }),
    ]);

    if (!stop) return NextResponse.json({ error: 'stop not found' }, { status: 404 });
    if (!team) return NextResponse.json({ error: 'team not found' }, { status: 404 });

    // Prevent cross-tournament enrollment
    if (stop.tournamentId !== team.tournamentId) {
      return NextResponse.json({ error: 'team must belong to the same tournament as the stop' }, { status: 400 });
    }

    await prisma.stopTeam.createMany({
      data: [{ stopId, teamId }],
      skipDuplicates: true,
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** DELETE /api/admin/stops/:stopId/teams?teamId=... */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ stopId: string }> }
) {
  try {
    const { stopId } = await ctx.params;
    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get('teamId') ?? undefined;

    if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 });

    // Use singleton prisma instance

    // Remove any per-stop roster links first (safer if FKs aren’t cascading)
    await prisma.stopTeamPlayer.deleteMany({ where: { stopId, teamId } });

    // Then remove the StopTeam row (composite PK)
    await prisma.stopTeam.delete({ where: { stopId_teamId: { stopId, teamId } } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
