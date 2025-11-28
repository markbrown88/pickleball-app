import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { invalidateCache, cacheKeys } from '@/lib/cache';
import { evaluateMatchTiebreaker } from '@/lib/matchTiebreaker';
import { advanceTeamsInBracket } from '@/lib/bracketAdvancement';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body = await request.json();
    const { status } = body;


    if (!status || !['not_started', 'in_progress', 'completed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }


    // Map status to appropriate Game fields
    const updateData: any = {};
    if (status === 'not_started') {
      updateData.isComplete = false;
      updateData.startedAt = null;
      updateData.endedAt = null;
    } else if (status === 'in_progress') {
      updateData.isComplete = false;
      updateData.startedAt = new Date();
      updateData.endedAt = null;
    } else if (status === 'completed') {
      updateData.isComplete = true;
      updateData.endedAt = new Date();
    }

    // Use transaction to update game and potentially advance teams
    const result = await prisma.$transaction(async (tx) => {
      const updatedGame = await tx.game.update({
        where: { id: gameId },
        data: updateData,
        include: {
          match: {
            select: {
              id: true,
              round: {
                select: {
                  stopId: true
                }
              }
            }
          }
        }
      });

      // If game was marked complete, evaluate match tiebreaker and advance teams if match is complete
      if (status === 'completed') {
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

            console.log('[Manager Game Status] Match complete - teams advanced:', {
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
    if (result.match?.round?.stopId) {
      await invalidateCache(`${cacheKeys.stopSchedule(result.match.round.stopId)}*`);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating game status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = (error as any)?.code;
    const errorMeta = (error as any)?.meta;
    
    console.error('Error details:', {
      message: errorMessage,
      code: errorCode,
      meta: errorMeta
    });
    return NextResponse.json({ 
      error: 'Failed to update game status',
      details: errorMessage,
      code: errorCode
    }, { status: 500 });
  }
}
