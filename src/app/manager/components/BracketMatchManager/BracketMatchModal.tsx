'use client';

/**
 * Bracket Match Modal Component
 *
 * Modal dialog for scoring matches when clicked from the bracket diagram.
 * Displays game slots with score inputs and completion button.
 */

import { useState, useEffect } from 'react';

interface Game {
  id: string;
  slot: string;
  bracketId: string | null;
  bracket?: { id: string; name: string } | null;
  teamAScore: number | null;
  teamBScore: number | null;
  isComplete: boolean;
  startedAt: string | null;
}

interface Match {
  id: string;
  teamA: { id: string; name: string } | null;
  teamB: { id: string; name: string } | null;
  seedA: number | null;
  seedB: number | null;
  isBye: boolean;
  winnerId: string | null;
  games: Game[];
}

interface BracketMatchModalProps {
  match: Match | null;
  onClose: () => void;
  onUpdate: () => void;
  onError: (message: string) => void;
  onInfo: (message: string) => void;
}

export function BracketMatchModal({
  match,
  onClose,
  onUpdate,
  onError,
  onInfo,
}: BracketMatchModalProps) {
  const [updating, setUpdating] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (match) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [match, onClose]);

  if (!match) return null;

  const handleScoreUpdate = async (gameId: string, teamAScore: number | null, teamBScore: number | null) => {
    try {
      const response = await fetch(`/api/admin/games/${gameId}/score`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamAScore, teamBScore }),
      });

      if (!response.ok) {
        throw new Error('Failed to update score');
      }

      onUpdate();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to update score');
    }
  };

  const handleCompleteMatch = async () => {
    if (!canCompleteMatch()) {
      onError('All games must be completed before completing the match');
      return;
    }

    try {
      setUpdating(true);

      const response = await fetch(`/api/admin/matches/${match.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to complete match');
      }

      onInfo('Match completed successfully!');
      onUpdate();
      onClose();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to complete match');
    } finally {
      setUpdating(false);
    }
  };

  const canCompleteMatch = () => {
    if (match.isBye) return false;
    if (match.winnerId) return false;
    return match.games.every(g => g.isComplete);
  };

  const getMatchWinner = () => {
    if (match.winnerId === match.teamA?.id) return match.teamA;
    if (match.winnerId === match.teamB?.id) return match.teamB;
    return null;
  };

  const getGameWins = () => {
    let teamAWins = 0;
    let teamBWins = 0;

    for (const game of match.games) {
      if (!game.isComplete) continue;
      if (game.teamAScore === null || game.teamBScore === null) continue;

      if (game.teamAScore > game.teamBScore) {
        teamAWins++;
      } else if (game.teamBScore > game.teamAScore) {
        teamBWins++;
      }
    }

    return { teamAWins, teamBWins };
  };

  const winner = getMatchWinner();
  const { teamAWins, teamBWins } = getGameWins();
  const isComplete = !!match.winnerId;

  // Handle bye matches
  if (match.isBye) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
        <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700" onClick={(e) => e.stopPropagation()}>
          <div className="text-center">
            <h3 className="text-xl font-bold text-white mb-3">BYE Match</h3>
            <p className="text-gray-400">
              {match.teamA?.name || 'TBD'} automatically advances
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Handle TBD teams
  if (!match.teamA || !match.teamB) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
        <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700" onClick={(e) => e.stopPropagation()}>
          <div className="text-center">
            <h3 className="text-xl font-bold text-white mb-3">Match Not Ready</h3>
            <p className="text-gray-400">
              Teams are not determined yet. Complete previous matches first.
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">Score Match v2.0</h3>
            <p className="text-gray-400 text-sm mt-1">
              {match.teamA.name} vs {match.teamB.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Match Score Header */}
          <div className="flex items-center justify-between bg-gray-900 rounded-lg p-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                {match.seedA && (
                  <span className="text-xs font-bold text-gray-400 bg-gray-700 px-2 py-1 rounded">
                    #{match.seedA}
                  </span>
                )}
                <span className={`font-semibold text-lg ${winner?.id === match.teamA.id ? 'text-green-400' : 'text-white'}`}>
                  {match.teamA.name}
                </span>
                {isComplete && (
                  <span className="text-sm text-gray-400 ml-2">
                    ({teamAWins} {teamAWins === 1 ? 'win' : 'wins'})
                  </span>
                )}
              </div>
            </div>

            <span className="text-gray-500 mx-4">vs</span>

            <div className="flex-1 text-right">
              <div className="flex items-center gap-2 justify-end">
                {isComplete && (
                  <span className="text-sm text-gray-400 mr-2">
                    ({teamBWins} {teamBWins === 1 ? 'win' : 'wins'})
                  </span>
                )}
                <span className={`font-semibold text-lg ${winner?.id === match.teamB.id ? 'text-green-400' : 'text-white'}`}>
                  {match.teamB.name}
                </span>
                {match.seedB && (
                  <span className="text-xs font-bold text-gray-400 bg-gray-700 px-2 py-1 rounded">
                    #{match.seedB}
                  </span>
                )}
              </div>
            </div>
          </div>

          {isComplete && (
            <div className="bg-green-900/30 border border-green-500 rounded-lg p-3 text-center">
              <span className="text-green-400 font-semibold">
                ✓ Match Complete - Winner: {winner?.name}
              </span>
            </div>
          )}

          {/* Games */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-400 uppercase">Game Scores</h4>

            {/* Group games by bracket */}
            {(() => {
              // Group games by bracket
              const gamesByBracket: Record<string, Game[]> = {};

              for (const game of match.games) {
                const bracketKey = game.bracket?.name || 'Main';
                if (!gamesByBracket[bracketKey]) {
                  gamesByBracket[bracketKey] = [];
                }
                gamesByBracket[bracketKey].push(game);
              }

              // Render each bracket's games
              return Object.entries(gamesByBracket).map(([bracketName, games]) => (
                <div key={bracketName} className="space-y-2">
                  {/* Only show bracket header if there are multiple brackets */}
                  {Object.keys(gamesByBracket).length > 1 && (
                    <h5 className="text-sm font-semibold text-blue-400 px-1">
                      {bracketName} Bracket
                    </h5>
                  )}
                  <div className="space-y-2">
                    {games.map(game => (
                      <GameScoreEntry
                        key={game.id}
                        game={game}
                        teamAName={match.teamA!.name}
                        teamBName={match.teamB!.name}
                        onScoreUpdate={handleScoreUpdate}
                        disabled={isComplete}
                      />
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>

          {/* Complete Match Button */}
          {!isComplete && (
            <div className="pt-4 border-t border-gray-700">
              <button
                onClick={handleCompleteMatch}
                disabled={!canCompleteMatch() || updating}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-md transition-colors"
              >
                {updating ? 'Completing...' : 'Complete Match & Advance Winner'}
              </button>
              {!canCompleteMatch() && match.games.some(g => !g.isComplete) && (
                <p className="text-xs text-gray-400 mt-2 text-center">
                  Complete all games to finish the match
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GameScoreEntry({
  game,
  teamAName,
  teamBName,
  onScoreUpdate,
  disabled,
}: {
  game: Game;
  teamAName: string;
  teamBName: string;
  onScoreUpdate: (gameId: string, teamAScore: number | null, teamBScore: number | null) => void;
  disabled: boolean;
}) {
  const [teamAScore, setTeamAScore] = useState(game.teamAScore ?? '');
  const [teamBScore, setTeamBScore] = useState(game.teamBScore ?? '');

  // Update local state when game prop changes
  useEffect(() => {
    setTeamAScore(game.teamAScore ?? '');
    setTeamBScore(game.teamBScore ?? '');
  }, [game.teamAScore, game.teamBScore]);

  const getGameTitle = (slot: string) => {
    switch (slot) {
      case 'MENS_DOUBLES': return "Men's Doubles";
      case 'WOMENS_DOUBLES': return "Women's Doubles";
      case 'MIXED_1': return 'Mixed Doubles 1';
      case 'MIXED_2': return 'Mixed Doubles 2';
      case 'TIEBREAKER': return 'Tiebreaker';
      default: return slot;
    }
  };

  const handleScoreChange = (team: 'A' | 'B', value: string) => {
    const score = value === '' ? null : parseInt(value, 10);

    if (team === 'A') {
      setTeamAScore(value);
      onScoreUpdate(game.id, score, teamBScore === '' ? null : parseInt(teamBScore as string, 10));
    } else {
      setTeamBScore(value);
      onScoreUpdate(game.id, teamAScore === '' ? null : parseInt(teamAScore as string, 10), score);
    }
  };

  const getWinnerStyle = () => {
    if (!game.isComplete) return {};
    if (game.teamAScore === null || game.teamBScore === null) return {};

    if (game.teamAScore > game.teamBScore) {
      return { teamA: 'bg-green-600 border-green-500 text-white', teamB: 'bg-gray-700 border-gray-600 text-gray-300' };
    } else if (game.teamBScore > game.teamAScore) {
      return { teamA: 'bg-gray-700 border-gray-600 text-gray-300', teamB: 'bg-green-600 border-green-500 text-white' };
    }
    return {};
  };

  const winnerStyle = getWinnerStyle();

  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-white">
          {getGameTitle(game.slot)}
        </span>
        {game.isComplete && (
          <span className="text-xs text-green-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-400"></span>
            Complete
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Team A Score */}
        <div className="flex-1">
          <label className="block text-xs text-gray-400 mb-1">{teamAName}</label>
          <input
            type="number"
            min="0"
            max="99"
            value={teamAScore}
            onChange={(e) => handleScoreChange('A', e.target.value)}
            disabled={disabled}
            placeholder="-"
            className={`w-full px-3 py-2 text-center text-lg font-semibold rounded border ${
              winnerStyle.teamA || 'bg-gray-800 border-gray-600 text-white'
            } focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`}
          />
        </div>

        <span className="text-gray-500 text-xl mt-5">-</span>

        {/* Team B Score */}
        <div className="flex-1">
          <label className="block text-xs text-gray-400 mb-1">{teamBName}</label>
          <input
            type="number"
            min="0"
            max="99"
            value={teamBScore}
            onChange={(e) => handleScoreChange('B', e.target.value)}
            disabled={disabled}
            placeholder="-"
            className={`w-full px-3 py-2 text-center text-lg font-semibold rounded border ${
              winnerStyle.teamB || 'bg-gray-800 border-gray-600 text-white'
            } focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`}
          />
        </div>
      </div>
    </div>
  );
}
