/**
 * Tournament Type Configuration
 * 
 * Centralized configuration for tournament type-specific rules and behaviors.
 * This helps keep the codebase organized and makes it easy to add new tournament types
 * or modify existing ones.
 */

import type { TournamentType } from '@prisma/client';

export type PricingModel = 'TOURNAMENT_WIDE' | 'PER_STOP' | 'PER_BRACKET' | 'PER_STOP_PER_BRACKET';

export interface TournamentTypeConfig {
  /** Display name for the tournament type */
  displayName: string;
  
  /** Whether clubs are required for this tournament type */
  requiresClubs: boolean;
  
  /** Whether stops are visible/manageable in the UI (false = uses default stop internally) */
  showsStops: boolean;
  
  /** Whether brackets are visible/manageable in the UI (false = uses default bracket internally) */
  showsBrackets: boolean;
  
  /** Whether multiple stops are allowed (only relevant if showsStops is true) */
  allowsMultipleStops: boolean;
  
  /** Whether this is a team/club-based tournament */
  isTeamTournament: boolean;
  
  /** Allowed pricing models for this tournament type */
  allowedPricingModels: PricingModel[];
  
  /** Whether this tournament type requires a stop selection step in registration */
  requiresStopSelection: boolean;
  
  /** Whether this tournament type requires a bracket selection step in registration */
  requiresBracketSelection: boolean;
  
  /** Default stop name to use internally if showsStops is false */
  defaultStopName: string;
  
  /** Default bracket name to use internally if showsBrackets is false */
  defaultBracketName: string;
}

/**
 * Configuration for each tournament type
 */
export const TOURNAMENT_TYPE_CONFIG: Record<TournamentType, TournamentTypeConfig> = {
  TEAM_FORMAT: {
    displayName: 'Club Round-Robin',
    requiresClubs: true,
    showsStops: true,
    showsBrackets: true,
    allowsMultipleStops: true,
    isTeamTournament: true,
    allowedPricingModels: ['TOURNAMENT_WIDE', 'PER_STOP'],
    requiresStopSelection: true,
    requiresBracketSelection: true,
    defaultStopName: 'Default Stop',
    defaultBracketName: 'DEFAULT',
  },
  
  SINGLE_ELIMINATION: {
    displayName: 'Single Elimination',
    requiresClubs: true,
    showsStops: true,
    showsBrackets: true,
    allowsMultipleStops: false,
    isTeamTournament: false,
    allowedPricingModels: ['TOURNAMENT_WIDE', 'PER_STOP', 'PER_BRACKET', 'PER_STOP_PER_BRACKET'],
    requiresStopSelection: true,
    requiresBracketSelection: true,
    defaultStopName: 'Default Stop',
    defaultBracketName: 'DEFAULT',
  },
  
  DOUBLE_ELIMINATION: {
    displayName: 'Double Elimination',
    requiresClubs: true,
    showsStops: true, // Show location/dates tab to configure venue and tournament dates
    showsBrackets: true, // Has multiple brackets
    allowsMultipleStops: false, // Only one location/stop allowed
    isTeamTournament: false,
    allowedPricingModels: ['TOURNAMENT_WIDE', 'PER_BRACKET'],
    requiresStopSelection: false, // Skip stop selection in registration (only one stop)
    requiresBracketSelection: true, // Bracket selection required
    defaultStopName: 'Main Tournament',
    defaultBracketName: 'DEFAULT',
  },
  
  DOUBLE_ELIMINATION_CLUBS: {
    displayName: 'Club Double Elimination',
    requiresClubs: true,
    showsStops: true, // Show location/dates tab to configure venue and tournament dates
    showsBrackets: true, // Has multiple brackets
    allowsMultipleStops: false, // Only one location/stop allowed
    isTeamTournament: true,
    allowedPricingModels: ['TOURNAMENT_WIDE'], // Only tournament-wide since there's only one stop
    requiresStopSelection: false, // Skip stop selection in registration (only one stop)
    requiresBracketSelection: true, // Bracket selection required
    defaultStopName: 'Main Tournament',
    defaultBracketName: 'DEFAULT',
  },
  
  ROUND_ROBIN: {
    displayName: 'Round Robin',
    requiresClubs: false,
    showsStops: true,
    showsBrackets: true,
    allowsMultipleStops: true,
    isTeamTournament: false,
    allowedPricingModels: ['TOURNAMENT_WIDE', 'PER_STOP', 'PER_BRACKET', 'PER_STOP_PER_BRACKET'],
    requiresStopSelection: true,
    requiresBracketSelection: true,
    defaultStopName: 'Default Stop',
    defaultBracketName: 'DEFAULT',
  },
  
  POOL_PLAY: {
    displayName: 'Pool Play',
    requiresClubs: false,
    showsStops: true,
    showsBrackets: true,
    allowsMultipleStops: true,
    isTeamTournament: false,
    allowedPricingModels: ['TOURNAMENT_WIDE', 'PER_STOP', 'PER_BRACKET', 'PER_STOP_PER_BRACKET'],
    requiresStopSelection: true,
    requiresBracketSelection: true,
    defaultStopName: 'Default Stop',
    defaultBracketName: 'DEFAULT',
  },
  
  LADDER_TOURNAMENT: {
    displayName: 'Ladder Tournament',
    requiresClubs: false,
    showsStops: true,
    showsBrackets: true,
    allowsMultipleStops: true,
    isTeamTournament: false,
    allowedPricingModels: ['TOURNAMENT_WIDE', 'PER_STOP', 'PER_BRACKET', 'PER_STOP_PER_BRACKET'],
    requiresStopSelection: true,
    requiresBracketSelection: true,
    defaultStopName: 'Default Stop',
    defaultBracketName: 'DEFAULT',
  },
};

