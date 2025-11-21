// Bulk roster endpoint - fetches rosters for multiple teams in one call
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEffectivePlayer, getActAsHeaderFromRequest } from '@/lib/actAs';

type Params = { stopId: string };

/**
 * GET /api/admin/stops/[stopId]/rosters?teamIds=id1,id2,id3
 *
 * Bulk fetch rosters for multiple teams in a single query
 * Eliminates N+1 problem when loading schedules
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<Params> }
) {
  try {
    const { stopId } = await ctx.params;

    // Support Act As functionality
    const actAsPlayerId = getActAsHeaderFromRequest(req);
    await getEffectivePlayer(actAsPlayerId);

    // Get teamIds from query string
    const url = new URL(req.url);
    const teamIdsParam = url.searchParams.get('teamIds');

    if (!teamIdsParam) {
      return NextResponse.json({ error: 'teamIds parameter required' }, { status: 400 });
    }

    const teamIds = teamIdsParam.split(',').filter(Boolean);

    if (teamIds.length === 0) {
      return NextResponse.json({ rosters: {} });
    }

    // Fetch all rosters in ONE query
    const stopTeamPlayers = await prisma.stopTeamPlayer.findMany({
      where: {
        stopId,
        teamId: { in: teamIds }
      },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            gender: true,
            duprDoubles: true,
            duprSingles: true,
            age: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Group by teamId
    const rosters: Record<string, any[]> = {};

    for (const teamId of teamIds) {
      rosters[teamId] = [];
    }

    for (const stp of stopTeamPlayers) {
      if (!rosters[stp.teamId]) {
        rosters[stp.teamId] = [];
      }
      rosters[stp.teamId].push({
        id: stp.player.id,
        firstName: stp.player.firstName,
        lastName: stp.player.lastName,
        name: stp.player.name,
        gender: stp.player.gender,
        dupr: stp.player.duprDoubles ?? null, // Default to doubles DUPR
        age: stp.player.age
      });
    }

    return NextResponse.json({ rosters });
  } catch (e: any) {
    console.error('Error fetching bulk rosters:', e);
    return NextResponse.json(
      { error: e?.message ?? 'Failed to load rosters' },
      { status: 500 }
    );
  }
}
