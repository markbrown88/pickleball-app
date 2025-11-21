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
        tournamentId: true,
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
      // Step 1: Fetch existing payment methods for ALL players on this stop (across all teams)
      // This preserves payment status when moving players between teams
      const allStopEntries = await tx.stopTeamPlayer.findMany({
        where: {
          stopId,
        },
        select: {
          playerId: true,
          paymentMethod: true
        }
      });

      // Create a map of playerId -> paymentMethod from ALL teams for this stop
      const paymentMethodMap = new Map<string, 'STRIPE' | 'MANUAL' | 'UNPAID'>();
      allStopEntries.forEach(entry => {
        // Keep the first payment method found (should be consistent, but prioritize non-UNPAID)
        const existing = paymentMethodMap.get(entry.playerId);
        if (!existing || existing === 'UNPAID') {
          paymentMethodMap.set(entry.playerId, entry.paymentMethod);
        }
      });

      // Step 2: For players not found in existing roster entries, check their registration payment status
      const playersNeedingPaymentCheck = playerIds.filter(playerId => !paymentMethodMap.has(playerId));
      
      if (playersNeedingPaymentCheck.length > 0) {
        // Fetch paid registrations for these players for this tournament
        const paidRegistrations = await tx.tournamentRegistration.findMany({
          where: {
            playerId: { in: playersNeedingPaymentCheck },
            tournamentId: stop.tournamentId,
            paymentStatus: {
              in: ['PAID', 'COMPLETED'],
            },
          },
          select: {
            playerId: true,
            notes: true,
            paymentStatus: true,
          },
        });

        // Check if each paid registration includes this stop
        for (const registration of paidRegistrations) {
          let stopIds: string[] = [];
          if (registration.notes) {
            try {
              const notes = JSON.parse(registration.notes);
              stopIds = notes.stopIds || [];
            } catch (e) {
              // Ignore parse errors
            }
          }

          // If this stop is in the registration, mark player as paid via STRIPE
          if (stopIds.includes(stopId)) {
            paymentMethodMap.set(registration.playerId, 'STRIPE');
          }
        }
      }

      // Step 3: Remove existing roster for this team/stop
      await tx.stopTeamPlayer.deleteMany({
        where: {
          stopId,
          teamId
        }
      });

      // Step 4: Add new roster entries, preserving payment methods
      if (playerIds.length > 0) {
        await tx.stopTeamPlayer.createMany({
          data: playerIds.map(playerId => ({
            stopId,
            teamId,
            playerId,
            // Preserve payment method from any existing roster entry for this stop,
            // or from paid registration, or default to UNPAID
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
