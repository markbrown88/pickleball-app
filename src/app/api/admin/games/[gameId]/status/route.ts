import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body = await request.json();
    const { status } = body;

    console.log('Status update request:', { gameId, status });

    if (!status || !['not_started', 'in_progress', 'completed'].includes(status)) {
      console.log('Invalid status:', status);
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    console.log('Attempting to update game status in database...');
    const updatedGame = await prisma.game.update({
      where: { id: gameId },
      data: { status }
    });

    console.log('Game status updated successfully:', updatedGame);
    return NextResponse.json(updatedGame);
  } catch (error) {
    console.error('Error updating game status:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
    return NextResponse.json({ 
      error: 'Failed to update game status',
      details: error.message,
      code: error.code
    }, { status: 500 });
  }
}
