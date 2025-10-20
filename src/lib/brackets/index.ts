/**
 * Brackets Library
 *
 * Complete bracket generation and management system for tournament brackets.
 * Supports:
 * - Double elimination
 * - Flexible team counts (with automatic byes)
 * - Winner/Loser bracket progression
 * - Match linking for bracket tree structure
 */

export * from './types';
export * from './seeding';
export * from './doubleElimination';
export * from './progression';

// Re-export commonly used functions
export {
  generateDoubleEliminationBracket,
} from './doubleElimination';

export {
  createFirstRoundMatchups,
  getBracketInfo,
  calculateByes,
} from './seeding';

export {
  advanceWinner,
  calculateWinnerProgression,
  calculateLoserProgression,
} from './progression';
