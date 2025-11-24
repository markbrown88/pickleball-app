/**
 * Double Elimination Bracket Generator
 *
 * Generates complete double elimination bracket structure with:
 * - Winner bracket
 * - Loser bracket
 * - Finals
 * - Automatic bye handling
 * - Match progression links
 */

import {
  BracketGenerationOptions,
  BracketRound,
  BracketMatch,
  GeneratedBracket,
  Team,
} from './types';
import {
  getNextPowerOfTwo,
  createFirstRoundMatchups,
  getBracketInfo,
} from './seeding';

/**
 * Generate a complete double elimination bracket
 */
export function generateDoubleEliminationBracket(
  options: BracketGenerationOptions
): GeneratedBracket {
  const { stopId, teams } = options;

  const info = getBracketInfo(teams.length);
  const winnerRounds = createWinnerBracket(stopId, teams, info.roundCount);
  const loserRounds = createLoserBracket(stopId, info.roundCount, winnerRounds);
  const finalsRounds = createFinalsRounds(stopId);

  // Link matches for bracket progression
  linkBracketProgression(winnerRounds, loserRounds, finalsRounds);

  const allRounds = [...winnerRounds, ...loserRounds, ...finalsRounds];
  const totalMatches = allRounds.reduce((sum, r) => sum + r.matches.length, 0);

  return {
    rounds: allRounds,
    totalMatches,
    totalRounds: allRounds.length,
  };
}

/**
 * Create winner bracket rounds
 */
function createWinnerBracket(
  stopId: string,
  teams: Team[],
  roundCount: number
): BracketRound[] {
  const rounds: BracketRound[] = [];

  // Round 0: First round with all teams
  const firstRoundMatchups = createFirstRoundMatchups(teams);

  rounds.push({
    stopId,
    idx: 0,
    bracketType: 'WINNER',
    depth: roundCount - 1,
    matches: firstRoundMatchups.map((matchup, idx) => ({
      teamAId: matchup.teamA?.id || null,
      teamBId: matchup.teamB?.id || null,
      seedA: matchup.seedA,
      seedB: matchup.seedB || undefined,
      bracketPosition: idx,
      isBye: matchup.isBye,
      sourceMatchAId: null,
      sourceMatchBId: null,
    })),
  });

  // Subsequent rounds: winners advance
  for (let roundIdx = 1; roundIdx < roundCount; roundIdx++) {
    const prevRound = rounds[roundIdx - 1];
    const matchCount = Math.floor(prevRound.matches.length / 2);

    const matches: BracketMatch[] = [];
    for (let matchIdx = 0; matchIdx < matchCount; matchIdx++) {
      const sourceAIdx = matchIdx * 2;
      const sourceBIdx = matchIdx * 2 + 1;

      matches.push({
        teamAId: null, // Will be filled when previous match completes
        teamBId: null,
        bracketPosition: matchIdx,
        isBye: false,
        sourceMatchAId: null, // Will be set when linking
        sourceMatchBId: null, // Will be set when linking
      });
    }

    rounds.push({
      stopId,
      idx: roundIdx,
      bracketType: 'WINNER',
      depth: roundCount - 1 - roundIdx,
      matches,
    });
  }

  return rounds;
}

/**
 * Create loser bracket rounds
 *
 * Loser bracket structure for standard double elimination:
 * - Number of loser rounds = 2 * winnerRoundCount - 1
 * - First round may have multiple matches (handles all first-round losers)
 * - Subsequent rounds alternate between receiving drops and pure elimination
 * - Each round eliminates teams until we have the loser bracket champion
 * - BYE matches may be needed in L0 if losers from W0 < 2×matches
 */
