'use client';

/**
 * Bracket Match Component
 *
 * Displays a single DE/Club match with bracket-grouped games in 2-column layout
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
    forfeitTeam: 'A' | 'B' | null;
    totalPointsTeamA: number | null;
    totalPointsTeamB: number | null;
    tiebreakerStatus: string | null;
    tiebreakerWinnerTeamId: string | null;
    games: Array<{
      id: string;
      slot: string;
      bracketId?: string | null;
      bracket?: { id: string; name: string } | null;
      teamAScore: number | null;
      teamBScore: number | null;
      isComplete: boolean;
      startedAt: string | null;
      teamALineup?: any[];
      teamBLineup?: any[];
    }>;
  };
  onUpdate: () => void;
  onError: (message: string) => void;
  onInfo: (message: string) => void;
}

export function BracketMatch({ match, onUpdate, onError, onInfo }: BracketMatchProps) {
  const [updating, setUpdating] = useState(false);
  const [resolvingAction, setResolvingAction] = useState<string | null>(null);

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
      onError('Match cannot be completed yet');
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

  const handleDecideByPoints = async () => {
    const confirmMessage = `Confirm using total points to decide ${match.teamA?.name} vs ${match.teamB?.name}?`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setResolvingAction('points');

      const response = await fetch(`/api/admin/matches/${match.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decideByPoints: true }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to decide match by points');
      }

      onInfo('Match decided by total points');
      onUpdate();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to decide match by points');
    } finally {
      setResolvingAction(null);
    }
  };

  const handleScheduleTiebreaker = async () => {
    try {
      setResolvingAction('tiebreaker');
      const response = await fetch(`/api/admin/matches/${match.id}/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          games: [
            {
              slot: 'TIEBREAKER',
              teamAScore: null,
              teamBScore: null,
              teamALineup: null,
              teamBLineup: null,
              lineupConfirmed: false,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to schedule tiebreaker');
      }

      onInfo('Tiebreaker game created');
      onUpdate();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to schedule tiebreaker');
    } finally {
      setResolvingAction(null);
    }
  };

  const handleForfeit = async (forfeitTeam: 'A' | 'B') => {
    const forfeitingTeamName = forfeitTeam === 'A' ? (match.teamA?.name || 'Team A') : (match.teamB?.name || 'Team B');
    const winningTeamName = forfeitTeam === 'A' ? (match.teamB?.name || 'Team B') : (match.teamA?.name || 'Team A');

    const confirmMessage = `${forfeitingTeamName} will forfeit to ${winningTeamName}. Continue?`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setResolvingAction(`forfeit${forfeitTeam}`);

      const response = await fetch(`/api/admin/matches/${match.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forfeitTeam }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to forfeit match');
      }

      onInfo(`${forfeitingTeamName} forfeited. ${winningTeamName} wins.`);
      onUpdate();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to forfeit match');
    } finally {
      setResolvingAction(null);
    }
  };

  const canCompleteMatch = () => {
    if (match.isBye) return false;
    if (match.winnerId) return false;

    // For club tournaments, need at least 8 games completed (4 slots × 2 brackets)
    const completedGames = match.games.filter(g => g.isComplete).length;
    if (completedGames < 8) return false;

    // Check if there's a clear winner (more than 4 wins for one club)
    const { teamABracketWins, teamBBracketWins } = getBracketWins();

    // Need at least one club to win both brackets or decide via tiebreaker/points
    return teamABracketWins >= 2 || teamBBracketWins >= 2 || match.tiebreakerWinnerTeamId !== null;
  };

  const getBracketWins = () => {
    const bracketsByName: Record<string, { teamAWins: number; teamBWins: number }> = {};

    for (const game of match.games) {
      if (!game.isComplete) continue;
      if (game.teamAScore === null || game.teamBScore === null) continue;

      const bracketName = game.bracket?.name || 'Main';
      if (!bracketsByName[bracketName]) {
        bracketsByName[bracketName] = { teamAWins: 0, teamBWins: 0 };
      }

      if (game.teamAScore > game.teamBScore) {
        bracketsByName[bracketName].teamAWins++;
      } else if (game.teamBScore > game.teamAScore) {
        bracketsByName[bracketName].teamBWins++;
      }
    }

    let teamABracketWins = 0;
    let teamBBracketWins = 0;

    for (const bracket of Object.values(bracketsByName)) {
      if (bracket.teamAWins > bracket.teamBWins) {
        teamABracketWins++;
      } else if (bracket.teamBWins > bracket.teamAWins) {
        teamBBracketWins++;
      }
    }

    return { teamABracketWins, teamBBracketWins, bracketsByName };
  };

  const getMatchStatus = () => {
    if (match.forfeitTeam) return 'decided';
    if (match.winnerId) return 'decided';
    if (match.tiebreakerWinnerTeamId) return 'decided';

    const { teamABracketWins, teamBBracketWins } = getBracketWins();
    const completedGames = match.games.filter(g => g.isComplete).length;

    if (completedGames < 8) return 'in_progress';
    if (teamABracketWins === teamBBracketWins && teamABracketWins > 0) return 'tied';
    if (teamABracketWins >= 2 || teamBBracketWins >= 2) return 'ready_to_complete';

    return 'in_progress';
  };

  const { teamABracketWins, teamBBracketWins } = getBracketWins();
  const matchStatus = getMatchStatus();
  const isDecided = matchStatus === 'decided';

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
    <div className={`bg-gray-700 rounded-lg p-6 border ${isDecided ? 'border-green-500' : 'border-gray-600'}`}>
      {/* Match Header - Club Names Only */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4">
        <div>
          <h3 className="text-base font-semibold text-white">
            {match.teamA.name} vs {match.teamB.name}
          </h3>
          <div className="text-xs text-gray-400 mt-1">
            {teamABracketWins} - {teamBBracketWins} (Brackets Won)
          </div>
        </div>

        {/* Match Status Badge */}
        {isDecided && (
          <div className="text-xs font-semibold px-2 py-1 bg-success/20 text-success rounded">
            ✓ Complete
          </div>
        )}

        {/* Manager Actions */}
        {!isDecided && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 w-full sm:w-auto">
            {matchStatus === 'tied' && (
              <>
                <button
                  className="btn btn-xs btn-secondary flex-1 sm:flex-none"
                  disabled={resolvingAction === 'points'}
                  onClick={handleDecideByPoints}
                >
                  {resolvingAction === 'points' ? 'Resolving...' : 'Decide by Points'}
                </button>
                <button
                  className="btn btn-xs btn-primary flex-1 sm:flex-none"
                  disabled={resolvingAction === 'tiebreaker'}
                  onClick={handleScheduleTiebreaker}
                >
                  {resolvingAction === 'tiebreaker' ? 'Creating...' : 'Add Tiebreaker'}
                </button>
              </>
            )}
            <div className="flex gap-2 flex-1 sm:flex-none">
              <button
                className="btn btn-xs btn-error flex-1 sm:flex-none"
                disabled={resolvingAction === 'forfeitA'}
                onClick={() => handleForfeit('A')}
              >
                {resolvingAction === 'forfeitA' ? 'Processing...' : `Forfeit ${match.teamA.name}`}
              </button>
              <button
                className="btn btn-xs btn-error flex-1 sm:flex-none"
                disabled={resolvingAction === 'forfeitB'}
                onClick={() => handleForfeit('B')}
              >
                {resolvingAction === 'forfeitB' ? 'Processing...' : `Forfeit ${match.teamB.name}`}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Total Points Summary */}
      {match.totalPointsTeamA !== null && match.totalPointsTeamB !== null && matchStatus === 'tied' && (
        <div className="bg-gray-600 rounded px-3 py-2 text-sm mb-4">
          <div className="flex justify-between items-center gap-4">
            <div className="flex-1">
              <div className="text-gray-300 text-xs mb-1">Total Points:</div>
              <div className="font-semibold text-white">{match.teamA.name}: <span className="text-green-400">{match.totalPointsTeamA}</span></div>
            </div>
            <div className="flex-1 text-right">
              <div className="text-gray-300 text-xs mb-1">Total Points:</div>
              <div className="font-semibold text-white">{match.teamB.name}: <span className="text-green-400">{match.totalPointsTeamB}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Games - Grouped by Bracket Level */}
      <div className="space-y-6">
        {(() => {
          // Group games by bracket
          const gamesByBracket: Record<string, typeof match.games> = {};

          for (const game of match.games) {
            const bracketKey = game.bracket?.name || 'Main';
            if (!gamesByBracket[bracketKey]) {
              gamesByBracket[bracketKey] = [];
            }
            gamesByBracket[bracketKey].push(game);
          }

          // Render each bracket's games
          return Object.entries(gamesByBracket).map(([bracketName, games]) => {
            // Calculate bracket winner
            let teamAWins = 0;
            let teamBWins = 0;
            for (const game of games) {
              if (game.isComplete && game.teamAScore !== null && game.teamBScore !== null) {
                if (game.teamAScore > game.teamBScore) teamAWins++;
                else if (game.teamBScore > game.teamAScore) teamBWins++;
              }
            }

            return (
              <div key={bracketName}>
                {/* Bracket Header */}
                {Object.keys(gamesByBracket).length > 1 && (
                  <h4 className="text-sm font-semibold text-blue-400 mb-3">
                    {bracketName} Bracket ({teamAWins} - {teamBWins})
                  </h4>
                )}

                {/* Games in 2-column grid */}
                <div className="grid gap-4 lg:grid-cols-2">
                  {games.map(game => (
                    <GameScoreCard
                      key={game.id}
                      game={game}
                      teamAName={match.teamA!.name}
                      teamBName={match.teamB!.name}
                      onScoreUpdate={handleScoreUpdate}
                      disabled={isDecided}
                    />
                  ))}
                </div>
              </div>
            );
          });
        })()}
      </div>

      {/* Complete Match Button */}
      {!isDecided && canCompleteMatch() && (
        <div className="mt-4 pt-4">
          <button
            onClick={handleCompleteMatch}
            disabled={updating}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-md transition-colors"
          >
            {updating ? 'Completing...' : 'Complete Match & Advance Winner'}
          </button>
        </div>
      )}
    </div>
  );
}

