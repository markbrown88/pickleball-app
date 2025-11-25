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

/**
 * Cascade winner change through the bracket
 * When a match winner changes, remove the old winner from child matches
 * and recursively clear downstream matches that depended on the old result
 */
async function cascadeWinnerChange(matchId: string, oldWinnerId: string): Promise<void> {
  // Find all matches where this team was placed as a result of the old win
  const childMatches = await prisma.match.findMany({
    where: {
      OR: [
        { sourceMatchAId: matchId, teamAId: oldWinnerId },
        { sourceMatchBId: matchId, teamBId: oldWinnerId },
      ],
    },
    select: {
      id: true,
      teamAId: true,
      teamBId: true,
      winnerId: true,
      sourceMatchAId: true,
      sourceMatchBId: true,
    },
  });

  for (const child of childMatches) {
    const updates: { teamAId?: null; teamBId?: null; winnerId?: null } = {};

    // Clear the old winner from the appropriate position
    if (child.teamAId === oldWinnerId) {
      updates.teamAId = null;
    }
    if (child.teamBId === oldWinnerId) {
      updates.teamBId = null;
    }

    // If this child match had a winner, clear it and cascade further
    if (child.winnerId) {
      updates.winnerId = null;
      // Recursively cascade to downstream matches
      await cascadeWinnerChange(child.id, child.winnerId);
    }

    if (Object.keys(updates).length > 0) {
      await prisma.match.update({
        where: { id: child.id },
        data: updates,
      });
    }
  }
}

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

    // Check if winner has changed (match was reopened)
    const winnerChanged = match.winnerId && match.winnerId !== winnerId;
    const oldWinnerId = match.winnerId;

    // Update match with winner
    await prisma.match.update({
      where: { id: matchId },
      data: { winnerId },
    });

    // If winner changed, cascade the change forward by clearing old winner from child matches
    if (winnerChanged && oldWinnerId) {
      await cascadeWinnerChange(matchId, oldWinnerId);
    }

    // BRACKET RESET LOGIC: Check if this is Finals 1 in double elimination
    let bracketResetTriggered = false;
    let finals2MatchId: string | null = null;

    if (match.round?.bracketType === 'FINALS' && match.round?.depth === 1) {

      // Determine if winner is from winner bracket or loser bracket
      // The winner bracket champion is teamA (sourceMatchAId), loser bracket is teamB (sourceMatchBId)
      const isLoserBracketChampionWinner = winnerId === match.teamBId;

      if (isLoserBracketChampionWinner) {
        // Loser bracket champion won Finals 1 → Trigger bracket reset (Finals 2)

        // Find Finals 2 match (depth === 0, same stopId)
        const finals2Match = await prisma.match.findFirst({
          where: {
            round: {
              stopId: match.round.stopId,
              bracketType: 'FINALS',
              depth: 0,
            },
          },
          include: {
            round: true,
          },
        });

        if (finals2Match) {
          finals2MatchId = finals2Match.id;
          bracketResetTriggered = true;

          // Both teams from Finals 1 play again in Finals 2
          // Winner bracket champion gets another chance (they've only lost once now)
          await prisma.match.update({
            where: { id: finals2Match.id },
            data: {
              teamAId: match.teamAId, // Winner bracket champion (loser of Finals 1)
              teamBId: match.teamBId, // Loser bracket champion (winner of Finals 1)
            },
          });
        } else {
          console.error(`[Complete Match] Finals 2 match not found for bracket reset!`);
        }
      } else {
        // Winner bracket champion won Finals 1 → Tournament over (no Finals 2)
      }
    }

    // Find child matches (matches that this match feeds into)
    // Need to check bracket type to ensure winners only go to winner bracket, losers only to loser bracket
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


    // Separate child matches by bracket type
    const winnerBracketChildMatchesA = childMatchesA.filter(m => m.round?.bracketType === 'WINNER' || m.round?.bracketType === 'FINALS');
    const winnerBracketChildMatchesB = childMatchesB.filter(m => m.round?.bracketType === 'WINNER' || m.round?.bracketType === 'FINALS');
    const loserBracketChildMatchesA = childMatchesA.filter(m => m.round?.bracketType === 'LOSER');
    const loserBracketChildMatchesB = childMatchesB.filter(m => m.round?.bracketType === 'LOSER');


    // Advance winner to appropriate bracket matches
    // - Winner bracket matches → winner advances to winner bracket
    // - Loser bracket matches → winner advances to loser bracket
    // - Finals matches → winner advances to winner bracket or finals

    // Advance winner to winner bracket / finals matches
    // SKIP Finals 2 if bracket reset was triggered (already set up with both teams)
    for (const childMatch of winnerBracketChildMatchesA) {
      if (bracketResetTriggered && childMatch.id === finals2MatchId) {
        continue; // Skip - already handled by bracket reset logic
      }
      await prisma.match.update({
        where: { id: childMatch.id },
        data: { teamAId: winnerId },
      });
    }

    for (const childMatch of winnerBracketChildMatchesB) {
      if (bracketResetTriggered && childMatch.id === finals2MatchId) {
        continue; // Skip - already handled by bracket reset logic
      }
      await prisma.match.update({
        where: { id: childMatch.id },
        data: { teamBId: winnerId },
      });
    }

    // Advance winner to loser bracket or finals matches (for loser bracket match completions)
    // Loser bracket winners can advance to either the next loser bracket round OR to finals
    if (match.round?.bracketType === 'LOSER') {
      // Advance to loser bracket children
      for (const childMatch of loserBracketChildMatchesA) {
        await prisma.match.update({
          where: { id: childMatch.id },
          data: { teamAId: winnerId },
        });
      }

      for (const childMatch of loserBracketChildMatchesB) {
        await prisma.match.update({
          where: { id: childMatch.id },
          data: { teamBId: winnerId },
        });
      }

      // Explicitly check if this is the loser bracket final (last loser round)
      // and advance to Finals if no children were found above
      const hasLoserChildren = loserBracketChildMatchesA.length > 0 || loserBracketChildMatchesB.length > 0;

      if (!hasLoserChildren) {
        // This is the loser bracket final - find Finals 1 explicitly
        const finalsMatch = await prisma.match.findFirst({
          where: {
            round: {
              stopId: match.round.stopId,
              bracketType: 'FINALS',
              depth: 1, // Finals 1
            },
          },
        });

        if (finalsMatch) {
          // Loser bracket champion goes to position B of Finals 1
          await prisma.match.update({
            where: { id: finalsMatch.id },
            data: { teamBId: winnerId },
          });
        }
      }
    }

    // Advance loser to loser bracket matches (only for winner bracket match completions)
    if (match.round?.bracketType === 'WINNER' && loserId) {
      for (const childMatch of loserBracketChildMatchesA) {
        await prisma.match.update({
          where: { id: childMatch.id },
          data: { teamAId: loserId },
        });
      }

      for (const childMatch of loserBracketChildMatchesB) {
        await prisma.match.update({
          where: { id: childMatch.id },
          data: { teamBId: loserId },
        });
      }
    }

    // AUTO-COMPLETE BYE MATCHES: If we just placed a team into a BYE match, auto-complete it
    // Use a queue-based approach to handle cascading BYE completions
    const allChildMatches = [...winnerBracketChildMatchesA, ...winnerBracketChildMatchesB, ...loserBracketChildMatchesA, ...loserBracketChildMatchesB];
    const matchesToCheck = [...allChildMatches];
    let processedMatches = new Set<string>();

    while (matchesToCheck.length > 0) {
      const childMatch = matchesToCheck.shift();
      if (!childMatch || processedMatches.has(childMatch.id)) continue;
      processedMatches.add(childMatch.id);

      // Check if this child match is a BYE and now has a team
      const updatedChild = await prisma.match.findUnique({
        where: { id: childMatch.id },
        select: {
          id: true,
          isBye: true,
          teamAId: true,
          teamBId: true,
          winnerId: true,
          round: { select: { bracketType: true } },
        },
      });

      // Only auto-complete if it's explicitly marked as a BYE match, has a team in either position, and no winner yet
      // DO NOT auto-complete matches that just happen to have one team - they're waiting for their other source
      const byeTeamId = updatedChild?.teamAId || updatedChild?.teamBId;
      if (updatedChild?.isBye && byeTeamId && !updatedChild.winnerId) {

        // Set winner (the team that has the BYE, whether in position A or B)
        await prisma.match.update({
          where: { id: updatedChild.id },
          data: { winnerId: byeTeamId },
        });

        // Find child matches and advance winner
        const byeChildMatchesA = await prisma.match.findMany({
          where: { sourceMatchAId: updatedChild.id },
          include: { round: { select: { bracketType: true } } },
        });

        const byeChildMatchesB = await prisma.match.findMany({
          where: { sourceMatchBId: updatedChild.id },
          include: { round: { select: { bracketType: true } } },
        });

        // Filter by bracket type
        let targetChildrenA = byeChildMatchesA;
        let targetChildrenB = byeChildMatchesB;

        if (updatedChild.round?.bracketType === 'LOSER') {
          // Loser bracket BYE advances to loser bracket or finals
          targetChildrenA = byeChildMatchesA.filter(m => m.round?.bracketType === 'LOSER' || m.round?.bracketType === 'FINALS');
          targetChildrenB = byeChildMatchesB.filter(m => m.round?.bracketType === 'LOSER' || m.round?.bracketType === 'FINALS');
        } else {
          // Winner bracket BYE advances to winner/finals bracket
          targetChildrenA = byeChildMatchesA.filter(m => m.round?.bracketType === 'WINNER' || m.round?.bracketType === 'FINALS');
          targetChildrenB = byeChildMatchesB.filter(m => m.round?.bracketType === 'WINNER' || m.round?.bracketType === 'FINALS');
        }

        // Advance winner to child matches
        for (const child of targetChildrenA) {
          await prisma.match.update({
            where: { id: child.id },
            data: { teamAId: byeTeamId },
          });
          // Add to queue to check if this child is also a BYE
          matchesToCheck.push(child);
        }

        for (const child of targetChildrenB) {
          await prisma.match.update({
            where: { id: child.id },
            data: { teamBId: byeTeamId },
          });
          // Add to queue to check if this child is also a BYE
          matchesToCheck.push(child);
        }

      }
    }

    // CRITICAL: Remove winner from any loser bracket matches they may have been incorrectly placed in
    // This can happen if matches were completed before this fix was implemented
    if (match.round?.bracketType === 'WINNER') {
      for (const childMatch of loserBracketChildMatchesA) {
        // If winner is incorrectly in this loser bracket match, remove them
        const currentMatch = await prisma.match.findUnique({
          where: { id: childMatch.id },
          select: { teamAId: true, teamBId: true },
        });
        
        if (currentMatch?.teamAId === winnerId) {
          await prisma.match.update({
            where: { id: childMatch.id },
            data: { teamAId: null },
          });
        }
      }

      for (const childMatch of loserBracketChildMatchesB) {
        const currentMatch = await prisma.match.findUnique({
          where: { id: childMatch.id },
          select: { teamAId: true, teamBId: true },
        });
        
        if (currentMatch?.teamBId === winnerId) {
          await prisma.match.update({
            where: { id: childMatch.id },
            data: { teamBId: null },
          });
        }
      }
    }

    // Invalidate schedule cache for this stop so bracket updates immediately
    if (match.round?.stopId) {
      await invalidateCache(`${cacheKeys.stopSchedule(match.round.stopId)}*`);
    }

    // For double elimination: Handle loser bracket drop
    // TODO: Implement loser bracket advancement logic
    // This requires knowing which matches in the loser bracket this match feeds into

      return NextResponse.json({
        success: true,
        message: 'Match completed successfully',
        winnerId,
        loserId,
        advancedMatches: winnerBracketChildMatchesA.length + winnerBracketChildMatchesB.length,
        advancedLoserMatches: loserBracketChildMatchesA.length + loserBracketChildMatchesB.length,
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
