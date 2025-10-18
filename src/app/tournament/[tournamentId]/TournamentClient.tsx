
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { formatDateRangeUTC } from '@/lib/utils';
import { getMatchOutcomes, type MatchOutcome, type NormalizedGame } from '@/lib/matchOutcome';
import type { MatchTiebreakerStatus } from '@prisma/client';

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
  tiebreakerStatus?: MatchTiebreakerStatus;
  tiebreakerWinnerTeamId?: string | null;
  totalPointsTeamA?: number | null;
  totalPointsTeamB?: number | null;
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
              tiebreakerStatus: match.tiebreakerStatus && match.tiebreakerStatus !== 'undefined' ? match.tiebreakerStatus : 'NONE',
              tiebreakerWinnerTeamId: match.tiebreakerWinnerTeamId && match.tiebreakerWinnerTeamId !== 'undefined' ? match.tiebreakerWinnerTeamId : null,
            totalPointsTeamA: match.totalPointsTeamA,
            totalPointsTeamB: match.totalPointsTeamB,
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
    const teamId = team === 'A' ? (match.teamA ? match.teamA.id : undefined) : (match.teamB ? match.teamB.id : undefined);
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
            return team === 'A' ? (match.teamA ? match.teamA.name || 'Team A' : 'Team A') : (match.teamB ? match.teamB.name || 'Team B' : 'Team B');
          default:
            return team === 'A' ? 'Team A' : 'Team B';
        }
      }
    }

    if (game.slot === 'TIEBREAKER') {
      return team === 'A' ? (match.teamA ? match.teamA.name || 'Team A' : 'Team A') : (match.teamB ? match.teamB.name || 'Team B' : 'Team B');
    }

    return team === 'A' ? 'Team A' : 'Team B';
  };

  function formatInProgressMatchLabel(match: Match) {
    const rawNameA = match.teamA ? match.teamA.name ?? 'Team A' : 'Team A';
    const rawNameB = match.teamB ? match.teamB.name ?? 'Team B' : 'Team B';

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
  }

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

  type MatchListProps = {
    title: string;
    iconColor: string;
    emptyMessage: string;
    variant: 'in-progress' | 'completed';
    matches: Array<{ match: Match; outcome: MatchOutcome; round: Round | null }>;
  };

  const MatchList = ({ title, iconColor, emptyMessage, variant, matches }: MatchListProps) => (
    <div>
      <h3 className="text-sm font-semibold text-primary mb-1 flex items-center">
        <div className={`w-2 h-2 ${iconColor} rounded-full mr-2`}></div>
        {title}
      </h3>
      {matches.length > 0 ? (
        <div className="space-y-2">
          {matches.map(({ match, outcome, round }) => (
            <MatchCard key={match.id} match={match} outcome={outcome} round={round} variant={variant} />
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-muted text-sm">{emptyMessage}</div>
      )}
    </div>
  );

  const MatchCard = ({ match, outcome, round, variant }: {
    match: Match;
    outcome: MatchOutcome;
    round: Round | null;
    variant: 'in-progress' | 'completed';
  }) => {
    const roundLabel = round?.name ?? 'Round';
    const divisionLabel = match.teamA?.name?.includes('Advanced') ? 'Advanced' : 'Intermediate';
    const winnerTeamId = outcome.winnerTeamId;
    
    // Extract club names and bracket name
    const clubA = deriveClubKey(match.teamA?.name);
    const clubB = deriveClubKey(match.teamB?.name);
    const bracketName = match.teamA?.bracket?.name || divisionLabel;

    return (
      <div className="border border-subtle rounded p-3 bg-surface-2">
        <div className="text-sm font-medium text-muted mb-1 flex items-center">
          {roundLabel} - {bracketName}:
          <span className={`ml-2 ${winnerTeamId && match.teamA?.id === winnerTeamId && variant === 'completed' ? 'font-bold text-success' : ''}`}>
            {winnerTeamId && match.teamA?.id === winnerTeamId && variant === 'completed' && (
              <span className="mr-1">🏆</span>
            )}
            {clubA}
          </span>
          <span className="mx-1">vs</span>
          <span className={`${winnerTeamId && match.teamB?.id === winnerTeamId && variant === 'completed' ? 'font-bold text-success' : ''}`}>
            {clubB}
            {winnerTeamId && match.teamB?.id === winnerTeamId && variant === 'completed' && (
              <span className="ml-1">🏆</span>
            )}
          </span>
        </div>
        {!match.forfeitTeam && <div className="text-xs text-muted mb-2">{divisionLabel}</div>}

        {!match.forfeitTeam && (
          <div className="space-y-2">
            {outcome.games.map(({ game, started, completed }) => (
              <div key={game.id} className="border border-subtle rounded p-2">
                <div className="flex items-center justify-between text-xs text-muted mb-1">
                  <span className="uppercase tracking-wide">{game.slot.replace('_', ' ')}</span>
                  {variant === 'in-progress' && (
                    <span>
                      {completed
                        ? 'Completed'
                        : started
                        ? 'In progress'
                        : outcome.pendingTiebreaker
                        ? 'Awaiting tiebreaker'
                        : 'Not started'}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className={`text-xs whitespace-pre-line text-left flex items-center ${game.teamAScore !== null && game.teamBScore !== null && game.teamAScore > game.teamBScore ? 'font-bold text-success' : 'text-secondary'}`}>
                    {game.teamAScore !== null && game.teamBScore !== null && game.teamAScore > game.teamBScore && (
                      <span className="mr-1">🏆</span>
                    )}
                    {getPlayerNames(game, match, 'A')}
                  </div>
                  <span className="font-medium text-primary">
                    {game.teamAScore !== null ? game.teamAScore : '-'}
                  </span>
                  <span className="text-muted">vs</span>
                  <span className="font-medium text-primary">
                    {game.teamBScore !== null ? game.teamBScore : '-'}
                  </span>
                  <div className={`text-xs whitespace-pre-line text-right flex items-center ${game.teamAScore !== null && game.teamBScore !== null && game.teamBScore > game.teamAScore ? 'font-bold text-success' : 'text-secondary'}`}>
                    {getPlayerNames(game, match, 'B')}
                    {game.teamAScore !== null && game.teamBScore !== null && game.teamBScore > game.teamAScore && (
                      <span className="ml-1">🏆</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted mt-1">
                  <span>Started: {getGameStartTime(game) || '—'}</span>
                  <span>Ended: {getGameEndTime(game) || '—'}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {match.forfeitTeam && variant === 'completed' ? (
          <div className="text-center py-3">
            <div className="text-sm font-semibold text-red-600">
              {match.forfeitTeam === 'A'
                ? clubB
                : clubA}{' '}
              wins by forfeit
            </div>
          </div>
        ) : variant === 'completed' && outcome.decidedBy ? (
          <div className="mt-2 text-xs text-muted text-right">
            Decided by {outcome.decidedBy === 'GAMES'
              ? 'game wins'
              : outcome.decidedBy === 'POINTS'
              ? 'total points'
              : outcome.decidedBy === 'TIEBREAKER'
              ? 'tiebreaker'
              : 'forfeit'}
          </div>
        ) : null}

        {variant === 'in-progress' && outcome.pendingTiebreaker && (
          <div className="mt-2 text-xs text-warning text-right">Tiebreaker still to be played</div>
        )}
      </div>
    );
  };

// buildMatchOutcome and getMatchOutcomes are now imported from @/lib/matchOutcome

  const selectedStop = currentStopData || (selectedStopId ? stopDataCache[selectedStopId] : null);

  const matchOutcomes = useMemo(() => {
    return selectedStop ? getMatchOutcomes(selectedStop) : {};
  }, [selectedStop]);

  const collectMatchesByStatus = (stop: Stop | null | undefined, status: MatchOutcome['status']) => {
    if (!stop) return [] as Array<{ match: Match; outcome: MatchOutcome; round: Round | null }>;

    const matches: Array<{ match: Match; outcome: MatchOutcome; round: Round | null }> = [];

    stop.rounds?.forEach(round => {
      round.matches?.forEach(match => {
        const outcome = matchOutcomes[match.id];
        if (!outcome) return;

        // Trust the outcome status - no need for additional pendingTiebreaker check
        // The buildMatchOutcome function already sets status='in_progress' when pendingTiebreaker=true
        if (outcome.status === status) {
          matches.push({ match, outcome, round });
        }
      });
    });

    return matches;
  };

  const inProgressMatches = useMemo(
    () => collectMatchesByStatus(selectedStop, 'in_progress'),
    [selectedStop, matchOutcomes]
  );

  const completedMatches = useMemo(
    () => collectMatchesByStatus(selectedStop, 'completed'),
    [selectedStop, matchOutcomes]
  );

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
                // Check if match was decided by tiebreaker
                if (match.tiebreakerStatus === 'DECIDED_POINTS' || match.tiebreakerStatus === 'DECIDED_TIEBREAKER') {
                  // Match decided by tiebreaker - use tiebreakerWinnerTeamId
                  if (match.tiebreakerWinnerTeamId === match.teamA?.id) {
                    teamPoints[match.teamA.id].points += 3;
                    teamPoints[match.teamA.id].wins += 1;
                    teamPoints[match.teamB.id].points += 1;
                    teamPoints[match.teamB.id].losses += 1;
                  } else if (match.tiebreakerWinnerTeamId === match.teamB?.id) {
                    teamPoints[match.teamB.id].points += 3;
                    teamPoints[match.teamB.id].wins += 1;
                    teamPoints[match.teamA.id].points += 1;
                    teamPoints[match.teamA.id].losses += 1;
                  }
                } else if (teamAScore > teamBScore) {
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
          team: {
            id: key,
            name: clubName,
          },
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
    }, new Map<string, { team: { id: string; name: string }; points: number; wins: number; losses: number }>()).values()
  ).sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    return a.team.name.localeCompare(b.team.name);
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
          {/* Left side - Games (2/3 width) */}
          <div className="col-span-1 md:col-span-2">
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
                <MatchList
                  title="In Progress"
                  iconColor="bg-warning"
                  emptyMessage="No games started yet"
                  matches={inProgressMatches}
                  variant="in-progress"
                />

                <MatchList
                  title="Completed"
                  iconColor="bg-success"
                  emptyMessage="No completed games yet"
                  matches={completedMatches}
                  variant="completed"
                />
                            </div>
                            </div>
                          </div>

          {/* Right side - Standings (1/3 width) */}
          <div className="col-span-1 md:col-span-1 block md:block">
            <div className="card">
              <div className="px-1 py-1 md:px-4 md:py-3 border-b border-subtle pb-2">
                <h2 className="text-sm md:text-lg font-semibold text-primary flex items-center mb-2">
                  <div className="w-2 h-2 bg-info rounded-full mr-2"></div>
                  Standings
                </h2>
                            </div>
              <div className="p-1 md:p-4">
                <div className="mb-2 md:mb-6">
                  <h3 className="text-sm font-semibold text-primary mb-1 md:mb-3 text-center md:text-left">Combined</h3>
                  <div className="bg-surface-2 rounded p-3">
                    {combinedStandings.length > 0 ? (
                      <div className="space-y-1">
                        {combinedStandings.map((standing) => (
                          <div key={standing.team.id} className="flex items-center justify-between py-1">
                            <div className="flex items-center">
                              <span className="text-xs font-medium text-muted w-4">{standing.place}</span>
                              <span className="text-sm font-medium text-primary ml-2">{standing.team.name}</span>
                            </div>
                            <div className="text-sm font-semibold text-primary">{standing.points} pts</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                      <div className="text-center py-3 text-muted text-sm">No Combined teams</div>
                  )}
                </div>
                            </div>

                <div className="mb-2 md:mb-6">
                  <h3 className="text-sm font-semibold text-primary mb-1 md:mb-3 text-center md:text-left">Advanced</h3>
                  {advancedStandings.length > 0 ? (
                    <div className="bg-surface-2 rounded p-3 space-y-1">
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
                  ) : (
                    <div className="text-center py-3 text-muted text-sm">No Advanced teams</div>
                  )}
            </div>

                <div>
                  <h3 className="text-sm font-semibold text-primary mb-1 md:mb-3 text-center md:text-left">Intermediate</h3>
                  {intermediateStandings.length > 0 ? (
                    <div className="bg-surface-2 rounded p-3 space-y-1">
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
                  ) : (
                    <div className="text-center py-3 text-muted text-sm">No Intermediate teams</div>
                  )}
                    </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}