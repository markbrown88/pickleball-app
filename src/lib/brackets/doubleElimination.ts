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
  const loserRounds = createLoserBracket(stopId, info.roundCount);
  const finalsRound = createFinalsRound(stopId);

  // Link matches for bracket progression
  linkBracketProgression(winnerRounds, loserRounds, finalsRound);

  const allRounds = [...winnerRounds, ...loserRounds, finalsRound];
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
 * Loser bracket is more complex:
 * - Has 2*(n-1) rounds where n is winner bracket rounds
 * - Teams drop from winner bracket at different stages
 * - Some rounds pit dropped teams against each other
 * - Other rounds pit winners from previous loser round against newly dropped teams
 */
function createLoserBracket(
  stopId: string,
  winnerRoundCount: number
): BracketRound[] {
  const rounds: BracketRound[] = [];
  const loserRoundCount = (winnerRoundCount - 1) * 2;

  // Calculate matches for each loser bracket round
  // This follows standard double elimination structure
  let currentMatchCount = Math.pow(2, winnerRoundCount - 2); // Half of first round

  for (let roundIdx = 0; roundIdx < loserRoundCount; roundIdx++) {
    const matches: BracketMatch[] = [];

    for (let matchIdx = 0; matchIdx < currentMatchCount; matchIdx++) {
      matches.push({
        teamAId: null,
        teamBId: null,
        bracketPosition: matchIdx,
        isBye: false,
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

    // Match count alternates: stays same, then halves
    if (roundIdx % 2 === 1) {
      currentMatchCount = Math.floor(currentMatchCount / 2);
    }
  }

  return rounds;
}

/**
 * Create finals round (winner bracket winner vs loser bracket winner)
 */
function createFinalsRound(stopId: string): BracketRound {
  return {
    stopId,
    idx: 9999, // Will be updated when we know total round count
    bracketType: 'FINALS',
    depth: 0,
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
  };
}

/**
 * Link matches for bracket progression
 * Sets sourceMatchAId and sourceMatchBId to connect the bracket tree
 */
function linkBracketProgression(
  winnerRounds: BracketRound[],
  loserRounds: BracketRound[],
  finalsRound: BracketRound
): void {
  // This is complex logic that needs to be implemented based on:
  // 1. Winner bracket: winners advance to next winner round
  // 2. Winner bracket: losers drop to loser bracket at specific positions
  // 3. Loser bracket: winners advance within loser bracket
  // 4. Finals: gets winners from both brackets

  // TODO: Implement full progression logic
  // For now, this is a placeholder that will be completed
  // when we integrate with the database and create matches
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
