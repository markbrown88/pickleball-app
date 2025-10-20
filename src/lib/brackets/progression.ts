/**
 * Bracket Progression
 *
 * Handles advancing winners and losers through the bracket structure.
 * Determines which match a team moves to after winning/losing.
 */

/**
 * When a match is completed, determine where the winner advances
 *
 * @param matchId - The completed match ID
 * @param winnerTeamId - The winning team ID
 * @param bracketType - Current bracket type
 * @param roundDepth - Current round depth
 * @returns Next match ID and position (A or B)
 */
export interface ProgressionResult {
  nextMatchId: string | null;
  position: 'A' | 'B';
  moveToLoserBracket?: boolean;
  loserMatchId?: string | null;
  loserPosition?: 'A' | 'B';
}

/**
 * Calculate where a winner advances in the bracket
 */
export function calculateWinnerProgression(
  currentMatch: {
    id: string;
    bracketType: string;
    depth: number;
    bracketPosition: number;
  },
  childMatches: Array<{
    id: string;
    sourceMatchAId: string | null;
    sourceMatchBId: string | null;
  }>
): ProgressionResult | null {
  // Find which child match this match feeds into
  const nextMatch = childMatches.find(
    (m) => m.sourceMatchAId === currentMatch.id || m.sourceMatchBId === currentMatch.id
  );

  if (!nextMatch) {
    // This is the finals or end of bracket
    return null;
  }

  const position = nextMatch.sourceMatchAId === currentMatch.id ? 'A' : 'B';

  return {
    nextMatchId: nextMatch.id,
    position,
  };
}

/**
 * Calculate where a loser goes in the bracket
 * (For winner bracket matches - losers drop to loser bracket)
 */
export function calculateLoserProgression(
  currentMatch: {
    id: string;
    bracketType: string;
    depth: number;
    bracketPosition: number;
    roundIdx: number;
  },
  loserBracketMatches: Array<{
    id: string;
    roundIdx: number;
    bracketPosition: number;
    sourceMatchAId: string | null;
    sourceMatchBId: string | null;
  }>
): { loserMatchId: string; position: 'A' | 'B' } | null {
  if (currentMatch.bracketType !== 'WINNER') {
    // Losers in loser bracket are eliminated
    return null;
  }

  // Calculate which loser bracket round to drop into
  // Standard double elim: losers from winner round N go to loser round 2N or 2N-1
  const loserRoundIdx = currentMatch.roundIdx === 0 ? 0 : currentMatch.roundIdx * 2 - 1;

  // Find matching loser bracket match
  const loserMatch = loserBracketMatches.find(
    (m) => m.roundIdx === loserRoundIdx && m.sourceMatchAId === currentMatch.id ||
           m.sourceMatchBId === currentMatch.id
  );

  if (!loserMatch) {
    return null;
  }

  const position = loserMatch.sourceMatchAId === currentMatch.id ? 'A' : 'B';

  return {
    loserMatchId: loserMatch.id,
    position,
  };
}

/**
 * Advance winner to next match
 * Updates the database with the winning team in the next match
 */
export async function advanceWinner(
  completedMatchId: string,
  winnerTeamId: string,
  loserTeamId: string | null,
  prisma: any // PrismaClient
): Promise<{
  success: boolean;
  nextMatch?: any;
  loserMatch?: any;
}> {
  // Get the completed match with its relationships
  const completedMatch = await prisma.match.findUnique({
    where: { id: completedMatchId },
    include: {
      round: true,
      childMatchesFromA: true,
      childMatchesFromB: true,
    },
  });

  if (!completedMatch) {
    throw new Error('Match not found');
  }

  // Find next match (where winner advances)
  const nextMatches = [
    ...completedMatch.childMatchesFromA,
    ...completedMatch.childMatchesFromB,
  ];

  if (nextMatches.length === 0) {
    // This is the final match
    return { success: true };
  }

  const nextMatch = nextMatches[0];

  // Determine position (A or B)
  const position = nextMatch.sourceMatchAId === completedMatchId ? 'teamAId' : 'teamBId';

  // Update next match with winner
  const updatedNextMatch = await prisma.match.update({
    where: { id: nextMatch.id },
    data: {
      [position]: winnerTeamId,
    },
  });

  // Handle loser bracket progression if this is a winner bracket match
  let loserMatch = null;
  if (completedMatch.round.bracketType === 'WINNER' && loserTeamId) {
    // Find loser bracket match
    // This requires more complex logic based on bracket structure
    // For now, we'll return null and implement this later
  }

  return {
    success: true,
    nextMatch: updatedNextMatch,
    loserMatch,
  };
}
