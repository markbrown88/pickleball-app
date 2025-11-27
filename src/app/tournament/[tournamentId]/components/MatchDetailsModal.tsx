'use client';

/**
 * Read-Only Match Details Modal
 *
 * Displays match and game details without edit capabilities.
 */

import { useMemo } from 'react';

interface Match {
  id: string;
  teamA: { id: string; name: string; club?: { name: string } } | null;
  teamB: { id: string; name: string; club?: { name: string } } | null;
  winnerId: string | null;
  games: Game[];
  isBye?: boolean;
}

interface Game {
  id: string;
  slot: string;
  teamAScore: number | null;
  teamBScore: number | null;
  isComplete: boolean;
  startedAt: string | null;
  courtNumber?: string | null;
  bracketId?: string | null;
  bracket?: { id: string; name: string } | null;
  teamALineup?: Player[];
  teamBLineup?: Player[];
}

interface Player {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string;
}

interface MatchDetailsModalProps {
  match: Match;
  onClose: () => void;
}

const GAME_SLOT_LABELS: Record<string, string> = {
  MENS_DOUBLES: "Men's Doubles",
  WOMENS_DOUBLES: "Women's Doubles",
  MIXED_1: 'Mixed 1',
  MIXED_2: 'Mixed 2',
  TIEBREAKER: 'Tiebreaker',
};

function formatPlayerName(player: Player | undefined): string {
  if (!player) return 'TBD';
  if (player.firstName && player.lastName) {
    return `${player.firstName} ${player.lastName}`;
  }
  return player.name || 'Unknown';
}

export function MatchDetailsModal({ match, onClose }: MatchDetailsModalProps) {
  // Calculate games won
  const gamesWon = useMemo(() => {
    let teamAWins = 0;
    let teamBWins = 0;

    match.games.forEach((game) => {
      if (game.isComplete && game.teamAScore !== null && game.teamBScore !== null) {
        if (game.teamAScore > game.teamBScore) {
          teamAWins++;
        } else if (game.teamBScore > game.teamAScore) {
          teamBWins++;
        }
      }
    });

    return { teamA: teamAWins, teamB: teamBWins };
  }, [match.games]);

  const hasStarted = match.games.some(g => g.startedAt !== null);
  const isComplete = match.winnerId !== null;

  if (match.isBye) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-gray-800 rounded-lg border border-gray-700 max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
          <div className="text-center">
            <h2 className="text-xl font-bold text-white mb-2">Bye Match</h2>
            <p className="text-gray-400 mb-4">This team received a bye and automatically advances.</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/80 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-gray-900 rounded-lg border border-gray-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">Match Details</h2>
            {isComplete && (
              <p className="text-sm text-green-400 mt-1">Match Complete</p>
            )}
            {!isComplete && hasStarted && (
              <p className="text-sm text-yellow-400 mt-1">Match In Progress</p>
            )}
            {!isComplete && !hasStarted && (
              <p className="text-sm text-gray-400 mt-1">Match Not Started</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-2xl"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Match Summary */}
        <div className="px-6 py-4 border-b border-gray-700">
          <div className="grid grid-cols-3 gap-4 items-center">
            {/* Team A */}
            <div className={`text-center ${match.winnerId === match.teamA?.id ? 'opacity-100' : 'opacity-60'}`}>
              <div className="text-base font-bold text-white">
                {match.teamA?.name || 'TBD'}
              </div>
              {match.teamA?.club && (
                <div className="text-sm text-gray-400 mt-1">{match.teamA.club.name}</div>
              )}
              {isComplete && match.winnerId === match.teamA?.id && (
                <div className="text-green-400 text-sm mt-2 font-semibold">Winner</div>
              )}
            </div>

            {/* Score */}
            <div className="text-center">
              <div className="text-2xl font-bold text-white">
                {gamesWon.teamA} - {gamesWon.teamB}
              </div>
              <div className="text-xs text-gray-400 mt-1">Games Won</div>
            </div>

            {/* Team B */}
            <div className={`text-center ${match.winnerId === match.teamB?.id ? 'opacity-100' : 'opacity-60'}`}>
              <div className="text-base font-bold text-white">
                {match.teamB?.name || 'TBD'}
              </div>
              {match.teamB?.club && (
                <div className="text-sm text-gray-400 mt-1">{match.teamB.club.name}</div>
              )}
              {isComplete && match.winnerId === match.teamB?.id && (
                <div className="text-green-400 text-sm mt-2 font-semibold">Winner</div>
              )}
            </div>
          </div>
        </div>

        {/* Games List */}
        <div className="px-6 py-4">
          <h3 className="text-base font-semibold text-white mb-4">Games</h3>
          <div className="space-y-3">
            {match.games.map((game) => {
              const gameWinner =
                game.isComplete && game.teamAScore !== null && game.teamBScore !== null
                  ? game.teamAScore > game.teamBScore
                    ? 'A'
                    : game.teamBScore > game.teamAScore
                    ? 'B'
                    : null
                  : null;

              // For DE Clubs, use bracket name; otherwise use slot label
              const gameLabel = game.bracket?.name || GAME_SLOT_LABELS[game.slot] || game.slot;

              return (
                <div key={game.id} className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  {/* Game Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-white">
                        {gameLabel}
                      </h4>
                      {game.courtNumber && (
                        <span className="text-xs bg-blue-900/40 text-blue-400 px-2 py-0.5 rounded">
                          Court {game.courtNumber}
                        </span>
                      )}
                      {game.isComplete && (
                        <span className="text-xs bg-green-900/40 text-green-400 px-2 py-0.5 rounded">
                          Complete
                        </span>
                      )}
                      {!game.isComplete && game.startedAt && (
                        <span className="text-xs bg-yellow-900/40 text-yellow-400 px-2 py-0.5 rounded">
                          In Progress
                        </span>
                      )}
                    </div>
                    {game.isComplete && (
                      <div className="text-base font-bold text-white">
                        {game.teamAScore} - {game.teamBScore}
                      </div>
                    )}
                  </div>

                  {/* Lineups */}
                  {(game.teamALineup || game.teamBLineup) && (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {/* Team A Lineup */}
                      <div className={gameWinner === 'A' ? 'opacity-100' : 'opacity-60'}>
                        <div className="font-medium text-white mb-1">
                          {match.teamA?.name || 'Team A'}
                          {gameWinner === 'A' && <span className="ml-2 text-green-400">✓</span>}
                        </div>
                        <div className="text-gray-400 space-y-0.5">
                          {game.teamALineup?.map((player) => (
                            <div key={player.id}>{formatPlayerName(player)}</div>
                          ))}
                          {(!game.teamALineup || game.teamALineup.length === 0) && (
                            <div className="italic">No lineup</div>
                          )}
                        </div>
                      </div>

                      {/* Team B Lineup */}
                      <div className={gameWinner === 'B' ? 'opacity-100' : 'opacity-60'}>
                        <div className="font-medium text-white mb-1">
                          {match.teamB?.name || 'Team B'}
                          {gameWinner === 'B' && <span className="ml-2 text-green-400">✓</span>}
                        </div>
                        <div className="text-gray-400 space-y-0.5">
                          {game.teamBLineup?.map((player) => (
                            <div key={player.id}>{formatPlayerName(player)}</div>
                          ))}
                          {(!game.teamBLineup || game.teamBLineup.length === 0) && (
                            <div className="italic">No lineup</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* If no lineups, just show placeholder */}
                  {!game.teamALineup && !game.teamBLineup && !game.startedAt && (
                    <div className="text-center text-gray-400 text-sm">Game not started</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/80 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
