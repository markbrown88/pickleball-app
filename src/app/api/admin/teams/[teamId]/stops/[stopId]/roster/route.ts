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
      throw new Error('Team not found');
    }

    // Verify stop exists and check if it's in the past
    const stop = await prisma.stop.findUnique({
      where: { id: stopId },
      select: { 
        id: true,
        name: true,
        startAt: true,
        endAt: true,
      }
    });

    if (!stop) {
      throw new Error('Stop not found');
    }

    // Warn if stop is in the past (but allow admin to proceed)
    const now = new Date();
    const isPast = stop.endAt 
      ? new Date(stop.endAt) < now
      : stop.startAt 
        ? new Date(stop.startAt) < now
        : false;
    
    if (isPast) {
      console.warn(`Admin is adding players to a past stop: ${stop.name} (${stopId})`);
      // Note: We allow this for admin flexibility, but log a warning
    }

    await prisma.$transaction(async (tx) => {
      // Fetch existing payment methods before deleting
      const existingEntries = await tx.stopTeamPlayer.findMany({
        where: {
          stopId,
          teamId
        },
        select: {
          playerId: true,
          paymentMethod: true
        }
      });

      // Create a map of playerId -> paymentMethod
      const paymentMethodMap = new Map<string, 'STRIPE' | 'MANUAL' | 'UNPAID'>();
      existingEntries.forEach(entry => {
        paymentMethodMap.set(entry.playerId, entry.paymentMethod);
      });

      // Remove existing roster for this team/stop
      await tx.stopTeamPlayer.deleteMany({
        where: {
          stopId,
          teamId
        }
      });

      // Add new roster entries, preserving payment methods
      if (playerIds.length > 0) {
        await tx.stopTeamPlayer.createMany({
          data: playerIds.map(playerId => ({
            stopId,
            teamId,
            playerId,
            // Preserve existing payment method, default to UNPAID for new entries
            paymentMethod: paymentMethodMap.get(playerId) || 'UNPAID'
          })),
          skipDuplicates: true
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update roster:', error);
    return NextResponse.json(
      { error: 'Failed to update roster' },
      { status: 500 }
    );
  }
}
