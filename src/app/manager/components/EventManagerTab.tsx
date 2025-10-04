'use client';

import { useState, useEffect } from 'react';
import { fetchWithActAs } from '@/lib/fetchWithActAs';

type Id = string;

type PlayerLite = {
  id: Id;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  gender: 'MALE' | 'FEMALE';
  dupr?: number | null;
  age?: number | null;
};

type EventManagerTournament = {
  tournamentId: Id;
  tournamentName: string;
  type: string;
  maxTeamSize: number | null;
  roles: {
    manager: boolean;
    admin: boolean;
    captainOfClubs: string[];
  };
  clubs: Array<{ id: Id; name: string }>;
  stops: Array<{
    stopId: Id;
    stopName: string;
    locationName?: string | null;
    startAt?: string | null;
    endAt?: string | null;
    rounds: Array<{ roundId: Id; idx: number; gameCount: number; matchCount: number }>;
  }>;
};

type Match = {
  id: string;
  roundId: string;
  idx: number;
  teamA?: { id: string; name: string; clubName?: string } | null;
  teamB?: { id: string; name: string; clubName?: string } | null;
  isBye: boolean;
};

type Game = {
  id: string;
  matchId: string;
  slot: string;
  teamAScore: number | null;
  teamBScore: number | null;
  courtNumber: string | null;
  isComplete: boolean;
  startedAt: Date | null;
  endedAt: Date | null;
};

