// User and Authentication Types
export interface UserProfile {
  id: string;
  clerkUserId: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  gender: 'MALE' | 'FEMALE';
  dupr: number | null;
  age: number | null;
  birthday: Date | null;
  city: string | null;
  region: string | null;
  country: string | null;
  isAppAdmin: boolean;
  isTournamentAdmin: boolean;
  club: {
    id: string;
    name: string;
    city: string | null;
    region: string | null;
  };
}

// Role Types
export type UserRole = 'APP_ADMIN' | 'TOURNAMENT_ADMIN' | 'EVENT_MANAGER' | 'CAPTAIN' | 'PLAYER';

export interface RoleInfo {
  isAppAdmin: boolean;
  isTournamentAdmin: boolean;
  isEventManager: boolean;
  isCaptain: boolean;
  admins: string[];
  eventManagers: string[];
  captains: string[];
}

// Tournament Types
export interface TournamentBracket {
  id: string;
  name: string;
  idx: number;
}

export interface TournamentStop {
  id: string;
  name: string;
  startAt: Date;
  endAt: Date | null;
  locationName: string | null;
}

export interface Tournament {
  id: string;
  name: string;
  type: 'TEAM_FORMAT' | 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'ROUND_ROBIN' | 'POOL_PLAY' | 'LADDER_TOURNAMENT';
  createdAt: Date;
  brackets: TournamentBracket[];
  stops: TournamentStop[];
}

export interface TournamentsResponse {
  tournaments: Tournament[];
}

// Registration Types
export interface PlayerRegistration {
  tournamentId: string;
  tournamentName: string;
  tournamentType: string;
  teamId: string;
  teamName: string;
  bracket: string;
}

export interface RegistrationResponse {
  registered: boolean;
  registration?: {
    teamId: string;
    teamName: string;
    bracket: string;
  };
  message?: string;
}

// Player Types
export interface Player {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  gender?: 'MALE' | 'FEMALE' | null;
  birthday?: Date | null;
  age?: number | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  clubId?: string | null;
  duprSingles?: number | null;
  duprDoubles?: number | null;
  clubRatingSingles?: number | null;
  clubRatingDoubles?: number | null;
  displayAge?: boolean | null;
  displayLocation?: boolean | null;
  createdAt?: Date;
  updatedAt?: Date;
  club?: {
    id: string;
    name: string;
    city?: string | null;
    region?: string | null;
  } | null;
}

// Club Types
export interface Club {
  id: string;
  fullName: string;
  name: string;
  address1?: string | null;
  city?: string | null;
  region?: string | null;
  country: string;
  postalCode?: string | null;
  phone?: string | null;
  address?: string | null;
  email?: string | null;
  description?: string | null;
  directorId?: string | null;
  logo?: string | null;
  director?: Player | null;
}

// Team Types
export interface Team {
  id: string;
  name: string;
  tournamentId: string;
  clubId: string;
  captainId?: string | null;
  division: 'INTERMEDIATE' | 'ADVANCED';
  bracketId?: string | null;
  levelId?: string | null;
  bracket?: {
    name: string;
  };
}

// Error and Info Message Types
export interface ErrorMessage {
  error: string;
}

export interface InfoMessage {
  message: string;
}
