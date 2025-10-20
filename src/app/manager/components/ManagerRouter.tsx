'use client';

import { TeamFormatManager } from './TeamFormatManager';
import { BracketManager } from './BracketManager';

type Id = string;

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

interface ManagerRouterProps {
  tournaments: EventManagerTournament[];
  onError: (message: string) => void;
  onInfo: (message: string) => void;
}

/**
 * ManagerRouter
 *
 * Routes to the correct tournament manager component based on tournament type.
 * This allows us to have different UIs for different tournament formats
 * (Team Format, Double Elimination, Single Elimination, etc.)
 */
export function ManagerRouter({ tournaments, onError, onInfo }: ManagerRouterProps) {
  // Get the tournament type from the first tournament
  // (Currently we only show one tournament at a time)
  const tournamentType = tournaments[0]?.type || 'TEAM_FORMAT';

  switch (tournamentType) {
    case 'TEAM_FORMAT':
      return (
        <TeamFormatManager
          tournaments={tournaments}
          onError={onError}
          onInfo={onInfo}
        />
      );

    case 'DOUBLE_ELIMINATION':
      return (
        <BracketManager
          tournaments={tournaments}
          onError={onError}
          onInfo={onInfo}
        />
      );

    case 'SINGLE_ELIMINATION':
      return (
        <div className="card p-8 text-center">
          <div className="max-w-md mx-auto space-y-3">
            <div className="text-5xl">🎯</div>
            <h3 className="text-lg font-semibold text-secondary">Single Elimination Manager</h3>
            <p className="text-muted">
              This tournament type is not yet supported.
            </p>
          </div>
        </div>
      );

    case 'ROUND_ROBIN':
      return (
        <div className="card p-8 text-center">
          <div className="max-w-md mx-auto space-y-3">
            <div className="text-5xl">🔄</div>
            <h3 className="text-lg font-semibold text-secondary">Round Robin Manager</h3>
            <p className="text-muted">
              This tournament type is not yet supported.
            </p>
          </div>
        </div>
      );

    default:
      return (
        <div className="card p-8 text-center">
          <div className="max-w-md mx-auto space-y-3">
            <div className="text-5xl">❓</div>
            <h3 className="text-lg font-semibold text-secondary">Unknown Tournament Type</h3>
            <p className="text-muted">
              Tournament type "{tournamentType}" is not supported.
            </p>
          </div>
        </div>
      );
  }
}
