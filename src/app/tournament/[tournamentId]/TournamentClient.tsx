'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatDateRangeUTC } from '@/lib/utils';

interface Tournament {
  id: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  stops?: any[];
}

interface Stop {
  id: string;
  name: string;
  tournamentId: string;
  rounds: Round[];
  startAt?: string | null;
  endAt?: string | null;
}

interface Round {
  id: string;
  name: string;
  stopId: string;
  matches: Match[];
  idx?: number;
}

interface Match {
  id: string;
  teamA: Team;
  teamB: Team;
  games: Game[];
  status: string;
  forfeitTeam?: string | null;
}

interface Team {
  id: string;
  name: string;
  club?: {
    name: string;
  };
  bracket?: {
    name: string;
  };
}

interface Game {
  id: string;
  slot: string;
  teamAScore: number | null;
  teamBScore: number | null;
  isComplete: boolean | null;
  courtNumber?: string | null;
  lineupConfirmed?: boolean;
  teamALineup?: Player[];
  teamBLineup?: Player[];
  startedAt?: string | null;
  endedAt?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
}

interface Player {
  id: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  gender?: string | null;
}

interface TournamentClientProps {
  tournament: Tournament;
  stops: Stop[];
  initialStopData: Stop | null;
}

export default function TournamentClient({ tournament, stops, initialStopData }: TournamentClientProps) {
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [currentStopData, setCurrentStopData] = useState<Stop | null>(initialStopData);
  const [stopDataCache, setStopDataCache] = useState<Record<string, Stop>>(
    () => (initialStopData ? { [initialStopData.id]: initialStopData } : {})
  );
  const [lineups, setLineups] = useState<Record<string, Record<string, any[]>>>({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'in-progress' | 'completed' | 'standings'>('standings');

  // Find stop closest to today's date
  const findClosestStop = (stops: Stop[]) => {
    if (stops.length === 0) return null;
    
    const today = new Date();
    const todayTime = today.getTime();
    
    return stops.reduce((closest, stop) => {
      const stopDate = new Date(stop.startAt || stop.endAt || '');
      const stopTime = stopDate.getTime();
      const closestDate = new Date(closest.startAt || closest.endAt || '');
      const closestTime = closestDate.getTime();
      
      const stopDiff = Math.abs(todayTime - stopTime);
      const closestDiff = Math.abs(todayTime - closestTime);
      
      return stopDiff < closestDiff ? stop : closest;
    });
  };

  // Initialize with stop closest to today's date
  useEffect(() => {
    if (stops.length > 0 && !selectedStopId) {
      const closestStop = findClosestStop(stops);
      if (closestStop) {
        setSelectedStopId(closestStop.id);
      }
    }
  }, [stops, selectedStopId]);

  // Load stop data when selectedStopId changes
  useEffect(() => {
    if (!selectedStopId) return;

    const cached = stopDataCache[selectedStopId];
    if (cached) {
      setCurrentStopData(cached);
    } else {
      loadStopData(selectedStopId);
    }
  }, [selectedStopId, stopDataCache]);

  const loadStopData = async (stopId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Use the public scoreboard API to get rounds, matches, and games data
      const response = await fetch(`/api/public/stops/${stopId}/scoreboard`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch stop scoreboard');
      }
      
      const data = await response.json();
      
      // Transform the scoreboard data to match our Stop interface
      const stopData: Stop = {
        id: stopId,
        name: data.stop.name || 'Unknown Stop',
        tournamentId: data.stop.tournamentId || '',
        startAt: data.stop.startAt || null,
        endAt: data.stop.endAt || null,
        rounds: data.rounds.map((round: any) => ({
          id: round.roundId,
          name: `Round ${round.idx + 1}`,
          stopId: stopId,
          matches: round.matches.map((match: any) => ({
            id: match.matchId,
            teamA: match.teamA,
            teamB: match.teamB,
            forfeitTeam: match.forfeitTeam, // Include forfeitTeam
            updatedAt: match.updatedAt, // Include updatedAt
            games: match.games.map((game: any) => {
              const rawIsComplete = typeof game.isComplete === 'boolean' ? game.isComplete : null;
              const isComplete = rawIsComplete === true || Boolean(game.endedAt);

              return {
                id: game.id,
                slot: game.slot,
                teamAScore: game.teamAScore,
                teamBScore: game.teamBScore,
                isComplete,
                startedAt: game.startedAt ?? null,
                endedAt: game.endedAt ?? null,
                updatedAt: game.updatedAt ?? null,
                createdAt: game.createdAt ?? null,
                courtNumber: game.courtNumber ?? null,
                lineupConfirmed: game.lineupConfirmed ?? false,
                teamALineup: game.teamALineup || [],
                teamBLineup: game.teamBLineup || []
              } as Game;
            }),
            status: 'scheduled' // Default status
          }))
        }))
      };
      
      setCurrentStopData(stopData);
      setStopDataCache(prev => ({ ...prev, [stopId]: stopData }));
    } catch (err) {
      console.error('Error loading stop data:', err);
      setError('Failed to load stop schedule.');
      setCurrentStopData(null);
    } finally {
      setLoading(false);
    }
  };

  const loadLineupsForStop = async (stopId: string) => {
    // For now, just log that we would load lineups
    // In a real implementation, this would load team lineups
    console.log('Would load lineups for stop:', stopId);
  };

  const toTimestamp = (value?: string | null) => (value ? new Date(value).getTime() : null);

  const resolveStartTimestamp = (game: Game) =>
    toTimestamp(game.startedAt) ?? toTimestamp(game.updatedAt) ?? toTimestamp(game.createdAt) ?? 0;

  const resolveEndTimestamp = (game: Game) =>
    toTimestamp(game.endedAt) ?? toTimestamp(game.updatedAt) ?? toTimestamp(game.createdAt) ?? 0;

  const hasGameStarted = (game: Game) =>
    Boolean(game.startedAt || game.teamAScore !== null || game.teamBScore !== null);

  const isGameComplete = (game: Game) =>
    game.isComplete === true || Boolean(game.endedAt);

  const getGameStatus = (game: Game) => {
    if (isGameComplete(game)) return 'completed';
    if (hasGameStarted(game)) return 'in_progress';
    return 'not_started';
  };

  const getPlayerNames = (game: Game, match: Match, team: 'A' | 'B') => {
    // First try to get lineup from game data
    const gameLineup = team === 'A' ? game.teamALineup : game.teamBLineup;
    if (gameLineup && Array.isArray(gameLineup) && gameLineup.length >= 2) {
      return `${gameLineup[0]?.name || 'Player 1'} &\n${gameLineup[1]?.name || 'Player 2'}`;
    }

    // If not in game data, try to get from lineup state
    const teamId = team === 'A' ? match.teamA?.id : match.teamB?.id;
    if (teamId && lineups[match.id] && lineups[match.id][teamId]) {
      const teamLineup = lineups[match.id][teamId];
      if (Array.isArray(teamLineup) && teamLineup.length >= 2) {
        const man1 = teamLineup[0];
        const man2 = teamLineup[1];
        const woman1 = teamLineup[2];
        const woman2 = teamLineup[3];
        
        switch (game.slot) {
          case 'MENS_DOUBLES':
            return man1 && man2 ? `${man1.name} &\n${man2.name}` : 'Team A';
          case 'WOMENS_DOUBLES':
            return woman1 && woman2 ? `${woman1.name} &\n${woman2.name}` : 'Team A';
          case 'MIXED_1':
            return man1 && woman1 ? `${man1.name} &\n${woman1.name}` : 'Team A';
          case 'MIXED_2':
            return man2 && woman2 ? `${man2.name} &\n${woman2.name}` : 'Team A';
          case 'TIEBREAKER':
            return team === 'A' ? (match.teamA?.name || 'Team A') : (match.teamB?.name || 'Team B');
          default:
            return team === 'A' ? 'Team A' : 'Team B';
        }
      }
    }

    if (game.slot === 'TIEBREAKER') {
      return team === 'A' ? (match.teamA?.name || 'Team A') : (match.teamB?.name || 'Team B');
    }

    return team === 'A' ? 'Team A' : 'Team B';
  };

  const formatInProgressMatchLabel = (match: Match) => {
    const rawNameA = match.teamA?.name ?? 'Team A';
    const rawNameB = match.teamB?.name ?? 'Team B';

    const extractSuffix = (name: string) => {
      const parts = name.trim().split(/\s+/);
      return parts.length > 1 ? parts[parts.length - 1] : null;
    };

    const suffixA = extractSuffix(rawNameA);
    const suffixB = extractSuffix(rawNameB);

    const sharedSuffix = suffixA && suffixB && suffixA.toLowerCase() === suffixB.toLowerCase()
      ? suffixA
      : null;

    if (!sharedSuffix) {
      return `${rawNameA} vs ${rawNameB}`;
    }

    const trimSuffix = (name: string, suffix: string) =>
      name.replace(new RegExp(`\\s+${suffix}$`, 'i'), '').trim();

    const nameA = trimSuffix(rawNameA, sharedSuffix);
    const nameB = trimSuffix(rawNameB, sharedSuffix);

    return `${nameA || rawNameA} vs ${nameB || rawNameB} - ${sharedSuffix}`;
  };

  const getGameStartTime = (game: Game) => {
    const formatTime = (value?: string | null) => (
      value
        ? new Date(value).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          })
        : null
    );

    return (
      formatTime(game.startedAt) ??
      formatTime(game.updatedAt) ??
      formatTime(game.createdAt)
    );
  };

  const getGameEndTime = (game: Game) => {
    if (!game.endedAt) return null;

    return new Date(game.endedAt).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getGamesByStatus = (stop: Stop) => {
    const allGames: Array<{ game: Game; match: Match; round: Round }> = [];
    
    stop.rounds?.forEach(round => {
      round.matches?.forEach(match => {
        match.games?.forEach(game => {
          allGames.push({ game, match, round });
        });
      });
    });

    const inProgress = allGames
      .filter(({ game }) => !isGameComplete(game) && hasGameStarted(game))
      .sort((a, b) => resolveStartTimestamp(a.game) - resolveStartTimestamp(b.game));
    
    const completed = allGames
      .filter(({ game }) => isGameComplete(game))
      .sort((a, b) => {
        // Use game endedAt for all matches - this represents when the game was completed
        // For forfeited matches, this is set to the forfeit time
        // For regular matches, this is when the game was actually completed
        const gameACompletionTime = toTimestamp(a.game.endedAt) ?? 0;
        const gameBCompletionTime = toTimestamp(b.game.endedAt) ?? 0;
        
        // Sort by completion time in descending order (most recent first)
        return gameBCompletionTime - gameACompletionTime;
      });
    
    return { inProgress, completed };
  };

  const selectedStop = currentStopData || (selectedStopId ? stopDataCache[selectedStopId] : null);
  const { inProgress, completed } = selectedStop ? getGamesByStatus(selectedStop) : { inProgress: [], completed: [] };

  // Calculate standings for all teams across all stops
  const calculateStandings = () => {
    const teamPoints: Record<string, { team: any; points: number; wins: number; losses: number }> = {};
    
    const stopDatas = Object.values(stopDataCache);
    const allStops = stopDatas.length > 0
      ? stopDatas
      : currentStopData
        ? [currentStopData]
        : [];
    allStops.forEach(stop => {
      stop.rounds?.forEach(round => {
        round.matches?.forEach(match => {
          if (match.teamA) {
            teamPoints[match.teamA.id] = {
              team: match.teamA,
              points: 0,
              wins: 0,
              losses: 0
            };
          }
          if (match.teamB) {
            teamPoints[match.teamB.id] = {
              team: match.teamB,
              points: 0,
              wins: 0,
              losses: 0
            };
          }
        });
      });
    });

    // Calculate points based on completed games
    allStops.forEach(stop => {
      stop.rounds?.forEach(round => {
        round.matches?.forEach(match => {
          if (match.teamA && match.teamB) {
            // Check for forfeit first
            if (match.forfeitTeam) {
              // Handle forfeit - forfeiting team gets 0 points, winning team gets 3 points
              if (match.forfeitTeam === 'A') {
                // Team A forfeited, Team B wins
                teamPoints[match.teamB.id].points += 3;
                teamPoints[match.teamB.id].wins += 1;
                teamPoints[match.teamA.id].points += 0; // 0 points for forfeit
                teamPoints[match.teamA.id].losses += 1;
              } else {
                // Team B forfeited, Team A wins
                teamPoints[match.teamA.id].points += 3;
                teamPoints[match.teamA.id].wins += 1;
                teamPoints[match.teamB.id].points += 0; // 0 points for forfeit
                teamPoints[match.teamB.id].losses += 1;
              }
            } else if (match.games && match.games.length > 0) {
              // Normal match - calculate from game scores
              let teamAScore = 0;
              let teamBScore = 0;
              let completedGames = 0;
              
              match.games.forEach(game => {
                if (game.teamAScore !== null && game.teamBScore !== null) {
                  completedGames++;
                  if (game.teamAScore > game.teamBScore) {
                    teamAScore++;
                  } else if (game.teamBScore > game.teamAScore) {
                    teamBScore++;
                  }
                }
              });
              
              // Only calculate points if there are completed games
              if (completedGames > 0) {
                if (teamAScore > teamBScore) {
                  // Team A wins
                  teamPoints[match.teamA.id].points += 3;
                  teamPoints[match.teamA.id].wins += 1;
                  teamPoints[match.teamB.id].points += 1; // 1 point for loss
                  teamPoints[match.teamB.id].losses += 1;
                } else if (teamBScore > teamAScore) {
                  // Team B wins
                  teamPoints[match.teamB.id].points += 3;
                  teamPoints[match.teamB.id].wins += 1;
                  teamPoints[match.teamA.id].points += 1; // 1 point for loss
                  teamPoints[match.teamA.id].losses += 1;
                }
                // No ties - if scores are equal, no points awarded
              }
            }
          }
        });
      });
    });

    return Object.values(teamPoints).sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      return a.team.name.localeCompare(b.team.name);
    });
  };

  // Fetch tournament-level standings from API
  const [standings, setStandings] = useState<any[]>([]);
  const [standingsLoading, setStandingsLoading] = useState(false);

  const fetchTournamentStandings = useCallback(async (tournamentId: string) => {
    setStandingsLoading(true);
    try {
      console.log('Fetching standings for tournament:', tournamentId);
      const response = await fetch(`/api/public/tournaments/${tournamentId}/standings`);
      console.log('Standings response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Standings data:', data);
        setStandings(data);
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch tournament standings:', response.status, errorText);
        setStandings([]);
      }
    } catch (error) {
      console.error('Error fetching tournament standings:', error);
      setStandings([]);
    } finally {
      setStandingsLoading(false);
    }
  }, []);

  // Load standings when tournament changes
  useEffect(() => {
    console.log('Tournament effect running, tournament:', tournament);
    if (tournament?.id) {
      console.log('Fetching standings for tournament ID:', tournament.id);
      fetchTournamentStandings(tournament.id);
    } else {
      console.log('No tournament ID available');
    }
  }, [tournament?.id, fetchTournamentStandings]);

  const deriveClubKey = (teamName?: string | null) =>
    (teamName ?? 'Unknown Team')
      .replace(/\s+(Advanced|Intermediate)$/i, '')
      .trim()
      || 'Unknown Team';

  // Transform API data to match expected format
  console.log('Raw standings data:', standings);
  const transformedStandings = standings.map(standing => ({
    team: {
      id: standing.team_id,
      name: standing.team_name,
      clubId: standing.clubId
    },
    points: standing.points,
    wins: standing.wins,
    losses: standing.losses
  }));
  console.log('Transformed standings:', transformedStandings);

  const combinedStandingsRaw = Array.from(
    transformedStandings.reduce((map, standing) => {
      const teamName = standing.team?.name ?? 'Unknown Team';
      const clubName = deriveClubKey(teamName);
      const key = clubName.toLowerCase();

      if (!map.has(key)) {
        map.set(key, {
          name: clubName,
          points: 0,
          wins: 0,
          losses: 0,
        });
      }

      const entry = map.get(key)!;
      entry.points += standing.points;
      entry.wins += standing.wins;
      entry.losses += standing.losses;

      return map;
    }, new Map<string, { name: string; points: number; wins: number; losses: number }>()).values()
  ).sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    return a.name.localeCompare(b.name);
  });

  const advancedStandingsRaw = transformedStandings.filter(s => s.team.name.includes('Advanced'));
  const intermediateStandingsRaw = transformedStandings.filter(s => s.team.name.includes('Intermediate'));

  const attachPlaces = <T extends { points: number }>(entries: T[]) => {
    let previousPoints: number | null = null;
    let currentPlace = 0;

    return entries.map((entry, index) => {
      if (previousPoints === null || entry.points !== previousPoints) {
        currentPlace = index + 1;
        previousPoints = entry.points;
      }

      return {
        ...entry,
        place: currentPlace,
      };
    });
  };

  const combinedStandings = attachPlaces(combinedStandingsRaw);
  const advancedStandings = attachPlaces(advancedStandingsRaw);
  const intermediateStandings = attachPlaces(intermediateStandingsRaw);
  
  console.log('Combined standings:', combinedStandings);
  console.log('Advanced standings:', advancedStandings);
  console.log('Intermediate standings:', intermediateStandings);

  const formatStopDates = (stop: Stop) => {
    const cached = stopDataCache[stop.id];
    const startRaw = cached?.startAt ?? stop.startAt ?? null;
    const endRaw = cached?.endAt ?? stop.endAt ?? null;

    console.log('Raw date strings:', { startRaw, endRaw });
    console.log('Parsed dates:', { 
      start: startRaw ? new Date(startRaw) : null, 
      end: endRaw ? new Date(endRaw) : null 
    });

    return formatDateRangeUTC(startRaw, endRaw);
  };

  return (
    <div className="min-h-screen bg-app">
      <div className="w-full px-1 py-2 md:px-4 md:py-6">
        <div className="flex items-center justify-between mb-2 md:mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-3xl font-bold text-primary truncate">{tournament.name}</h1>
            {tournament.description && (
              <p className="text-secondary mt-1 text-sm md:text-base line-clamp-2">{tournament.description}</p>
            )}
          </div>
          <button
            onClick={() => window.location.reload()}
            disabled={refreshing}
            className="btn btn-primary text-xs md:text-sm px-2 py-1 md:px-4 md:py-2 ml-2"
          >
            {refreshing ? (
              <div className="loading-spinner"></div>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>

        {/* Main Content Layout - Stops (2/3) and Standings (1/3) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-1 md:gap-4 mb-20 md:mb-6">
          {/* Left side - Games (2/3 width) - Mobile: only show when not standings */}
          <div className={`col-span-1 md:col-span-2 ${activeTab === 'standings' ? 'hidden' : 'block'} md:block`}>
            {/* Combined Games Card */}
            <div className="card">
              {/* Stop Tabs */}
              <div className="px-1 py-1 md:px-3 border-b border-subtle pb-2">
                <h2 className="text-sm md:text-lg font-semibold text-primary mb-2">Matches & Games</h2>
                {/* Desktop: Horizontal tabs */}
                <nav className="hidden md:flex space-x-4" aria-label="Tabs">
                  {stops.map((stop) => (
                    <button
                      key={stop.id}
                      onClick={() => {
                        setSelectedStopId(stop.id);
                        loadStopData(stop.id);
                      }}
                      className={`tab-button ${
                        selectedStopId === stop.id ? 'active' : ''
                      }`}
                    >
                      <div className="flex flex-col items-start">
                        <span>{stop.name}</span>
                        {formatStopDates(stop) && (
                          <span className="text-xs text-muted">{formatStopDates(stop)}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </nav>

                {/* Mobile: Dropdown */}
                <div className="md:hidden my-2">
                  <select
                    value={selectedStopId || ''}
                    onChange={(e) => {
                      const stopId = e.target.value;
                      setSelectedStopId(stopId);
                      loadStopData(stopId);
                    }}
                    className="w-full px-3 py-2 text-xs bg-surface-2 border border-subtle rounded-md text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    {stops.map((stop) => (
                      <option key={stop.id} value={stop.id}>
                        {stop.name} {formatStopDates(stop) && `- ${formatStopDates(stop)}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Games Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1 md:gap-3 p-1 md:p-4">
                {/* In Progress Games - Mobile: only show when active tab is 'in-progress' */}
                <div className={`${activeTab === 'in-progress' ? 'block' : 'hidden'} md:block`}>
                  <h3 className="text-sm font-semibold text-primary mb-1 flex items-center">
                    <div className="w-2 h-2 bg-warning rounded-full mr-2"></div>
                    In Progress
                  </h3>
                  {inProgress.length > 0 ? (
                    <div className="space-y-2">
                      {inProgress.map(({ game, match, round }) => (
                        <div key={game.id} className="border border-subtle rounded p-2 bg-surface-2">
                          <div className="flex items-start justify-between mb-1">
                            {/* Team names at top */}
                            <div className="text-xs text-muted pr-2">
                              {round?.idx !== undefined
                                ? `Round ${round.idx + 1}: ${formatInProgressMatchLabel(match)}`
                                : `${round?.name ?? 'Round'}: ${formatInProgressMatchLabel(match)}`}
                            </div>
                            <div className="text-right text-xs text-green-600 whitespace-nowrap ml-2">
                              {getGameStartTime(game) && (
                                <div>Started: {getGameStartTime(game)}</div>
                              )}
                              {game.courtNumber && (
                                <div>Court {game.courtNumber}</div>
                              )}
                            </div>
                          </div>
                          {/* Team names at top */}
                          {/* Game type */}
                          <div className="text-sm font-medium text-secondary mb-2">
                            {game.slot.replace('_', ' ')}
                          </div>
                          
                          {/* Player names and scores */}
                          <div className="flex items-center justify-between text-sm mb-1">
                            <div className="text-xs whitespace-pre-line text-left flex items-center text-secondary">
                              {getPlayerNames(game, match, 'A')}
                            </div>
                            <span className="font-medium text-primary">
                              {game.teamAScore !== null ? game.teamAScore : '-'}
                            </span>
                            <span className="text-muted">vs</span>
                            <span className="font-medium text-primary">
                              {game.teamBScore !== null ? game.teamBScore : '-'}
                            </span>
                            <div className="text-xs whitespace-pre-line text-left flex items-center text-secondary">
                              {getPlayerNames(game, match, 'B')}
                            </div>
                          </div>
                          
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted text-sm">
                      No games started yet
                    </div>
                  )}
                </div>

                {/* Completed Games - Mobile: only show when active tab is 'completed' */}
                <div className={`${activeTab === 'completed' ? 'block' : 'hidden'} md:block`}>
                  <h3 className="text-sm font-semibold text-primary mb-1 flex items-center">
                    <div className="w-2 h-2 bg-success rounded-full mr-2"></div>
                    Completed
                  </h3>
                  {completed.length > 0 ? (
                    <div className="space-y-2">
                      {(() => {
                        // Group games by match
                        const matchGroups = completed.reduce((groups, { game, match, round }) => {
                          const matchId = match.id;
                          if (!groups[matchId]) {
                            groups[matchId] = { match, games: [] };
                          }
                          groups[matchId].games.push({ game, round });
                          return groups;
                        }, {} as Record<string, { match: any; games: { game: any; round: any }[] }>);

                        return Object.values(matchGroups).map(({ match, games }) => {
                          // Calculate overall match winner
                          let teamAWins = 0;
                          let teamBWins = 0;

                          games.forEach(({ game }) => {
                            if (game.teamAScore !== null && game.teamBScore !== null) {
                              if (game.teamAScore > game.teamBScore) {
                                teamAWins++;
                              } else if (game.teamBScore > game.teamAScore) {
                                teamBWins++;
                              }
                            }
                          });

                          // Check if match was decided by tiebreaker (points or game)
                          let hasWinner = false;
                          let highlightTeamA = false;
                          let highlightTeamB = false;
                          
                          if (match.tiebreakerStatus === 'DECIDED_POINTS' || match.tiebreakerStatus === 'DECIDED_TIEBREAKER') {
                            // Match decided by tiebreaker - check tiebreakerWinnerTeamId
                            if (match.tiebreakerWinnerTeamId) {
                              hasWinner = true;
                              highlightTeamA = match.tiebreakerWinnerTeamId === match.teamA?.id;
                              highlightTeamB = match.tiebreakerWinnerTeamId === match.teamB?.id;
                            }
                          } else {
                            // Standard game-based winner determination
                            hasWinner = (teamAWins >= 3 || teamBWins >= 3) && teamAWins !== teamBWins;
                            highlightTeamA = hasWinner && teamAWins > teamBWins;
                            highlightTeamB = hasWinner && teamBWins > teamAWins;
                          }

                          return (
                            <div key={match.id} className="border border-subtle rounded p-3 bg-surface-2">
                              {/* Round and bracket */}
                              <div className="text-sm font-medium text-muted mb-1">
                                Round {games[0]?.round?.name?.replace('Round ', '') || '1'}: {match.teamA?.name?.includes('Advanced') ? 'Advanced' : 'Intermediate'}
                              </div>
                              
                              {/* Team names with winner highlighting */}
                              <div className="text-sm font-medium mb-2 flex items-center justify-between border-b border-medium pb-2">
                                <div className={`flex items-center ${highlightTeamA ? 'text-success' : ''}`}>
                                  {highlightTeamA && <span className="mr-1">🏆</span>}
                                  {match.teamA?.name}
                                </div>
                                <span className="text-muted">vs</span>
                                <div className={`flex items-center text-right ${highlightTeamB ? 'text-success' : ''}`}>
                                  {match.teamB?.name}
                                  {highlightTeamB && <span className="ml-1">🏆</span>}
                                </div>
                              </div>
                              
                              {/* For forfeited matches, show forfeit message instead of games */}
                              {match.forfeitTeam ? (
                                <div className="text-center py-3">
                                  <div className="text-sm font-medium text-red-600">
                                    {match.forfeitTeam === 'A' ? match.teamB?.name : match.teamA?.name} wins by forfeit
                                  </div>
                                </div>
                              ) : (
                                /* Games - only show for non-forfeited matches */
                                <div className="space-y-1">
                                  {games.map(({ game }) => (
                                    <div key={game.id} className="border-t border-subtle pt-1 first:border-t-0 first:pt-0">
                                      {/* Game type */}
                                      <div className="text-xs font-medium text-secondary mb-1">
                                        {game.slot.replace('_', ' ')}
                                      </div>
                                      
                                      {/* Player names and scores */}
                                      <div className="flex items-center justify-between text-sm">
                                        <div className={`text-xs whitespace-pre-line text-left flex items-center ${(game.teamAScore || 0) > (game.teamBScore || 0) ? 'text-success' : 'text-secondary'}`}>
                                          {getPlayerNames(game, match, 'A')}
                                          {(game.teamAScore || 0) > (game.teamBScore || 0) && (
                                            <span className="ml-1 text-warning">🏆</span>
                                          )}
                                        </div>
                                        <span className="font-medium text-primary">
                                          {game.teamAScore !== null ? game.teamAScore : '-'}
                                        </span>
                                        <span className="text-muted">vs</span>
                                        <span className="font-medium text-primary">
                                          {game.teamBScore !== null ? game.teamBScore : '-'}
                                        </span>
                                        <div className={`text-xs whitespace-pre-line text-right flex items-center justify-end ${(game.teamBScore || 0) > (game.teamAScore || 0) ? 'text-success' : 'text-secondary'}`}>
                                          {(game.teamBScore || 0) > (game.teamAScore || 0) && (
                                            <span className="mr-1 text-warning">🏆</span>
                                          )}
                                          {getPlayerNames(game, match, 'B')}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted text-sm">
                      No completed games
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Standings (1/3 width) - Mobile: only show when active tab is 'standings' */}
          <div className={`col-span-1 md:col-span-1 ${activeTab === 'standings' ? 'block' : 'hidden'} md:block`}>
            {/* Tournament Standings */}
            <div className="card">
              <div className="px-1 py-1 md:px-4 md:py-3 border-b border-subtle pb-2">
                <h2 className="text-sm md:text-lg font-semibold text-primary flex items-center mb-2">
                  <div className="w-2 h-2 bg-info rounded-full mr-2"></div>
                  Standings
                </h2>
              </div>
              <div className="p-1 md:p-4">
                {/* Combined Standings */}
                <div className="mb-2 md:mb-6">
                  <h3 className="text-sm font-semibold text-primary mb-1 md:mb-3 text-center md:text-left">Combined</h3>
                  {standingsLoading ? (
                    <div className="bg-surface-2 rounded p-3">
                      <div className="flex items-center justify-center py-4">
                        <div className="loading-spinner"></div>
                        <span className="ml-2 text-sm text-muted">Loading standings...</span>
                      </div>
                    </div>
                  ) : combinedStandings.length > 0 ? (
                    <div className="bg-surface-2 rounded p-3">
                      <div className="space-y-1">
                        {combinedStandings.map((standing) => (
                          <div key={standing.name} className="flex items-center justify-between py-1">
                            <div className="flex items-center">
                              <span className="text-xs font-medium text-muted w-4">{standing.place}</span>
                              <span className="text-sm font-medium text-primary ml-2">{standing.name}</span>
                            </div>
                            <div className="text-sm font-semibold text-primary">{standing.points} pts</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-3 text-muted text-sm">No Combined results</div>
                  )}
                </div>

                {/* Advanced Bracket Standings */}
                <div className="mb-2 md:mb-6">
                  <h3 className="text-sm font-semibold text-primary mb-1 md:mb-3 text-center md:text-left">Advanced</h3>
                  {standingsLoading ? (
                    <div className="bg-surface-2 rounded p-3">
                      <div className="flex items-center justify-center py-4">
                        <div className="loading-spinner"></div>
                        <span className="ml-2 text-sm text-muted">Loading standings...</span>
                      </div>
                    </div>
                  ) : advancedStandings.length > 0 ? (
                    <div className="bg-surface-2 rounded p-3">
                      <div className="space-y-1">
                        {advancedStandings.map((standing) => (
                          <div key={standing.team.id} className="flex items-center justify-between py-1">
                            <div className="flex items-center">
                              <span className="text-xs font-medium text-muted w-4">{standing.place}</span>
                              <span className="text-sm font-medium text-primary ml-2">{standing.team.name}</span>
                            </div>
                            <div className="text-sm font-semibold text-primary">{standing.points} pts</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-3 text-muted text-sm">No Advanced teams</div>
                  )}
                </div>

                {/* Intermediate Bracket Standings */}
                <div>
                  <h3 className="text-sm font-semibold text-primary mb-1 md:mb-3 text-center md:text-left">Intermediate</h3>
                  {standingsLoading ? (
                    <div className="bg-surface-2 rounded p-3">
                      <div className="flex items-center justify-center py-4">
                        <div className="loading-spinner"></div>
                        <span className="ml-2 text-sm text-muted">Loading standings...</span>
                      </div>
                    </div>
                  ) : intermediateStandings.length > 0 ? (
                    <div className="bg-surface-2 rounded p-3">
                      <div className="space-y-1">
                        {intermediateStandings.map((standing) => (
                          <div key={standing.team.id} className="flex items-center justify-between py-1">
                            <div className="flex items-center">
                              <span className="text-xs font-medium text-muted w-4">{standing.place}</span>
                              <span className="text-sm font-medium text-primary ml-2">{standing.team.name}</span>
                            </div>
                            <div className="text-sm font-semibold text-primary">{standing.points} pts</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-3 text-muted text-sm">No Intermediate teams</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Bottom Navigation - Only show on mobile */}
        <div className="fixed bottom-0 left-0 right-0 bg-surface border-t-2 border-primary shadow-lg md:hidden z-[9999]">
          <div className="grid grid-cols-3 h-16">
            {/* In Progress Tab */}
            <button
              onClick={() => setActiveTab('in-progress')}
              className={`flex flex-col items-center justify-center px-2 py-2 relative ${
                activeTab === 'in-progress'
                  ? 'border-t-2 border-warning bg-warning'
                  : 'text-muted hover:bg-warning bg-surface-2'
              }`}
              style={{
                color: activeTab === 'in-progress' ? '#000000' : undefined
              }}
            >
              <div className={`w-2 h-2 rounded-full mb-1 ${activeTab === 'in-progress' ? 'bg-black' : 'bg-warning'}`}></div>
              <span 
                className="text-xs font-medium"
                style={{
                  color: activeTab === 'in-progress' ? '#000000' : undefined
                }}
              >
                In Progress Games
              </span>
              {inProgress.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-warning text-primary text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                  {inProgress.length}
                </span>
              )}
            </button>

            {/* Completed Tab */}
            <button
              onClick={() => setActiveTab('completed')}
              className={`flex flex-col items-center justify-center px-2 py-2 relative ${
                activeTab === 'completed'
                  ? 'border-t-2 border-success bg-success'
                  : 'text-muted hover:bg-success bg-surface-2'
              }`}
              style={{
                color: activeTab === 'completed' ? '#000000' : undefined
              }}
            >
              <div className={`w-2 h-2 rounded-full mb-1 ${activeTab === 'completed' ? 'bg-black' : 'bg-success'}`}></div>
              <span 
                className="text-xs font-medium"
                style={{
                  color: activeTab === 'completed' ? '#000000' : undefined
                }}
              >
                Completed Games
              </span>
              {completed.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-success text-primary text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                  {completed.length}
                </span>
              )}
            </button>

            {/* Standings Tab */}
            <button
              onClick={() => setActiveTab('standings')}
              className={`flex flex-col items-center justify-center px-2 py-2 relative ${
                activeTab === 'standings'
                  ? 'border-t-2 border-info bg-info'
                  : 'text-muted hover:bg-info bg-surface-2'
              }`}
              style={{
                color: activeTab === 'standings' ? '#000000' : undefined
              }}
            >
              <div className={`w-2 h-2 rounded-full mb-1 ${activeTab === 'standings' ? 'bg-black' : 'bg-info'}`}></div>
              <span 
                className="text-xs font-medium"
                style={{
                  color: activeTab === 'standings' ? '#000000' : undefined
                }}
              >
                Standings
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
