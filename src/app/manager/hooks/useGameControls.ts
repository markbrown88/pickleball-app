'use client';

/**
 * Shared hook for game controls across all tournament formats.
 * Handles starting, ending, scoring, and court assignment with optimistic updates.
 */

import { useRef, useCallback } from 'react';
import { fetchWithActAs } from '@/lib/fetchWithActAs';

export interface GameControlsOptions {
  onError: (message: string) => void;
  onUpdate?: () => void;
}

export function useGameControls(options: GameControlsOptions) {
  const { onError, onUpdate } = options;
  const debouncedScoreUpdate = useRef<Record<string, NodeJS.Timeout>>({});

  /**
   * Start a game by setting startedAt timestamp
   */
  const startGame = useCallback(async (gameId: string) => {
    try {
      const response = await fetchWithActAs(`/api/admin/games/${gameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isComplete: false,
          startedAt: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start game');
      }

      // Caller is responsible for updating their local state optimistically
      // We return the updated game data so they can do so
      const updatedGame = await response.json();
      return updatedGame;
    } catch (error) {
      onError(`Failed to start game: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }, [onError]);

  /**
   * End a game by setting endedAt timestamp and marking complete
   * NOTE: Does NOT call onUpdate() - relies on optimistic updates
   * NOTE: Individual games cannot have tied scores - this is validated at the UI level
   */
  const endGame = useCallback(async (gameId: string, teamAScore: number, teamBScore: number) => {
    try {
      const response = await fetchWithActAs(`/api/admin/games/${gameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isComplete: true,
          endedAt: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to end game');
      }

      const updatedGame = await response.json();

      // Give server time to calculate tiebreaker status
      await new Promise(resolve => setTimeout(resolve, 500));

      // NOTE: We do NOT call onUpdate() here to avoid page refresh
      // The optimistic update already shows the completed state immediately

      return updatedGame;
    } catch (error) {
      onError(`Failed to end game: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }, [onError]);

  /**
   * Update game scores with debouncing
   * Updates are debounced by 500ms to avoid excessive API calls
   * NOTE: Does NOT call onUpdate() - relies on optimistic updates for immediate UI feedback
   */
  const updateScore = useCallback(async (gameId: string, teamAScore: number | null, teamBScore: number | null) => {
    // Clear any pending debounced update for this game
    if (debouncedScoreUpdate.current[gameId]) {
      clearTimeout(debouncedScoreUpdate.current[gameId]);
    }

    // Caller should update local state immediately (optimistic update)
    // Then we'll debounce the actual API call
    debouncedScoreUpdate.current[gameId] = setTimeout(async () => {
      try {
        const response = await fetchWithActAs(`/api/admin/games/${gameId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamAScore, teamBScore })
        });

        if (!response.ok) {
          throw new Error('Failed to update score');
        }

        const updatedGame = await response.json();

        // Give server time to calculate tiebreaker status
        await new Promise(resolve => setTimeout(resolve, 500));

        // NOTE: We do NOT call onUpdate() here to avoid page refresh
        // The optimistic update already shows the new score immediately
        // Only endGame/reopenGame should trigger full reload for tiebreaker recalc

        return updatedGame;
      } catch (error) {
        onError(`Failed to update score: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }
    }, 500);
  }, [onError]);

  /**
   * Update court number for a game
   * NOTE: Does NOT call onUpdate() - relies on optimistic updates
   */
  const updateCourtNumber = useCallback(async (gameId: string, courtNumber: number | null) => {
    try {
      const response = await fetchWithActAs(`/api/admin/games/${gameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courtNumber })
      });

      if (!response.ok) {
        throw new Error('Failed to update court number');
      }

      const updatedGame = await response.json();
      // NOTE: We do NOT call onUpdate() here to avoid page refresh
      return updatedGame;
    } catch (error) {
      onError(`Failed to update court number: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }, [onError]);

  /**
   * Reopen a completed game back to In Progress
   * Clears the endedAt timestamp and sets isComplete to false
   * NOTE: Does NOT call onUpdate() - relies on optimistic updates
   */
  const reopenGame = useCallback(async (gameId: string) => {
    try {
      const response = await fetchWithActAs(`/api/admin/games/${gameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isComplete: false,
          endedAt: null
        })
      });

      if (!response.ok) {
        throw new Error('Failed to reopen game');
      }

      const updatedGame = await response.json();

      // Give server time to recalculate tiebreaker status
      await new Promise(resolve => setTimeout(resolve, 500));

      // NOTE: We do NOT call onUpdate() here to avoid page refresh
      // The optimistic update already shows the reopened state immediately

      return updatedGame;
    } catch (error) {
      onError(`Failed to reopen game: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }, [onError]);

  /**
   * Forfeit a game by setting winner and marking complete
   */
  const forfeitGame = useCallback(async (gameId: string, winnerTeam: 'A' | 'B') => {
    try {
      const response = await fetchWithActAs(`/api/admin/games/${gameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamAScore: winnerTeam === 'A' ? 11 : 0,
          teamBScore: winnerTeam === 'B' ? 11 : 0,
          isComplete: true,
          status: 'FORFEIT',
          endedAt: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to forfeit game');
      }

      const updatedGame = await response.json();

      // Give server time to calculate tiebreaker status
      await new Promise(resolve => setTimeout(resolve, 500));

      // Notify caller to reload data if needed
      if (onUpdate) {
        onUpdate();
      }

      return updatedGame;
    } catch (error) {
      onError(`Failed to forfeit game: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }, [onError, onUpdate]);

  return {
    startGame,
    endGame,
    reopenGame,
    updateScore,
    updateCourtNumber,
    forfeitGame,
  };
}
