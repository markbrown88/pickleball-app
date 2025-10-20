export type Id = string;

export type PlayerLite = {
  id: Id;
  firstName?: string | null;
  lastName?: string | null;
  name: string;
  gender: 'MALE' | 'FEMALE';
  dupr?: number | null;
  age?: number | null;
};

export type EventManagerTournament = {
  tournamentId: Id;
  tournamentName: string;
  type: string;
  maxTeamSize: number | null;
  roles: {
    manager: boolean;
    admin: boolean;
    captainOfClubs: string[];
  };
  clubs: Array<{ id: Id; name: string }>;
  stops: Array<{
    stopId: Id;
    stopName: string;
    locationName?: string | null;
    startAt?: string | null;
    endAt?: string | null;
    lineupDeadline?: string | null;
    rounds: Array<{ roundId: Id; idx: number; gameCount: number; matchCount: number }>;
  }>;
};
