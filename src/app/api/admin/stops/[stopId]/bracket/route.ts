/**
 * Bracket API - Reset/Delete bracket for a stop
 *
 * DELETE /api/admin/stops/[stopId]/bracket
 *
 * Deletes all rounds, matches, and games for a stop's bracket.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { invalidateCache, cacheKeys } from '@/lib/cache';
import { requireAuth, requireStopAccess } from '@/lib/auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ stopId: string }> }
) {
  try {
    const { stopId } = await params;

    // 1. Authenticate
    const authResult = await requireAuth('tournament_admin');
    if (authResult instanceof NextResponse) return authResult;

    // 2. Authorize
    const accessCheck = await requireStopAccess(authResult, stopId);
    if (accessCheck instanceof NextResponse) return accessCheck;

    // Use a transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Find all rounds for this stop
      const rounds = await tx.round.findMany({
        where: { stopId },
        select: { id: true },
      });

      if (rounds.length === 0) {
        return {
          message: 'No bracket found for this stop',
          deleted: { rounds: 0, matches: 0, games: 0 },
        };
      }

      const roundIds = rounds.map(r => r.id);

      // Find all matches for these rounds
      const matches = await tx.match.findMany({
        where: { roundId: { in: roundIds } },
        select: { id: true },
      });

      let gamesDeleted = 0;
      let matchesDeleted = 0;

      if (matches.length > 0) {
        const matchIds = matches.map(m => m.id);

        // Step 1: Clear all match references to avoid foreign key constraint violations
        // This includes team references, winner references, and tiebreaker references
        await tx.match.updateMany({
          where: { id: { in: matchIds } },
          data: {
            sourceMatchAId: null,
            sourceMatchBId: null,
            winnerId: null,
            teamAId: null,
            teamBId: null,
            tiebreakerWinnerTeamId: null,
            tiebreakerGameId: null,        // Clear reference to game before deleting games
            tiebreakerDecidedById: null,    // Clear reference to player
          },
        });

        // Step 2: Delete games (now safe since tiebreakerGameId is cleared)
        const gamesResult = await tx.game.deleteMany({
          where: { matchId: { in: matchIds } },
        });
        gamesDeleted = gamesResult.count;

        // Step 3: Delete matches (now safe since all references are cleared)
        const matchesResult = await tx.match.deleteMany({
          where: { id: { in: matchIds } },
        });
        matchesDeleted = matchesResult.count;
      }

      // Finally delete rounds
      const roundsResult = await tx.round.deleteMany({
        where: { id: { in: roundIds } },
      });

      return {
        message: 'Bracket reset successfully',
        deleted: {
          rounds: roundsResult.count,
          matches: matchesDeleted,
          games: gamesDeleted,
        },
      };
    });

    // Invalidate cache for this stop's schedule
    await invalidateCache(`${cacheKeys.stopSchedule(stopId)}*`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error resetting bracket:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      {
        error: 'Failed to reset bracket',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
