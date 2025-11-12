/**
 * Fix Bracket API
 * 
 * POST /api/admin/stops/[stopId]/fix-bracket
 * 
 * Removes winners from loser bracket matches where they shouldn't be.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { invalidateCache } from '@/lib/cache';
import { cacheKeys } from '@/lib/cache';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ stopId: string }> }
) {
  try {
    const { stopId } = await params;

    console.log(`[Fix Bracket] Starting cleanup for stop: ${stopId}`);

    // Get all rounds for this stop
    const rounds = await prisma.round.findMany({
      where: { stopId },
      include: {
        matches: {
          include: {
            teamA: { select: { id: true, name: true } },
            teamB: { select: { id: true, name: true } },
            round: { select: { id: true, bracketType: true } },
          },
        },
      },
    });

    console.log(`[Fix Bracket] Found ${rounds.length} rounds`);

    const fixes: Array<{ matchId: string; teamId: string; teamName: string; removedFrom: 'A' | 'B' }> = [];

    // Find all loser bracket matches
    const loserRounds = rounds.filter(r => r.bracketType === 'LOSER');
    console.log(`[Fix Bracket] Found ${loserRounds.length} loser rounds`);

    for (const loserRound of loserRounds) {
      for (const loserMatch of loserRound.matches) {
        // Check if this loser match has source links to winner bracket matches
        if (loserMatch.sourceMatchAId || loserMatch.sourceMatchBId) {
          // Find the source matches
          const allMatches = rounds.flatMap(r => r.matches);
          const sourceMatchA = loserMatch.sourceMatchAId 
            ? allMatches.find(m => m.id === loserMatch.sourceMatchAId)
            : null;
          const sourceMatchB = loserMatch.sourceMatchBId
            ? allMatches.find(m => m.id === loserMatch.sourceMatchBId)
            : null;

          // Check sourceMatchA - if it's a winner bracket match with a winner
          if (sourceMatchA && sourceMatchA.round?.bracketType === 'WINNER' && sourceMatchA.winnerId) {
            // If the winner is incorrectly in this loser bracket match as teamA
            if (loserMatch.teamAId === sourceMatchA.winnerId) {
              const winnerName = sourceMatchA.teamAId === sourceMatchA.winnerId 
                ? sourceMatchA.teamA?.name 
                : sourceMatchA.teamB?.name;
              
              console.log(`[Fix Bracket] Removing winner "${winnerName}" (${sourceMatchA.winnerId}) from loser bracket match ${loserMatch.id} as Team A`);
              
              await prisma.match.update({
                where: { id: loserMatch.id },
                data: { teamAId: null },
              });

              fixes.push({
                matchId: loserMatch.id,
                teamId: sourceMatchA.winnerId,
                teamName: winnerName || 'Unknown',
                removedFrom: 'A',
              });
            }
          }

          // Check sourceMatchB - if it's a winner bracket match with a winner
          if (sourceMatchB && sourceMatchB.round?.bracketType === 'WINNER' && sourceMatchB.winnerId) {
            // If the winner is incorrectly in this loser bracket match as teamB
            if (loserMatch.teamBId === sourceMatchB.winnerId) {
              const winnerName = sourceMatchB.teamAId === sourceMatchB.winnerId 
                ? sourceMatchB.teamA?.name 
                : sourceMatchB.teamB?.name;
              
              console.log(`[Fix Bracket] Removing winner "${winnerName}" (${sourceMatchB.winnerId}) from loser bracket match ${loserMatch.id} as Team B`);
              
              await prisma.match.update({
                where: { id: loserMatch.id },
                data: { teamBId: null },
              });

              fixes.push({
                matchId: loserMatch.id,
                teamId: sourceMatchB.winnerId,
                teamName: winnerName || 'Unknown',
                removedFrom: 'B',
              });
            }
          }
        }
      }
    }

    // Invalidate cache
    await invalidateCache(`${cacheKeys.stopSchedule(stopId)}*`);

    console.log(`[Fix Bracket] Fixed ${fixes.length} incorrect placements`);

    return NextResponse.json({
      success: true,
      fixes: fixes.length,
      details: fixes,
    });
  } catch (error) {
    console.error('[Fix Bracket] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fix bracket',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

