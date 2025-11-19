'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { DndContext, DragEndEvent, DragStartEvent, closestCenter } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { fetchWithActAs } from '@/lib/fetchWithActAs';
import { expectedGenderForIndex, LINEUP_SLOT_ORDER, LINEUP_SLOT_CONFIG } from '@/lib/lineupSlots';
import { saveManagerActiveStopTab, getManagerLastActiveStopTab } from '@/lib/tournamentStorage';
import { GameScoreBox } from '../shared/GameScoreBox';
import { DraggableTeam } from '../shared/DraggableTeam';
import { InlineLineupEditor } from '../shared/InlineLineupEditor';
import { ScheduleSkeleton } from '../shared/LoadingSkeleton';
import { PlayerLite, EventManagerTournament, type Id } from '../shared/types';
import {
  type MatchStatus,
  getGameStatus,
  normalizeTiebreakerStatus,
  deriveMatchStatus,
  isMatchComplete,
  hasAnyMatchStarted,
  getTiebreakerBanner,
  formatMatchLabel,
  gatherRoundTiebreakerAlerts,
  totalPointsDisagree,
  shortenLineupName,
  shorten,
  formatDate,
  formatDateRange,
  formatDeadline,
  getTournamentTypeDisplayName,
  checkForDuplicateMatchups,
  checkForDuplicateMatchupsFromSchedule,
} from '../shared/utils';

// Conditional logging helper
// Removed dev logging to reduce console noise

// Custom strategy that disables automatic reordering
const noReorderStrategy = () => null;

// Components are now imported from separate files
// GameScoreBox - ./EventManagerTab/GameScoreBox.tsx
// DraggableTeam - ./EventManagerTab/DraggableTeam.tsx
// InlineLineupEditor - ./EventManagerTab/InlineLineupEditor.tsx


