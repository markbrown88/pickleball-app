'use client';

/**
 * Bracket Match Component
 *
 * Displays a single match in a bracket with score entry and completion.
 */

import { useState } from 'react';

interface BracketMatchProps {
  match: {
    id: string;
    teamA: { id: string; name: string } | null;
    teamB: { id: string; name: string } | null;
    seedA: number | null;
    seedB: number | null;
    isBye: boolean;
    winnerId: string | null;
    games: Array<{
      id: string;
      slot: string;
      teamAScore: number | null;
      teamBScore: number | null;
      isComplete: boolean;
      startedAt: string | null;
    }>;
  };
  onUpdate: () => void;
  onError: (message: string) => void;
  onInfo: (message: string) => void;
}

export function BracketMatch({ match, onUpdate, onError, onInfo }: BracketMatchProps) {
  const [updating, setUpdating] = useState(false);

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

  const getGameTitle = (slot: string) => {
    switch (slot) {
      case 'MENS_DOUBLES': return "Men's Doubles";
      case 'WOMENS_DOUBLES': return "Women's Doubles";
      case 'MIXED_1': return 'Mixed 1';
      case 'MIXED_2': return 'Mixed 2';
      case 'TIEBREAKER': return 'Tiebreaker';
      default: return slot;
    }
  };

  const winner = getMatchWinner();
  const { teamAWins, teamBWins } = getGameWins();
  const isComplete = !!match.winnerId;

  // Handle bye matches
  if (match.isBye) {
    return (
      <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {match.seedA && (
                <span className="text-xs font-bold text-gray-400 bg-gray-600 px-2 py-1 rounded">
                  #{match.seedA}
                </span>
              )}
              <span className="font-semibold text-white">
                {match.teamA?.name || 'TBD'}
              </span>
            </div>
          </div>
          <span className="text-sm text-gray-400 italic">BYE - Auto advance</span>
        </div>
      </div>
    );
  }

  // Handle TBD teams
  if (!match.teamA || !match.teamB) {
    return (
      <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
        <div className="text-center text-gray-400 italic">
          Match pending - Teams TBD
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-700 rounded-lg p-4 border ${isComplete ? 'border-green-500' : 'border-gray-600'}`}>
      {/* Match Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Team A */}
          <div className="flex items-center gap-2">
            {match.seedA && (
              <span className="text-xs font-bold text-gray-400 bg-gray-600 px-2 py-1 rounded">
                #{match.seedA}
              </span>
            )}
            <span className={`font-semibold ${winner?.id === match.teamA.id ? 'text-green-400' : 'text-white'}`}>
              {match.teamA.name}
            </span>
            {isComplete && (
              <span className="text-sm text-gray-400">
                ({teamAWins})
              </span>
            )}
          </div>

          <span className="text-gray-500">vs</span>

          {/* Team B */}
          <div className="flex items-center gap-2">
            {match.seedB && (
              <span className="text-xs font-bold text-gray-400 bg-gray-600 px-2 py-1 rounded">
                #{match.seedB}
              </span>
            )}
            <span className={`font-semibold ${winner?.id === match.teamB.id ? 'text-green-400' : 'text-white'}`}>
              {match.teamB.name}
            </span>
            {isComplete && (
              <span className="text-sm text-gray-400">
                ({teamBWins})
              </span>
            )}
          </div>
        </div>

        {isComplete && (
          <span className="text-green-400 text-sm font-medium">
            ✓ Complete
          </span>
        )}
      </div>

      {/* Games */}
      <div className="space-y-2">
        {match.games.map(game => (
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

      {/* Complete Match Button */}
      {!isComplete && (
        <div className="mt-3 pt-3 border-t border-gray-600">
          <button
            onClick={handleCompleteMatch}
            disabled={!canCompleteMatch() || updating}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-md transition-colors"
          >
            {updating ? 'Completing...' : 'Complete Match & Advance Winner'}
          </button>
        </div>
      )}
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
  game: any;
  teamAName: string;
  teamBName: string;
  onScoreUpdate: (gameId: string, teamAScore: number | null, teamBScore: number | null) => void;
  disabled: boolean;
}) {
  const [teamAScore, setTeamAScore] = useState(game.teamAScore ?? '');
  const [teamBScore, setTeamBScore] = useState(game.teamBScore ?? '');

  const getGameTitle = (slot: string) => {
    switch (slot) {
      case 'MENS_DOUBLES': return "MD";
      case 'WOMENS_DOUBLES': return "WD";
      case 'MIXED_1': return 'MX1';
      case 'MIXED_2': return 'MX2';
      case 'TIEBREAKER': return 'TB';
      default: return slot;
    }
  };

  const handleScoreChange = (team: 'A' | 'B', value: string) => {
    const score = value === '' ? null : parseInt(value, 10);

    if (team === 'A') {
      setTeamAScore(value);
      onScoreUpdate(game.id, score, teamBScore === '' ? null : parseInt(teamBScore, 10));
    } else {
      setTeamBScore(value);
      onScoreUpdate(game.id, teamAScore === '' ? null : parseInt(teamAScore, 10), score);
    }
  };

  const getWinnerStyle = () => {
    if (!game.isComplete) return {};
    if (game.teamAScore === null || game.teamBScore === null) return {};

    if (game.teamAScore > game.teamBScore) {
      return { teamA: 'bg-green-600 text-white', teamB: 'bg-gray-600 text-gray-300' };
    } else if (game.teamBScore > game.teamAScore) {
      return { teamA: 'bg-gray-600 text-gray-300', teamB: 'bg-green-600 text-white' };
    }
    return {};
  };

  const winnerStyle = getWinnerStyle();

  return (
    <div className="flex items-center gap-2 bg-gray-800 rounded p-2">
      <span className="text-xs font-semibold text-gray-400 w-10">
        {getGameTitle(game.slot)}
      </span>

      <div className="flex-1 flex items-center gap-2">
        <input
          type="number"
          min="0"
          max="99"
          value={teamAScore}
          onChange={(e) => handleScoreChange('A', e.target.value)}
          disabled={disabled}
          placeholder="-"
          className={`w-16 px-2 py-1 text-center rounded border ${
            winnerStyle.teamA || 'bg-gray-700 border-gray-600 text-white'
          } focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`}
        />

        <span className="text-gray-500 text-sm">-</span>

        <input
          type="number"
          min="0"
          max="99"
          value={teamBScore}
          onChange={(e) => handleScoreChange('B', e.target.value)}
          disabled={disabled}
          placeholder="-"
          className={`w-16 px-2 py-1 text-center rounded border ${
            winnerStyle.teamB || 'bg-gray-700 border-gray-600 text-white'
          } focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`}
        />
      </div>

      {game.isComplete && (
        <span className="text-xs text-green-400">✓</span>
      )}
    </div>
  );
}
