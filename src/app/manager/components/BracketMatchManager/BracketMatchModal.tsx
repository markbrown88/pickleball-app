'use client';

/**
 * Bracket Match Modal Component
 *
 * Modal dialog for scoring matches when clicked from the bracket diagram.
 * Now displays games in 2-column grid with player lineups, matching the list view.
 */

import { useState, useEffect } from 'react';

/**
 * Strip bracket level suffix from team/club name
 * E.g., "Pickleplex 2.5" → "Pickleplex"
 */
function stripBracketSuffix(name: string): string {
  return name.replace(/\s+[\d.]+$/, '').replace(/\s+(Intermediate|Advanced|Beginner)$/i, '');
}

/**
 * Shorten a name for display in buttons
 */
function shortenLineupName(name?: string | null): string {
  if (!name) return 'Team';
  return name.length > 18 ? `${name.slice(0, 15)}…` : name;
}

interface Game {
  id: string;
  slot: string;
  bracketId: string | null;
  bracket?: { id: string; name: string } | null;
  teamAScore: number | null;
  teamBScore: number | null;
  isComplete: boolean;
  startedAt: string | null;
  teamALineup?: any[];
  teamBLineup?: any[];
}

interface Match {
  id: string;
  teamA: { id: string; name: string } | null;
  teamB: { id: string; name: string } | null;
  seedA: number | null;
  seedB: number | null;
  isBye: boolean;
  winnerId: string | null;
  forfeitTeam?: 'A' | 'B' | null;
  totalPointsTeamA?: number | null;
  totalPointsTeamB?: number | null;
  tiebreakerStatus?: string | null;
  tiebreakerWinnerTeamId?: string | null;
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
  const [resolvingAction, setResolvingAction] = useState<string | null>(null);

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
      onClose();
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

    // Check if there's a clear winner
    const { teamABracketWins, teamBBracketWins } = getBracketWins();
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

