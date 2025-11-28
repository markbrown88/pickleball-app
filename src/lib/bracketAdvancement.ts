/**
 * Bracket Advancement Utility
 *
 * Handles advancing winners and losers through double elimination brackets.
 * Extracted from the complete match endpoint to be reusable by forfeit handler.
 */

import { prisma } from '@/lib/prisma';
import type { PrismaClient } from '@prisma/client';

/**
 * Recursively clear a team from all downstream matches
 * Used when a match is marked as incomplete - we need to remove its winner from all child matches
 */
async function clearWinnerFromDownstream(
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  matchId: string,
  winnerId: string
): Promise<void> {
  // Find all matches where this winner was placed
  const childMatches = await tx.match.findMany({
    where: {
      OR: [
        { sourceMatchAId: matchId, teamAId: winnerId },
        { sourceMatchBId: matchId, teamBId: winnerId },
      ],
    },
    select: {
      id: true,
      teamAId: true,
      teamBId: true,
      winnerId: true,
    },
  });

  for (const child of childMatches) {
    const updates: {
      teamAId?: null;
      teamBId?: null;
      winnerId?: null;
    } = {};

    // Clear the winner from the appropriate position
    if (child.teamAId === winnerId) {
      updates.teamAId = null;
    }
    if (child.teamBId === winnerId) {
      updates.teamBId = null;
    }

    // If this child match had a winner, clear it and cascade further
    if (child.winnerId) {
      const oldChildWinnerId = child.winnerId;
      updates.winnerId = null;
      // Recursively cascade to downstream matches
      await clearWinnerFromDownstream(tx, child.id, oldChildWinnerId);
    }

    if (Object.keys(updates).length > 0) {
      await tx.match.update({
        where: { id: child.id },
        data: updates,
      });
    }
  }
}

/**
 * Cascade winner change through the bracket
 * When a match winner changes, replace the old winner with the new winner in child matches
 * and mark those matches as incomplete if they had already been decided
 */
