import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { evaluateMatchTiebreaker } from '@/lib/matchTiebreaker';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body = await request.json();
    const { teamAScore, teamBScore, courtNumber, isComplete, status, startedAt, endedAt } = body;

    // Get current game to check slot type
    const currentGame = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, slot: true, isComplete: true, endedAt: true }
    });

    if (!currentGame) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    console.log('Updating game:', {
      gameId,
      slot: currentGame.slot,
      currentIsComplete: currentGame.isComplete,
      currentEndedAt: currentGame.endedAt,
      requestBody: { teamAScore, teamBScore, courtNumber, isComplete, status, startedAt, endedAt }
    });

    // Prepare update data
    const updateData: any = {
      teamAScore: teamAScore !== undefined ? teamAScore : undefined,
      teamBScore: teamBScore !== undefined ? teamBScore : undefined,
      courtNumber: courtNumber !== undefined ? courtNumber : undefined,
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
      console.log('Auto-setting startedAt for game start');
    } else if (isComplete === true && !endedAt) {
      // Game is being ended - set endedAt
      updateData.endedAt = new Date();
      console.log('Auto-setting endedAt for game end');
    }

    // Log what we're about to update
    console.log('Update data being applied:', updateData);

    // Update the game with new scores and other fields
    const updatedGame = await prisma.game.update({
      where: { id: gameId },
      data: updateData
    });

    // After updating game, recalculate match tiebreaker status
    if (updatedGame.matchId) {
      await evaluateMatchTiebreaker(prisma, updatedGame.matchId);
    }

    console.log('Game updated successfully:', updatedGame);
    return NextResponse.json(updatedGame);
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

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        match: {
          include: {
            teamA: true,
            teamB: true
          }
        }
      }
    });

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    return NextResponse.json(game);
  } catch (error) {
    console.error('Error fetching game:', error);
    return NextResponse.json({ error: 'Failed to fetch game' }, { status: 500 });
  }
}