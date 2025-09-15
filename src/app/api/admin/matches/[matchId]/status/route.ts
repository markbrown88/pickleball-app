import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await params;
    const body = await request.json();
    const { status } = body; // 'not_started', 'in_progress', 'completed'

    // For now, we'll store the match status in a JSON field on the Match model
    // or we could add a status field to the schema later
    const updatedMatch = await prisma.match.update({
      where: { id: matchId },
      data: {
        // We'll need to add a status field to the Match model
        // For now, let's use a workaround with a custom field
      }
    });

    return NextResponse.json(updatedMatch);
  } catch (error) {
    console.error('Error updating match status:', error);
    return NextResponse.json({ error: 'Failed to update match status' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await params;

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        teamA: true,
        teamB: true,
        games: {
          orderBy: { slot: 'asc' }
        }
      }
    });

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // Determine match status based on games
    const hasGames = match.games.length > 0;
    const hasScores = match.games.some(game => game.teamAScore !== null || game.teamBScore !== null);
    const allGamesComplete = match.games.every(game => game.teamAScore !== null && game.teamBScore !== null);

    let status = 'not_started';
    if (hasGames && hasScores) {
      status = allGamesComplete ? 'completed' : 'in_progress';
    }

    return NextResponse.json({ ...match, status });
  } catch (error) {
    console.error('Error fetching match status:', error);
    return NextResponse.json({ error: 'Failed to fetch match status' }, { status: 500 });
  }
}
