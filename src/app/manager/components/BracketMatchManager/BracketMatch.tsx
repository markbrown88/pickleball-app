'use client';

/**
 * Bracket Match Component
 *
 * Displays a single DE/Club match with bracket-grouped games in 2-column layout
 */

import { useState, useCallback, useEffect } from 'react';
import { InlineLineupEditor } from '../shared/InlineLineupEditor';
import { BracketLineupEditor } from './BracketLineupEditor';
import { PlayerLite } from '../shared/types';
import { GameScoreBox } from '../shared/GameScoreBox';
import { useGameControls } from '../../hooks/useGameControls';

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
    teamA: { id: string; name: string; club?: { name: string } | null } | null;
    teamB: { id: string; name: string; club?: { name: string } | null } | null;
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
  roundId: string;
  stopId: string;
  tournamentType: string;
  lineups: Record<string, Record<string, PlayerLite[]>>; // matchId -> teamId -> players
  teamRosters: Record<string, PlayerLite[]>;
  onUpdate: () => void;
  onError: (message: string) => void;
  onInfo: (message: string) => void;
  onLineupSave: (matchId: string, lineupData: { teamA: PlayerLite[]; teamB: PlayerLite[] }, teamAId: string, teamBId: string) => void;
}

export function BracketMatch({ match, roundId, stopId, tournamentType, lineups, teamRosters, onUpdate, onError, onInfo, onLineupSave }: BracketMatchProps) {
  const [updating, setUpdating] = useState(false);
  const [resolvingAction, setResolvingAction] = useState<string | null>(null);
  const [isEditingLineup, setIsEditingLineup] = useState(false);
  const [localGames, setLocalGames] = useState(match.games);
  const [bracketTeams, setBracketTeams] = useState<Record<string, { teamA: { id: string; name: string }; teamB: { id: string; name: string } }>>({});
  const [loadingBracketTeams, setLoadingBracketTeams] = useState(false);

  // Sync localGames when match.games updates
  useEffect(() => {
    setLocalGames(match.games);
  }, [match.games]);

  // Use shared game controls hook
  const gameControls = useGameControls({ onError, onUpdate });

  // Fetch bracket-specific teams for DE Clubs tournaments
  const loadBracketTeams = useCallback(async () => {
    if (!match.teamA || !match.teamB) return;

    setLoadingBracketTeams(true);
    try {
      // Fetch all teams for this stop
      const response = await fetch(`/api/admin/stops/${stopId}/teams`);
      if (!response.ok) {
        throw new Error('Failed to load teams');
      }

      const stopTeamsData = await response.json();

      // First, find the current match teams in the full data to get their club IDs
      const matchTeamAData = stopTeamsData.find((st: any) => st.team.id === match.teamA!.id);
      const matchTeamBData = stopTeamsData.find((st: any) => st.team.id === match.teamB!.id);

      if (!matchTeamAData || !matchTeamBData) {
        console.error('Could not find match teams in stop teams data');
        return;
      }

      const teamAClubId = matchTeamAData.team.clubId;
      const teamBClubId = matchTeamBData.team.clubId;

      console.log('[BracketMatch] Loading bracket teams:', {
        teamAClubId,
        teamBClubId,
        matchTeamA: match.teamA.name,
        matchTeamB: match.teamB.name,
      });

      // Build a map of bracketId -> { teamA, teamB }
      const teamsMap: Record<string, { teamA: { id: string; name: string }; teamB: { id: string; name: string } }> = {};

      // Group all brackets from games
      const bracketIds = new Set(localGames.filter(g => g.bracketId).map(g => g.bracketId!));

      bracketIds.forEach(bracketId => {
        // Find teams for this bracket that belong to the same clubs (by club ID)
        const teamA = stopTeamsData.find((st: any) =>
          st.team.bracketId === bracketId && st.team.clubId === teamAClubId
        );

        const teamB = stopTeamsData.find((st: any) =>
          st.team.bracketId === bracketId && st.team.clubId === teamBClubId
        );

        if (teamA && teamB) {
          console.log(`[BracketMatch] Found teams for bracket ${bracketId}:`, {
            teamA: teamA.team.name,
            teamB: teamB.team.name,
          });
          teamsMap[bracketId] = {
            teamA: { id: teamA.team.id, name: teamA.team.name },
            teamB: { id: teamB.team.id, name: teamB.team.name },
          };
        } else {
          console.warn(`[BracketMatch] Could not find teams for bracket ${bracketId}`);
        }
      });

      setBracketTeams(teamsMap);
    } catch (error) {
      console.error('Error loading bracket teams:', error);
      onError('Failed to load bracket teams');
    } finally {
      setLoadingBracketTeams(false);
    }
  }, [match.teamA, match.teamB, stopId, localGames, onError]);

  // Game control functions for GameScoreBox
  const startGame = useCallback(async (gameId: string) => {
    try {
      const updatedGame = await gameControls.startGame(gameId);

      // Update local state optimistically
      setLocalGames(prev => prev.map(g =>
        g.id === gameId
          ? { ...g, startedAt: new Date().toISOString(), isComplete: false }
          : g
      ));
    } catch (error) {
      // Error already handled by hook
    }
  }, [gameControls]);

  const endGame = useCallback(async (gameId: string) => {
    try {
      const game = localGames.find(g => g.id === gameId);
      if (!game) return;

      const updatedGame = await gameControls.endGame(gameId, game.teamAScore || 0, game.teamBScore || 0);

      if (updatedGame) {
        // Update local state optimistically
        setLocalGames(prev => prev.map(g =>
          g.id === gameId
            ? { ...g, isComplete: true, endedAt: new Date().toISOString() }
            : g
        ));

        // Re-evaluate match after game completes - trigger server-side recalculation
        // and check if tiebreaker should be deleted
        setTimeout(() => {
          onUpdate();
        }, 600);
      }
    } catch (error) {
      // Error already handled by hook
    }
  }, [gameControls, localGames, onUpdate]);

  const reopenGame = useCallback(async (gameId: string) => {
    try {
      const updatedGame = await gameControls.reopenGame(gameId);

      if (updatedGame) {
        // Update local state optimistically
        setLocalGames(prev => prev.map(g =>
          g.id === gameId
            ? { ...g, isComplete: false, endedAt: null }
            : g
        ));

        // Re-evaluate match after reopening - trigger server-side recalculation
        // Server will delete tiebreaker if match is no longer tied
        setTimeout(() => {
          onUpdate();
        }, 600);
      }
    } catch (error) {
      // Error already handled by hook
    }
  }, [gameControls, onUpdate]);

  const updateGameScore = useCallback(async (gameId: string, teamAScore: number | null, teamBScore: number | null) => {
    // Update local state immediately (optimistic update)
    setLocalGames(prev => prev.map(g =>
      g.id === gameId
        ? { ...g, teamAScore, teamBScore }
        : g
    ));

    // Debounced API call handled by hook
    await gameControls.updateScore(gameId, teamAScore, teamBScore);
  }, [gameControls]);

  const updateGameCourtNumber = useCallback(async (gameId: string, courtNumber: string) => {
    const courtNum = courtNumber ? parseInt(courtNumber, 10) : null;

    // Update local state immediately (optimistic update)
    setLocalGames(prev => prev.map(g =>
      g.id === gameId
        ? { ...g, courtNumber: courtNum }
        : g
    ));

    await gameControls.updateCourtNumber(gameId, courtNum);
  }, [gameControls]);

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

  const getGameWins = () => {
    let teamAGameWins = 0;
    let teamBGameWins = 0;

    for (const game of localGames) {
      if (!game.isComplete) continue;
      
      // For completed games, treat null scores as 0
      // This handles cases where a game was marked complete but scores weren't fully saved
      const teamAScore = game.teamAScore ?? 0;
      const teamBScore = game.teamBScore ?? 0;
      
      // If both scores are null/0, skip (shouldn't happen for completed games, but handle gracefully)
      if (teamAScore === null && teamBScore === null) continue;

      if (teamAScore > teamBScore) {
        teamAGameWins++;
      } else if (teamBScore > teamAScore) {
        teamBGameWins++;
      }
    }

    // Also track brackets for display purposes (games are grouped by bracket)
    const bracketsByName: Record<string, { teamAWins: number; teamBWins: number }> = {};
    for (const game of localGames) {
      if (!game.isComplete) continue;
      
      // Treat null scores as 0 for completed games
      const teamAScore = game.teamAScore ?? 0;
      const teamBScore = game.teamBScore ?? 0;
      
      if (teamAScore === null && teamBScore === null) continue;

      const bracketName = game.bracket?.name || 'Main';
      if (!bracketsByName[bracketName]) {
        bracketsByName[bracketName] = { teamAWins: 0, teamBWins: 0 };
      }

      if (teamAScore > teamBScore) {
        bracketsByName[bracketName].teamAWins++;
      } else if (teamBScore > teamAScore) {
        bracketsByName[bracketName].teamBWins++;
      }
    }

    return { teamAGameWins, teamBGameWins, bracketsByName };
  };

  const getMatchStatus = () => {
    if (match.forfeitTeam) return 'decided';
    if (match.winnerId) return 'decided';
    if (match.tiebreakerWinnerTeamId) return 'decided';

    const { teamAGameWins, teamBGameWins, bracketsByName } = getGameWins();
    const bracketCount = Object.keys(bracketsByName).length;
    const totalExpectedGames = bracketCount * 4;
    const majority = Math.ceil(totalExpectedGames / 2);

    const completedGames = localGames.filter(g => g.isComplete).length;

    if (completedGames < totalExpectedGames) return 'in_progress';
    if (teamAGameWins === teamBGameWins && teamAGameWins > 0) return 'tied';
    if (teamAGameWins >= majority || teamBGameWins >= majority) return 'ready_to_complete';

    return 'in_progress';
  };

  const { teamAGameWins, teamBGameWins } = getGameWins();
  const matchStatus = getMatchStatus();
  const isDecided = matchStatus === 'decided';

  // Handle bye matches
  if (match.isBye) {
    const isDoubleEliminationClubs = tournamentType === 'DOUBLE_ELIMINATION_CLUBS';
    const byeTeamName = isDoubleEliminationClubs && match.teamA?.club?.name
      ? match.teamA.club.name
      : stripBracketSuffix(match.teamA?.name || 'TBD');

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
                {byeTeamName}
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

  // For DE Clubs tournaments, use club names instead of team names
  const isDoubleEliminationClubs = tournamentType === 'DOUBLE_ELIMINATION_CLUBS';
  const cleanTeamAName = isDoubleEliminationClubs && match.teamA.club?.name
    ? match.teamA.club.name
    : stripBracketSuffix(match.teamA.name);
  const cleanTeamBName = isDoubleEliminationClubs && match.teamB.club?.name
    ? match.teamB.club.name
    : stripBracketSuffix(match.teamB.name);

  return (
    <div className="card">
      {/* Match Header - Club Names Only */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4">
        <div>
          <h3 className="text-base font-semibold text-primary">
            {cleanTeamAName} vs {cleanTeamBName}
          </h3>
          <div className="text-xs text-muted mt-1">
            {teamAGameWins} - {teamBGameWins} (Games Won)
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
            {matchStatus === 'tied' && (() => {
              const hasTiebreakerGame = localGames.some(g => g.slot === 'TIEBREAKER');
              return (
                <>
                  <button
                    className="btn btn-xs btn-secondary flex-1 sm:flex-none"
                    disabled={resolvingAction === 'points'}
                    onClick={handleDecideByPoints}
                  >
                    {resolvingAction === 'points' ? 'Resolving...' : 'Decide by Points'}
                  </button>
                  {!hasTiebreakerGame && (
                    <button
                      className="btn btn-xs btn-primary flex-1 sm:flex-none"
                      disabled={resolvingAction === 'tiebreaker'}
                      onClick={handleScheduleTiebreaker}
                    >
                      {resolvingAction === 'tiebreaker' ? 'Creating...' : 'Add Tiebreaker'}
                    </button>
                  )}
                </>
              );
            })()}
            <div className="flex gap-2 flex-1 sm:flex-none">
              <button
                className="btn btn-xs flex-1 sm:flex-none"
                style={{ backgroundColor: '#dc2626', color: 'white' }}
                disabled={resolvingAction === 'forfeitA'}
                onClick={() => handleForfeit('A')}
              >
                {resolvingAction === 'forfeitA' ? 'Processing...' : `Forfeit ${shortenLineupName(cleanTeamAName)}`}
              </button>
              <button
                className="btn btn-xs flex-1 sm:flex-none"
                style={{ backgroundColor: '#dc2626', color: 'white' }}
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
        // Check if we have lineups for this match (simple match-based check)
        const matchLineups = lineups[match.id];
        const hasLineups = matchLineups &&
          match.teamA &&
          match.teamB &&
          matchLineups[match.teamA.id]?.length === 4 &&
          matchLineups[match.teamB.id]?.length === 4;

        const teamALineup = matchLineups?.[match.teamA?.id || ''] || [];
        const teamBLineup = matchLineups?.[match.teamB?.id || ''] || [];

        // Check if any game has started (in progress or completed)
        const hasAnyGameStarted = localGames.some(g => g.startedAt || g.isComplete);

        // Show lineup editor if editing
        if (isEditingLineup && match.teamA && match.teamB) {
          // For DE Clubs tournaments with multiple brackets, use BracketLineupEditor
          if (isDoubleEliminationClubs) {
            // Show loading state while fetching bracket teams
            if (loadingBracketTeams || Object.keys(bracketTeams).length === 0) {
              return (
                <div className="bg-surface-2 rounded-lg p-6 text-center mb-4">
                  <p className="text-muted">Loading bracket teams...</p>
                </div>
              );
            }

            // Extract brackets from games using the loaded bracket-specific teams
            const brackets = Array.from(
              new Map(
                localGames
                  .filter(g => g.bracket && g.bracketId)
                  .map(g => {
                    const bracketTeam = bracketTeams[g.bracketId!];
                    return [
                      g.bracketId!,
                      {
                        bracketId: g.bracketId!,
                        bracketName: g.bracket!.name,
                        // Use bracket-specific teams if available, otherwise fall back to match teams
                        teamA: bracketTeam?.teamA || { id: match.teamA!.id, name: match.teamA!.name },
                        teamB: bracketTeam?.teamB || { id: match.teamB!.id, name: match.teamB!.name },
                      }
                    ];
                  })
              ).values()
            );

            return (
              <div className="mb-4">
                <BracketLineupEditor
                  matchId={match.id}
                  stopId={stopId}
                  brackets={brackets}
                  existingLineups={lineups}
                  onSave={async (bracketLineups) => {
                    try {
                      console.log('[BracketMatch] Saving bracket-aware lineups:', JSON.stringify(bracketLineups, null, 2));

                      // Save bracket-aware lineups via API
                      const response = await fetch(`/api/admin/stops/${stopId}/lineups`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          lineups: bracketLineups,
                        }),
                      });

                      if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Save failed: ${response.status} ${errorText}`);
                      }

                      console.log('[BracketMatch] Lineup save successful, calling onUpdate to reload data');
                      onInfo('Lineups saved successfully!');
                      setIsEditingLineup(false);
                      await onUpdate();
                      console.log('[BracketMatch] onUpdate completed, data should be reloaded');
                    } catch (error) {
                      console.error('[BracketMatch] Lineup save error:', error);
                      onError(error instanceof Error ? error.message : 'Failed to save lineups');
                    }
                  }}
                  onCancel={() => setIsEditingLineup(false)}
                />
              </div>
            );
          }

          // For regular tournaments, use InlineLineupEditor
          return (
            <div className="mb-4">
              <InlineLineupEditor
                matchId={match.id}
                stopId={stopId}
                teamA={match.teamA}
                teamB={match.teamB}
                lineups={lineups}
                prefetchedTeamRosters={{
                  teamA: teamRosters[match.teamA.id] || [],
                  teamB: teamRosters[match.teamB.id] || [],
                }}
                teamRosters={teamRosters}
                onSave={async (lineupData) => {
                  try {
                    if (lineupData.teamA.length !== 4 || lineupData.teamB.length !== 4) {
                      throw new Error(`Invalid lineup: Team A has ${lineupData.teamA.length} players, Team B has ${lineupData.teamB.length} players. Need exactly 4 each.`);
                    }

                    await onLineupSave(match.id, lineupData, match.teamA!.id, match.teamB!.id);
                    setIsEditingLineup(false);
                  } catch (error) {
                    onError(error instanceof Error ? error.message : 'Failed to save lineups');
                  }
                }}
                onCancel={() => setIsEditingLineup(false)}
              />
            </div>
          );
        }

        // If no lineups set yet, show button to set them (only if no games started)
        if (!hasLineups && !isDecided && !hasAnyGameStarted) {
          return (
            <div className="bg-surface-2 rounded-lg p-6 text-center mb-4">
              <p className="text-muted mb-3">Lineups must be set before games can begin</p>
              <button
                className="btn btn-secondary"
                onClick={async () => {
                  if (isDoubleEliminationClubs) {
                    await loadBracketTeams();
                  }
                  setIsEditingLineup(true);
                }}
              >
                Set Lineups
              </button>
            </div>
          );
        }

        // If lineups exist, show edit button and lineup display (only if no games started and not decided)
        if (hasLineups && !isDecided && !hasAnyGameStarted) {
          return (
            <div className="mb-4">
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                {/* Team A Lineup */}
                <div className="rounded-lg border-2 border-border-medium bg-surface-2 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-primary">
                      {match.teamA?.name || 'Team A'}
                    </h4>
                    {teamALineup.length === 4 && (
                      <span className="chip chip-success text-[10px] px-2 py-0.5">Ready</span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {teamALineup.length > 0 ? (
                      teamALineup.map((player: any, idx: number) => (
                        <div key={`teamA-${idx}-${player.id}`} className="flex items-center gap-2 text-sm bg-surface-1 px-3 py-2 rounded">
                          <span className="text-muted font-semibold w-5">{idx + 1}.</span>
                          <span className="text-secondary flex-1">{player.name}</span>
                          <span className={`chip text-[10px] px-2 py-0.5 ${
                            player.gender === 'MALE' ? 'chip-info' : 'chip-accent'
                          }`}>
                            {player.gender === 'MALE' ? 'M' : 'F'}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted text-xs">No lineup set</p>
                    )}
                  </div>
                </div>

                {/* Team B Lineup */}
                <div className="rounded-lg border-2 border-border-medium bg-surface-2 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-primary">
                      {match.teamB?.name || 'Team B'}
                    </h4>
                    {teamBLineup.length === 4 && (
                      <span className="chip chip-success text-[10px] px-2 py-0.5">Ready</span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {teamBLineup.length > 0 ? (
                      teamBLineup.map((player: any, idx: number) => (
                        <div key={`teamB-${idx}-${player.id}`} className="flex items-center gap-2 text-sm bg-surface-1 px-3 py-2 rounded">
                          <span className="text-muted font-semibold w-5">{idx + 1}.</span>
                          <span className="text-secondary flex-1">{player.name}</span>
                          <span className={`chip text-[10px] px-2 py-0.5 ${
                            player.gender === 'MALE' ? 'chip-info' : 'chip-accent'
                          }`}>
                            {player.gender === 'MALE' ? 'M' : 'F'}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted text-xs">No lineup set</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  className="btn btn-secondary"
                  onClick={async () => {
                    if (isDoubleEliminationClubs) {
                      await loadBracketTeams();
                    }
                    setIsEditingLineup(true);
                  }}
                >
                  Edit Lineups
                </button>
              </div>
            </div>
          );
        }

        return null;
      })()}

      {/* Games - Grouped by Bracket Level (only show if lineups are set) */}
      {(() => {
        // Check if any game has lineups set
        const hasLineupsInGames = localGames.some(g => g.teamALineup && g.teamBLineup);

        // Check if we have lineups in state for all brackets
        const brackets = Array.from(
          new Map(
            localGames
              .filter(g => g.bracket && g.bracketId)
              .map(g => [g.bracketId!, { bracketId: g.bracketId! }])
          ).values()
        );

        const hasAllLineupsInState = brackets.length > 0 && brackets.every(bracket => {
          const bracketLineups = lineups[bracket.bracketId];
          const bracketTeam = bracketTeams[bracket.bracketId];

          // For bracket-aware matches, use the correct team IDs for this specific bracket
          if (bracketTeam) {
            return (
              bracketLineups &&
              bracketLineups[bracketTeam.teamA.id]?.length === 4 &&
              bracketLineups[bracketTeam.teamB.id]?.length === 4
            );
          }

          // Fallback for non-bracket matches
          return (
            bracketLineups &&
            match.teamA &&
            match.teamB &&
            bracketLineups[match.teamA.id]?.length === 4 &&
            bracketLineups[match.teamB.id]?.length === 4
          );
        });

        if (!hasAllLineupsInState && !hasLineupsInGames) {
          return null; // Don't show games until lineups are set
        }

        // Group games by bracket
        const gamesByBracket: Record<string, typeof localGames> = {};

        for (const game of localGames) {
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
                      <GameScoreBox
                        key={game.id}
                        game={game}
                        match={match}
                        lineups={lineups}
                        startGame={startGame}
                        endGame={endGame}
                        reopenGame={reopenGame}
                        updateGameScore={updateGameScore}
                        updateGameCourtNumber={updateGameCourtNumber}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
