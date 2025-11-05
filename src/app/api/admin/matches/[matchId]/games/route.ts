import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { evaluateMatchTiebreaker } from '@/lib/matchTiebreaker';

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

    // Get all games for this match with score submissions
    const [games, submissions] = await prisma.$transaction([
      prisma.game.findMany({
        where: { matchId },
        orderBy: { slot: 'asc' }
      }),
      prisma.gameScoreSubmission.findMany({
        where: { game: { matchId } },
        orderBy: { submittedAt: 'asc' }
      })
    ]);

    // Process games to include submissions
    // Note: Lineups are now managed via Lineup/LineupEntry tables, not JSON fields on Game
    const processedGames = games.map(game => {
      const gameSubmissions = submissions
        .filter(sub => sub.gameId === game.id)
        .map(sub => ({
          id: sub.id,
          teamId: sub.teamId,
          teamName: sub.teamName ?? undefined,
          reportedScore: sub.reportedScore,
          submittedAt: sub.submittedAt,
        }));

      return {
        ...game,
        submissions: gameSubmissions
      };
    });

    return NextResponse.json(processedGames);
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
      try {
        // First check if tiebreaker already exists for this match
        const existingTiebreaker = await prisma.game.findFirst({
          where: {
            matchId,
            slot: 'TIEBREAKER'
          }
        });
        
        if (existingTiebreaker) {
          // Tiebreaker already exists, but ensure match status is set to REQUIRES_TIEBREAKER
          await prisma.match.update({
            where: { id: matchId },
            data: { tiebreakerStatus: 'REQUIRES_TIEBREAKER' }
          });
          return NextResponse.json([existingTiebreaker]);
        }
        
        const tiebreakerGame = await prisma.game.create({
          data: {
            matchId,
            slot: 'TIEBREAKER',
            teamAScore: games[0].teamAScore || null,
            teamBScore: games[0].teamBScore || null
          }
        });
        
        // After creating tiebreaker game, update match status to REQUIRES_TIEBREAKER
        // This ensures the tiebreaker game displays in the UI
        await prisma.match.update({
          where: { id: matchId },
          data: { tiebreakerStatus: 'REQUIRES_TIEBREAKER' }
        });
        
        return NextResponse.json([tiebreakerGame]);
      } catch (tiebreakerError: any) {
        console.error('Error creating tiebreaker game:', tiebreakerError);
        throw tiebreakerError;
      }
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
      // Note: Lineups are now managed via Lineup/LineupEntry tables, not JSON fields on Game
      const createdGames = await Promise.all(
        games.map((game: any) =>
          tx.game.create({
            data: {
              matchId,
              slot: game.slot,
              teamAScore: game.teamAScore || null,
              teamBScore: game.teamBScore || null
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
