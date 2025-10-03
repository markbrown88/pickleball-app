import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body = await request.json();
    const { teamAScore, teamBScore, courtNumber, isComplete, status, startedAt, endedAt } = body;

    console.log('Updating game:', { gameId, teamAScore, teamBScore, courtNumber, isComplete, status, startedAt, endedAt });

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
    if (isComplete === false && !startedAt) {
      // Game is being started - set startedAt
      updateData.startedAt = new Date();
    } else if (isComplete === true && !endedAt) {
      // Game is being ended - set endedAt
      updateData.endedAt = new Date();
    }

    // Update the game with new scores and other fields
    const updatedGame = await prisma.game.update({
      where: { id: gameId },
      data: updateData
    });

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