function createLoserBracket(
  stopId: string,
  winnerRoundCount: number,
  winnerRounds: BracketRound[]
): BracketRound[] {
  const rounds: BracketRound[] = [];

  // Standard double elimination formula
  const loserRoundCount = 2 * (winnerRoundCount - 1);

  const firstWinnerRound = winnerRounds[0];
  const nonByeMatches = firstWinnerRound.matches.filter(m => !m.isBye);

  // Base loser round size equals half of first winner round match count (rounded up to handle odd drops)
  let currentMatchCount = Math.max(
    1,
    Math.ceil(nonByeMatches.length / 2) || Math.floor(Math.pow(2, winnerRoundCount - 2))
  );

  for (let roundIdx = 0; roundIdx < loserRoundCount; roundIdx++) {
    const matches: BracketMatch[] = [];
    const isFirstLoserRound = roundIdx === 0;

    // Track how many losers feed into each L0 slot so we can flag under-filled matches as BYEs.
    const loserSourcesPerMatch: number[] = [];
    if (isFirstLoserRound) {
      for (let i = 0; i < currentMatchCount; i++) {
        loserSourcesPerMatch[i] = 0;
      }

      firstWinnerRound.matches.forEach((match, matchIdx) => {
        if (match.isBye) return;
        const targetIdx = Math.floor(matchIdx / 2);
        if (targetIdx < loserSourcesPerMatch.length) {
          loserSourcesPerMatch[targetIdx] += 1;
        }
      });
    }

    for (let matchIdx = 0; matchIdx < currentMatchCount; matchIdx++) {
      const isByeMatch =
        isFirstLoserRound && (loserSourcesPerMatch[matchIdx] ?? 0) < 2;

      matches.push({
        teamAId: null,
        teamBId: null,
        bracketPosition: matchIdx,
        isBye: isByeMatch,
        sourceMatchAId: null,
        sourceMatchBId: null,
      });
    }

    rounds.push({
      stopId,
      idx: winnerRoundCount + roundIdx,
      bracketType: 'LOSER',
      depth: loserRoundCount - roundIdx - 1,
      matches,
    });

    // Match count alternates: stays same, then halves (for most rounds)
    // Except we always have at least 1 match
    if (roundIdx % 2 === 1) {
      currentMatchCount = Math.max(1, Math.floor(currentMatchCount / 2));
    }
  }

  return rounds;
}

/**
 * Create finals rounds (true double elimination with bracket reset)
 * Returns 2 rounds:
 * - Finals 1 (depth 1): Winner bracket winner vs Loser bracket winner
 * - Finals 2 (depth 0): Bracket reset match, only played if LB champion wins Finals 1
 */
function createFinalsRounds(stopId: string): BracketRound[] {
  return [
    {
      stopId,
      idx: 9999, // Will be updated when we know total round count
      bracketType: 'FINALS',
      depth: 1, // Finals Match 1
      matches: [
        {
          teamAId: null, // Winner bracket winner
          teamBId: null, // Loser bracket winner
          bracketPosition: 0,
          isBye: false,
          sourceMatchAId: null,
          sourceMatchBId: null,
        },
      ],
    },
    {
      stopId,
      idx: 10000, // Will be updated when we know total round count
      bracketType: 'FINALS',
      depth: 0, // Finals Match 2 (bracket reset)
      matches: [
        {
          teamAId: null, // Will be determined by Finals 1 completion logic
          teamBId: null, // Will be determined by Finals 1 completion logic
          bracketPosition: 0,
          isBye: false,
          sourceMatchAId: null, // Will link to Finals 1
          sourceMatchBId: null, // No second source - both teams come from Finals 1
        },
      ],
    },
  ];
}

/**
 * Link matches for bracket progression
 * Sets sourceMatchAId and sourceMatchBId to connect the bracket tree
 *
 * Uses position-based assignment (standard double elimination practice):
 * - Winners advance based on bracket position (match index)
 * - Losers drop to loser bracket based on match index (not seed)
 * - This creates a fixed, predictable bracket structure
 */
function linkBracketProgression(
  winnerRounds: BracketRound[],
  loserRounds: BracketRound[],
  finalsRounds: BracketRound[]
): void {
  // We need to create a flat list of matches with temporary IDs for linking
  // In the actual implementation, these will be replaced with database IDs

  let matchIdCounter = 0;
  const getMatchId = () => `temp-match-${matchIdCounter++}`;

  // Assign temporary IDs to all matches
  for (const round of winnerRounds) {
    for (const match of round.matches) {
      match.id = getMatchId();
    }
  }
  for (const round of loserRounds) {
    for (const match of round.matches) {
      match.id = getMatchId();
    }
  }
  for (const round of finalsRounds) {
    for (const match of round.matches) {
      match.id = getMatchId();
    }
  }

  // 1. Link winner bracket progression
  linkWinnerBracket(winnerRounds);

  // 2. Link loser bracket internal progression
  linkLoserBracket(loserRounds);

  // 3. Link winners dropping to losers (position-based)
  linkWinnerToLoser(winnerRounds, loserRounds);

  // 4. Link finals
  linkFinals(winnerRounds, loserRounds, finalsRounds);
}

