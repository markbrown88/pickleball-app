/**
 * Bracket Types
 *
 * Type definitions for bracket tournament generation and management
 */

export type BracketType = 'WINNER' | 'LOSER' | 'FINALS';

export type GameSlot = 'MENS_DOUBLES' | 'WOMENS_DOUBLES' | 'MIXED_1' | 'MIXED_2' | 'TIEBREAKER';

export interface Team {
  id: string;
  name: string;
  clubId?: string;
  seed?: number;
}

export interface BracketMatch {
  id?: string;
  roundId?: string;
  teamAId: string | null;
  teamBId: string | null;
  seedA?: number;
  seedB?: number;
  sourceMatchAId?: string | null;
  sourceMatchBId?: string | null;
  bracketPosition: number;
  isBye: boolean;
}

export interface BracketRound {
  id?: string;
  stopId: string;
  idx: number;
  bracketType: BracketType;
  depth: number;
  matches: BracketMatch[];
}

export interface BracketGenerationOptions {
  tournamentId: string;
  stopId: string;
  teams: Team[]; // Pre-seeded teams in order
  gamesPerMatch: number;
  gameSlots: GameSlot[];
}

export interface GeneratedBracket {
  rounds: BracketRound[];
  totalMatches: number;
  totalRounds: number;
}
