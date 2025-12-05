import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { evaluateMatchTiebreaker } from '@/lib/matchTiebreaker';
import { invalidateCache, cacheKeys } from '@/lib/cache';
import { advanceTeamsInBracket } from '@/lib/bracketAdvancement';
import { requireAuth, requireStopAccess } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;

    // 1. Authenticate
    const authResult = await requireAuth('tournament_admin');
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { teamAScore, teamBScore, courtNumber, isComplete, status, startedAt, endedAt } = body;

    // Get current game to check slot type and Authorize
    const currentGame = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        slot: true,
        isComplete: true,
        endedAt: true,
        match: { select: { round: { select: { stopId: true } } } }
      }
    });

    if (!currentGame) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    if (!currentGame.match?.round?.stopId) {
      // Should probably not happen for valid games, but if orphan...
      return NextResponse.json({ error: 'Game not linked to a stop' }, { status: 500 });
    }

    // 2. Authorize
    const accessCheck = await requireStopAccess(authResult, currentGame.match.round.stopId);
    if (accessCheck instanceof NextResponse) return accessCheck;


    // Prepare update data
    const updateData: any = {
      teamAScore: teamAScore !== undefined ? teamAScore : undefined,
      teamBScore: teamBScore !== undefined ? teamBScore : undefined,
      courtNumber: courtNumber !== undefined ? (courtNumber === null ? null : String(courtNumber)) : undefined,
      isComplete: isComplete !== undefined ? isComplete : undefined,
      status: status !== undefined ? status : undefined,
      startedAt: startedAt !== undefined ? (startedAt ? new Date(startedAt) : null) : undefined,
      endedAt: endedAt !== undefined ? (endedAt ? new Date(endedAt) : null) : undefined,
    };

    // Handle timestamps based on game state changes (fallback if not provided directly)
    // ONLY apply auto-completion logic if isComplete is explicitly provided
    if (isComplete === false && !startedAt) {
      // Game is being started - set startedAt
      updateData.startedAt = new Date();
    } else if (isComplete === true && !endedAt) {
      // Game is being ended - set endedAt
      updateData.endedAt = new Date();
    }

    // Log what we're about to update

    // Use transaction to update game and potentially advance teams in bracket
    const result = await prisma.$transaction(async (tx) => {
      // Update the game with new scores and other fields
      const updatedGame = await tx.game.update({
        where: { id: gameId },
        data: updateData,
        include: {
          match: {
            select: { id: true }
          }
        }
      });

      // After updating game, recalculate match tiebreaker status
      if (updatedGame.matchId) {
        const updatedMatch = await evaluateMatchTiebreaker(tx, updatedGame.matchId);

        // If match has a winner, advance teams through the bracket
        if (updatedMatch && updatedMatch.winnerId) {
          const matchWithRound = await tx.match.findUnique({
            where: { id: updatedGame.matchId },
            select: {
              id: true,
              winnerId: true,
              teamAId: true,
              teamBId: true,
              round: {
                select: {
                  stopId: true,
                  bracketType: true,
                  depth: true,
                },
              },
            },
          });

          if (matchWithRound) {
            const loserId = updatedMatch.winnerId === matchWithRound.teamAId
              ? matchWithRound.teamBId
              : matchWithRound.teamAId;

            await advanceTeamsInBracket(
              tx,
              updatedGame.matchId,
              updatedMatch.winnerId,
              loserId,
              matchWithRound
            );

            console.log('[Manager Game PATCH] Match complete - teams advanced:', {
              matchId: updatedGame.matchId,
              winnerId: updatedMatch.winnerId,
              loserId,
            });
          }
        }
      }

      return updatedGame;
    });

    // Invalidate schedule cache for this stop
    // Using cached stopId from initial fetch
    await invalidateCache(`${cacheKeys.stopSchedule(currentGame.match.round.stopId)}*`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating game:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = (error as any)?.code;
    const errorMeta = (error as any)?.meta;

    console.error('Error details:', {
      message: errorMessage,
      code: errorCode,
      meta: errorMeta
    });
    return NextResponse.json({
      error: 'Failed to update game',
      details: errorMessage,
      code: errorCode
    }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;

    // 1. Authenticate
    const authResult = await requireAuth('tournament_admin');
    if (authResult instanceof NextResponse) return authResult;

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        match: {
          include: {
            teamA: true,
            teamB: true,
            round: { select: { stopId: true } }
          }
        }
      }
    });

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    if (!game.match?.round?.stopId) {
      return NextResponse.json({ error: 'Game not linked to a stop' }, { status: 500 });
    }

    // 2. Authorize
    const accessCheck = await requireStopAccess(authResult, game.match.round.stopId);
    if (accessCheck instanceof NextResponse) return accessCheck;

    // Strip internal fields if needed? Or just return game.
    // round info was included to check access. returning it is fine.

    return NextResponse.json(game);
  } catch (error) {
    console.error('Error fetching game:', error);
    return NextResponse.json({ error: 'Failed to fetch game' }, { status: 500 });
  }
}