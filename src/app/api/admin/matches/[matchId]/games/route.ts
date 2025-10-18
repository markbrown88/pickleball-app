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

    // Get all games for this match with any lineups/score submissions
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

    // Process lineup data to convert player IDs to player names
    const allPlayerIds = new Set<string>();
    games.forEach(game => {
      if (game.teamALineup && Array.isArray(game.teamALineup)) {
        game.teamALineup.forEach((entry: any) => {
          if (entry.player1Id) allPlayerIds.add(entry.player1Id);
          if (entry.player2Id) allPlayerIds.add(entry.player2Id);
        });
      }
      if (game.teamBLineup && Array.isArray(game.teamBLineup)) {
        game.teamBLineup.forEach((entry: any) => {
          if (entry.player1Id) allPlayerIds.add(entry.player1Id);
          if (entry.player2Id) allPlayerIds.add(entry.player2Id);
        });
      }
    });

    // Fetch player details
    const players = await prisma.player.findMany({
      where: { id: { in: Array.from(allPlayerIds) } },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true
      }
    });

    const playerMap = new Map(players.map(p => [p.id, {
      id: p.id,
      name: p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim()
    }]));

    // Process games to convert lineup data
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

      const processLineup = (lineup: any) => {
        if (!lineup || !Array.isArray(lineup)) return lineup;
        return lineup.map((entry: any) => {
          const player1 = entry.player1Id ? playerMap.get(entry.player1Id) : null;
          const player2 = entry.player2Id ? playerMap.get(entry.player2Id) : null;
          return {
            player1Id: entry.player1Id,
            player2Id: entry.player2Id,
            name: player1 && player2 ? `${player1.name} & ${player2.name}` : 'Unknown Players'
          };
        });
      };

      return {
        ...game,
        teamALineup: processLineup(game.teamALineup),
        teamBLineup: processLineup(game.teamBLineup),
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
          // Tiebreaker already exists, just return it
          return NextResponse.json([existingTiebreaker]);
        }
        
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