  const cleanTeamAName = stripBracketSuffix(match.teamA?.name || '');
  const cleanTeamBName = stripBracketSuffix(match.teamB?.name || '');

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
        className="bg-gray-800 rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto border border-gray-700 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-white">
                {cleanTeamAName} vs {cleanTeamBName}
              </h3>
              <div className="text-sm text-gray-400 mt-1">
                {teamABracketWins} - {teamBBracketWins} (Brackets Won)
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Match Status Badge */}
          {isDecided && (
            <div className="text-xs font-semibold px-2 py-1 bg-success/20 text-success rounded inline-block">
              ✓ Complete
            </div>
          )}

          {/* Manager Actions */}
          {!isDecided && (
            <div className="flex flex-wrap gap-2 mt-4">
              {matchStatus === 'tied' && (
                <>
                  <button
                    className="btn btn-xs btn-secondary"
                    disabled={resolvingAction === 'points'}
                    onClick={handleDecideByPoints}
                  >
                    {resolvingAction === 'points' ? 'Resolving...' : 'Decide by Points'}
                  </button>
                  <button
                    className="btn btn-xs btn-primary"
                    disabled={resolvingAction === 'tiebreaker'}
                    onClick={handleScheduleTiebreaker}
                  >
                    {resolvingAction === 'tiebreaker' ? 'Creating...' : 'Add Tiebreaker'}
                  </button>
                </>
              )}
              <button
                className="btn btn-xs btn-error"
                disabled={resolvingAction === 'forfeitA'}
                onClick={() => handleForfeit('A')}
              >
                {resolvingAction === 'forfeitA' ? 'Processing...' : `Forfeit ${shortenLineupName(cleanTeamAName)}`}
              </button>
              <button
                className="btn btn-xs btn-error"
                disabled={resolvingAction === 'forfeitB'}
                onClick={() => handleForfeit('B')}
              >
                {resolvingAction === 'forfeitB' ? 'Processing...' : `Forfeit ${shortenLineupName(cleanTeamBName)}`}
              </button>
            </div>
          )}

          {/* Total Points Summary */}
          {match.totalPointsTeamA !== null && match.totalPointsTeamB !== null && matchStatus === 'tied' && (
            <div className="bg-surface-2 rounded px-3 py-2 text-sm mt-4">
              <div className="flex justify-between items-center gap-4">
                <div className="flex-1">
                  <div className="text-muted text-xs mb-1">Total Points:</div>
                  <div className="font-semibold">{cleanTeamAName}: <span className="text-success">{match.totalPointsTeamA}</span></div>
                </div>
                <div className="flex-1 text-right">
                  <div className="text-muted text-xs mb-1">Total Points:</div>
                  <div className="font-semibold">{cleanTeamBName}: <span className="text-success">{match.totalPointsTeamB}</span></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content - Games by Bracket */}
        <div className="p-6 space-y-6">
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
          <div className="border-t border-gray-700 p-6">
            <button
              onClick={handleCompleteMatch}
              disabled={updating}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-md transition-colors"
            >
              {updating ? 'Completing...' : 'Complete Match & Advance Winner'}
            </button>
          </div>
        )}
      </div>
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
  game: Game;
  teamAName: string;
  teamBName: string;
  onScoreUpdate: (gameId: string, teamAScore: number | null, teamBScore: number | null) => void;
  disabled: boolean;
}) {
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

  const getTeamALineup = () => {
    if (game.teamALineup && Array.isArray(game.teamALineup)) {
      const man1 = game.teamALineup[0];
      const man2 = game.teamALineup[1];
      const woman1 = game.teamALineup[2];
      const woman2 = game.teamALineup[3];

      switch (game.slot) {
        case 'MENS_DOUBLES':
          return man1 && man2 ? `${man1.name} &\n${man2.name}` : stripBracketSuffix(teamAName);
        case 'WOMENS_DOUBLES':
          return woman1 && woman2 ? `${woman1.name} &\n${woman2.name}` : stripBracketSuffix(teamAName);
        case 'MIXED_1':
          return man1 && woman1 ? `${man1.name} &\n${woman1.name}` : stripBracketSuffix(teamAName);
        case 'MIXED_2':
          return man2 && woman2 ? `${man2.name} &\n${woman2.name}` : stripBracketSuffix(teamAName);
        case 'TIEBREAKER':
          return stripBracketSuffix(teamAName);
        default:
          return stripBracketSuffix(teamAName);
      }
    }
    return stripBracketSuffix(teamAName);
  };

  const getTeamBLineup = () => {
    if (game.teamBLineup && Array.isArray(game.teamBLineup)) {
      const man1 = game.teamBLineup[0];
      const man2 = game.teamBLineup[1];
      const woman1 = game.teamBLineup[2];
      const woman2 = game.teamBLineup[3];

      switch (game.slot) {
        case 'MENS_DOUBLES':
          return man1 && man2 ? `${man1.name} &\n${man2.name}` : stripBracketSuffix(teamBName);
        case 'WOMENS_DOUBLES':
          return woman1 && woman2 ? `${woman1.name} &\n${woman2.name}` : stripBracketSuffix(teamBName);
        case 'MIXED_1':
          return man1 && woman1 ? `${man1.name} &\n${woman1.name}` : stripBracketSuffix(teamBName);
        case 'MIXED_2':
          return man2 && woman2 ? `${man2.name} &\n${woman2.name}` : stripBracketSuffix(teamBName);
        case 'TIEBREAKER':
          return stripBracketSuffix(teamBName);
        default:
          return stripBracketSuffix(teamBName);
      }
    }
    return stripBracketSuffix(teamBName);
  };

  const teamAScore = game.teamAScore || 0;
  const teamBScore = game.teamBScore || 0;
  const teamAWon = teamAScore > teamBScore;
  const teamBWon = teamBScore > teamAScore;
  const isCompleted = game.isComplete;

  return (
    <div className={`rounded-lg border-2 overflow-hidden ${
      isCompleted ? 'border-border-subtle bg-surface-1' : 'border-border-medium bg-surface-2'
    }`}>
      {/* Game Header */}
      <div className={`px-4 py-2 flex items-center justify-between ${
        isCompleted ? 'bg-surface-2' : 'bg-surface-1'
      }`}>
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-primary">{getGameTitle(game.slot)}</h4>
          {isCompleted && (
            <span className="chip chip-success text-[10px] px-2 py-0.5">Complete</span>
          )}
        </div>
      </div>

      {/* Game Body - Players and Scores */}
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
          {/* Team A Side */}
          <div className={`text-sm ${
            isCompleted && teamAWon ? 'text-success font-semibold' : 'text-secondary'
          }`}>
            <div className="whitespace-pre-line leading-relaxed">{getTeamALineup()}</div>
          </div>

          {/* Scores */}
          <div className="flex items-center gap-3">
            {isCompleted ? (
              <>
                <div className={`text-2xl font-bold tabular ${
                  teamAWon ? 'text-success' : 'text-muted'
                }`}>
                  {teamAScore}
                </div>
                <div className="text-muted font-medium">-</div>
                <div className={`text-2xl font-bold tabular ${
                  teamBWon ? 'text-success' : 'text-muted'
                }`}>
                  {teamBScore}
                </div>
              </>
            ) : (
              <>
                <input
                  type="number"
                  min="0"
                  max="99"
                  className="w-16 px-2 py-2 text-xl font-bold border-2 border-border-medium rounded-lg text-center bg-surface-1 focus:border-secondary focus:outline-none tabular [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={teamAScore || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 99)) {
                      onScoreUpdate(game.id, value ? parseInt(value) : null, teamBScore || null);
                    }
                  }}
                  disabled={disabled}
                  placeholder="0"
                />
                <div className="text-muted font-medium">-</div>
                <input
                  type="number"
                  min="0"
                  max="99"
                  className="w-16 px-2 py-2 text-xl font-bold border-2 border-border-medium rounded-lg text-center bg-surface-1 focus:border-secondary focus:outline-none tabular [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={teamBScore || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 99)) {
                      onScoreUpdate(game.id, teamAScore || null, value ? parseInt(value) : null);
                    }
                  }}
                  disabled={disabled}
                  placeholder="0"
                />
              </>
            )}
          </div>

          {/* Team B Side */}
          <div className={`text-sm text-right ${
            isCompleted && teamBWon ? 'text-success font-semibold' : 'text-secondary'
          }`}>
            <div className="whitespace-pre-line leading-relaxed">{getTeamBLineup()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
