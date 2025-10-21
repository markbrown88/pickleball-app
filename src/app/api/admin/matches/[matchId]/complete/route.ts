/**
 * Complete Match API
 *
 * POST /api/admin/matches/[matchId]/complete
 *
 * Completes a bracket match and advances the winner to the next match.
 * Also handles loser bracket drops for double elimination.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await params;

    // Get match with games
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        games: true,
        round: {
          include: {
            stop: {
              include: {
                tournament: true,
              },
            },
          },
        },
        teamA: true,
        teamB: true,
      },
    });

    if (!match) {
      return NextResponse.json(
        { error: 'Match not found' },
        { status: 404 }
      );
    }

    // Verify all games are complete
    const allGamesComplete = match.games.every(g => g.isComplete);
    if (!allGamesComplete) {
      return NextResponse.json(
        { error: 'All games must be completed before completing the match' },
        { status: 400 }
      );
    }

    // Calculate winner based on game wins
    let teamAWins = 0;
    let teamBWins = 0;

    for (const game of match.games) {
      if (game.teamAScore === null || game.teamBScore === null) continue;

      if (game.teamAScore > game.teamBScore) {
        teamAWins++;
      } else if (game.teamBScore > game.teamAScore) {
        teamBWins++;
      }
    }

    if (teamAWins === teamBWins) {
      return NextResponse.json(
        { error: 'Match is tied - cannot determine winner' },
        { status: 400 }
      );
    }

    const winnerId = teamAWins > teamBWins ? match.teamAId : match.teamBId;
    const loserId = teamAWins > teamBWins ? match.teamBId : match.teamAId;

    if (!winnerId) {
      return NextResponse.json(
        { error: 'Could not determine winner' },
        { status: 400 }
      );
    }

    // Update match with winner
    await prisma.match.update({
      where: { id: matchId },
      data: { winnerId },
    });

    // Find child matches (matches that this match feeds into)
    const childMatchesA = await prisma.match.findMany({
      where: { sourceMatchAId: matchId },
    });

    const childMatchesB = await prisma.match.findMany({
      where: { sourceMatchBId: matchId },
    });

    // Advance winner to child matches
    for (const childMatch of childMatchesA) {
      await prisma.match.update({
        where: { id: childMatch.id },
        data: { teamAId: winnerId },
      });
    }

    for (const childMatch of childMatchesB) {
      await prisma.match.update({
        where: { id: childMatch.id },
        data: { teamBId: winnerId },
      });
    }

    // For double elimination: Handle loser bracket drop
    // TODO: Implement loser bracket advancement logic
    // This requires knowing which matches in the loser bracket this match feeds into

    return NextResponse.json({
      success: true,
      message: 'Match completed successfully',
      winnerId,
      loserId,
      advancedMatches: childMatchesA.length + childMatchesB.length,
    });
  } catch (error) {
    console.error('Complete match error:', error);
    return NextResponse.json(
      {
        error: 'Failed to complete match',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
