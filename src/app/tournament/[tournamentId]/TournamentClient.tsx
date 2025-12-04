
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { formatDateRangeUTC } from '@/lib/utils';
import { getMatchOutcomes, type MatchOutcome, type NormalizedGame } from '@/lib/matchOutcome';
import type { MatchTiebreakerStatus } from '@prisma/client';
import { ReadOnlyBracketView } from './components/ReadOnlyBracketView';

interface Tournament {
  id: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  type?: string;
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
  updatedAt?: string | null;
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
  bracketId?: string | null;
  bracket?: { id: string; name: string } | null;
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
  const [openAccordion, setOpenAccordion] = useState<'bracket' | 'inProgress' | 'completed'>('bracket');
  const [view, setView] = useState<'bracket' | 'matches'>('bracket');

  // Check if this is a double elimination tournament
  const isDoubleElimination = tournament.type === 'DOUBLE_ELIMINATION' || tournament.type === 'DOUBLE_ELIMINATION_CLUBS';

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

  // Ensure third stop data is loaded for Club Points calculation
  useEffect(() => {
    const thirdStopId = stops[2]?.id;
    if (thirdStopId && !stopDataCache[thirdStopId]) {
      loadStopData(thirdStopId);
    }
  }, [stops, stopDataCache]);

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
                teamBLineup: game.teamBLineup || [],
                bracketId: game.bracketId ?? null,
                bracket: game.bracket ?? null
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
    const winnerTeamId = outcome.winnerTeamId;

    // Extract club names and bracket name from match data
    const clubA = match.teamA?.club?.name || match.teamA?.name || 'Team A';
    const clubB = match.teamB?.club?.name || match.teamB?.name || 'Team B';
    const bracketName = match.teamA?.bracket?.name || match.teamB?.bracket?.name;

