import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await params;

    // Simple match check - we don't need team data for basic games
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true }
    });

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // Get all games for this match
    const games = await prisma.game.findMany({
      where: { matchId },
      orderBy: { slot: 'asc' }
    });

    // Return games without complex lineup generation
    // The frontend will handle displaying team names for tiebreakers
    return NextResponse.json(games);
  } catch (error) {
    console.error('Error fetching games:', error);
    return NextResponse.json({ error: 'Failed to fetch games' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await params;
    const body = await request.json();
    const { games } = body;

    // Check if this is a tiebreaker creation (single game)
    if (games.length === 1 && games[0].slot === 'TIEBREAKER') {
      // Create just the tiebreaker game
      const tiebreakerGame = await prisma.game.create({
        data: {
          matchId,
          slot: 'TIEBREAKER',
          teamAScore: games[0].teamAScore || null,
          teamBScore: games[0].teamBScore || null,
          teamALineup: games[0].teamALineup || null,
          teamBLineup: games[0].teamBLineup || null,
          lineupConfirmed: games[0].lineupConfirmed || false
        }
      });
      
      return NextResponse.json([tiebreakerGame]);
    }

    // Original logic for creating all 4 standard games
    const requiredSlots = ['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_1', 'MIXED_2'];
    const providedSlots = games.map((g: any) => g.slot);
    
    if (!requiredSlots.every(slot => providedSlots.includes(slot))) {
      return NextResponse.json({ error: 'Missing required game slots' }, { status: 400 });
    }

    // Use transaction to create/update all games
    const result = await prisma.$transaction(async (tx) => {
      // Delete existing games for this match
      await tx.game.deleteMany({
        where: { matchId }
      });

      // Create new games
      const createdGames = await Promise.all(
        games.map((game: any) =>
          tx.game.create({
            data: {
              matchId,
              slot: game.slot,
              teamAScore: game.teamAScore || null,
              teamBScore: game.teamBScore || null,
              teamALineup: game.teamALineup || null,
              teamBLineup: game.teamBLineup || null,
              lineupConfirmed: game.lineupConfirmed || false
            }
          })
        )
      );

      return createdGames;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error saving games:', error);
    return NextResponse.json({ error: 'Failed to save games' }, { status: 500 });
  }
}
