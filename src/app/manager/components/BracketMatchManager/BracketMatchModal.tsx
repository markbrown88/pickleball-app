'use client';

/**
 * Bracket Match Modal Component
 *
 * Modal dialog for scoring matches when clicked from the bracket diagram.
 * Now displays games in 2-column grid with player lineups, matching the list view.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { GameScoreBox } from '../shared/GameScoreBox';
import { PlayerLite } from '../shared/types';
import { useGameControls } from '../../hooks/useGameControls';

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
  bracketId?: string | null;
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
  lineups: Record<string, Record<string, PlayerLite[]>>; // bracketId -> teamId -> players
  onClose: () => void;
  onUpdate: () => void;
  onError: (message: string) => void;
  onInfo: (message: string) => void;
}

export function BracketMatchModal({
  match,
  lineups,
  onClose,
  onUpdate,
  onError,
  onInfo,
}: BracketMatchModalProps) {
  const [updating, setUpdating] = useState(false);
  const [resolvingAction, setResolvingAction] = useState<string | null>(null);
  // Initialize localGames from match.games, but ensure we always have the latest
  const [localGames, setLocalGames] = useState<Game[]>(() => {
    const initialGames = match?.games || [];
    return initialGames;
  });

  // Sync localGames when match updates
  // ALWAYS sync from server data to ensure we have the latest game states (scores, statuses, etc.)
  useEffect(() => {
    if (!match) {
      // Match is null/undefined, reset localGames
      setLocalGames([]);
      return;
    }

    const gamesArray = Array.isArray(match.games) ? match.games : [];


    // Always sync from server to ensure we have latest data (scores, statuses, etc.)
    // This fixes the issue where closing/reopening modal showed stale data
    setLocalGames([...gamesArray]); // Create new array reference
  }, [match]); // Depend on the entire match object to catch all changes

  // Use shared game controls hook
  const gameControls = useGameControls({ onError, onUpdate });

  // Game control functions
  const startGame = useCallback(async (gameId: string) => {
    try {
      const updatedGame = await gameControls.startGame(gameId);

      // Update local state optimistically - create new array reference to trigger re-render
      setLocalGames(prev => {
        const updated = prev.map(g =>
          g.id === gameId
            ? { ...g, startedAt: updatedGame.startedAt || new Date().toISOString(), isComplete: false }
            : g
        );
        return [...updated]; // Force new array reference
      });
      
      // Don't call onUpdate() here - optimistic updates are sufficient
      // The modal should stay open and show the updated state immediately
    } catch (error) {
      console.error('BracketMatchModal: Error starting game', error);
      // Error already handled by hook
    }
  }, [gameControls]);

  const endGame = useCallback(async (gameId: string) => {
    try {
      const game = localGames.find(g => g.id === gameId);
      if (!game) return;

      // Ensure scores are saved before ending the game
      // If scores are null, set them to 0 (likely a forfeit or incomplete data)
      const teamAScore = game.teamAScore ?? 0;
      const teamBScore = game.teamBScore ?? 0;
      
      // Save scores first if they're null
      if (game.teamAScore === null || game.teamBScore === null) {
        await gameControls.updateScore(gameId, teamAScore, teamBScore);
        // Wait for score to be saved
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      const updatedGame = await gameControls.endGame(gameId, teamAScore, teamBScore);

      if (updatedGame) {
        // Update local state optimistically - create new array reference to trigger re-render
        setLocalGames(prev => {
          const updated = prev.map(g =>
            g.id === gameId
              ? { ...g, isComplete: true, endedAt: updatedGame.endedAt || new Date().toISOString(), teamAScore, teamBScore }
              : g
          );
          return [...updated]; // Force new array reference
        });
        
        // Don't call onUpdate here - it would overwrite localGames
        // Instead, rely on handleModalClose to refresh when modal closes
      }
    } catch (error) {
      // Error already handled by hook
    }
  }, [gameControls, localGames]);

  const reopenGame = useCallback(async (gameId: string) => {
    try {
      const updatedGame = await gameControls.reopenGame(gameId);

      if (updatedGame) {
        // Update local state optimistically - create new array reference to trigger re-render
        setLocalGames(prev => {
          const updated = prev.map(g =>
            g.id === gameId
              ? { ...g, isComplete: false, endedAt: null }
              : g
          );
          return [...updated]; // Force new array reference
        });
        
        // Don't call onUpdate() here - optimistic updates are sufficient
      }
    } catch (error) {
      // Error already handled by hook
    }
  }, [gameControls]);

  const updateGameScore = useCallback(async (gameId: string, teamAScore: number | null, teamBScore: number | null) => {
    
    // Update local state immediately (optimistic update) - create new array and objects
    setLocalGames(prev => {
      const updated = prev.map(g =>
        g.id === gameId
          ? { ...g, teamAScore, teamBScore } // Create new object
          : g
      );
      return [...updated]; // Force new array reference
    });

    // Debounced API call handled by hook
    await gameControls.updateScore(gameId, teamAScore, teamBScore);
  }, [gameControls]);

  const updateGameCourtNumber = useCallback(async (gameId: string, courtNumber: string) => {
    const courtNum = courtNumber ? parseInt(courtNumber, 10) : null;

    // Update local state immediately (optimistic update) - create new array reference
    setLocalGames(prev => {
      const updated = prev.map(g =>
        g.id === gameId
          ? { ...g, courtNumber: courtNum }
          : g
      );
      return [...updated]; // Force new array reference
    });

    await gameControls.updateCourtNumber(gameId, courtNum);
  }, [gameControls]);

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
      
      // Refresh match data without closing modal
      if (onUpdate) {
        // Small delay to let the API update complete
        setTimeout(() => {
          onUpdate();
        }, 200);
      }
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
      
      // Refresh match data without closing modal
      if (onUpdate) {
        // Small delay to let the API update complete
        setTimeout(() => {
          onUpdate();
        }, 200);
      }
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
      
      // Refresh match data without closing modal
      if (onUpdate) {
        // Small delay to let the API update complete
        setTimeout(() => {
          onUpdate();
        }, 200);
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to forfeit match');
    } finally {
      setResolvingAction(null);
    }
  };

  const getGameWins = () => {
    // Always use localGames as source of truth - it includes optimistic updates
    // This ensures game wins update dynamically as games are completed
    const gamesToUse = localGames.length > 0 ? localGames : (match?.games || []);
    
    let teamAGameWins = 0;
    let teamBGameWins = 0;

    
    // Log all games with their details

    for (const game of gamesToUse) {
      if (!game.isComplete) {
        continue;
      }
      
      // For completed games, treat null scores as 0
      // This handles cases where a game was marked complete but scores weren't fully saved
      const teamAScore = game.teamAScore ?? 0;
      const teamBScore = game.teamBScore ?? 0;
      
      // If both original scores are null, skip (shouldn't happen for completed games, but handle gracefully)
      if (game.teamAScore === null && game.teamBScore === null) {
        continue;
      }

      
      // Alert if we have a null score that we're fixing
      if (game.teamAScore === null || game.teamBScore === null) {
        console.warn(`⚠️ Game ${game.id} (${game.slot}) has null score - treating as 0. Original: [${game.teamAScore}, ${game.teamBScore}], Using: [${teamAScore}, ${teamBScore}]`);
      }

      if (teamAScore > teamBScore) {
        teamAGameWins++;
      } else if (teamBScore > teamAScore) {
        teamBGameWins++;
      } else {
      }
    }


    // Also track brackets for display purposes (games are grouped by bracket)
    const bracketsByName: Record<string, { teamAWins: number; teamBWins: number }> = {};
    for (const game of gamesToUse) {
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

  // Handle match completion - moved here after getGameWins is defined
  const handleCompleteMatch = useCallback(async () => {
    if (!match) return;
    if (match.isBye || match.winnerId) {
      onError('Match cannot be completed');
      return;
    }

    const gamesToUse = localGames.length > 0 ? localGames : (match?.games || []);
    const completedGames = gamesToUse.filter(g => g.isComplete).length;
    const bracketCount = new Set(gamesToUse.filter(g => g.bracketId).map(g => g.bracketId)).size;
    const totalExpectedGames = bracketCount * 4 || gamesToUse.length;
    
    if (completedGames < totalExpectedGames) {
      onError('Match cannot be completed yet');
      return;
    }

    const { teamAGameWins, teamBGameWins } = getGameWins();
    const majority = Math.ceil(totalExpectedGames / 2);
    const hasClearWinner = teamAGameWins >= majority || teamBGameWins >= majority || match.tiebreakerWinnerTeamId !== null;
    
    if (!hasClearWinner) {
      onError('Match cannot be completed - no clear winner');
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

      const result = await response.json();
      
      onInfo('Match completed successfully!');
      // Refresh bracket data first to show winner progression, then close modal
      if (onUpdate) {
        await onUpdate();
      }
      onClose();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to complete match');
    } finally {
      setUpdating(false);
    }
  }, [match, localGames, getGameWins, onError, onInfo, onUpdate, onClose]);

  // Calculate game wins directly - don't use useMemo, just calculate on every render
  // React will re-render when localGames changes (new array reference from setLocalGames)
  // This ensures the display updates immediately when games are finished
  const { teamAGameWins, teamBGameWins } = (() => {
    const result = getGameWins();
    return result;
  })();
  
  const getMatchStatus = () => {
    if (match.forfeitTeam) return 'decided';
    if (match.winnerId) return 'decided';
    if (match.tiebreakerWinnerTeamId) return 'decided';

    // Check server-provided tiebreaker status first
    if (match.tiebreakerStatus) {
      switch (match.tiebreakerStatus) {
        case 'REQUIRES_TIEBREAKER':
          return 'tied_requires_tiebreaker';
        case 'NEEDS_DECISION':
          return 'needs_decision';
        case 'PENDING_TIEBREAKER':
          return 'tied_pending';
        case 'DECIDED_POINTS':
          return 'decided_points';
        case 'DECIDED_TIEBREAKER':
          return 'decided_tiebreaker';
      }
    }

    // Always use localGames as source of truth - it includes optimistic updates
    const gamesToUse = localGames.length > 0 ? localGames : (match?.games || []);
    const regularGames = gamesToUse.filter(g => g.slot !== 'TIEBREAKER');

    const { teamAGameWins: winsA, teamBGameWins: winsB } = getGameWins();
    const bracketCount = new Set(regularGames.filter(g => g.bracketId).map(g => g.bracketId)).size;
    const totalExpectedGames = bracketCount * 4 || regularGames.length;
    const completedRegularGames = regularGames.filter(g => g.isComplete).length;

    if (completedRegularGames < totalExpectedGames) return 'in_progress';

    // All regular games complete - check for tie or winner
    if (winsA === winsB && winsA === 2) {
      // Tied 2:2 - needs decision
      return 'tied';
    }

    const majority = Math.ceil(totalExpectedGames / 2);
    if (winsA >= majority || winsB >= majority) return 'ready_to_complete';

    return 'in_progress';
  };
  
  const matchStatus = useMemo(() => getMatchStatus(), [localGames, match, teamAGameWins, teamBGameWins]);
  const isDecided = matchStatus === 'decided' || matchStatus === 'decided_points' || matchStatus === 'decided_tiebreaker';

  // Check if match can be manually completed
  const canCompleteMatch = useCallback(() => {
    if (match.isBye || match.winnerId) {
      return false;
    }

    // Don't show button if match needs a decision (buttons above will handle it)
    if (matchStatus === 'needs_decision' || matchStatus === 'tied_requires_tiebreaker' || matchStatus === 'tied_pending') {
      return false;
    }

    // Always use localGames as source of truth - it includes optimistic updates
    const gamesToUse = localGames.length > 0 ? localGames : (match?.games || []);
    const regularGames = gamesToUse.filter(g => g.slot !== 'TIEBREAKER');

    // For club tournaments, need all regular games completed (4 per bracket)
    const completedRegularGames = regularGames.filter(g => g.isComplete).length;
    const bracketCount = new Set(regularGames.filter(g => g.bracketId).map(g => g.bracketId)).size;
    const totalExpectedGames = bracketCount * 4 || regularGames.length;

    if (completedRegularGames < totalExpectedGames) {
      return false;
    }

    // Check if there's a clear winner or tiebreaker was completed
    const { teamAGameWins, teamBGameWins } = getGameWins();
    const hasClearWinner = teamAGameWins !== teamBGameWins && (teamAGameWins >= 3 || teamBGameWins >= 3);
    const tiebreakerComplete = gamesToUse.find(g => g.slot === 'TIEBREAKER' && g.isComplete);

    return hasClearWinner || tiebreakerComplete || match.tiebreakerWinnerTeamId !== null;
  }, [match, localGames, matchStatus, getGameWins]);

  // Auto-complete match when all games are finished and there's a clear winner
  // Also auto-create tiebreaker when needed (2:2 tie with equal points)
  useEffect(() => {

    if (!match || match.winnerId || match.isBye || match.forfeitTeam) {
      return; // Already completed or can't complete
    }

    // Check if all required games are complete (not counting tiebreaker)
    const gamesToUse = localGames.length > 0 ? localGames : (match?.games || []);
    const regularGames = gamesToUse.filter(g => g.slot !== 'TIEBREAKER');
    const bracketCount = new Set(regularGames.filter(g => g.bracketId).map(g => g.bracketId)).size;
    const totalExpectedGames = bracketCount * 4 || regularGames.length;
    const completedRegularGames = regularGames.filter(g => g.isComplete).length;


    if (completedRegularGames < totalExpectedGames) {
      return; // Not all regular games complete yet
    }

    // Calculate game wins
    const { teamAGameWins: winsA, teamBGameWins: winsB } = getGameWins();

    // Case 1: Clear winner (3:1 or 4:0) - auto-complete
    if (winsA !== winsB && (winsA >= 3 || winsB >= 3)) {

      handleCompleteMatch();
      return;
    }

    // Case 2: Tied 2:2
    if (winsA === winsB && winsA === 2) {

      // Check if tiebreaker game already exists
      const tiebreakerGame = gamesToUse.find(g => g.slot === 'TIEBREAKER');

      // If tiebreaker game exists and is complete, auto-complete the match
      if (tiebreakerGame?.isComplete) {

        handleCompleteMatch();
        return;
      }

      // If no tiebreaker game and tiebreakerStatus is REQUIRES_TIEBREAKER, auto-create it
      // REQUIRES_TIEBREAKER means 2:2 tie with equal total points
      if (!tiebreakerGame && match.tiebreakerStatus === 'REQUIRES_TIEBREAKER') {
        // Only create if not already in progress (prevent duplicate creation)
        if (resolvingAction !== 'tiebreaker') {
          // Auto-create tiebreaker game
          handleScheduleTiebreaker();
        }
        return;
      }

      // If tiebreakerStatus is NEEDS_DECISION or tied_pending, buttons will be shown (handled below)
    }
  }, [localGames, match?.id, match?.winnerId, match?.isBye, match?.forfeitTeam, match?.tiebreakerStatus, resolvingAction, handleCompleteMatch, handleScheduleTiebreaker]);
  
  // Check if winner should advance to next round
  const winnerId = match.winnerId || match.tiebreakerWinnerTeamId;
  const winnerName = winnerId === match.teamA?.id 
    ? match.teamA?.name 
    : winnerId === match.teamB?.id 
    ? match.teamB?.name 
    : null;
  

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
                {teamAGameWins} - {teamBGameWins} (Games Won)
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
              {/* Decide by Points button: Show when NEEDS_DECISION or (tied_pending with different points) */}
              {(matchStatus === 'needs_decision' ||
                (matchStatus === 'tied_pending' &&
                 match.totalPointsTeamA !== null &&
                 match.totalPointsTeamB !== null &&
                 match.totalPointsTeamA !== match.totalPointsTeamB)) && (
                <button
                  className="btn btn-xs btn-secondary"
                  disabled={resolvingAction === 'points'}
                  onClick={handleDecideByPoints}
                >
                  {resolvingAction === 'points' ? 'Resolving...' : 'Decide by Points'}
                </button>
              )}
              {/* Add Tiebreaker button: Show when tied_requires_tiebreaker, needs_decision, or (tied_pending with different points), and no tiebreaker exists */}
              {(() => {
                const gamesToUse = localGames.length > 0 ? localGames : (match?.games || []);
                const tiebreakerGame = gamesToUse.find(g => g.slot === 'TIEBREAKER');
                const showButton =
                  (matchStatus === 'tied_requires_tiebreaker' ||
                   matchStatus === 'needs_decision' ||
                   (matchStatus === 'tied_pending' &&
                    match.totalPointsTeamA !== null &&
                    match.totalPointsTeamB !== null &&
                    match.totalPointsTeamA !== match.totalPointsTeamB)) &&
                  (matchStatus !== 'needs_decision' ? !tiebreakerGame : true);

                return showButton ? (
                  <button
                    className="btn btn-xs btn-primary"
                    disabled={resolvingAction === 'tiebreaker'}
                    onClick={handleScheduleTiebreaker}
                  >
                    {resolvingAction === 'tiebreaker' ? 'Creating...' : 'Add Tiebreaker'}
                  </button>
                ) : null;
              })()}
            </div>
          )}

          {/* Forfeit Buttons */}
          {!isDecided && (
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                className="btn btn-xs bg-error hover:bg-error/80 text-white border-error"
                disabled={resolvingAction === 'forfeitA'}
                onClick={() => handleForfeit('A')}
              >
                {resolvingAction === 'forfeitA' ? 'Processing...' : `Forfeit ${shortenLineupName(cleanTeamAName)}`}
              </button>
              <button
                className="btn btn-xs bg-error hover:bg-error/80 text-white border-error"
                disabled={resolvingAction === 'forfeitB'}
                onClick={() => handleForfeit('B')}
              >
                {resolvingAction === 'forfeitB' ? 'Processing...' : `Forfeit ${shortenLineupName(cleanTeamBName)}`}
              </button>
            </div>
          )}

          {/* Total Points Summary - Show when tied and deciding by points */}
          {match.totalPointsTeamA !== null && match.totalPointsTeamB !== null &&
           (matchStatus === 'needs_decision' || matchStatus === 'tied_pending' || matchStatus === 'tied') && (
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
            // Use localGames as the source of truth for rendering (includes optimistic updates)
            // Fall back to match.games only if localGames is empty (initial state)
            const gamesToRender = localGames.length > 0 ? localGames : (match?.games || []);
            
            
            if (gamesToRender.length === 0) {
              return (
                <div className="text-center py-8 text-gray-400">
                  <p>No games found for this match.</p>
                  <p className="text-sm mt-2">Match ID: {match?.id}</p>
                </div>
              );
            }
            
            // Group games by bracket
            const gamesByBracket = new Map<string, Game[]>();

            for (const game of gamesToRender) {
              const bracketKey = game.bracket?.name || 'Main';
              if (!gamesByBracket.has(bracketKey)) {
                gamesByBracket.set(bracketKey, []);
              }
              gamesByBracket.get(bracketKey)!.push(game);
            }

            // Render each bracket's games in encounter order
            return Array.from(gamesByBracket.entries()).map(([bracketName, games]) => {
              // Calculate bracket winner
              let teamAWins = 0;
              let teamBWins = 0;
              for (const game of games) {
                if (game.isComplete && game.teamAScore !== null && game.teamBScore !== null) {
                  if (game.teamAScore > game.teamBScore) teamAWins++;
                  else if (game.teamBScore > game.teamAScore) teamBWins++;
                }
              }

              const bracketLabel =
                bracketName === 'Main'
                  ? 'Overall Skill Bracket'
                  : `${bracketName} Skill Bracket`;

              return (
                <div key={bracketName}>
                  {/* Bracket Header */}
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-blue-400">
                      {bracketLabel}
                    </h4>
                    <span className="text-xs font-semibold text-gray-300 bg-gray-700/60 px-2 py-0.5 rounded">
                      {teamAWins} - {teamBWins}
                    </span>
                  </div>

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