function GameScoreCard({
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
      onScoreUpdate(game.id, score, teamBScore === '' ? null : parseInt(teamBScore, 10));
    } else {
      setTeamBScore(value);
      onScoreUpdate(game.id, teamAScore === '' ? null : parseInt(teamAScore, 10), score);
    }
  };

  const teamAWon = game.isComplete && game.teamAScore !== null && game.teamBScore !== null && game.teamAScore > game.teamBScore;
  const teamBWon = game.isComplete && game.teamAScore !== null && game.teamBScore !== null && game.teamBScore > game.teamAScore;

  return (
    <div className={`bg-gray-800 rounded-lg p-4 border ${game.isComplete ? 'border-green-500/50' : 'border-gray-600'}`}>
      {/* Game Title */}
      <div className="flex items-center justify-between mb-3">
        <h5 className="text-sm font-semibold text-gray-200">{getGameTitle(game.slot)}</h5>
        {game.isComplete && (
          <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">COMPLETE</span>
        )}
      </div>

      {/* Team A Players & Score */}
      <div className={`flex items-center justify-between p-3 rounded mb-2 ${teamAWon ? 'bg-green-600/20' : 'bg-gray-700'}`}>
        <div className="flex-1">
          <div className="text-sm font-semibold text-white mb-1">{teamAName}</div>
          {game.teamALineup && game.teamALineup.length > 0 && (
            <div className="text-xs text-gray-300">
              {game.teamALineup.map((p: any, idx: number) => (
                <div key={idx}>{p.name}</div>
              ))}
            </div>
          )}
        </div>
        <input
          type="number"
          min="0"
          max="99"
          value={teamAScore}
          onChange={(e) => handleScoreChange('A', e.target.value)}
          disabled={disabled}
          placeholder="-"
          className="w-16 px-2 py-1 text-center rounded border bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ml-3"
        />
      </div>

      {/* Team B Players & Score */}
      <div className={`flex items-center justify-between p-3 rounded ${teamBWon ? 'bg-green-600/20' : 'bg-gray-700'}`}>
        <div className="flex-1">
          <div className="text-sm font-semibold text-white mb-1">{teamBName}</div>
          {game.teamBLineup && game.teamBLineup.length > 0 && (
            <div className="text-xs text-gray-300">
              {game.teamBLineup.map((p: any, idx: number) => (
                <div key={idx}>{p.name}</div>
              ))}
            </div>
          )}
        </div>
        <input
          type="number"
          min="0"
          max="99"
          value={teamBScore}
          onChange={(e) => handleScoreChange('B', e.target.value)}
          disabled={disabled}
          placeholder="-"
          className="w-16 px-2 py-1 text-center rounded border bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ml-3"
        />
      </div>
    </div>
  );
}
