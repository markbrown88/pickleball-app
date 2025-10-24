'use client';

/**
 * Bracket Match Component
 *
 * Displays a single DE/Club match with bracket-grouped games in 2-column layout
 */

import { useState } from 'react';
import { InlineLineupEditor } from '../shared/InlineLineupEditor';
import { PlayerLite } from '../shared/types';

/**
 * Strip bracket level suffix from team/club name
 * E.g., "Pickleplex 2.5" → "Pickleplex"
 */
function stripBracketSuffix(name: string): string {
  // Remove patterns like " 2.5", " 3.0", " Intermediate", " Advanced", etc.
  return name.replace(/\s+[\d.]+$/, '').replace(/\s+(Intermediate|Advanced|Beginner)$/i, '');
}

/**
 * Shorten a name for display in buttons
 */
function shortenLineupName(name?: string | null): string {
  if (!name) return 'Team';
  return name.length > 18 ? `${name.slice(0, 15)}…` : name;
}

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
  stopId: string;
  lineups: Record<string, Record<string, PlayerLite[]>>;
  teamRosters: Record<string, PlayerLite[]>;
  onUpdate: () => void;
  onError: (message: string) => void;
  onInfo: (message: string) => void;
  onLineupSave: (matchId: string, lineups: { teamA: PlayerLite[]; teamB: PlayerLite[] }) => void;
}

export function BracketMatch({ match, stopId, lineups, teamRosters, onUpdate, onError, onInfo, onLineupSave }: BracketMatchProps) {
  const [updating, setUpdating] = useState(false);
  const [resolvingAction, setResolvingAction] = useState<string | null>(null);
  const [isEditingLineup, setIsEditingLineup] = useState(false);

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

  const cleanTeamAName = stripBracketSuffix(match.teamA.name);
  const cleanTeamBName = stripBracketSuffix(match.teamB.name);

  return (
    <div className="card">
      {/* Match Header - Club Names Only */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4">
        <div>
          <h3 className="text-base font-semibold text-primary">
            {cleanTeamAName} vs {cleanTeamBName}
          </h3>
          <div className="text-xs text-muted mt-1">
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
                {resolvingAction === 'forfeitA' ? 'Processing...' : `Forfeit ${shortenLineupName(cleanTeamAName)}`}
              </button>
              <button
                className="btn btn-xs btn-error flex-1 sm:flex-none"
                disabled={resolvingAction === 'forfeitB'}
                onClick={() => handleForfeit('B')}
              >
                {resolvingAction === 'forfeitB' ? 'Processing...' : `Forfeit ${shortenLineupName(cleanTeamBName)}`}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Total Points Summary */}
      {match.totalPointsTeamA !== null && match.totalPointsTeamB !== null && matchStatus === 'tied' && (
        <div className="bg-surface-2 rounded px-3 py-2 text-sm mb-4">
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

      {/* Lineup Editor or Prompt */}
      {(() => {
        const teamALineup = lineups[match.id]?.[match.teamA.id] || [];
        const teamBLineup = lineups[match.id]?.[match.teamB.id] || [];
        const hasLineups = teamALineup.length === 4 && teamBLineup.length === 4;
        const hasLineupsInGames = match.games.some(g => g.teamALineup && g.teamBLineup);

        // Show lineup editor if editing
        if (isEditingLineup) {
          return (
            <div className="mb-4">
              <InlineLineupEditor
                matchId={match.id}
                stopId={stopId}
                teamA={match.teamA}
                teamB={match.teamB}
                lineups={lineups}
                teamRosters={teamRosters}
                onSave={(savedLineups) => {
                  onLineupSave(match.id, savedLineups);
                  setIsEditingLineup(false);
                }}
                onCancel={() => setIsEditingLineup(false)}
              />
            </div>
          );
        }

        // If no lineups set yet, show button to set them
        if (!hasLineups && !hasLineupsInGames && !isDecided) {
          return (
            <div className="bg-surface-2 rounded-lg p-6 text-center mb-4">
              <p className="text-muted mb-3">Lineups must be set before games can begin</p>
              <button
                className="btn btn-secondary"
                onClick={() => setIsEditingLineup(true)}
              >
                Set Lineups
              </button>
            </div>
          );
        }

        // If lineups exist, show edit button
        if ((hasLineups || hasLineupsInGames) && !isDecided) {
          return (
            <div className="flex justify-center mb-4">
              <button
                className="btn btn-secondary"
                onClick={() => setIsEditingLineup(true)}
              >
                Edit Lineups
              </button>
            </div>
          );
        }

        return null;
      })()}

      {/* Games - Grouped by Bracket Level (only show if lineups are set) */}
      {(() => {
        const teamALineup = lineups[match.id]?.[match.teamA?.id || ''] || [];
        const teamBLineup = lineups[match.id]?.[match.teamB?.id || ''] || [];
        const hasLineups = teamALineup.length === 4 && teamBLineup.length === 4;
        const hasLineupsInGames = match.games.some(g => g.teamALineup && g.teamBLineup);

        if (!hasLineups && !hasLineupsInGames) {
          return null; // Don't show games until lineups are set
        }

        // Group games by bracket
        const gamesByBracket: Record<string, typeof match.games> = {};

        for (const game of match.games) {
          const bracketKey = game.bracket?.name || 'Main';
          if (!gamesByBracket[bracketKey]) {
            gamesByBracket[bracketKey] = [];
          }
          gamesByBracket[bracketKey].push(game);
        }

        // Render games grouped by bracket
        return (
          <div className="space-y-6">
            {Object.entries(gamesByBracket).map(([bracketName, games]) => {
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
            })}
          </div>
        );
      })()}

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