/**
 * Link winner bracket matches - winners advance to next round
 */
function linkWinnerBracket(winnerRounds: BracketRound[]): void {
  for (let roundIdx = 0; roundIdx < winnerRounds.length - 1; roundIdx++) {
    const currentRound = winnerRounds[roundIdx];
    const nextRound = winnerRounds[roundIdx + 1];

    for (let matchIdx = 0; matchIdx < currentRound.matches.length; matchIdx++) {
      const currentMatch = currentRound.matches[matchIdx];
      const nextMatchIdx = Math.floor(matchIdx / 2);
      const nextMatch = nextRound.matches[nextMatchIdx];

      // Determine if this match feeds into position A or B of next match
      const isPositionA = matchIdx % 2 === 0;

      if (isPositionA) {
        nextMatch.sourceMatchAId = currentMatch.id!;
      } else {
        nextMatch.sourceMatchBId = currentMatch.id!;
      }
    }
  }
}

/**
 * Link loser bracket internal progression
 * Loser bracket has alternating structure:
 * - Odd rounds: receive new drops from winner bracket + previous loser round winners
 * - Even rounds: only previous loser round winners advance
 */
function linkLoserBracket(loserRounds: BracketRound[]): void {
  for (let roundIdx = 0; roundIdx < loserRounds.length - 1; roundIdx++) {
    const currentRound = loserRounds[roundIdx];
    const nextRound = loserRounds[roundIdx + 1];

    // Even-indexed loser rounds (L0, L2, L4...) receive drops from winner bracket
    // These are handled in linkWinnerToLoser
    // Odd-indexed loser rounds (L1, L3, L5...) only get winners from previous loser round

    if (roundIdx % 2 === 0) {
      // Even round: winners advance to next loser round
      // The next round will ALSO receive drops from winner bracket
      for (let matchIdx = 0; matchIdx < currentRound.matches.length; matchIdx++) {
        const currentMatch = currentRound.matches[matchIdx];
        const nextMatch = nextRound.matches[matchIdx];

        // Winners from L0, L2, L4 usually feed into position B of the next round,
        // which simultaneously receives new drops from the winner bracket (position A).
        // The exception is the round immediately before the loser bracket final,
        // where position A must come from this round because the final only receives
        // one drop (the loser of the championship match).
        const isNextRoundFinal = roundIdx === loserRounds.length - 2;
        if (isNextRoundFinal) {
          nextMatch.sourceMatchAId = currentMatch.id!;
        } else {
          nextMatch.sourceMatchBId = currentMatch.id!;
        }
      }
    } else {
      // Odd round: winners advance to next loser round (standard elimination)
      for (let matchIdx = 0; matchIdx < currentRound.matches.length; matchIdx++) {
        const currentMatch = currentRound.matches[matchIdx];
        const nextMatchIdx = Math.floor(matchIdx / 2);
        const nextMatch = nextRound.matches[nextMatchIdx];

        const isPositionA = matchIdx % 2 === 0;
        if (isPositionA) {
          nextMatch.sourceMatchAId = currentMatch.id!;
        } else {
          nextMatch.sourceMatchBId = currentMatch.id!;
        }
      }
    }
  }
}

/**
 * Link winner bracket losers to loser bracket (position-based)
 *
 * Standard double elimination structure:
 * - Losers from winner round 0 (W1, W2, W3...) go to loser round 0 (L1, L2...)
 * - Losers from winner round N go to loser round 2N-1
 *
 * Position-based assignment:
 * - Loser of W1 → L1 position A (or gets bye if odd number)
 * - Loser of W2 → L1 position A/B
 * - Loser of W3 → L1 position B (or plays if odd number)
 */