async function cascadeWinnerChange(
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  matchId: string,
  oldWinnerId: string,
  newWinnerId: string
): Promise<void> {
  // Find all matches where the old winner was placed
  const childMatches = await tx.match.findMany({
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
    const updates: {
      teamAId?: string;
      teamBId?: string;
      winnerId?: null;
    } = {};

    // Replace the old winner with the new winner in the appropriate position
    if (child.teamAId === oldWinnerId) {
      updates.teamAId = newWinnerId;
    }
    if (child.teamBId === oldWinnerId) {
      updates.teamBId = newWinnerId;
    }

    // If this child match had a winner, it's now invalid - clear it
    if (child.winnerId) {
      const oldChildWinnerId = child.winnerId;
      updates.winnerId = null;

      // Recursively clear the old winner from downstream matches
      // We don't replace here, we just clear, because this match needs to be replayed
      await clearWinnerFromDownstream(tx, child.id, oldChildWinnerId);
    }

    if (Object.keys(updates).length > 0) {
      await tx.match.update({
        where: { id: child.id },
        data: updates,
      });
    }
  }
}

export interface AdvancementResult {
  winnerId: string;
  loserId: string | null;
  advancedWinnerMatches: number;
  advancedLoserMatches: number;
  bracketResetTriggered: boolean;
}

/**
 * Advance teams in the bracket after a match is completed
 * Handles winner/loser bracket logic, finals bracket reset, and cascading BYE completions
 */
export async function advanceTeamsInBracket(
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  matchId: string,
  winnerId: string,
  loserId: string | null,
  match: {
    id: string;
    winnerId: string | null;
    round: {
      stopId: string;
      bracketType: string | null;
      depth: number | null;
    } | null;
    teamAId: string | null;
    teamBId: string | null;
  }
): Promise<AdvancementResult> {
  // Check if winner has changed (match was reopened)
  const winnerChanged = match.winnerId && match.winnerId !== winnerId;
  const oldWinnerId = match.winnerId;

  // If winner changed, cascade the change forward by replacing old winner with new winner
  if (winnerChanged && oldWinnerId) {
    await cascadeWinnerChange(tx, matchId, oldWinnerId, winnerId);
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
      const finals2Match = await tx.match.findFirst({
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
        await tx.match.update({
          where: { id: finals2Match.id },
          data: {
            teamAId: match.teamAId, // Winner bracket champion (loser of Finals 1)
            teamBId: match.teamBId, // Loser bracket champion (winner of Finals 1)
          },
        });
      } else {
        console.error(`[Bracket Advancement] Finals 2 match not found for bracket reset!`);
      }
    } else {
      // Winner bracket champion won Finals 1 → Tournament over (no Finals 2 needed)
      // Clear Finals 2 teams so it doesn't appear in the bracket
      const finals2Match = await tx.match.findFirst({
        where: {
          round: {
            stopId: match.round.stopId,
            bracketType: 'FINALS',
            depth: 0,
          },
        },
      });

      if (finals2Match) {
        await tx.match.update({
          where: { id: finals2Match.id },
          data: {
            teamAId: null,
            teamBId: null,
          },
        });
      }
    }
  }

  // Find child matches (matches that this match feeds into)
  const childMatchesA = await tx.match.findMany({
    where: { sourceMatchAId: matchId },
    include: {
      round: {
        select: {
          bracketType: true,
        },
      },
    },
  });

  const childMatchesB = await tx.match.findMany({
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

  // Advance winner to winner bracket / finals matches
  // SKIP Finals 2 if bracket reset was triggered (already set up with both teams)
  for (const childMatch of winnerBracketChildMatchesA) {
    if (bracketResetTriggered && childMatch.id === finals2MatchId) {
      continue; // Skip - already handled by bracket reset logic
    }
    await tx.match.update({
      where: { id: childMatch.id },
      data: { teamAId: winnerId },
    });
  }

  for (const childMatch of winnerBracketChildMatchesB) {
    if (bracketResetTriggered && childMatch.id === finals2MatchId) {
      continue; // Skip - already handled by bracket reset logic
    }
    await tx.match.update({
      where: { id: childMatch.id },
      data: { teamBId: winnerId },
    });
  }

  // Advance winner to loser bracket or finals matches (for loser bracket match completions)
  // Loser bracket winners can advance to either the next loser bracket round OR to finals
  if (match.round?.bracketType === 'LOSER') {
    // Advance to loser bracket children
    for (const childMatch of loserBracketChildMatchesA) {
      await tx.match.update({
        where: { id: childMatch.id },
        data: { teamAId: winnerId },
      });
    }

    for (const childMatch of loserBracketChildMatchesB) {
      await tx.match.update({
        where: { id: childMatch.id },
        data: { teamBId: winnerId },
      });
    }

    // Explicitly check if this is the loser bracket final (last loser round)
    // and advance to Finals if no children were found above
    const hasLoserChildren = loserBracketChildMatchesA.length > 0 || loserBracketChildMatchesB.length > 0;

    if (!hasLoserChildren) {
      // This is the loser bracket final - find Finals 1 explicitly
      const finalsMatch = await tx.match.findFirst({
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
        await tx.match.update({
          where: { id: finalsMatch.id },
          data: { teamBId: winnerId },
        });
      }
    }
  }

  // Advance loser to loser bracket matches (only for winner bracket match completions)
  if (match.round?.bracketType === 'WINNER' && loserId) {
    for (const childMatch of loserBracketChildMatchesA) {
      await tx.match.update({
        where: { id: childMatch.id },
        data: { teamAId: loserId },
      });
    }

    for (const childMatch of loserBracketChildMatchesB) {
      await tx.match.update({
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
    const updatedChild = await tx.match.findUnique({
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
    const byeTeamId = updatedChild?.teamAId || updatedChild?.teamBId;
    if (updatedChild?.isBye && byeTeamId && !updatedChild.winnerId) {
      // Set winner (the team that has the BYE, whether in position A or B)
      await tx.match.update({
        where: { id: updatedChild.id },
        data: { winnerId: byeTeamId },
      });

      // Find child matches and advance winner
      const byeChildMatchesA = await tx.match.findMany({
        where: { sourceMatchAId: updatedChild.id },
        include: { round: { select: { bracketType: true } } },
      });

      const byeChildMatchesB = await tx.match.findMany({
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
        await tx.match.update({
          where: { id: child.id },
          data: { teamAId: byeTeamId },
        });
        // Add to queue to check if this child is also a BYE
        matchesToCheck.push(child);
      }

      for (const child of targetChildrenB) {
        await tx.match.update({
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
      const currentMatch = await tx.match.findUnique({
        where: { id: childMatch.id },
        select: { teamAId: true, teamBId: true },
      });

      if (currentMatch?.teamAId === winnerId) {
        await tx.match.update({
          where: { id: childMatch.id },
          data: { teamAId: null },
        });
      }
    }

    for (const childMatch of loserBracketChildMatchesB) {
      const currentMatch = await tx.match.findUnique({
        where: { id: childMatch.id },
        select: { teamAId: true, teamBId: true },
      });

      if (currentMatch?.teamBId === winnerId) {
        await tx.match.update({
          where: { id: childMatch.id },
          data: { teamBId: null },
        });
      }
    }
  }

  return {
    winnerId,
    loserId,
    advancedWinnerMatches: winnerBracketChildMatchesA.length + winnerBracketChildMatchesB.length,
    advancedLoserMatches: loserBracketChildMatchesA.length + loserBracketChildMatchesB.length,
    bracketResetTriggered,
  };
}