// Main TeamFormatManager Component
export function TeamFormatManager({
  tournaments,
  onError,
  onInfo,
}: {
  tournaments: EventManagerTournament[];
  onError: (m: string) => void;
  onInfo: (m: string) => void;
}) {
  // Default to expanding only in-progress or not-started rounds (not completed)
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set());
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [scheduleData, setScheduleData] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [lineupDeadlines, setLineupDeadlines] = useState<Record<string, string>>({});

  // Lineup and game state
  const [editingMatch, setEditingMatch] = useState<string | null>(null);
  const [lineups, setLineups] = useState<Record<string, Record<string, PlayerLite[]>>>({});
  const [teamRosters, setTeamRosters] = useState<Record<string, PlayerLite[]>>({});
  const [games, setGames] = useState<Record<string, any[]>>({});
  const [resolvingMatch, setResolvingMatch] = useState<string | null>(null);

  // Matchup editing state
  const [editingRounds, setEditingRounds] = useState<Set<string>>(new Set());
  const [roundMatchups, setRoundMatchups] = useState<Record<string, Array<{
    id: Id;
    isBye: boolean;
    bracketName?: string;
    teamA?: { id: Id; name: string; clubName?: string; bracketName?: string };
    teamB?: { id: Id; name: string; clubName?: string; bracketName?: string };
  }>>>({});
  const [updateKey, setUpdateKey] = useState(0);
  const [renderKey, setRenderKey] = useState(0);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    sourceId: string;
    targetId: string;
    sourceTeam: any;
    targetTeam: any;
  } | null>(null);

  // Debounce refs
  const debouncedScoreUpdate = useRef<Record<string, NodeJS.Timeout>>({});
  const debouncedCourtUpdate = useRef<Record<string, NodeJS.Timeout>>({});

  // Auto-select stop when tournaments load (with persistence)
  useEffect(() => {
    if (tournaments.length > 0 && !selectedStopId) {
      const firstTournament = tournaments[0];
      if (firstTournament.stops.length > 0) {
        // Try to restore last active stop from localStorage
        const lastActiveStopId = getManagerLastActiveStopTab(firstTournament.id);
        const stopExists = lastActiveStopId && firstTournament.stops.some(s => s.stopId === lastActiveStopId);

        // Use last active stop if it exists, otherwise use first stop
        const stopId = stopExists ? lastActiveStopId : firstTournament.stops[0].stopId;
        setSelectedStopId(stopId);
        loadSchedule(stopId);
      }
    }
  }, [tournaments, selectedStopId]);

  // Save selected stop to localStorage whenever it changes
  useEffect(() => {
    if (selectedStopId && tournaments.length > 0) {
      const tournament = tournaments[0];
      saveManagerActiveStopTab(tournament.id, selectedStopId);
    }
  }, [selectedStopId, tournaments]);

  // Initialize lineup deadlines from tournament data
  useEffect(() => {
    const deadlines: Record<string, string> = {};
    tournaments.forEach(tournament => {
      tournament.stops.forEach(stop => {
        if (stop.lineupDeadline) {
          // Convert ISO string to datetime-local format (YYYY-MM-DDTHH:mm)
          const date = new Date(stop.lineupDeadline);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          deadlines[stop.stopId] = `${year}-${month}-${day}T${hours}:${minutes}`;
        }
      });
    });
    setLineupDeadlines(deadlines);
  }, [tournaments]);

  const toggleRound = (roundId: string) => {
    setExpandedRounds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(roundId)) {
        newSet.delete(roundId);
      } else {
        // Close all other rounds first (only one open at a time)
        newSet.clear();
        newSet.add(roundId);
      }
      return newSet;
    });
  };

  const toggleRoundEdit = (roundId: string) => {
    setEditingRounds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(roundId)) {
        newSet.delete(roundId);
        // Remove from roundMatchups when closing edit mode
        setRoundMatchups(prev => {
          const newMatchups = { ...prev };
          delete newMatchups[roundId];
          return newMatchups;
        });
      } else {
        newSet.add(roundId);
        // Load round data when opening edit mode, but only if we don't already have it
        if (!roundMatchups[roundId]) {
          loadRoundMatchups(roundId);
        }
      }
      return newSet;
    });
  };

  const loadSchedule = async (stopId: string, force = false) => {
    if (scheduleData[stopId] && !force) return; // Already loaded

    setLoading(prev => ({ ...prev, [stopId]: true }));
    try {
      const response = await fetchWithActAs(`/api/admin/stops/${stopId}/schedule`);
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Schedule error:', errorData);
        throw new Error(errorData.error || 'Failed to load schedule');
      }
      const data = await response.json();
      
      // Log match statuses for debugging
      data.forEach((round: any, roundIdx: number) => {
      });

      setScheduleData(prev => ({ ...prev, [stopId]: data || [] }));

      // Prefetch stop rosters for all teams in this schedule
      const teamIds = new Set<string>();
      data.forEach((round: any) => {
        round.matches?.forEach((match: any) => {
          if (match.teamA?.id) teamIds.add(match.teamA.id);
          if (match.teamB?.id) teamIds.add(match.teamB.id);
        });
      });

      if (teamIds.size > 0) {
        // Use bulk roster endpoint - ONE query instead of N queries
        try {
          const teamIdsArray = Array.from(teamIds);
          const rosterResp = await fetchWithActAs(`/api/admin/stops/${stopId}/rosters?teamIds=${teamIdsArray.join(',')}`);

          if (rosterResp.ok) {
            const { rosters } = await rosterResp.json();
            setTeamRosters(prev => {
              const updated = { ...prev };
              // Only update if we don't already have data for this team
              for (const [teamId, roster] of Object.entries(rosters)) {
                if (!updated[teamId] || updated[teamId].length === 0) {
                  updated[teamId] = roster as PlayerLite[];
                }
              }
              return updated;
            });
          } else {
            console.error('Failed to prefetch rosters:', await rosterResp.text());
          }
        } catch (err) {
          console.error('Failed to prefetch rosters:', err);
        }
      }

      // Extract games and lineups from schedule data
      const gamesMap: Record<string, any[]> = {};
      const lineupsMap: Record<string, Record<string, PlayerLite[]>> = {};

      data.forEach((round: any) => {
        round.matches?.forEach((match: any) => {
          if (match.games && match.games.length > 0) {
            gamesMap[match.id] = match.games;
          }

          // Extract lineups from schedule data
          if (match.teamALineup && match.teamBLineup && match.teamA?.id && match.teamB?.id) {
            if (!lineupsMap[match.id]) {
              lineupsMap[match.id] = {};
            }
            lineupsMap[match.id][match.teamA.id] = match.teamALineup;
            lineupsMap[match.id][match.teamB.id] = match.teamBLineup;
          }
        });
      });

      setGames(prev => {
        const updated = { ...prev, ...gamesMap };
        return updated;
      });

      // Populate lineups from schedule data
      setLineups(prev => {
        const updated = { ...prev };
        // Merge in lineups from schedule, but don't overwrite existing ones
        for (const matchId in lineupsMap) {
          if (!updated[matchId]) {
            updated[matchId] = lineupsMap[matchId];
          } else {
            // Merge team lineups
            for (const teamId in lineupsMap[matchId]) {
              if (!updated[matchId][teamId]) {
                updated[matchId][teamId] = lineupsMap[matchId][teamId];
              }
            }
          }
        }
        return updated;
      });

      // Load lineups from the dedicated lineups endpoint instead of extracting from games
      await loadLineupsForStop(stopId);

      // Auto-expand the first incomplete round
      const firstIncompleteRound = data.find((round: any) => {
        const allMatchesComplete = round.matches?.every((match: any) => {
          const gamesForMatch = match.games || [];
          return gamesForMatch.length > 0 && gamesForMatch.every((g: any) =>
            g.teamAScore !== null && g.teamBScore !== null
          );
        });
        return !allMatchesComplete;
      });

      if (firstIncompleteRound) {
        setExpandedRounds(new Set([firstIncompleteRound.id]));
      } else if (data.length > 0) {
        // If all rounds complete, expand the last one
        setExpandedRounds(new Set([data[data.length - 1].id]));
      }

      // Check for duplicate matchups after loading schedule
      setTimeout(() => {
        // Convert schedule data to roundMatchups format for duplicate checking
        const scheduleRoundMatchups: Record<string, any> = {};
        data.forEach((round: any) => {
          if (round.matches) {
            scheduleRoundMatchups[round.id as string] = round.matches.map((match: any) => ({
              id: match.id,
              isBye: match.isBye,
              bracketName: match.bracketName,
              teamA: match.teamA ? {
                id: match.teamA.id,
                name: match.teamA.name,
                clubName: match.teamA.clubName || undefined,
                bracketName: match.teamA.bracketName || undefined,
              } : undefined,
              teamB: match.teamB ? {
                id: match.teamB.id,
                name: match.teamB.name,
                clubName: match.teamB.clubName || undefined,
                bracketName: match.teamB.bracketName || undefined,
              } : undefined,
              games: match.games || [],
            }));
          }
        });
        
        // Create a modified version of checkForDuplicateMatchups that works with schedule data
        checkForDuplicateMatchupsFromSchedule(stopId, scheduleRoundMatchups, data, tournaments, onError);
      }, 100);
    } catch (e) {
      console.error('Load schedule error:', e);
      onError(`Failed to load schedule: ${(e as Error).message}`);
      setScheduleData(prev => ({ ...prev, [stopId]: [] }));
    } finally {
      setLoading(prev => ({ ...prev, [stopId]: false }));
    }
  };

  const loadLineupsForStop = async (stopId: string) => {
    try {
      const response = await fetchWithActAs(`/api/admin/stops/${stopId}/lineups`);
      if (response.ok) {
        const lineupsData = await response.json();
        setLineups(prev => {
          const updated = { ...prev, ...lineupsData };
          return updated;
        });

        // Load games for matches that have confirmed lineups
        Object.keys(lineupsData).forEach(matchId => {
          const matchLineups = lineupsData[matchId];
          const teamAId = Object.keys(matchLineups)[0];
          const teamBId = Object.keys(matchLineups)[1];

          if (matchLineups[teamAId]?.length === 4 && matchLineups[teamBId]?.length === 4) {
            // Add a small delay to prevent overwhelming the API
            setTimeout(() => loadGamesForMatch(matchId, true), 100);
          }
        });
      }
    } catch (error) {
      console.error('Error loading lineups for stop:', error);
    }
  };

  const loadRoundMatchups = async (roundId: string) => {
    try {
      const response = await fetchWithActAs(`/api/admin/rounds/${roundId}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const roundData = await response.json();

      if (!roundData.matches) {
        return;
      }

      const matches = roundData.matches.map((match: any) => ({
        id: match.id,
        isBye: match.isBye,
        bracketName: match.bracketName,
        teamA: match.teamA ? {
          id: match.teamA.id,
          name: match.teamA.name,
          clubName: match.teamA.clubName || undefined,
          bracketName: match.teamA.bracketName || undefined,
        } : undefined,
        teamB: match.teamB ? {
          id: match.teamB.id,
          name: match.teamB.name,
          clubName: match.teamB.clubName || undefined,
          bracketName: match.teamB.bracketName || undefined,
        } : undefined,
        games: match.games || [],
      }));

      setRoundMatchups(prev => {
        const newRoundMatchups = {
          ...prev,
          [roundId]: matches
        };
        
        // Check for duplicate matchups after updating the state
        // We need to find the stopId for this round to check all rounds in the stop
        const stopId = Object.keys(scheduleData).find(stopId =>
          scheduleData[stopId].some((round: any) => round.id === roundId)
        );
        
        if (stopId) {
          // Use setTimeout to ensure state is updated before checking
          setTimeout(() => {
            checkForDuplicateMatchups(stopId, newRoundMatchups, scheduleData, tournaments, onError);
          }, 0);
        }
        
        return newRoundMatchups;
      });
    } catch (e) {
      onError((e as Error).message);
    }
  };

  const generateSchedule = async (stopId: string, stopName: string) => {
    setLoading(prev => ({ ...prev, [stopId]: true }));
    try {
      const response = await fetchWithActAs(`/api/admin/stops/${stopId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overwrite: true,
          slots: ['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_1', 'MIXED_2', 'TIEBREAKER']
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate schedule');
      }

      const result = await response.json();
      onInfo(`Matchups regenerated: ${result.roundsCreated} rounds, ${result.matchesCreated} matches, ${result.gamesCreated} games`);

      // Reload schedule data
      await loadSchedule(stopId, true);

      // Check for duplicate matchups after schedule generation
      setTimeout(() => {
        checkForDuplicateMatchups(stopId, roundMatchups, scheduleData, tournaments, onError);
      }, 100);
    } catch (e) {
      onError(`Failed to generate schedule: ${(e as Error).message}`);
    } finally {
      setLoading(prev => ({ ...prev, [stopId]: false }));
    }
  };

  const saveLineupDeadline = async (stopId: string) => {
    const deadlineValue = lineupDeadlines[stopId];
    if (!deadlineValue) {
      onError('Please select a deadline date and time');
      return;
    }

    setLoading(prev => ({ ...prev, [stopId]: true }));
    try {
      const response = await fetchWithActAs(`/api/admin/stops/${stopId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineupDeadline: deadlineValue,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save lineup deadline');
      }

      onInfo('Lineup deadline saved successfully');
    } catch (e) {
      onError(`Failed to save lineup deadline: ${(e as Error).message}`);
    } finally {
      setLoading(prev => ({ ...prev, [stopId]: false }));
    }
  };

  const copyLineupsFromPreviousRound = useCallback(async (stopId: string, roundIdx: number) => {
    const rounds = scheduleData[stopId];
    if (!rounds || roundIdx <= 0) {
      onInfo('No previous round available to copy lineups from.');
      return;
    }

    const currentRound = rounds[roundIdx];
    const previousRound = rounds[roundIdx - 1];

    if (!currentRound?.matches || !previousRound?.matches) {
      onInfo('No previous round matches found to copy lineups.');
      return;
    }

    const teamLineupMap = new Map<string, PlayerLite[]>();

    previousRound.matches.forEach((prevMatch: any) => {
      const prevMatchLineups = lineups[prevMatch.id];
      if (!prevMatchLineups) return;

      const teamAId = prevMatch.teamA?.id;
      const teamBId = prevMatch.teamB?.id;

      if (teamAId && prevMatchLineups[teamAId]?.length) {
        teamLineupMap.set(teamAId, prevMatchLineups[teamAId].map((p: PlayerLite) => ({ ...p })));
      }
      if (teamBId && prevMatchLineups[teamBId]?.length) {
        teamLineupMap.set(teamBId, prevMatchLineups[teamBId].map((p: PlayerLite) => ({ ...p })));
      }
    });

    const updates: Record<string, Record<string, PlayerLite[]>> = {};
    let copiedTeams = 0;

    currentRound.matches.forEach((match: any) => {
            const matchUpdates: Record<string, PlayerLite[]> = {};

            const applyTeam = (team: any) => {
              if (!team?.id) return;
              const previousLineup = teamLineupMap.get(team.id);
              if (!previousLineup || previousLineup.length === 0) return;
              matchUpdates[team.id] = previousLineup.map((p) => ({ ...p }));
              copiedTeams += 1;
            };

            applyTeam(match.teamA);
            applyTeam(match.teamB);

      if (Object.keys(matchUpdates).length > 0) {
        updates[match.id] = matchUpdates;
      }
    });

    if (Object.keys(updates).length === 0) {
      onInfo('No previous lineups found to copy.');
      return;
    }

    try {
      const response = await fetchWithActAs(`/api/admin/stops/${stopId}/lineups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineups: updates }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to copy lineups');
      }

      setLineups((prev) => {
        const next = { ...prev };
        for (const [matchId, teamMap] of Object.entries(updates)) {
          const existing = { ...(next[matchId] ?? {}) };
          for (const [teamId, players] of Object.entries(teamMap)) {
            existing[teamId] = players.map((p) => ({ ...p }));
          }
          next[matchId] = existing;
        }
        return next;
      });

      await Promise.all(Object.keys(updates).map((matchId) => loadGamesForMatch(matchId, true)));

      onInfo(`Copied previous lineups for ${copiedTeams} team${copiedTeams === 1 ? '' : 's'}.`);
    } catch (error) {
      console.error('Error copying previous lineups:', error);
      onError(error instanceof Error ? error.message : 'Failed to copy lineups');
    }
  }, [scheduleData, lineups, onError, onInfo]);

  const autoSaveRoundMatchups = async (roundId: string) => {
    const matches = roundMatchups[roundId];
    if (!matches) return;

    try {
      const updates = matches.map(match => ({
        gameId: match.id,
        teamAId: match.teamA?.id || null,
        teamBId: match.teamB?.id || null,
      }));

      await fetchWithActAs(`/api/admin/rounds/${roundId}/matchups`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
    } catch (e) {
      onError((e as Error).message);
    }
  };

  const saveRoundMatchups = async (roundId: string) => {
    const matches = roundMatchups[roundId];
    if (!matches) return;

    try {
      const updates = matches.map(match => ({
        gameId: match.id,
        teamAId: match.teamA?.id || null,
        teamBId: match.teamB?.id || null,
      }));

      await fetchWithActAs(`/api/admin/rounds/${roundId}/matchups`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });

      setEditingRounds(prev => {
        const newSet = new Set(prev);
        newSet.delete(roundId);
        return newSet;
      });

      const stopId = Object.keys(scheduleData).find(stopId =>
        scheduleData[stopId].some((round: any) => round.id === roundId)
      );
      if (stopId) {
        await loadSchedule(stopId, true);
        await loadRoundMatchups(roundId);
      }

      onInfo('Matchups confirmed and saved!');
    } catch (e) {
      onError((e as Error).message);
    }
  };

  const loadGamesForMatch = async (matchId: string, force = false) => {
    if (!force && games[matchId]) return;

    try {
      const response = await fetchWithActAs(`/api/admin/matches/${matchId}/games`, { cache: 'no-store' });
      if (response.ok) {
        const gamesData = await response.json();
        setGames(prev => ({ ...prev, [matchId]: gamesData }));
      } else if (response.status === 404) {
        console.warn(`Match ${matchId} not found, removing from games state`);
        setGames(prev => {
          const { [matchId]: removed, ...rest } = prev;
          return rest;
        });
      } else {
        console.error(`Failed to load games for match ${matchId}:`, response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error loading games:', error);
    }
  };


  const startGame = async (gameId: string) => {
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

      // Update local state
      setGames(prev => {
        const updated = { ...prev };
        for (const matchId in updated) {
          updated[matchId] = updated[matchId]?.map(g =>
            g.id === gameId ? { ...g, startedAt: new Date().toISOString(), isComplete: false } : g
          );
        }
        return updated;
      });
    } catch (error) {
      onError(`Failed to start game: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const endGame = async (gameId: string) => {
    try {
      let gameToCheck: any = null;
      let parentMatchId: string | null = null;
      for (const [matchId, matchGames] of Object.entries(games)) {
        const foundGame = matchGames?.find(game => game.id === gameId);
        if (foundGame) {
          gameToCheck = foundGame;
          parentMatchId = matchId;
          break;
        }
      }

      if (!gameToCheck || !parentMatchId) {
        throw new Error('Game not found');
      }

      const teamAScore = gameToCheck.teamAScore || 0;
      const teamBScore = gameToCheck.teamBScore || 0;

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

      // Update local state
      setGames(prev => {
        const updated = { ...prev };
        for (const matchId in updated) {
          updated[matchId] = updated[matchId]?.map(g =>
            g.id === gameId ? { ...g, isComplete: true, endedAt: new Date().toISOString() } : g
          );
        }
        return updated;
      });

      // Give the server a moment to calculate tiebreaker status
      await new Promise(resolve => setTimeout(resolve, 500));

      // Reload games for this specific match
      await loadGamesForMatch(parentMatchId, true);

      // Also fetch the match to get updated tiebreaker status
      try {
        const matchResponse = await fetchWithActAs(`/api/admin/matches/${parentMatchId}`);
        if (matchResponse.ok) {
          const matchData = await matchResponse.json();
          // Update the schedule data with the new tiebreaker status
          setScheduleData(prev => ({
            ...prev,
            [selectedStopId || '']: (prev[selectedStopId || ''] || []).map(round => ({
              ...round,
              matches: (round.matches || []).map((m: any) =>
                m.id === parentMatchId
                  ? { ...m, tiebreakerStatus: matchData.tiebreakerStatus, tiebreakerWinnerTeamId: matchData.tiebreakerWinnerTeamId }
                  : m
              )
            }))
          }));
        }
      } catch (err) {
        console.error('Failed to fetch match status:', err);
      }
    } catch (error) {
      onError(`Failed to end game: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const reopenGame = async (gameId: string) => {
    try {
      let parentMatchId: string | null = null;
      for (const [matchId, matchGames] of Object.entries(games)) {
        const foundGame = matchGames?.find(game => game.id === gameId);
        if (foundGame) {
          parentMatchId = matchId;
          break;
        }
      }

      if (!parentMatchId) {
        throw new Error('Game not found');
      }

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

      // Update local state
      setGames(prev => {
        const updated = { ...prev };
        for (const matchId in updated) {
          updated[matchId] = updated[matchId]?.map(g =>
            g.id === gameId ? { ...g, isComplete: false, endedAt: null } : g
          );
        }
        return updated;
      });

      // Give the server a moment to recalculate tiebreaker status
      await new Promise(resolve => setTimeout(resolve, 500));

      // Reload games for this specific match
      await loadGamesForMatch(parentMatchId, true);

      // Also fetch the match to get updated tiebreaker status
      try {
        const matchResponse = await fetchWithActAs(`/api/admin/matches/${parentMatchId}`);
        if (matchResponse.ok) {
          const matchData = await matchResponse.json();
          // Update the schedule data with the new tiebreaker status
          setScheduleData(prev => ({
            ...prev,
            [selectedStopId || '']: (prev[selectedStopId || ''] || []).map(round => ({
              ...round,
              matches: (round.matches || []).map((m: any) =>
                m.id === parentMatchId
                  ? { ...m, tiebreakerStatus: matchData.tiebreakerStatus, tiebreakerWinnerTeamId: matchData.tiebreakerWinnerTeamId }
                  : m
              )
            }))
          }));
        }
      } catch (err) {
        console.error('Failed to fetch match status:', err);
      }
    } catch (error) {
      onError(`Failed to reopen game: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const updateGameScore = async (gameId: string, teamAScore: number | null, teamBScore: number | null) => {
    if (debouncedScoreUpdate.current[gameId]) {
      clearTimeout(debouncedScoreUpdate.current[gameId]);
    }

    setGames(prev => {
      const newGames = { ...prev };
      Object.keys(newGames).forEach(matchId => {
        newGames[matchId] = newGames[matchId].map(game =>
          game.id === gameId ? { ...game, teamAScore, teamBScore } : game
        );
      });
      return newGames;
    });

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

        // Find which match this game belongs to using response data first
        const updatedGame = await response.json();
        let matchIdForGame: string | null = updatedGame.matchId ?? null;

        if (!matchIdForGame) {
          for (const [matchId, matchGames] of Object.entries(games)) {
            if (matchGames?.find((g) => g.id === gameId)) {
              matchIdForGame = matchId;
              break;
            }
          }
        }

        // Give the server a moment to calculate tiebreaker status
        await new Promise(resolve => setTimeout(resolve, 500));

        // Reload games for this specific match to get updated scores
        if (matchIdForGame) {
          await loadGamesForMatch(matchIdForGame, true);

          try {
            const matchResponse = await fetchWithActAs(`/api/admin/matches/${matchIdForGame}`);
            if (matchResponse.ok) {
              const matchData = await matchResponse.json();

              setScheduleData(prev => ({
                ...prev,
                [selectedStopId || '']: (prev[selectedStopId || ''] || []).map(round => ({
                  ...round,
                  matches: (round.matches || []).map((m: any) =>
                    m.id === matchIdForGame
                      ? {
                          ...m,
                          tiebreakerStatus: matchData.tiebreakerStatus,
                          tiebreakerWinnerTeamId: matchData.tiebreakerWinnerTeamId,
                          totalPointsTeamA: matchData.totalPointsTeamA,
                          totalPointsTeamB: matchData.totalPointsTeamB,
                          forfeitTeam: matchData.forfeitTeam,
                        }
                      : m
                  )
                }))
              }));
            }
          } catch (err) {
            console.error('Failed to fetch match status:', err);
          }
        }
      } catch (error) {
        console.error('Error updating game score:', error);
      }
    }, 500);
  };

  const updateGameCourtNumber = async (gameId: string, courtNumber: string) => {
    if (debouncedCourtUpdate.current[gameId]) {
      clearTimeout(debouncedCourtUpdate.current[gameId]);
    }

    setGames(prev => {
      const newGames = { ...prev };
      Object.keys(newGames).forEach(matchId => {
        newGames[matchId] = newGames[matchId].map(game =>
          game.id === gameId ? { ...game, courtNumber } : game
        );
      });
      return newGames;
    });

    debouncedCourtUpdate.current[gameId] = setTimeout(async () => {
      try {
        const response = await fetchWithActAs(`/api/admin/games/${gameId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courtNumber })
        });

        if (!response.ok) {
          throw new Error('Failed to update court number');
        }
      } catch (error) {
        console.error('Error updating court number:', error);
      }
    }, 500);
  };

  const hasAnyMatchStarted = (round: any) => {
    if (!round || !round.matches) return false;
    return round.matches.some((match: any) => {
      const matchGames = games[match.id] ?? match.games ?? [];
      return matchGames.some((game: any) =>
        getGameStatus(game) === 'in_progress' || getGameStatus(game) === 'completed'
      );
    });
  };

  const getMatchesForRound = useCallback((round: any, isEditing: boolean) => {
    const matches = isEditing ? (roundMatchups[round.id] || round.matches) : round.matches;
    return matches;
  }, [roundMatchups]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const activeId = event.active.id as string;
    setActiveId(activeId);
    setIsDragging(true);
    setDragPreview(null);
  }, []);

  const handleDragOver = useCallback((event: any) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      setDragPreview(null);
      return;
    }

    const activeData = active.data.current;
    const overData = over.data.current;

    if (!activeData || !overData || activeData.bracketName !== overData.bracketName) {
      setDragPreview(null);
      return;
    }

    setDragPreview({
      sourceId: active.id,
      targetId: over.id,
      sourceTeam: activeData.team,
      targetTeam: overData.team
    });
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);
    setIsDragging(false);
    setDragPreview(null);

    if (!over || active.id === over.id) {
      return;
    }

    const activeData = active.data.current;
    const overData = over.data.current;

    if (!activeData || !overData) {
      return;
    }

    if (activeData.bracketName !== overData.bracketName) {
      return;
    }

    const sourceLocalMatchIndex = activeData.matchIndex;
    const targetLocalMatchIndex = overData.matchIndex;
    const sourceTeamPosition = activeData.teamPosition;
    const targetTeamPosition = overData.teamPosition;
    const roundId = activeData.roundId;
    const bracketName = activeData.bracketName;

    const currentMatches = [...(roundMatchups[roundId] || [])];
    const bracketMatches = currentMatches.filter(match =>
      (match.teamA?.bracketName || match.teamB?.bracketName) === bracketName
    );

    const sourceGlobalIndex = currentMatches.findIndex(match =>
      (match.teamA?.bracketName || match.teamB?.bracketName) === bracketName &&
      bracketMatches.indexOf(match) === sourceLocalMatchIndex
    );
    const targetGlobalIndex = currentMatches.findIndex(match =>
      (match.teamA?.bracketName || match.teamB?.bracketName) === bracketName &&
      bracketMatches.indexOf(match) === targetLocalMatchIndex
    );

    if (sourceGlobalIndex === -1 || targetGlobalIndex === -1) {
      return;
    }

    const sourceMatch = { ...currentMatches[sourceGlobalIndex] };
    const targetMatch = { ...currentMatches[targetGlobalIndex] };

    const sourceTeam = activeData.team;
    const targetTeam = overData.team;

    if (sourceTeamPosition === 'A' && targetTeamPosition === 'A') {
      sourceMatch.teamA = targetTeam;
      targetMatch.teamA = sourceTeam;
    } else if (sourceTeamPosition === 'B' && targetTeamPosition === 'B') {
      sourceMatch.teamB = targetTeam;
      targetMatch.teamB = sourceTeam;
    } else if (sourceTeamPosition === 'A' && targetTeamPosition === 'B') {
      sourceMatch.teamA = targetTeam;
      targetMatch.teamB = sourceTeam;
    } else if (sourceTeamPosition === 'B' && targetTeamPosition === 'A') {
      sourceMatch.teamB = targetTeam;
      targetMatch.teamA = sourceTeam;
    }

    const newMatches = [...currentMatches];
    newMatches[sourceGlobalIndex] = sourceMatch;
    newMatches[targetGlobalIndex] = targetMatch;

    setRoundMatchups(prev => ({
      ...prev,
      [roundId]: newMatches
    }));

    try {
      await autoSaveRoundMatchups(roundId);
    } catch (error) {
      // Handle error silently
    }

  }, [roundMatchups, autoSaveRoundMatchups]);

  const resolveMatchByPoints = async (match: any) => {
    if (!match) return;
    const derivedStatus = deriveMatchStatus(match);
    if (derivedStatus !== 'tied_requires_tiebreaker' && derivedStatus !== 'needs_decision') {
      onInfo('This match is not currently in a state where it can be decided by points.');
      return;
    }

    const teamAName = match.teamA?.name || 'Team A';
    const teamBName = match.teamB?.name || 'Team B';
    const confirmMessage = `Confirm using total points to decide ${teamAName} vs ${teamBName}?`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setResolvingMatch(match.id);

      const response = await fetchWithActAs(`/api/admin/matches/${match.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decideByPoints: true }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to decide match by points');
      }

      const result = await response.json();

      await loadGamesForMatch(match.id, true);

      setScheduleData(prev => ({
        ...prev,
        [selectedStopId || '']: (prev[selectedStopId || ''] || []).map(round => ({
          ...round,
          matches: (round.matches || []).map((m: any) =>
            m.id === match.id
              ? {
                  ...m,
                  tiebreakerStatus: result?.match?.tiebreakerStatus || 'DECIDED_POINTS',
                  tiebreakerWinnerTeamId: result?.match?.tiebreakerWinnerTeamId || m.tiebreakerWinnerTeamId,
                  totalPointsTeamA: result?.match?.totalPointsTeamA ?? m.totalPointsTeamA,
                  totalPointsTeamB: result?.match?.totalPointsTeamB ?? m.totalPointsTeamB,
                  forfeitTeam: result?.match?.forfeitTeam ?? m.forfeitTeam,
                }
              : m
          )
        }))
      }));

      onInfo('Match decided by total points');
    } catch (error) {
      console.error('Resolve match by points error:', error);
      onError(error instanceof Error ? error.message : 'Failed to decide match by points');
    } finally {
      setResolvingMatch(null);
    }
  };

  const scheduleTiebreakerGame = async (match: any) => {
    if (!match) return;
    const derivedStatus = deriveMatchStatus(match);
    if (!['tied_requires_tiebreaker', 'tied_pending', 'needs_decision'].includes(derivedStatus)) {
      onInfo('This match does not currently allow a tiebreaker.');
      return;
    }

    try {
      setResolvingMatch(match.id);
      const response = await fetchWithActAs(`/api/admin/matches/${match.id}/games`, {
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

      const result = await response.json();

      await loadGamesForMatch(match.id, true);

      const newStatus = result?.tiebreakerStatus || 'REQUIRES_TIEBREAKER';

      setScheduleData(prev => ({
        ...prev,
        [selectedStopId || '']: (prev[selectedStopId || ''] || []).map(round => ({
          ...round,
          matches: (round.matches || []).map((m: any) =>
            m.id === match.id
              ? {
                  ...m,
                  tiebreakerStatus: newStatus,
                }
              : m
          )
        }))
      }));

      onInfo('Tiebreaker game created');
    } catch (error) {
      console.error('Schedule tiebreaker error:', error);
      onError(error instanceof Error ? error.message : 'Failed to schedule tiebreaker');
    } finally {
      setResolvingMatch(null);
    }
  };

  const forfeitMatch = async (match: any, forfeitTeam: 'A' | 'B') => {
    if (!match) return;

    const forfeitingTeamName = forfeitTeam === 'A' ? (match.teamA?.name || 'Team A') : (match.teamB?.name || 'Team B');
    const winningTeamName = forfeitTeam === 'A' ? (match.teamB?.name || 'Team B') : (match.teamA?.name || 'Team A');

    const confirmMessage = `${forfeitingTeamName} will forfeit to ${winningTeamName}. Continue?`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setResolvingMatch(`${match.id}-forfeit${forfeitTeam}`);

      const response = await fetchWithActAs(`/api/admin/matches/${match.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forfeitTeam }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to forfeit match');
      }

      const result = await response.json();

      await loadGamesForMatch(match.id, true);

      setScheduleData(prev => ({
        ...prev,
        [selectedStopId || '']: (prev[selectedStopId || ''] || []).map(round => ({
          ...round,
          matches: (round.matches || []).map((m: any) =>
            m.id === match.id
              ? {
                  ...m,
                  forfeitTeam: result?.match?.forfeitTeam ?? forfeitTeam,
                  tiebreakerStatus: result?.match?.tiebreakerStatus ?? 'NONE',
                  tiebreakerWinnerTeamId: result?.match?.tiebreakerWinnerTeamId ?? (forfeitTeam === 'A' ? match.teamB?.id ?? null : match.teamA?.id ?? null),
                  totalPointsTeamA:
                    result?.match?.totalPointsTeamA ??
                    (forfeitTeam === 'A' ? 0 : match.totalPointsTeamA ?? 0),
                  totalPointsTeamB:
                    result?.match?.totalPointsTeamB ??
                    (forfeitTeam === 'B' ? 0 : match.totalPointsTeamB ?? 0),
                }
              : m
          )
        }))
      }));

      onInfo(`${forfeitingTeamName} forfeited. ${winningTeamName} wins.`);
    } catch (error) {
      console.error('Forfeit match error:', error);
      onError(error instanceof Error ? error.message : 'Failed to forfeit match');
    } finally {
      setResolvingMatch(null);
    }
  };

  // Since we now only show one tournament at a time, simplify the structure
  const tournament = tournaments[0];

  if (!tournament) {
    return (
      <div className="text-center py-8 text-muted">
        You are not assigned as an event manager for any tournaments.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Stop tabs navigation */}
      <div className="border-b border-border-subtle mb-6">
        <nav className="flex gap-1 -mb-px" aria-label="Tabs">
          {tournament.stops.map((stop) => (
            <button
              key={stop.stopId}
              onClick={() => {
                setSelectedStopId(stop.stopId);
                loadSchedule(stop.stopId);
              }}
              className={`tab-button ${
                selectedStopId === stop.stopId ? 'active' : ''
              }`}
            >
              {stop.stopName}
            </button>
          ))}
        </nav>
      </div>

      {/* Stop content */}
      {selectedStopId && (() => {
                const stop = tournament.stops.find(s => s.stopId === selectedStopId);
                if (!stop) return null;

                const stopSchedule = scheduleData[stop.stopId] ?? [];
                if (stopSchedule.length > 0) {
                }
                const stopHasAnyGameStarted = stopSchedule.some((round: any) => hasAnyMatchStarted(round));
                const totalMatches = stopSchedule.reduce(
                  (acc: number, r: any) => acc + (r.matches?.length || 0),
                  0
                );
                // Count only games that were actually played (have scores)
                const totalGames = stopSchedule.reduce(
                  (acc: number, r: any) =>
                    acc + (r.matches?.reduce((matchAcc: number, m: any) => {
                      const matchGames = games[m.id] ?? m.games ?? [];
                      if (!Array.isArray(matchGames)) return matchAcc;
                      
                      // Count only games with actual scores (played games)
                      const playedGames = matchGames.filter((game: any) => 
                        game.teamAScore !== null && game.teamBScore !== null
                      );
                      return matchAcc + playedGames.length;
                    }, 0) || 0),
                  0
                );

                return (
                  <div>
                    <div className="flex items-center justify-between mb-6 p-4 bg-surface-2 rounded-lg border border-border-subtle">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-sm font-semibold text-primary">
                            <span className="text-muted font-normal">Location:</span> {stop.locationName || 'TBD'}
                          </h3>
                          <span className="text-xs text-muted">
                            {formatDateRange(stop.startAt ?? null, stop.endAt ?? null)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted">
                          <span className="chip chip-info text-[10px] px-2 py-0.5">{stopSchedule.length} Rounds</span>
                          <span>{totalMatches} Matches</span>
                          <span>{totalGames} Games</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {stopHasAnyGameStarted ? (
                          // After tournament has started: just show the deadline (non-editable)
                          stop.lineupDeadline && (
                            <div className="text-sm text-secondary">
                              <span className="font-medium">Lineup Deadline:</span> {formatDeadline(stop.lineupDeadline)}
                            </div>
                          )
                        ) : (
                          // Before tournament starts: show editable deadline
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-muted">Lineup Deadline</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="datetime-local"
                                value={lineupDeadlines[stop.stopId] || ''}
                                onChange={(e) => setLineupDeadlines(prev => ({ ...prev, [stop.stopId]: e.target.value }))}
                                className="input input-sm text-xs"
                                style={{ minWidth: '200px' }}
                              />
                              <button
                                className="btn btn-sm btn-secondary disabled:opacity-50"
                                onClick={() => saveLineupDeadline(stop.stopId)}
                                disabled={loading[stop.stopId] || !lineupDeadlines[stop.stopId]}
                              >
                                Save Deadline
                              </button>
                            </div>
                            {stop.lineupDeadline && (
                              <span className="text-xs text-muted">
                                Current: {formatDeadline(stop.lineupDeadline)}
                              </span>
                            )}
                          </div>
                        )}
                        {!stopHasAnyGameStarted && (
                        <button
                          className="btn btn-primary disabled:opacity-50"
                          onClick={() => generateSchedule(stop.stopId, stop.stopName)}
                          disabled={loading[stop.stopId] || stopHasAnyGameStarted}
                        >
                          {loading[stop.stopId] ? 'Regenerating...' : 'Regenerate Matchups'}
                        </button>
                        )}
                      </div>
                    </div>

                    <div className="bg-surface-1">
                      {loading[stop.stopId] ? (
                        <div className="p-6">
                          <ScheduleSkeleton roundCount={3} />
                        </div>
                      ) : stopSchedule.length === 0 ? (
                        <div className="text-center py-4 text-muted">
                          No matchups generated yet. Click "Regenerate Matchups" to create them.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {stopSchedule.map((round: any, roundIdx: number) => {
                            const previousRoundAvailable = roundIdx > 0 && !!stopSchedule[roundIdx - 1];
                            const isEditing = editingRounds.has(round.id);
                            const matches = getMatchesForRound(round, isEditing);
                            const tiebreakerAlerts = gatherRoundTiebreakerAlerts(matches, deriveMatchStatus).filter(alert =>
                              // Filter out "decided_points" and "tiebreaker played" alerts
                              !alert.message.includes('decided via total points') && !alert.message.includes('tiebreaker played')
                            );
                            const roundHasStarted = hasAnyMatchStarted(round);
                            const roundHasCompletedAllMatches = matches.length > 0 && matches.every((match: any) => {
                              const matchStatus = deriveMatchStatus(match);
                              // Check for explicitly decided matches (by points or tiebreaker)
                              if (matchStatus === 'completed' || matchStatus === 'decided_points' || matchStatus === 'decided_tiebreaker') return true;

                              const matchGames = games[match.id] ?? match.games ?? [];

                              if (matchGames.length === 0) {
                                return false;
                              }

                              let teamAWins = 0;
                              let teamBWins = 0;

                              for (const game of matchGames) {
                                if (!game) continue;

                                const status = getGameStatus(game);
                                if (status === 'in_progress') {
                                  return false;
                                }

                                const a = game.teamAScore;
                                const b = game.teamBScore;

                                if (a != null && b != null) {
                                  if (a > b) teamAWins += 1;
                                  else if (b > a) teamBWins += 1;
                                }
                              }

                              return (teamAWins >= 3 || teamBWins >= 3) && teamAWins !== teamBWins;
                            });

                            const _ = updateKey;

                            return (
                              <div key={`${round.id}-${renderKey}-${updateKey}`} className="border-2 border-border-medium rounded-lg overflow-hidden bg-surface-1">
                                <div
                                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-2 transition-colors bg-surface-2"
                                  onClick={() => toggleRound(round.id)}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`transform transition-transform text-secondary ${expandedRounds.has(round.id) ? 'rotate-90' : ''}`}>
                                      ▶
                                    </div>
                                    <div>
                                      <h4 className="font-semibold text-base text-primary">Round {round.idx + 1}</h4>
                                      <p className="text-xs text-muted mt-0.5">{matches.length} matches</p>
                                    </div>
                                    {roundHasCompletedAllMatches && (
                                      <span className="chip chip-success text-[10px] px-2 py-0.5">Complete</span>
                                    )}
                                    {roundHasStarted && !roundHasCompletedAllMatches && (
                                      <span className="chip chip-warning text-[10px] px-2 py-0.5">In Progress</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {previousRoundAvailable && !roundHasStarted && (
                                      <button
                                        className="btn btn-ghost text-xs"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          copyLineupsFromPreviousRound(stop.stopId, roundIdx);
                                        }}
                                      >
                                        Copy Previous Lineups
                                      </button>
                                    )}
                                    {isEditing ? (
                                      <button
                                        className="btn btn-secondary text-xs"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          saveRoundMatchups(round.id);
                                        }}
                                      >
                                        Confirm Matchups
                                      </button>
                                    ) : !roundHasStarted ? (
                                      <button
                                        className="btn btn-ghost text-xs"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleRoundEdit(round.id);
                                        }}
                                      >
                                        Edit Matchups
                                      </button>
                                    ) : null}
                                  </div>
                                </div>

                                {expandedRounds.has(round.id) && (
                                  <div className="p-6 border-t border-border-subtle bg-app">
                                    {isEditing && (
                                      <div className="mb-4 p-3 bg-info/10 border-l-4 border-info rounded text-sm text-info">
                                        <strong className="font-semibold">Drag teams to swap:</strong> Drag any team over another team to swap their positions.
                                      </div>
                                    )}

                                    {tiebreakerAlerts.length > 0 && (
                                      <div className="mb-4 space-y-2">
                                        {tiebreakerAlerts.map((alert, idx) => {
                                          const toneToStyles: Record<string, string> = {
                                            warning: 'bg-warning/10 border-warning/40 text-warning-dark',
                                            info: 'bg-info/10 border-info/40 text-info-dark',
                                            success: 'bg-success/10 border-success/40 text-success-dark',
                                          };
                                          return (
                                            <div
                                              key={`round-${round.id}-alert-${idx}`}
                                              className={`rounded-lg border px-3 py-2 text-sm ${toneToStyles[alert.tone] || 'bg-surface-2 border-border-subtle text-secondary'}`}
                                            >
                                              {alert.message}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}

                                    {(() => {
                                      const matchesByBracket: Record<string, any[]> = {};

                                      matches.forEach((match: any, matchIdx: number) => {
                                        const bracketName = match.bracketName || 'Unknown Bracket';

                                        if (!matchesByBracket[bracketName]) {
                                          matchesByBracket[bracketName] = [];
                                        }

                                        matchesByBracket[bracketName].push({ ...match, originalIndex: matchIdx });
                                      });

                                      Object.keys(matchesByBracket).forEach(bracketName => {
                                        matchesByBracket[bracketName].forEach((match: any, localIdx: number) => {
                                          match.localIndex = localIdx;
                                        });
                                      });

                                      return Object.entries(matchesByBracket).map(([bracketName, bracketMatches]) => (
                                        <div key={bracketName} className="space-y-4 mb-6 last:mb-0">
                                          {isEditing ? (
                                              <DndContext
                                                collisionDetection={closestCenter}
                                                onDragStart={handleDragStart}
                                                onDragOver={handleDragOver}
                                                onDragEnd={handleDragEnd}
                                              >
                                                <SortableContext
                                                  items={bracketMatches.map((match: any) => [
                                                    `${round.id}-${bracketName}-${match.localIndex}-A`,
                                                    `${round.id}-${bracketName}-${match.localIndex}-B`
                                                  ]).flat()}
                                                  strategy={noReorderStrategy}
                                                >
                                                  <div className="space-y-3">
                                                    {bracketMatches.map((match: any, localMatchIdx: number) => {
                                                      const localIndex = match.localIndex;
                                                      return (
                                                        <div key={`${match.id}-${localIndex}`} className="rounded-lg border border-dashed border-subtle bg-surface-2 p-3 shadow-sm">
                                                          <div className="mb-3 flex items-center justify-between text-xs text-muted">
                                                            <span>Match {match.originalIndex + 1}</span>
                                                            {match.isBye && (
                                                              <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
                                                                Bye
                                                              </span>
                                                            )}
                                                          </div>

                                                          {!match.isBye ? (
                                                            <div className="grid gap-3 md:grid-cols-2">
                                                              <DraggableTeam
                                                                team={match.teamA}
                                                                teamPosition="A"
                                                                roundId={round.id}
                                                                matchIndex={localIndex}
                                                                bracketName={bracketName}
                                                                isDragging={
                                                                  activeId === `${round.id}-${bracketName}-${localIndex}-A` ||
                                                                  (dragPreview && (
                                                                    dragPreview.sourceId === `${round.id}-${bracketName}-${localIndex}-A` ||
                                                                    dragPreview.targetId === `${round.id}-${bracketName}-${localIndex}-A`
                                                                  )) || false
                                                                }
                                                                dragPreview={dragPreview}
                                                              />

                                                              <DraggableTeam
                                                                team={match.teamB}
                                                                teamPosition="B"
                                                                roundId={round.id}
                                                                matchIndex={localIndex}
                                                                bracketName={bracketName}
                                                                isDragging={
                                                                  activeId === `${round.id}-${bracketName}-${localIndex}-B` ||
                                                                  (dragPreview && (
                                                                    dragPreview.sourceId === `${round.id}-${bracketName}-${localIndex}-B` ||
                                                                    dragPreview.targetId === `${round.id}-${bracketName}-${localIndex}-B`
                                                                  )) || false
                                                                }
                                                                dragPreview={dragPreview}
                                                              />
                                                            </div>
                                                          ) : (
                                                            <div className="flex items-center gap-3 text-sm">
                                                              <span className="font-medium">
                                                                {match.teamA?.name || 'TBD'} vs {match.teamB?.name || 'TBD'}
                                                              </span>
                                                            </div>
                                                          )}
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                </SortableContext>
                                              </DndContext>
                                            ) : (
                                              <div className="space-y-5">
                                                {bracketMatches.map((match: any) => {
                                                  const matchId = match.id;
                                                      const matchStatus = deriveMatchStatus(match);
                                                      const matchGames = games[matchId] ?? match.games ?? [];
                                                      const tiebreakerGame = matchGames.find((g: any) => g.slot === 'TIEBREAKER');
                                                      const isDecided = ['completed', 'decided_points', 'decided_tiebreaker'].includes(matchStatus) || !!match.forfeitTeam;
                                                      const isTiePending = matchStatus === 'tied_requires_tiebreaker' || matchStatus === 'needs_decision' || matchStatus === 'tied_pending';
                                                  const teamALineup = match.teamA?.id ? (lineups[matchId]?.[match.teamA.id] ?? []) : [];
                                                  const teamBLineup = match.teamB?.id ? (lineups[matchId]?.[match.teamB.id] ?? []) : [];
                                                  const hasAnyGameStarted = matchGames.some((game: any) =>
                                                    getGameStatus(game) === 'in_progress' || getGameStatus(game) === 'completed'
                                                  );
                                                  // Disable lineup editing once match is decided OR any game has started
                                                  const canEditLineups = !isDecided && !hasAnyGameStarted;
                                                  const isEditingThisMatch = editingMatch === match.id;

                                                  return (
                                                    <div key={matchId} className="card">
                                                      {/* Match Header */}
                                                      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4">
                                                        <div>
                                                          <h3 className="text-base font-semibold text-primary">
                                                            {(() => {
                                                              const bracketLabel = match.bracketName || match.teamA?.bracketName || match.teamB?.bracketName;
                                                              const teamAName = match.teamA?.name || 'Team A';
                                                              const teamBName = match.teamB?.name || 'Team B';

                                                              // Remove bracket name from team names if it exists
                                                              const cleanTeamAName = bracketLabel && teamAName.endsWith(` ${bracketLabel}`)
                                                                ? teamAName.replace(` ${bracketLabel}`, '')
                                                                : teamAName;
                                                              const cleanTeamBName = bracketLabel && teamBName.endsWith(` ${bracketLabel}`)
                                                                ? teamBName.replace(` ${bracketLabel}`, '')
                                                                : teamBName;

                                                              const matchupText = `${cleanTeamAName} vs ${cleanTeamBName}`;
                                                              return bracketLabel ? `${matchupText} - ${bracketLabel}` : matchupText;
                                                            })()}
                                                          </h3>
                                                        </div>

                                                        {/* Match Status Badge */}
                                                        {isDecided && (
                                                          <div className="text-xs font-semibold px-2 py-1 bg-success/20 text-success rounded">
                                                            ✓ Complete
                                                          </div>
                                                        )}

                                                        {/* Manager Actions */}
                                                        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 w-full sm:w-auto">
                                                      {!match.forfeitTeam && !isDecided && (matchStatus === 'needs_decision' || (matchStatus === 'tied_pending' && totalPointsDisagree(match.totalPointsTeamA, match.totalPointsTeamB))) && (
                                                            <button
                                                              className="btn btn-xs btn-secondary flex-1 sm:flex-none"
                                                              disabled={resolvingMatch === match.id}
                                                              onClick={() => resolveMatchByPoints(match)}
                                                            >
                                                              {resolvingMatch === match.id ? 'Resolving...' : 'Decide by Points'}
                                                            </button>
                                                          )}
                                                          {!match.forfeitTeam && !isDecided && (matchStatus === 'tied_requires_tiebreaker' || matchStatus === 'needs_decision' || (matchStatus === 'tied_pending' && totalPointsDisagree(match.totalPointsTeamA, match.totalPointsTeamB))) && (matchStatus !== 'needs_decision' ? !tiebreakerGame : true) && (
                                                            <button
                                                              className="btn btn-xs btn-primary flex-1 sm:flex-none"
                                                              disabled={resolvingMatch === match.id}
                                                              onClick={() => scheduleTiebreakerGame(match)}
                                                            >
                                                              {resolvingMatch === match.id ? 'Creating...' : 'Add Tiebreaker'}
                                                            </button>
                                                          )}
                                                      {!match.forfeitTeam && !isDecided && (
                                                            <div className="flex gap-2 flex-1 sm:flex-none">
                                                              <button
                                                                className="btn btn-xs bg-error hover:bg-error/80 text-white border-error flex-1 sm:flex-none"
                                                                style={{ fontSize: '0.675rem', whiteSpace: 'nowrap', overflow: 'visible' }}
                                                                disabled={resolvingMatch === `${match.id}-forfeitA`}
                                                                onClick={() => forfeitMatch(match, 'A')}
                                                              >
                                                                {resolvingMatch === `${match.id}-forfeitA` ? 'Processing...' : `Forfeit ${match.teamA?.name || 'Team A'}`}
                                                              </button>
                                                              <button
                                                                className="btn btn-xs bg-error hover:bg-error/80 text-white border-error flex-1 sm:flex-none"
                                                                style={{ fontSize: '0.675rem', whiteSpace: 'nowrap', overflow: 'visible' }}
                                                                disabled={resolvingMatch === `${match.id}-forfeitB`}
                                                                onClick={() => forfeitMatch(match, 'B')}
                                                              >
                                                                {resolvingMatch === `${match.id}-forfeitB` ? 'Processing...' : `Forfeit ${match.teamB?.name || 'Team B'}`}
                                                              </button>
                                                            </div>
                                                          )}
                                                        </div>
                                                      </div>

                                                      {/* Total Points Summary */}
                                                      {!match.forfeitTeam && matchStatus !== 'tied_requires_tiebreaker' && matchStatus !== 'tied_pending' && match.totalPointsTeamA !== null && match.totalPointsTeamB !== null && (
                                                        <div className="bg-surface-2 rounded px-3 py-2 text-sm mb-3">
                                                          <div className="flex justify-between items-center gap-4">
                                                            <div className="flex-1">
                                                              <div className="text-muted text-xs mb-1">Total Points:</div>
                                                              <div className="font-semibold">{match.teamA?.name || 'Team A'}: <span className="text-success">{match.totalPointsTeamA}</span></div>
                                                            </div>
                                                            <div className="flex-1 text-right">
                                                              <div className="text-muted text-xs mb-1">Total Points:</div>
                                                              <div className="font-semibold">{match.teamB?.name || 'Team B'}: <span className="text-success">{match.totalPointsTeamB}</span></div>
                                                            </div>
                                                          </div>
                                                        </div>
                                                      )}

                                                      <div className="mt-3 space-y-3">
                                                        {isEditingThisMatch ? (
                                                          match.teamA?.id && match.teamB?.id ? (
                                                            <InlineLineupEditor
                                                              matchId={match.id}
                                                              stopId={round.stopId}
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

                                                                  const response = await fetchWithActAs(`/api/admin/stops/${stop.stopId}/lineups`, {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({
                                                                      lineups: {
                                                                        [match.id]: {
                                                                          [match.teamA.id]: lineupData.teamA,
                                                                          [match.teamB.id]: lineupData.teamB,
                                                                        },
                                                                      },
                                                                    }),
                                                                  });

                                                                  if (!response.ok) {
                                                                    const errorText = await response.text();
                                                                    throw new Error(`Save failed: ${response.status} ${errorText}`);
                                                                  }

                                                                  // Reload schedule to pick up saved lineups
                                                                  await loadSchedule(stop.stopId, true);

                                                                  // Update local state after reload completes
                                                                  setLineups(prev => ({
                                                                    ...prev,
                                                                    [match.id]: {
                                                                      [match.teamA.id]: lineupData.teamA,
                                                                      [match.teamB.id]: lineupData.teamB,
                                                                    },
                                                                  }));

                                                                  setEditingMatch(null);
                                                                  onInfo('Lineups saved successfully!');
                                                                } catch (error) {
                                                                  console.error('Error saving lineups:', error);
                                                                  onError(`Failed to save lineups: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                                                }
                                                              }}
                                                              onCancel={() => setEditingMatch(null)}
                                                            />
                                                          ) : (
                                                            <div className="text-sm text-warning">
                                                              Unable to edit lineups because this match is missing team assignments.
                                                            </div>
                                                          )
                                                        ) : (
                                                          !hasAnyGameStarted && (
                                                            <div className="space-y-4">
                                                              <div className="grid md:grid-cols-2 gap-4">
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
                                                                      <div className="text-muted text-sm italic text-center py-4">No lineup set</div>
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
                                                                      <div className="text-muted text-sm italic text-center py-4">No lineup set</div>
                                                                    )}
                                                                  </div>
                                                                </div>
                                                              </div>

                                                              {canEditLineups && (
                                                                <div className="flex justify-center">
                                                                  <button
                                                                    className="btn btn-secondary"
                                                                    onClick={() => setEditingMatch(matchId)}
                                                                  >
                                                                    {teamALineup.length > 0 || teamBLineup.length > 0 ? 'Edit Lineups' : 'Set Lineups'}
                                                                  </button>
                                                                </div>
                                                              )}
                                                            </div>
                                                          )
                                                        )}

                                                        {/* Games Display - show when lineups exist in lineups state OR in game data */}
                                                        {((lineups[match.id] &&
                                                          lineups[match.id][match.teamA?.id || 'teamA']?.length === 4 &&
                                                          lineups[match.id][match.teamB?.id || 'teamB']?.length === 4) ||
                                                          (games[match.id]?.some((g: any) => g.teamALineup && g.teamBLineup))) && (
                                                            <div className="space-y-5">
                                                              <div className="pt-4">
                                                                <div className="grid gap-4 lg:grid-cols-2">
                                                                  {games[match.id]
                                                                    ?.filter((game) => game.slot === 'MENS_DOUBLES' || game.slot === 'WOMENS_DOUBLES')
                                                                    .map((game) => (
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

                                                              <div className="grid gap-4 lg:grid-cols-2">
                                                                {games[match.id]
                                                                  ?.filter((game) => game.slot === 'MIXED_1' || game.slot === 'MIXED_2')
                                                                  .map((game) => (
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

                                                              {(() => {
                                                                const resolvedTiebreakerStatus = normalizeTiebreakerStatus(match.tiebreakerStatus);
                                                                
                                                                // Only show tiebreaker-related UI if the database indicates a tiebreaker is needed
                                                                const showTiebreakerPrompt = 
                                                                  resolvedTiebreakerStatus === 'tied_requires_tiebreaker' &&
                                                                  !games[match.id]?.some((g) => g.slot === 'TIEBREAKER');

                                                                if (showTiebreakerPrompt) {
                                                                  return (
                                                                    <div className="border border-warning/40 bg-warning/10 text-warning px-4 py-3 rounded">
                                                                      This matchup is tied 2-2. Add a Tiebreaker game below to determine the winner.
                                                                    </div>
                                                                  );
                                                                }

                                                                const tiebreakerGame = games[match.id]?.find((g) => g.slot === 'TIEBREAKER');
                                                                if (tiebreakerGame && (resolvedTiebreakerStatus === 'tied_requires_tiebreaker' || resolvedTiebreakerStatus === 'tied_pending' || resolvedTiebreakerStatus === 'decided_tiebreaker')) {
                                                                  return (
                                                                    <GameScoreBox
                                                                      key={tiebreakerGame.id}
                                                                      game={tiebreakerGame}
                                                                      match={match}
                                                                      lineups={lineups}
                                                                      startGame={startGame}
                                                                      endGame={endGame}
                                                                      reopenGame={reopenGame}
                                                                      updateGameScore={updateGameScore}
                                                                      updateGameCourtNumber={updateGameCourtNumber}
                                                                    />
                                                                  );
                                                                }

                                                                return null;
                                                              })()}
                                                            </div>
                                                          )}
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        ));
                                      })()}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                    </div>
                  </div>
                );
              })()}
    </div>
  );
}
