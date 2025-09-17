'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface Tournament {
  id: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
}

interface Stop {
  id: string;
  name: string;
  tournamentId: string;
  rounds: Round[];
}

interface Round {
  id: string;
  name: string;
  stopId: string;
  matches: Match[];
}

interface Match {
  id: string;
  teamA: Team;
  teamB: Team;
  games: Game[];
  status: string;
}

interface Team {
  id: string;
  name: string;
  club?: {
    name: string;
  };
}

interface Game {
  id: string;
  slot: string;
  teamAScore: number | null;
  teamBScore: number | null;
  isComplete: boolean | null;
  courtNumber?: string;
  teamALineup?: Player[];
  teamBLineup?: Player[];
  startedAt?: string; // Added for start timestamp
  endedAt?: string; // Added for end timestamp
  updatedAt?: string; // Added for timestamp
  createdAt?: string; // Added for timestamp comparison
}

interface Player {
  id: string;
  name: string;
}

export default function TournamentPage() {
  const params = useParams();
  const tournamentId = params.tournamentId as string;
  
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [lineups, setLineups] = useState<Record<string, Record<string, any[]>>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTournamentData();
  }, [tournamentId]);

  const loadTournamentData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      // Load tournament details
      const tournamentResponse = await fetch(`/api/tournaments`);
      if (tournamentResponse.ok) {
        const tournaments = await tournamentResponse.json();
        const currentTournament = tournaments.find((t: Tournament) => t.id === tournamentId);
        if (currentTournament) {
          setTournament(currentTournament);
        }
      }

      // Load stops for this tournament
      const stopsResponse = await fetch(`/api/admin/stops`);
      if (stopsResponse.ok) {
        const allStops = await stopsResponse.json();
        const tournamentStops = allStops.filter((stop: any) => stop.tournamentId === tournamentId);
        setStops(tournamentStops);
        
        // Auto-select first stop if available
        if (tournamentStops.length > 0) {
          setSelectedStopId(tournamentStops[0].id);
          loadStopData(tournamentStops[0].id);
        }
      }

    } catch (err) {
      setError(`Failed to load tournament data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const loadStopData = async (stopId: string) => {
    try {
      // Load rounds and matches for this stop
      const roundsResponse = await fetch(`/api/admin/stops/${stopId}/schedule`);
      if (roundsResponse.ok) {
        const rounds = await roundsResponse.json();
        
        // Load matches for each round
        const roundsWithMatches = await Promise.all(
          rounds.map(async (round: any) => {
            const matchesResponse = await fetch(`/api/admin/rounds/${round.id}/matchups`);
            if (matchesResponse.ok) {
              const matches = await matchesResponse.json();
              return { ...round, matches };
            }
            return { ...round, matches: [] };
          })
        );

        setStops(prev => prev.map(stop => 
          stop.id === stopId 
            ? { ...stop, rounds: roundsWithMatches }
            : stop
        ));

        // Load lineups for this stop (with timeout)
        try {
          const lineupPromise = loadLineupsForStop(stopId);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Lineup loading timeout')), 10000)
          );
          await Promise.race([lineupPromise, timeoutPromise]);
        } catch (lineupError) {
          console.warn('Lineup loading failed or timed out:', lineupError);
          // Continue without lineups - games will show as "Team A" vs "Team B"
        }
      }
    } catch (err) {
      console.error('Error loading stop data:', err);
    }
  };

  const loadLineupsForStop = async (stopId: string) => {
    try {
      const response = await fetch(`/api/admin/stops/${stopId}/lineups`);
      if (response.ok) {
        const lineupsData = await response.json();
        setLineups(prev => ({ ...prev, ...lineupsData }));
      }
    } catch (error) {
      console.error('Error loading lineups for stop:', error);
    }
  };

  const getGameStatus = (game: Game) => {
    // Use the same logic as Event Manager to map isComplete to game status
    if (game.isComplete === true) return 'completed';
    if (game.isComplete === false) return 'in_progress';
    return 'not_started'; // isComplete === null (default state)
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
        // Generate lineup based on game slot
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

    // For tiebreakers, show team names
    if (game.slot === 'TIEBREAKER') {
      return team === 'A' ? (match.teamA?.name || 'Team A') : (match.teamB?.name || 'Team B');
    }

    return team === 'A' ? 'Team A' : 'Team B';
  };

  const getGameStartTime = (game: Game) => {
    // Use startedAt if available, otherwise fall back to updatedAt
    if (game.startedAt) {
      return new Date(game.startedAt).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    }
    if (game.isComplete === false || game.isComplete === true) {
      return new Date(game.updatedAt || game.createdAt || '').toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    }
    return null;
  };

  const getGameEndTime = (game: Game) => {
    // Use endedAt if available
    if (game.endedAt) {
      return new Date(game.endedAt).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    }
    return null;
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

    // Only include games that have actually been started (isComplete === false)
    // and have lineups confirmed
    const inProgress = allGames
      .filter(({ game, match }) => {
        const hasLineups = match.teamA?.id && match.teamB?.id && 
          lineups[match.id] && 
          lineups[match.id][match.teamA.id]?.length === 4 && 
          lineups[match.id][match.teamB.id]?.length === 4;
        
        // A game is considered "started" if:
        // 1. It's marked as in progress (isComplete === false)
        // 2. It has confirmed lineups
        // 3. It has actually been started (has startedAt timestamp)
        return game.isComplete === false && hasLineups && game.startedAt;
      })
      .sort((a, b) => new Date(a.game.startedAt).getTime() - new Date(b.game.startedAt).getTime());
    
    const completed = allGames.filter(({ game }) => game.isComplete === true);
    
    return { inProgress, completed };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tournament data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ Error</div>
          <p className="text-gray-600">{error}</p>
          <button 
            onClick={loadTournamentData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-600 text-xl mb-4">Tournament not found</div>
          <p className="text-gray-500">The tournament you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  const selectedStop = stops.find(stop => stop.id === selectedStopId);
  const { inProgress, completed } = selectedStop ? getGamesByStatus(selectedStop) : { inProgress: [], completed: [] };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full px-4 py-8">
        {/* Tournament Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{tournament.name}</h1>
              {tournament.description && (
                <p className="text-gray-600 mb-4">{tournament.description}</p>
              )}
              <div className="flex items-center space-x-6 text-sm text-gray-500">
                {tournament.startDate && (
                  <span>Start: {new Date(tournament.startDate).toLocaleDateString()}</span>
                )}
                {tournament.endDate && (
                  <span>End: {new Date(tournament.endDate).toLocaleDateString()}</span>
                )}
              </div>
            </div>
            <button
              onClick={() => loadTournamentData(true)}
              disabled={refreshing}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {refreshing ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Stop Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {stops.map((stop) => (
                <button
                  key={stop.id}
                  onClick={() => {
                    setSelectedStopId(stop.id);
                    loadStopData(stop.id);
                  }}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    selectedStopId === stop.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {stop.name}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Three Column Layout */}
        <div className="grid grid-cols-3 gap-8">
          {/* Column 1: In Progress Games */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200 bg-yellow-50">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                In Progress
              </h2>
              <p className="text-sm text-gray-500">{inProgress.length} games started</p>
            </div>
            <div className="p-6">
              {inProgress.length > 0 ? (
                <div className="space-y-4">
                  {inProgress.map(({ game, match, round }) => (
                    <div key={game.id} className="border border-gray-200 rounded-lg p-4">
                      {/* Team names at top */}
                      <div className="text-xs text-gray-500 mb-1">
                        {match.teamA?.name} vs {match.teamB?.name}
                      </div>
                      
                      {/* Game type - no space between team names and game type */}
                      <div className="text-sm font-medium text-gray-700 mb-4">
                        {game.slot.replace('_', ' ')}
                      </div>
                      
                      {/* Player names and scores */}
                      <div className="flex items-center justify-between text-sm mb-4">
                        <div className="text-gray-600 text-xs whitespace-pre-line text-left">
                          {getPlayerNames(game, match, 'A')}
                        </div>
                        <span className="font-medium">
                          {game.teamAScore !== null ? game.teamAScore : '-'}
                        </span>
                        <span className="text-gray-400">vs</span>
                        <span className="font-medium">
                          {game.teamBScore !== null ? game.teamBScore : '-'}
                        </span>
                        <div className="text-gray-600 text-xs whitespace-pre-line text-left">
                          {getPlayerNames(game, match, 'B')}
                        </div>
                      </div>
                      
                      {/* Start time and Court at bottom */}
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div>
                          {getGameStartTime(game) && (
                            <span>Started: {getGameStartTime(game)}</span>
                          )}
                        </div>
                        <div>
                          {game.courtNumber && (
                            <span>Court {game.courtNumber}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No games started yet
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Completed Games */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200 bg-green-50">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                Completed
              </h2>
              <p className="text-sm text-gray-500">{completed.length} games</p>
            </div>
            <div className="p-6">
              {completed.length > 0 ? (
                <div className="space-y-4">
                  {completed.map(({ game, match, round }) => (
                    <div key={game.id} className="border border-gray-200 rounded-lg p-4">
                      {/* Team names at top */}
                      <div className="text-xs text-gray-500 mb-1">
                        {match.teamA?.name} vs {match.teamB?.name}
                      </div>
                      
                      {/* Game type - no space between team names and game type */}
                      <div className="text-sm font-medium text-gray-700 mb-4">
                        {game.slot.replace('_', ' ')}
                      </div>
                      
                      {/* Player names and scores */}
                      <div className="flex items-center justify-between text-sm mb-4">
                        <div className="text-gray-600 text-xs whitespace-pre-line text-left">
                          {getPlayerNames(game, match, 'A')}
                        </div>
                        <span className="font-medium">
                          {game.teamAScore !== null ? game.teamAScore : '-'}
                        </span>
                        <span className="text-gray-400">vs</span>
                        <span className="font-medium">
                          {game.teamBScore !== null ? game.teamBScore : '-'}
                        </span>
                        <div className="text-gray-600 text-xs whitespace-pre-line text-left">
                          {getPlayerNames(game, match, 'B')}
                        </div>
                      </div>
                      
                      {/* End time and Court at bottom */}
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div>
                          {getGameEndTime(game) && (
                            <span>Ended: {getGameEndTime(game)}</span>
                          )}
                        </div>
                        <div>
                          {game.courtNumber && (
                            <span>Court {game.courtNumber}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No completed games
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Tournament Standings */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200 bg-blue-50">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                Standings
              </h2>
              <p className="text-sm text-gray-500">Tournament rankings</p>
            </div>
            <div className="p-6">
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">🏆</div>
                <p>Standings coming soon</p>
                <p className="text-xs mt-2">This feature will show team rankings and statistics</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
