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
    
    const updatedGame = await prisma.game.update({
      where: { id: gameId },
      data: updateData
    });

    console.log('Game status updated successfully:', updatedGame);
    return NextResponse.json(updatedGame);
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