    return (
      <div className="border border-subtle rounded p-3 bg-surface-2">
        <div className="text-sm font-medium text-muted mb-1 flex items-center">
          {roundLabel}:
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

        {!match.forfeitTeam && (() => {
          // Group games by bracket
          console.log('[MatchCard DEBUG] Match:', match.id);
          console.log('[MatchCard DEBUG] outcome.games:', outcome.games);
          console.log('[MatchCard DEBUG] First game:', outcome.games[0]);
          console.log('[MatchCard DEBUG] First game.game:', outcome.games[0]?.game);
          console.log('[MatchCard DEBUG] First game.game.bracket:', outcome.games[0]?.game.bracket);

          const gamesByBracket = new Map<string, typeof outcome.games>();
          outcome.games.forEach((gameData) => {
            const bracketKey = gameData.game.bracket?.name || 'Main';
            console.log('[MatchCard DEBUG] Processing game:', gameData.game.slot, 'bracket:', gameData.game.bracket, 'key:', bracketKey);
            if (!gamesByBracket.has(bracketKey)) {
              gamesByBracket.set(bracketKey, []);
            }
            gamesByBracket.get(bracketKey)!.push(gameData);
          });

          console.log('[MatchCard DEBUG] Final groups:', Array.from(gamesByBracket.entries()).map(([k, v]) => [k, v.length]));

          return (
            <div className="space-y-4">
              {Array.from(gamesByBracket.entries())
                .sort((a, b) => b[0].localeCompare(a[0])) // Reverse alphabetical: Intermediate before Advanced
                .map(([bracketName, games]) => (
                <div key={bracketName} className="space-y-2">
                  {/* Bracket header - only show if not Main */}
                  {bracketName !== 'Main' && (
                    <div className="text-xs font-semibold text-info uppercase tracking-wide">
                      {bracketName}
                    </div>
                  )}

                  {/* Games in this bracket */}
                  {games.map(({ game, started, completed }) => (
                    <div key={game.id} className="border border-subtle rounded p-2">
                      <div className="flex items-center justify-between text-xs text-muted mb-1">
                        <div className="flex items-center gap-2">
                          <span className="uppercase tracking-wide">{game.slot.replace('_', ' ')}</span>
                          {game.courtNumber && (
                            <span className="bg-info/20 text-info px-1.5 py-0.5 rounded text-xs">
                              Court {game.courtNumber}
                            </span>
                          )}
                        </div>
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
                        <div className={`text-xs whitespace-pre-line text-left flex items-center ${completed && game.teamAScore !== null && game.teamBScore !== null && game.teamAScore > game.teamBScore ? 'font-bold text-success' : 'text-secondary'}`}>
                          {completed && game.teamAScore !== null && game.teamBScore !== null && game.teamAScore > game.teamBScore && (
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
                        <div className={`text-xs whitespace-pre-line text-right flex items-center ${completed && game.teamAScore !== null && game.teamBScore !== null && game.teamBScore > game.teamAScore ? 'font-bold text-success' : 'text-secondary'}`}>
                          {getPlayerNames(game, match, 'B')}
                          {completed && game.teamAScore !== null && game.teamBScore !== null && game.teamBScore > game.teamAScore && (
                            <span className="ml-1">🏆</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          );
        })()}

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

  const completedMatches = useMemo(() => {
    const matches = collectMatchesByStatus(selectedStop, 'completed');
    
    // Sort by completion time: most recently completed first
    return matches.sort((a, b) => {
      // Calculate completion time for each match
      const getCompletionTime = (match: Match): number => {
        // For forfeits, use match.updatedAt if available, otherwise use latest game time
        if (match.forfeitTeam && match.updatedAt) {
          return new Date(match.updatedAt).getTime();
        }
        
        // For regular matches, use the latest game's endedAt or updatedAt
        const gameTimes = match.games
          .map(game => {
            // Prefer endedAt, fallback to updatedAt, then createdAt
            return game.endedAt 
              ? new Date(game.endedAt).getTime()
              : game.updatedAt
                ? new Date(game.updatedAt).getTime()
                : game.createdAt
                  ? new Date(game.createdAt).getTime()
                  : 0;
          })
          .filter(time => time > 0);
        
        if (gameTimes.length > 0) {
          return Math.max(...gameTimes);
        }
        
        // Fallback: use match updatedAt if available
        if (match.updatedAt) {
          return new Date(match.updatedAt).getTime();
        }
        
        // Last resort: use 0 (will sort to bottom)
        return 0;
      };
      
      const timeA = getCompletionTime(a.match);
      const timeB = getCompletionTime(b.match);
      
      // Most recent first (descending order)
      return timeB - timeA;
    });
  }, [selectedStop, matchOutcomes]);

  // Fetch tournament-level standings from API
  const [standings, setStandings] = useState<any[]>([]);
  const [standingsLoading, setStandingsLoading] = useState(false);

  const fetchTournamentStandings = useCallback(async (tournamentId: string) => {
    setStandingsLoading(true);
    try {
      const response = await fetch(`/api/public/tournaments/${tournamentId}/standings`);
      
      if (response.ok) {
        const data = await response.json();
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
    if (tournament?.id) {
      fetchTournamentStandings(tournament.id);
    } else {
    }
  }, [tournament?.id, fetchTournamentStandings]);

  // Transform API data to match expected format
  const transformedStandings = standings.map(standing => ({
    team: {
      id: standing.team_id,
      name: standing.team_name,
      bracketName: standing.bracket_name,
      clubId: standing.clubId,
      clubName: standing.clubName
    },
    points: standing.points,
    wins: standing.wins,
    losses: standing.losses
  }));

  const combinedStandingsRaw = Array.from(
    transformedStandings.reduce((map, standing) => {
      const clubName = standing.team?.clubName ?? 'Unknown Club';
      const key = standing.team?.clubId ?? clubName.toLowerCase();

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

  // Group standings by bracket dynamically
  const bracketStandingsMap = new Map<string, typeof transformedStandings>();

  transformedStandings.forEach((standing) => {
    const bracketName = standing.team.bracketName || 'Default';
    const existing = bracketStandingsMap.get(bracketName);
    if (existing) {
      existing.push(standing);
    } else {
      bracketStandingsMap.set(bracketName, [standing]);
    }
  });

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

  // Sort each bracket's standings and attach places
  const bracketStandings = Array.from(bracketStandingsMap.entries())
    .map(([bracketName, standings]) => ({
      bracketName,
      standings: attachPlaces(standings.sort((a, b) => {
        if (b.points !== a.points) {
          return b.points - a.points;
        }
        return a.team.name.localeCompare(b.team.name);
      }))
    }))
    .sort((a, b) => a.bracketName.localeCompare(b.bracketName)); // Sort brackets alphabetically

  // Calculate total game points by club (sum of actual game scores) - only from the third stop
  const clubGamePoints = useMemo(() => {
    // Get the third stop's data (index 2)
    const thirdStopId = stops[2]?.id;
    const thirdStop = thirdStopId ? stopDataCache[thirdStopId] : null;

    if (!thirdStop) return [];

    const pointsByClub = new Map<string, { clubName: string; totalPoints: number }>();

    thirdStop.rounds?.forEach(round => {
      round.matches?.forEach(match => {
        const clubA = match.teamA?.club?.name || match.teamA?.name || 'Unknown';
        const clubB = match.teamB?.club?.name || match.teamB?.name || 'Unknown';

        match.games?.forEach(game => {
          // Only count completed games with valid scores
          if (game.isComplete && game.teamAScore !== null && game.teamBScore !== null) {
            // Add Team A's score to their club
            if (!pointsByClub.has(clubA)) {
              pointsByClub.set(clubA, { clubName: clubA, totalPoints: 0 });
            }
            pointsByClub.get(clubA)!.totalPoints += game.teamAScore;

            // Add Team B's score to their club
            if (!pointsByClub.has(clubB)) {
              pointsByClub.set(clubB, { clubName: clubB, totalPoints: 0 });
            }
            pointsByClub.get(clubB)!.totalPoints += game.teamBScore;
          }
        });
      });
    });

    // Convert to array and sort by total points descending
    return Array.from(pointsByClub.values())
      .sort((a, b) => b.totalPoints - a.totalPoints);
  }, [stops, stopDataCache]);

  const formatStopDates = (stop: Stop) => {
    const cached = stopDataCache[stop.id];
    const startRaw = cached?.startAt ?? stop.startAt ?? null;
    const endRaw = cached?.endAt ?? stop.endAt ?? null;


    return formatDateRangeUTC(startRaw, endRaw);
  };

  return (
    <div className="min-h-screen bg-app">
      <div className="w-full px-1 py-1 md:px-2 md:py-2">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-2 gap-2">
          <div className="flex-1 min-w-0 w-full md:w-auto">
            <h1 className="text-xl md:text-3xl font-bold text-primary">{tournament.name}</h1>
            {tournament.description && (
              <p className="text-secondary mt-1 text-sm md:text-base line-clamp-2">{tournament.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto md:ml-2">
            {/* View Toggle for Double Elimination Tournaments */}
            {isDoubleElimination && (
              <>
                <button
                  onClick={() => setView('bracket')}
                  className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                    view === 'bracket'
                      ? 'bg-primary text-white'
                      : 'bg-surface-2 text-secondary hover:bg-surface hover:text-primary'
                  }`}
                >
                  Bracket View
                </button>
                <button
                  onClick={() => setView('matches')}
                  className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                    view === 'matches'
                      ? 'bg-primary text-white'
                      : 'bg-surface-2 text-secondary hover:bg-surface hover:text-primary'
                  }`}
                >
                  Matches View
                </button>
              </>
            )}
            <button
              onClick={() => window.location.reload()}
              disabled={refreshing}
              className="btn btn-primary text-xs md:text-sm px-2 py-1 md:px-4 md:py-2"
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
        </div>

        {/* Mobile: Dropdown for stop selection */}
        <div className="md:hidden mb-4">
          <select
            value={selectedStopId || ''}
            onChange={(e) => {
              const stopId = e.target.value;
              setSelectedStopId(stopId);
              loadStopData(stopId);
            }}
            className="w-full px-3 py-2 text-sm bg-surface-2 border border-subtle rounded-md text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          >
            {stops.map((stop) => (
              <option key={stop.id} value={stop.id}>
                {stop.name} {formatStopDates(stop) && `- ${formatStopDates(stop)}`}
              </option>
            ))}
          </select>
        </div>

        {/* Mobile: Accordion Layout */}
        <div className="md:hidden space-y-2 mb-20">
          {/* Bracket Accordion for Double Elimination */}
          {isDoubleElimination && view === 'bracket' && (
            <div className="card">
              <button
                onClick={() => setOpenAccordion(openAccordion === 'bracket' ? null as any : 'bracket')}
                className="w-full px-4 py-3 flex items-center justify-between"
              >
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-info rounded-full mr-2"></div>
                  <h2 className="text-sm font-semibold text-primary">Bracket</h2>
                </div>
                <span className="text-primary">{openAccordion === 'bracket' ? '▼' : '▶'}</span>
              </button>
              {openAccordion === 'bracket' && selectedStopId && (
                <div className="px-2 pb-4 border-t border-subtle pt-4">
                  <ReadOnlyBracketView stopId={selectedStopId} />
                </div>
              )}
            </div>
          )}

          {/* Standings Accordion for non-Double Elimination */}
          {!isDoubleElimination && (
            <div className="card">
              <button
                onClick={() => setOpenAccordion(openAccordion === 'bracket' ? null as any : 'bracket')}
                className="w-full px-4 py-3 flex items-center justify-between"
              >
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-info rounded-full mr-2"></div>
                  <h2 className="text-sm font-semibold text-primary">Standings</h2>
                </div>
                <span className="text-primary">{openAccordion === 'bracket' ? '▼' : '▶'}</span>
              </button>
              {openAccordion === 'bracket' && (
              <div className="px-4 pb-4 border-t border-subtle pt-4">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-primary mb-2">Combined</h3>
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
                {bracketStandings.map(({ bracketName, standings }) => (
                  <div key={bracketName} className="mb-4 last:mb-0">
                    <h3 className="text-sm font-semibold text-primary mb-2">{bracketName}</h3>
                    {standings.length > 0 ? (
                      <div className="bg-surface-2 rounded p-3 space-y-1">
                        {standings.map((standing) => (
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
                      <div className="text-center py-3 text-muted text-sm">No {bracketName} teams</div>
                    )}
                  </div>
                ))}

                {/* Club Game Points - Total points scored by each club */}
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-primary mb-2">Club Points</h3>
                  <div className="bg-surface-2 rounded p-3">
                    {clubGamePoints.length > 0 ? (
                      <div className="space-y-1">
                        {clubGamePoints.map((club, index) => (
                          <div key={club.clubName} className="flex items-center justify-between py-1">
                            <div className="flex items-center">
                              <span className="text-xs font-medium text-muted w-4">{index + 1}</span>
                              <span className="text-sm font-medium text-primary ml-2">{club.clubName}</span>
                            </div>
                            <div className="text-sm font-semibold text-primary">{club.totalPoints}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-3 text-muted text-sm">No game scores yet</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          )}

          {/* In Progress and Completed - Show for all tournaments, or when in matches view */}
          {(!isDoubleElimination || view === 'matches') && (
            <>
          {/* In Progress Accordion */}
          <div className="card">
            <button
              onClick={() => setOpenAccordion(openAccordion === 'inProgress' ? null as any : 'inProgress')}
              className="w-full px-4 py-3 flex items-center justify-between"
            >
              <div className="flex items-center">
                <div className="w-2 h-2 bg-warning rounded-full mr-2"></div>
                <h2 className="text-sm font-semibold text-primary">In Progress</h2>
              </div>
              <span className="text-primary">{openAccordion === 'inProgress' ? '▼' : '▶'}</span>
            </button>
            {openAccordion === 'inProgress' && (
              <div className="px-2 pb-2">
                <MatchList
                  title=""
                  iconColor="bg-warning"
                  emptyMessage="No games started yet"
                  matches={inProgressMatches}
                  variant="in-progress"
                />
              </div>
            )}
          </div>

          {/* Completed Accordion */}
          <div className="card">
            <button
              onClick={() => setOpenAccordion(openAccordion === 'completed' ? null as any : 'completed')}
              className="w-full px-4 py-3 flex items-center justify-between"
            >
              <div className="flex items-center">
                <div className="w-2 h-2 bg-success rounded-full mr-2"></div>
                <h2 className="text-sm font-semibold text-primary">Completed</h2>
              </div>
              <span className="text-primary">{openAccordion === 'completed' ? '▼' : '▶'}</span>
            </button>
            {openAccordion === 'completed' && (
              <div className="px-2 pb-2">
                <MatchList
                  title=""
                  iconColor="bg-success"
                  emptyMessage="No completed games yet"
                  matches={completedMatches}
                  variant="completed"
                />
              </div>
            )}
          </div>
            </>
          )}
        </div>

        {/* Desktop: Main Content Layout - Stops (2/3) and Standings (1/3) */}
        <div className="hidden md:grid grid-cols-1 md:grid-cols-3 gap-1 md:gap-2 mb-20 md:mb-6">
          {/* Bracket View for Double Elimination - Full Width */}
          {isDoubleElimination && view === 'bracket' && selectedStopId && (
            <div className="col-span-3">
              <ReadOnlyBracketView stopId={selectedStopId} />
            </div>
          )}

          {/* Matches View or Non-Double Elimination - Left side - Games (2/3 width) */}
          {(!isDoubleElimination || view === 'matches') && (
            <div className="col-span-1 md:col-span-2">
            {/* Combined Games Card */}
            <div className="card">
              {/* Stop Tabs */}
              <div className="px-1 py-1 md:px-3 border-b border-subtle pb-2">
                <h2 className="text-sm md:text-lg font-semibold text-primary mb-2">Matches & Games</h2>
                {/* Desktop: Horizontal tabs */}
                <nav className="flex space-x-4" aria-label="Tabs">
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
              </div>

              {/* Games Section - 2 Column Layout for Double Elimination */}
              <div className={`grid ${isDoubleElimination && view === 'matches' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 md:grid-cols-2'} gap-1 md:gap-3 p-1 md:p-4`}>
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
          )}

          {/* Right side - Standings (1/3 width) - Only for non-Double Elimination */}
          {!isDoubleElimination && (
          <div className="col-span-1 md:col-span-1">
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

                {/* Dynamic bracket standings sections */}
                {bracketStandings.map(({ bracketName, standings }) => (
                  <div key={bracketName} className="mb-2 md:mb-6 last:mb-0">
                    <h3 className="text-sm font-semibold text-primary mb-1 md:mb-3 text-center md:text-left">
                      {bracketName}
                    </h3>
                    {standings.length > 0 ? (
                      <div className="bg-surface-2 rounded p-3 space-y-1">
                        {standings.map((standing) => (
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
                      <div className="text-center py-3 text-muted text-sm">No {bracketName} teams</div>
                    )}
                  </div>
                ))}

                {/* Club Game Points - Total points scored by each club */}
                <div className="mb-2 md:mb-6">
                  <h3 className="text-sm font-semibold text-primary mb-1 md:mb-3 text-center md:text-left">Club Points</h3>
                  <div className="bg-surface-2 rounded p-3">
                    {clubGamePoints.length > 0 ? (
                      <div className="space-y-1">
                        {clubGamePoints.map((club, index) => (
                          <div key={club.clubName} className="flex items-center justify-between py-1">
                            <div className="flex items-center">
                              <span className="text-xs font-medium text-muted w-4">{index + 1}</span>
                              <span className="text-sm font-medium text-primary ml-2">{club.clubName}</span>
                            </div>
                            <div className="text-sm font-semibold text-primary">{club.totalPoints}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-3 text-muted text-sm">No game scores yet</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}