export function EventManagerTab({
  tournaments,
  onError,
  onInfo,
}: {
  tournaments: EventManagerTournament[];
  onError: (m: string) => void;
  onInfo: (m: string) => void;
}) {
  const [expandedTournaments, setExpandedTournaments] = useState<Set<string>>(new Set());
  const [expandedStops, setExpandedStops] = useState<Set<string>>(new Set());
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set());
  const [scheduleData, setScheduleData] = useState<Record<string, Match[]>>({});
  const [gamesData, setGamesData] = useState<Record<string, Game[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const formatDate = (dateStr?: string | null): string => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatDateRange = (start?: string | null, end?: string | null): string => {
    if (!start) return '—';
    if (!end || start === end) return formatDate(start);
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  const toggleTournament = (tournamentId: string) => {
    setExpandedTournaments((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tournamentId)) {
        newSet.delete(tournamentId);
      } else {
        newSet.add(tournamentId);
      }
      return newSet;
    });
  };

  const toggleStop = (stopId: string) => {
    setExpandedStops((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(stopId)) {
        newSet.delete(stopId);
      } else {
        newSet.add(stopId);
      }
      return newSet;
    });
  };

  const toggleRound = async (roundId: string) => {
    setExpandedRounds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(roundId)) {
        newSet.delete(roundId);
      } else {
        newSet.add(roundId);
      }
      return newSet;
    });

    // Load matches if not already loaded
    if (!scheduleData[roundId] && !loading[roundId]) {
      await loadMatches(roundId);
    }
  };

  const loadMatches = async (roundId: string) => {
    setLoading((prev) => ({ ...prev, [roundId]: true }));
    try {
      const res = await fetchWithActAs(`/api/admin/rounds/${roundId}/matchups`);
      if (!res.ok) throw new Error('Failed to load matches');
      const data = await res.json();
      setScheduleData((prev) => ({ ...prev, [roundId]: data.matchups || [] }));
    } catch (error) {
      console.error('Error loading matches:', error);
      onError('Failed to load matches');
    } finally {
      setLoading((prev) => ({ ...prev, [roundId]: false }));
    }
  };

  const loadGamesForMatch = async (matchId: string) => {
    try {
      const res = await fetchWithActAs(`/api/admin/matches/${matchId}/games`);
      if (!res.ok) throw new Error('Failed to load games');
      const data = await res.json();
      setGamesData((prev) => ({ ...prev, [matchId]: data.games || [] }));
    } catch (error) {
      console.error('Error loading games:', error);
      onError('Failed to load games');
    }
  };

  const updateGameScore = async (gameId: string, teamAScore: number | null, teamBScore: number | null) => {
    try {
      const res = await fetchWithActAs(`/api/admin/games/${gameId}/score`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamAScore, teamBScore }),
      });
      if (!res.ok) throw new Error('Failed to update score');
      onInfo('Score updated');
    } catch (error) {
      console.error('Error updating score:', error);
      onError('Failed to update score');
    }
  };

  return (
    <div className="space-y-4">
      {tournaments.map((tournament) => (
        <div key={tournament.tournamentId} className="card overflow-hidden">
          <button
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-surface-2 transition-colors"
            onClick={() => toggleTournament(tournament.tournamentId)}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{expandedTournaments.has(tournament.tournamentId) ? '📂' : '📁'}</span>
              <div>
                <h2 className="text-lg font-semibold text-primary">{tournament.tournamentName}</h2>
                <div className="text-sm text-muted mt-1">
                  {tournament.stops.length} stops • {tournament.type}
                </div>
              </div>
            </div>
            <span className="text-muted text-xl">{expandedTournaments.has(tournament.tournamentId) ? '▾' : '▸'}</span>
          </button>

          {expandedTournaments.has(tournament.tournamentId) && (
            <div className="border-t border-subtle p-6 space-y-4">
              {tournament.stops.map((stop) => (
                <div key={stop.stopId} className="border border-subtle rounded-lg overflow-hidden">
                  <button
                    className="w-full px-4 py-3 flex items-center justify-between text-left bg-surface-2/30 hover:bg-surface-2 transition-colors"
                    onClick={() => toggleStop(stop.stopId)}
                  >
                    <div>
                      <h3 className="font-semibold text-primary">{stop.stopName || 'Stop'}</h3>
                      <div className="text-sm text-muted mt-1">
                        {stop.locationName || 'Location TBD'} • {formatDateRange(stop.startAt, stop.endAt)} • {stop.rounds.length} rounds
                      </div>
                    </div>
                    <span className="text-muted">{expandedStops.has(stop.stopId) ? '▾' : '▸'}</span>
                  </button>

                  {expandedStops.has(stop.stopId) && (
                    <div className="p-4 space-y-2">
                      {stop.rounds.map((round) => (
                        <div key={round.roundId} className="border border-subtle rounded">
                          <button
                            className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-surface-1 transition-colors"
                            onClick={() => toggleRound(round.roundId)}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-secondary">Round {round.idx + 1}</span>
                              <span className="text-sm text-muted">• {round.matchCount} matches</span>
                            </div>
                            <span className="text-muted text-sm">{expandedRounds.has(round.roundId) ? '▾' : '▸'}</span>
                          </button>

                          {expandedRounds.has(round.roundId) && (
                            <div className="border-t border-subtle p-4">
                              {loading[round.roundId] ? (
                                <div className="flex items-center justify-center gap-2 py-4">
                                  <div className="loading-spinner" />
                                  <span className="text-muted text-sm">Loading matches...</span>
                                </div>
                              ) : scheduleData[round.roundId]?.length ? (
                                <div className="space-y-3">
                                  {scheduleData[round.roundId].map((match) => (
                                    <div key={match.id} className="bg-surface-1 rounded-lg p-4 border border-subtle">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="text-sm font-medium text-secondary">
                                          Match {match.idx + 1}
                                          {match.isBye && <span className="ml-2 text-xs text-muted">(BYE)</span>}
                                        </div>
                                        <button
                                          className="btn btn-ghost text-xs"
                                          onClick={() => loadGamesForMatch(match.id)}
                                        >
                                          {gamesData[match.id] ? 'Refresh' : 'Load'} Games
                                        </button>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div className="text-secondary">
                                          {match.teamA?.name || 'TBD'}
                                          {match.teamA?.clubName && (
                                            <span className="text-muted ml-1">({match.teamA.clubName})</span>
                                          )}
                                        </div>
                                        <div className="text-secondary">
                                          {match.teamB?.name || 'TBD'}
                                          {match.teamB?.clubName && (
                                            <span className="text-muted ml-1">({match.teamB.clubName})</span>
                                          )}
                                        </div>
                                      </div>

                                      {gamesData[match.id] && (
                                        <div className="mt-3 space-y-2">
                                          {gamesData[match.id].map((game) => (
                                            <div key={game.id} className="bg-surface-2 p-2 rounded text-xs">
                                              <div className="font-medium text-primary mb-1">{game.slot}</div>
                                              <div className="flex gap-2">
                                                <input
                                                  type="number"
                                                  className="input text-xs w-16 h-8"
                                                  placeholder="A"
                                                  value={game.teamAScore ?? ''}
                                                  onChange={(e) => {
                                                    const val = e.target.value ? parseInt(e.target.value) : null;
                                                    updateGameScore(game.id, val, game.teamBScore);
                                                  }}
                                                />
                                                <input
                                                  type="number"
                                                  className="input text-xs w-16 h-8"
                                                  placeholder="B"
                                                  value={game.teamBScore ?? ''}
                                                  onChange={(e) => {
                                                    const val = e.target.value ? parseInt(e.target.value) : null;
                                                    updateGameScore(game.id, game.teamAScore, val);
                                                  }}
                                                />
                                                <input
                                                  type="text"
                                                  className="input text-xs w-20 h-8"
                                                  placeholder="Court"
                                                  value={game.courtNumber ?? ''}
                                                  readOnly
                                                />
                                                {game.isComplete && (
                                                  <span className="chip chip-success text-xs">Complete</span>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center text-muted py-4 text-sm">
                                  No matches scheduled for this round
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
