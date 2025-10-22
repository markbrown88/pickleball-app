/**
 * Bracket API - Reset/Delete bracket for a stop
 *
 * DELETE /api/admin/stops/[stopId]/bracket
 *
 * Deletes all rounds, matches, and games for a stop's bracket.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ stopId: string }> }
) {
  try {
    const { stopId } = await params;

    // Find all rounds for this stop
    const rounds = await prisma.round.findMany({
      where: { stopId },
      select: { id: true },
    });

    if (rounds.length === 0) {
      return NextResponse.json(
        { message: 'No bracket found for this stop' },
        { status: 200 }
      );
    }

    const roundIds = rounds.map(r => r.id);

    // Find all matches for these rounds
    const matches = await prisma.match.findMany({
      where: { roundId: { in: roundIds } },
      select: { id: true },
    });

    if (matches.length > 0) {
      const matchIds = matches.map(m => m.id);

      // Delete games first (due to foreign key constraints)
      await prisma.game.deleteMany({
        where: { matchId: { in: matchIds } },
      });

      // Delete matches
      await prisma.match.deleteMany({
        where: { id: { in: matchIds } },
      });
    }

    // Finally delete rounds
    await prisma.round.deleteMany({
      where: { id: { in: roundIds } },
    });

    return NextResponse.json({
      message: 'Bracket reset successfully',
      deleted: {
        rounds: rounds.length,
        matches: matches.length,
      },
    });
  } catch (error) {
    console.error('Error resetting bracket:', error);
    return NextResponse.json(
      {
        error: 'Failed to reset bracket',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
