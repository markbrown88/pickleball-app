/**
 * Bracket Seeding
 *
 * Handles seeding logic for brackets with any number of teams.
 * Supports byes and ensures proper bracket balance.
 */

import { Team } from './types';

/**
 * Calculate the next power of 2 that can accommodate all teams
 * e.g., 5 teams → 8, 12 teams → 16, 20 teams → 32
 */
export function getNextPowerOfTwo(n: number): number {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

/**
 * Calculate number of byes needed
 */
export function calculateByes(teamCount: number): number {
  const bracketSize = getNextPowerOfTwo(teamCount);
  return bracketSize - teamCount;
}

/**
 * Standard bracket seeding pattern
 * For power of 2: [1,16,8,9,4,13,5,12,2,15,7,10,3,14,6,11] for 16 teams
 *
 * This ensures:
 * - Seed 1 plays weakest opponent (or bye) in first round
 * - Top seeds don't meet until later rounds
 */
export function generateBracketSeeding(bracketSize: number): number[] {
  if (bracketSize === 2) return [1, 2];
  if (bracketSize === 4) return [1, 4, 2, 3];
  if (bracketSize === 8) return [1, 8, 4, 5, 2, 7, 3, 6];
  if (bracketSize === 16) return [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11];
  if (bracketSize === 32) return [
    1, 32, 16, 17, 8, 25, 9, 24, 4, 29, 13, 20, 5, 28, 12, 21,
    2, 31, 15, 18, 7, 26, 10, 23, 3, 30, 14, 19, 6, 27, 11, 22
  ];
  if (bracketSize === 64) {
    // Generate 64-team seeding using recursive algorithm
    return generate64TeamSeeding();
  }

  throw new Error(`Bracket size ${bracketSize} not supported`);
}

/**
 * Generate 64-team seeding pattern
 */
function generate64TeamSeeding(): number[] {
  const result: number[] = [];
  const thirtyTwo = generateBracketSeeding(32);

  for (let i = 0; i < thirtyTwo.length; i += 2) {
    result.push(thirtyTwo[i]);
    result.push(65 - thirtyTwo[i]);
    result.push(thirtyTwo[i + 1]);
    result.push(65 - thirtyTwo[i + 1]);
  }

  return result;
}

/**
 * Create first round matchups with proper seeding and byes
 *
 * @param teams - Ordered teams (already seeded by user)
 * @returns Array of matchup pairs with seeds
 */
export function createFirstRoundMatchups(teams: Team[]): Array<{
  seedA: number;
  seedB: number | null;
  teamA: Team | null;
  teamB: Team | null;
  isBye: boolean;
}> {
  const teamCount = teams.length;
  const bracketSize = getNextPowerOfTwo(teamCount);
  const byeCount = calculateByes(teamCount);
  const seeding = generateBracketSeeding(bracketSize);

  const matchups: Array<{
    seedA: number;
    seedB: number | null;
    teamA: Team | null;
    teamB: Team | null;
    isBye: boolean;
  }> = [];

  // Create matchups based on seeding
  for (let i = 0; i < seeding.length; i += 2) {
    const seedA = seeding[i];
    const seedB = seeding[i + 1];

    // Team exists if seed <= teamCount
    const teamA = seedA <= teamCount ? teams[seedA - 1] : null;
    const teamB = seedB <= teamCount ? teams[seedB - 1] : null;

    // It's a bye if one team is missing
    const isBye = !teamA || !teamB;

    matchups.push({
      seedA,
      seedB: teamB ? seedB : null,
      teamA,
      teamB,
      isBye,
    });
  }

  return matchups;
}

/**
 * Determine which team advances from a bye match
 */
export function getByeWinner(matchup: {
  teamA: Team | null;
  teamB: Team | null;
}): Team | null {
  return matchup.teamA || matchup.teamB || null;
}

/**
 * Get information about the bracket structure
 */
export function getBracketInfo(teamCount: number) {
  const bracketSize = getNextPowerOfTwo(teamCount);
  const byeCount = calculateByes(teamCount);
  const roundCount = Math.log2(bracketSize);

  return {
    teamCount,
    bracketSize,
    byeCount,
    roundCount,
    firstRoundMatches: bracketSize / 2,
  };
}
