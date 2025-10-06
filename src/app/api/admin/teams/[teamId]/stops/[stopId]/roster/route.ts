import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type Params = {
  params: Promise<{
    teamId: string;
    stopId: string;
  }>;
};

/**
 * PUT /api/admin/teams/:teamId/stops/:stopId/roster
 * Update the roster for a team at a specific stop
 */
export async function PUT(request: Request, { params }: Params) {
  try {
    const { teamId, stopId } = await params;
    const { playerIds } = await request.json();

    if (!Array.isArray(playerIds)) {
      return NextResponse.json({ error: 'playerIds must be an array' }, { status: 400 });
    }

    // Verify team exists
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, clubId: true }
    });

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Verify stop exists
    const stop = await prisma.stop.findUnique({
      where: { id: stopId },
      select: { id: true }
    });

    if (!stop) {
      return NextResponse.json({ error: 'Stop not found' }, { status: 404 });
    }

    // Remove existing roster for this team/stop
    await prisma.stopTeamPlayer.deleteMany({
      where: {
        stopId,
        teamId
      }
    });

    // Add new roster entries
    if (playerIds.length > 0) {
      await prisma.stopTeamPlayer.createMany({
        data: playerIds.map(playerId => ({
          stopId,
          teamId,
          playerId
        })),
        skipDuplicates: true
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update roster:', error);
    return NextResponse.json(
      { error: 'Failed to update roster' },
      { status: 500 }
    );
  }
}
