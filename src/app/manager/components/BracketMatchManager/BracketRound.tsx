'use client';

/**
 * Bracket Round Component
 *
 * Displays a single round in a bracket with collapsible matches.
 */

import { BracketMatch } from './BracketMatch';
import { PlayerLite } from '../shared/types';

interface BracketRoundProps {
  round: {
    id: string;
    idx: number;
    bracketType: string | null;
    depth: number | null;
    matches: any[];
  };
  stopId: string;
  lineups: Record<string, Record<string, PlayerLite[]>>;
  teamRosters: Record<string, PlayerLite[]>;
  isExpanded: boolean;
  onToggle: () => void;
  onMatchUpdate: () => void;
  onError: (message: string) => void;
  onInfo: (message: string) => void;
  onLineupSave: (matchId: string, lineupData: { teamA: PlayerLite[]; teamB: PlayerLite[] }, teamAId: string, teamBId: string) => void;
}

export function BracketRound({
  round,
  stopId,
  lineups,
  teamRosters,
  isExpanded,
  onToggle,
  onMatchUpdate,
  onError,
  onInfo,
  onLineupSave,
}: BracketRoundProps) {
  const getRoundTitle = () => {
    const { bracketType, depth } = round;

    if (bracketType === 'FINALS') {
      return 'Finals';
    }

    if (bracketType === 'WINNER') {
      if (depth === 0) return 'Winner Finals';
      if (depth === 1) return 'Winner Semifinals';
      if (depth === 2) return 'Winner Quarterfinals';
      return `Winner Round ${round.idx + 1}`;
    }

    if (bracketType === 'LOSER') {
      if (depth === 0) return 'Loser Finals';
      if (depth === 1) return 'Loser Semifinals';
      if (depth === 2) return 'Loser Quarterfinals';
      return `Loser Round ${round.idx + 1}`;
    }

    return `Round ${round.idx + 1}`;
  };

  const completedCount = round.matches.filter((m: any) => m.winnerId).length;
  const totalMatches = round.matches.length;
  const isComplete = completedCount === totalMatches;

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700">
      {/* Round Header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-gray-400">
            {isExpanded ? '▼' : '▶'}
          </span>
          <h4 className="text-lg font-semibold text-white">
            {getRoundTitle()}
          </h4>
          <span className="text-sm text-gray-400">
            ({completedCount}/{totalMatches} complete)
          </span>
        </div>
        {isComplete && (
          <span className="text-green-400 text-sm font-medium">
            ✓ Complete
          </span>
        )}
      </button>

      {/* Matches */}
      {isExpanded && (
        <div className="p-4 space-y-3 border-t border-gray-700">
          {round.matches.map((match: any) => (
            <BracketMatch
              key={match.id}
              match={match}
              roundId={round.id}
              stopId={stopId}
              lineups={lineups}
              teamRosters={teamRosters}
              onUpdate={onMatchUpdate}
              onError={onError}
              onInfo={onInfo}
              onLineupSave={onLineupSave}
            />
          ))}
        </div>
      )}
    </div>
  );
}
