import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body = await request.json();
    const { teamAScore, teamBScore, courtNumber, isComplete } = body;

    console.log('Updating game:', { gameId, teamAScore, teamBScore, courtNumber, isComplete });

    // Update the game with new scores and other fields
    const updatedGame = await prisma.game.update({
      where: { id: gameId },
      data: {
        teamAScore: teamAScore !== undefined ? teamAScore : undefined,
        teamBScore: teamBScore !== undefined ? teamBScore : undefined,
        courtNumber: courtNumber !== undefined ? courtNumber : undefined,
        isComplete: isComplete !== undefined ? isComplete : undefined,
      }
    });

    console.log('Game updated successfully:', updatedGame);
    return NextResponse.json(updatedGame);
  } catch (error) {
    console.error('Error updating game:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
    return NextResponse.json({ 
      error: 'Failed to update game',
      details: error.message,
      code: error.code
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