function linkWinnerToLoser(
  winnerRounds: BracketRound[],
  loserRounds: BracketRound[]
): void {
  for (let winRoundIdx = 0; winRoundIdx < winnerRounds.length; winRoundIdx++) {
    const winnerRound = winnerRounds[winRoundIdx];

    // Calculate which loser round receives these drops
    // Round 0 → L0, Round 1 → L1, Round 2 → L3, etc.
    // IMPORTANT: Last winner round always feeds into last loser round (the loser bracket final)
    const isLastWinnerRound = winRoundIdx === winnerRounds.length - 1;
    const loserRoundIdx = isLastWinnerRound
      ? loserRounds.length - 1  // Last winner round → last loser round (loser bracket final)
      : (winRoundIdx === 0 ? 0 : (winRoundIdx * 2) - 1);

    if (loserRoundIdx >= loserRounds.length) {
      // Fallback: if calculation exceeds loser rounds, use last loser round
      const lastLoserRound = loserRounds[loserRounds.length - 1];
      for (let matchIdx = 0; matchIdx < winnerRound.matches.length; matchIdx++) {
        const winnerMatch = winnerRound.matches[matchIdx];
        const loserMatch = lastLoserRound.matches[matchIdx];

        loserMatch.sourceMatchBId = winnerMatch.id!;
      }
      continue;
    }

    const loserRound = loserRounds[loserRoundIdx];

    // Position-based assignment to loser bracket
    for (let matchIdx = 0; matchIdx < winnerRound.matches.length; matchIdx++) {
      const winnerMatch = winnerRound.matches[matchIdx];

      // Map winner bracket match index to loser bracket position
      // This creates the standard double-elim structure where:
      // - Match indices map directly for first round
      // - Later rounds follow a specific pattern

      if (loserRoundIdx === 0) {
        // First loser round: direct mapping
        // But handle odd numbers - some matches might not exist
        const loserMatchIdx = Math.floor(matchIdx / 2);

        if (loserMatchIdx < loserRound.matches.length) {
          const loserMatch = loserRound.matches[loserMatchIdx];
          const isPositionA = matchIdx % 2 === 0;

          if (isPositionA) {
            loserMatch.sourceMatchAId = winnerMatch.id!;
          } else {
            loserMatch.sourceMatchBId = winnerMatch.id!;
          }
        }
      } else {
        // Later rounds: drops fill position A of loser bracket matches
        // EXCEPT for last winner round, which fills position B of loser bracket final
        if (matchIdx < loserRound.matches.length) {
          const loserMatch = loserRound.matches[matchIdx];
          if (isLastWinnerRound) {
            // Last winner round: loser goes to position B of loser bracket final
            loserMatch.sourceMatchBId = winnerMatch.id!;
          } else {
            // Other rounds: drops go to position A
            loserMatch.sourceMatchAId = winnerMatch.id!;
          }
        }
      }
    }
  }
}

/**
 * Link finals rounds (bracket reset)
 * Finals 1: WB champion vs LB champion
 * Finals 2: Both teams from Finals 1 (only if LB champion wins Finals 1)
 */
function linkFinals(
  winnerRounds: BracketRound[],
  loserRounds: BracketRound[],
  finalsRounds: BracketRound[]
): void {
  const lastWinnerRound = winnerRounds[winnerRounds.length - 1];
  const lastLoserRound = loserRounds[loserRounds.length - 1];
  const finals1Round = finalsRounds[0];
  const finals2Round = finalsRounds[1];
  const finals1Match = finals1Round.matches[0];
  const finals2Match = finals2Round.matches[0];

  // Finals 1: Winner bracket champion vs Loser bracket champion
  finals1Match.sourceMatchAId = lastWinnerRound.matches[0].id!;
  finals1Match.sourceMatchBId = lastLoserRound.matches[0].id!;

  // Finals 2: Bracket reset - both teams come from Finals 1
  // This match is only played if the loser bracket champion wins Finals 1
  // The sourceMatchAId links to Finals 1 for tracking, but both teams come from it
  finals2Match.sourceMatchAId = finals1Match.id!;
  // sourceMatchBId stays null since both teams come from the same source match

  // Update finals round indices
  finals1Round.idx = winnerRounds.length + loserRounds.length;
  finals2Round.idx = winnerRounds.length + loserRounds.length + 1;
}

/**
 * Helper to get the depth of a round (0 = finals, 1 = semis, etc.)
 */
export function getRoundDepth(roundIndex: number, totalRounds: number): number {
  return totalRounds - roundIndex - 1;
}

/**
 * Helper to determine if a match is a bye (one team missing)
 */
export function isMatchBye(match: BracketMatch): boolean {
  return match.isBye || !match.teamAId || !match.teamBId;
}
