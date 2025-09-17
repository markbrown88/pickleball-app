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
}

export default function TournamentPage() {
  const params = useParams();
  const tournamentId = params.tournamentId as string;
  
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTournamentData();
  }, [tournamentId]);

  const loadTournamentData = async () => {
    try {
      setLoading(true);
      
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
      }

    } catch (err) {
      setError(`Failed to load tournament data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
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
      }
    } catch (err) {
      console.error('Error loading stop data:', err);
    }
  };

  const getGameStatus = (game: Game) => {
    if (game.isComplete === true) return 'completed';
    if (game.isComplete === false) return 'in_progress';
    return 'not_started';
  };

  const getMatchStatus = (match: Match) => {
    const completedGames = match.games.filter(g => g.isComplete === true);
    const teamAWins = completedGames.filter(g => (g.teamAScore || 0) > (g.teamBScore || 0)).length;
    const teamBWins = completedGames.filter(g => (g.teamBScore || 0) > (g.teamAScore || 0)).length;
    
    if (completedGames.length === 4) {
      if (teamAWins > teamBWins) return 'Team A Wins';
      if (teamBWins > teamAWins) return 'Team B Wins';
      return 'Tied';
    }
    
    if (completedGames.length > 0) return 'In Progress';
    return 'Not Started';
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Tournament Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
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

        {/* Stops */}
        <div className="space-y-8">
          {stops.map((stop) => (
            <div key={stop.id} className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">{stop.name}</h2>
                <button
                  onClick={() => loadStopData(stop.id)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Load Results
                </button>
              </div>
              
              <div className="p-6">
                {stop.rounds && stop.rounds.length > 0 ? (
                  <div className="space-y-6">
                    {stop.rounds.map((round) => (
                      <div key={round.id} className="border border-gray-200 rounded-lg p-4">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">{round.name}</h3>
                        
                        {round.matches && round.matches.length > 0 ? (
                          <div className="space-y-4">
                            {round.matches.map((match) => (
                              <div key={match.id} className="bg-gray-50 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center space-x-4">
                                    <div className="text-lg font-medium text-gray-900">
                                      {match.teamA?.name || 'Team A'} vs {match.teamB?.name || 'Team B'}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      {match.teamA?.club?.name} vs {match.teamB?.club?.name}
                                    </div>
                                  </div>
                                  <div className="text-sm font-medium text-gray-700">
                                    {getMatchStatus(match)}
                                  </div>
                                </div>
                                
                                {/* Games */}
                                <div className="grid grid-cols-2 gap-4">
                                  {match.games.map((game) => (
                                    <div key={game.id} className="bg-white rounded p-3 border">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-700">
                                          {game.slot.replace('_', ' ')}
                                        </span>
                                        <span className={`text-xs px-2 py-1 rounded ${
                                          getGameStatus(game) === 'completed' 
                                            ? 'bg-green-100 text-green-800'
                                            : getGameStatus(game) === 'in_progress'
                                            ? 'bg-yellow-100 text-yellow-800'
                                            : 'bg-gray-100 text-gray-800'
                                        }`}>
                                          {getGameStatus(game).replace('_', ' ')}
                                        </span>
                                      </div>
                                      
                                      <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Team A</span>
                                        <span className="font-medium">
                                          {game.teamAScore !== null ? game.teamAScore : '-'}
                                        </span>
                                        <span className="text-gray-400">vs</span>
                                        <span className="font-medium">
                                          {game.teamBScore !== null ? game.teamBScore : '-'}
                                        </span>
                                        <span className="text-gray-600">Team B</span>
                                      </div>
                                      
                                      {game.courtNumber && (
                                        <div className="text-xs text-gray-500 mt-1">
                                          Court {game.courtNumber}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-gray-500 text-center py-8">
                            No matches found for this round
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 text-center py-8">
                    Click "Load Results" to view match data
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