/**
 * Get configuration for a tournament type
 */
export function getTournamentTypeConfig(type: TournamentType | string | null | undefined): TournamentTypeConfig {
  if (!type) {
    return TOURNAMENT_TYPE_CONFIG.TEAM_FORMAT; // Default fallback
  }
  
  // Handle string labels (e.g., "Team Format" -> "TEAM_FORMAT")
  const normalizedType = normalizeTournamentType(type);
  if (!normalizedType) {
    return TOURNAMENT_TYPE_CONFIG.TEAM_FORMAT; // Default fallback
  }
  
  return TOURNAMENT_TYPE_CONFIG[normalizedType];
}

/**
 * Normalize tournament type string to enum
 */
function normalizeTournamentType(input: string): TournamentType | null {
  // Check if it's already an enum value
  if (input in TOURNAMENT_TYPE_CONFIG) {
    return input as TournamentType;
  }
  
  // Map display names to enum values
  const displayNameToEnum: Record<string, TournamentType> = {
    'Club Round-Robin': 'TEAM_FORMAT',
    'Team Format': 'TEAM_FORMAT', // Legacy alias
    'Single Elimination': 'SINGLE_ELIMINATION',
    'Double Elimination': 'DOUBLE_ELIMINATION',
    'Club Double Elimination': 'DOUBLE_ELIMINATION_CLUBS',
    'Double Elimination Clubs': 'DOUBLE_ELIMINATION_CLUBS', // Legacy alias
    'Round Robin': 'ROUND_ROBIN',
    'Pool Play': 'POOL_PLAY',
    'Ladder Tournament': 'LADDER_TOURNAMENT',
  };
  
  return displayNameToEnum[input] || null;
}

/**
 * Helper functions for common checks
 */
export function requiresClubs(type: TournamentType | string | null | undefined): boolean {
  return getTournamentTypeConfig(type).requiresClubs;
}

export function showsStops(type: TournamentType | string | null | undefined): boolean {
  return getTournamentTypeConfig(type).showsStops;
}

export function showsBrackets(type: TournamentType | string | null | undefined): boolean {
  return getTournamentTypeConfig(type).showsBrackets;
}

export function allowsMultipleStops(type: TournamentType | string | null | undefined): boolean {
  return getTournamentTypeConfig(type).allowsMultipleStops;
}

export function isTeamTournament(type: TournamentType | string | null | undefined): boolean {
  return getTournamentTypeConfig(type).isTeamTournament;
}

export function getAllowedPricingModels(type: TournamentType | string | null | undefined): PricingModel[] {
  return getTournamentTypeConfig(type).allowedPricingModels;
}

export function requiresStopSelection(type: TournamentType | string | null | undefined): boolean {
  return getTournamentTypeConfig(type).requiresStopSelection;
}

export function requiresBracketSelection(type: TournamentType | string | null | undefined): boolean {
  return getTournamentTypeConfig(type).requiresBracketSelection;
}

export function getDefaultStopName(type: TournamentType | string | null | undefined): string {
  return getTournamentTypeConfig(type).defaultStopName;
}

export function getDefaultBracketName(type: TournamentType | string | null | undefined): string {
  return getTournamentTypeConfig(type).defaultBracketName;
}

