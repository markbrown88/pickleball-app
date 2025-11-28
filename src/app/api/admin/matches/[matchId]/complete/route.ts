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
import { invalidateCache } from '@/lib/cache';
import { cacheKeys } from '@/lib/cache';
import { advanceTeamsInBracket } from '@/lib/bracketAdvancement';

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

    // Handle BYE matches - automatically set winner to teamA
    if (match.isBye) {
      if (!match.teamAId) {
        return NextResponse.json(
          { error: 'BYE match must have teamA' },
          { status: 400 }
        );
      }
      
      const winnerId = match.teamAId;
      
      // Update match with winner
      await prisma.match.update({
        where: { id: matchId },
        data: { winnerId },
      });

      // Find child matches (matches that this match feeds into)
      // Need to check bracket type to ensure winners only go to winner bracket
      const childMatchesA = await prisma.match.findMany({
        where: { sourceMatchAId: matchId },
        include: {
          round: {
            select: {
              bracketType: true,
            },
          },
        },
      });

      const childMatchesB = await prisma.match.findMany({
        where: { sourceMatchBId: matchId },
        include: {
          round: {
            select: {
              bracketType: true,
            },
          },
        },
      });


      // Filter child matches based on the BYE match's bracket type
      // - Winner bracket BYE → advances to winner/finals bracket
      // - Loser bracket BYE → advances to loser bracket
      // - Finals bracket BYE → advances to finals bracket
      let targetChildMatchesA: typeof childMatchesA = [];
      let targetChildMatchesB: typeof childMatchesB = [];

      if (match.round?.bracketType === 'LOSER') {
        // Loser bracket BYE should advance to loser bracket
        targetChildMatchesA = childMatchesA.filter(m => m.round?.bracketType === 'LOSER');
        targetChildMatchesB = childMatchesB.filter(m => m.round?.bracketType === 'LOSER');
      } else {
        // Winner/Finals bracket BYE should advance to winner/finals bracket
        targetChildMatchesA = childMatchesA.filter(m => m.round?.bracketType === 'WINNER' || m.round?.bracketType === 'FINALS');
        targetChildMatchesB = childMatchesB.filter(m => m.round?.bracketType === 'WINNER' || m.round?.bracketType === 'FINALS');
      }


      // Advance winner to appropriate bracket child matches
      for (const childMatch of targetChildMatchesA) {
        await prisma.match.update({
          where: { id: childMatch.id },
          data: { teamAId: winnerId },
        });
      }

      for (const childMatch of targetChildMatchesB) {
        await prisma.match.update({
          where: { id: childMatch.id },
          data: { teamBId: winnerId },
        });
      }

      // Invalidate schedule cache for this stop so bracket updates immediately
      if (match.round?.stopId) {
        await invalidateCache(`${cacheKeys.stopSchedule(match.round.stopId)}*`);
      }

      return NextResponse.json({
        success: true,
        message: 'BYE match completed successfully',
        winnerId,
        advancedMatches: targetChildMatchesA.length + targetChildMatchesB.length,
      });
    }

    // Verify match has games
    if (match.games.length === 0) {
      return NextResponse.json(
        { error: 'Match has no games - cannot determine winner' },
        { status: 400 }
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

    // Check for tiebreaker winner first (takes precedence over game wins)
    let winnerId: string | null = null;
    let loserId: string | null = null;

    if (match.tiebreakerWinnerTeamId) {
      // Match was decided by tiebreaker (total points or tiebreaker game)
      winnerId = match.tiebreakerWinnerTeamId;
      loserId = winnerId === match.teamAId ? match.teamBId : match.teamAId;
    } else {
      // Calculate winner based on game wins
      let teamAWins = 0;
      let teamBWins = 0;

      for (const game of match.games) {
        if (!game.isComplete) continue;

        // For completed games, treat null scores as 0
        // This handles cases where a game was marked complete but scores weren't fully saved
        const teamAScore = game.teamAScore ?? 0;
        const teamBScore = game.teamBScore ?? 0;

        // If both scores are null/0, skip (shouldn't happen for completed games, but handle gracefully)
        if (game.teamAScore === null && game.teamBScore === null) continue;

        if (teamAScore > teamBScore) {
          teamAWins++;
        } else if (teamBScore > teamAScore) {
          teamBWins++;
        }
        // Ties are not counted (shouldn't happen in pickleball, but handle gracefully)
      }

      if (teamAWins === teamBWins) {
        return NextResponse.json(
          { error: 'Match is tied - cannot determine winner. Please set a tiebreaker winner.' },
          { status: 400 }
        );
      }

      winnerId = teamAWins > teamBWins ? match.teamAId : match.teamBId;
      loserId = teamAWins > teamBWins ? match.teamBId : match.teamAId;
    }


    if (!winnerId) {
      return NextResponse.json(
        { error: 'Could not determine winner' },
        { status: 400 }
      );
    }

    // Use a transaction to atomically update match and advance teams in bracket
    const result = await prisma.$transaction(async (tx) => {
      // Get match with round info for bracket advancement
      const matchWithRound = await tx.match.findUnique({
        where: { id: matchId },
        select: {
          id: true,
          winnerId: true,
          teamAId: true,
          teamBId: true,
          round: {
            select: {
              stopId: true,
              bracketType: true,
              depth: true,
            },
          },
        },
      });

      if (!matchWithRound) {
        throw new Error('Match not found');
      }

      // Update match with winner
      await tx.match.update({
        where: { id: matchId },
        data: { winnerId },
      });

      // Advance teams in bracket using shared utility
      const advancementResult = await advanceTeamsInBracket(
        tx,
        matchId,
        winnerId,
        loserId || null,
        matchWithRound
      );

      console.log('[COMPLETE_MATCH] Bracket advancement completed:', {
        winnerId: advancementResult.winnerId,
        loserId: advancementResult.loserId,
        advancedWinnerMatches: advancementResult.advancedWinnerMatches,
        advancedLoserMatches: advancementResult.advancedLoserMatches,
      });

      return { advancementResult };
    });

    // Invalidate schedule cache for this stop so bracket updates immediately
    if (match.round?.stopId) {
      await invalidateCache(`${cacheKeys.stopSchedule(match.round.stopId)}*`);
    }

      return NextResponse.json({
        success: true,
        message: 'Match completed successfully',
        winnerId,
        loserId,
        advancedMatches: result.advancementResult.advancedWinnerMatches,
        advancedLoserMatches: result.advancementResult.advancedLoserMatches,
        bracketResetTriggered: result.advancementResult.bracketResetTriggered,
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
