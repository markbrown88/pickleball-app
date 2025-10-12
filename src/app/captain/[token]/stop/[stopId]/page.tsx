'use client';

import { use, useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type Bracket = {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
};

type Round = {
  id: string;
  idx: number;
  opponentTeamName: string;
  lineupsComplete: boolean;
};

type Game = {
  id: string;
  slot: string;
  myLineup?: Player[];
  opponentLineup?: Player[];
  myScore?: number | null;
  opponentScore?: number | null;
  mySubmittedScore?: number | null;
  opponentSubmittedScore?: number | null;
  myScoreSubmitted?: boolean;
  opponentScoreSubmitted?: boolean;
  isComplete: boolean;
  startedAt: string | null;
};

type Player = {
  id: string;
  name: string;
  gender: 'MALE' | 'FEMALE';
};

type MatchMeta = {
  id: string;
  opponentTeam?: { id?: string | null; name?: string | null } | null;
  tiebreakerStatus?: string | null;
  tiebreakerWinnerTeamId?: string | null;
  totalPointsTeamA?: number | null;
  totalPointsTeamB?: number | null;
  tiebreakerDecidedAt?: string | null;
  matchStatus?: string | null;
  opponentLineup?: (Player | null)[];
};

type LineupLockReason = 'deadline_passed' | 'match_started' | null;

export default function StopDetailPage({
  params,
}: {
  params: Promise<{ token: string; stopId: string }>;
}) {
  const { token, stopId } = use(params);
  const router = useRouter();

  const [view, setView] = useState<'brackets' | 'rounds' | 'games'>('brackets');
  const [selectedBracketId, setSelectedBracketId] = useState<string | null>(null);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);

  const [stopName, setStopName] = useState('');
  const [stopDate, setStopDate] = useState<string | null>(null);
  const [stopLocation, setStopLocation] = useState<string | null>(null);
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [roster, setRoster] = useState<Player[]>([]);
  const [canEdit, setCanEdit] = useState(true);
  const [isTeamA, setIsTeamA] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [existingLineup, setExistingLineup] = useState<Player[]>([]);
  const [matchMeta, setMatchMeta] = useState<MatchMeta | null>(null);
  const [lineupLockReason, setLineupLockReason] = useState<LineupLockReason>(null);

  // Breadcrumb data
  const [tournamentName, setTournamentName] = useState('');
  const [bracketName, setBracketName] = useState('');
  const [myTeamName, setMyTeamName] = useState('');
  const [opponentTeamName, setOpponentTeamName] = useState('');
  const [roundName, setRoundName] = useState('');

  const loadBrackets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/captain-portal/${token}/stop/${stopId}`);
      const data = await response.json();
      setStopName(data.stop.name);
      setBrackets(data.brackets);
      setTournamentName(data.tournament?.name || '');

      if (data.stop.startAt) {
        setStopDate(new Date(data.stop.startAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }));
      }
      setStopLocation(data.stop.club?.name || null);

      if (data.brackets.length > 0) {
        setMyTeamName(data.club?.name || data.brackets[0].teamName || '');
      }
    } catch (error) {
      console.error('Failed to load brackets:', error);
    } finally {
      setLoading(false);
    }
  }, [stopId, token]);

  const loadRounds = useCallback(async (bracketId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/captain-portal/${token}/stop/${stopId}/bracket/${bracketId}`);
      const data = await response.json();
      setRounds(data.rounds);
      setSelectedBracketId(bracketId);
      setView('rounds');
    } catch (error) {
      console.error('Failed to load rounds:', error);
    } finally {
      setLoading(false);
    }
  }, [stopId, token]);

  const loadGames = useCallback(async (roundId: string, bracketIdOverride?: string) => {
    setLoading(true);
    try {
      const bracketToUse = bracketIdOverride ?? selectedBracketId;
      if (!bracketToUse) {
        throw new Error('Please select a bracket first.');
      }

      setSelectedRoundId(roundId);
      setSelectedBracketId(bracketToUse);

      const response = await fetch(
        `/api/captain-portal/${token}/stop/${stopId}/bracket/${bracketToUse}/round/${roundId}`
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({} as { error?: string }));
        throw new Error(error?.error || `Failed to load games (HTTP ${response.status})`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const nextGames = data.games || [];
      const hadTiebreaker = games.some((g) => g.slot === 'TIEBREAKER');
      setGames(nextGames);
      setRoster(data.roster || []);
      setExistingLineup(data.existingLineup || []);
      setMatchMeta((data.match as MatchMeta) || null);
      setIsTeamA(typeof data.isTeamA === 'boolean' ? data.isTeamA : null);

      const matchStatus: string | undefined = data.match?.matchStatus;
      const anyGamesStarted = Array.isArray(data.games)
        ? data.games.some((g: any) => Boolean(g?.startedAt) || Boolean(g?.isComplete))
        : false;
      const lockedBecauseStarted = matchStatus && matchStatus !== 'not_started' ? true : anyGamesStarted;

      if (lockedBecauseStarted) {
        setCanEdit(false);
        setLineupLockReason('match_started');
      } else if (data.deadlinePassed) {
        setCanEdit(false);
        setLineupLockReason('deadline_passed');
      } else {
        setCanEdit(true);
        setLineupLockReason(null);
      }

      setTournamentName(data.tournament?.name || '');
      setBracketName(data.bracket?.name || '');
      setMyTeamName(data.myTeam?.name || '');
      setOpponentTeamName(data.match?.opponentTeam?.name || '');
      setRoundName(data.round?.name || `Round ${(data.round?.idx || 0) + 1}`);

      setView('games');

      if (!hadTiebreaker && nextGames.some((g: Game) => g.slot === 'TIEBREAKER')) {
        requestAnimationFrame(() => {
          const node = document.querySelector('[data-game-slot="TIEBREAKER"]');
          if (node instanceof HTMLElement) {
            node.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
      }
    } catch (error) {
      console.error('Failed to load games:', error);
      setGames([]);
      setRoster([]);
      alert(error instanceof Error ? error.message : 'Failed to load games.');
    } finally {
      setLoading(false);
    }
  }, [selectedBracketId, stopId, token]);

  useEffect(() => {
    loadBrackets();
  }, [loadBrackets]);

  const handleBack = () => {
    if (view === 'games') {
      setView('rounds');
      setSelectedRoundId(null);
    } else if (view === 'rounds') {
      setView('brackets');
      setSelectedBracketId(null);
    } else {
      router.push(`/captain/${token}`);
    }
  };

  if (loading && view === 'brackets') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-1">
        <div className="spinner"></div>
      </div>
    );
  }

  // Get current stop info from brackets data
  const currentBracket = brackets.find(b => b.id === selectedBracketId);
  const currentRound = rounds.find(r => r.id === selectedRoundId);

  // Helper function to remove bracket suffix from team names
  const stripBracketSuffix = (teamName: string) => {
    // Remove patterns like " 2.5", " 3.0", " 3.5", etc. from end of team name
    return teamName.replace(/\s+\d+(\.\d+)?$/, '');
  };

  const displayMyTeamName = stripBracketSuffix(myTeamName || currentBracket?.teamName || 'Your Team');
  const displayOpponentTeamName = stripBracketSuffix(opponentTeamName);

  return (
    <div className="min-h-screen">
      {/* Sticky Header with Progressive Breadcrumbs */}
      <div className="sticky top-0 bg-primary text-white py-3 px-4 z-50 shadow-lg">
        <div className="container mx-auto max-w-4xl">
          {/* Tournament Name - Always shown */}
          <h1 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold mb-1 truncate">{tournamentName || 'Tournament'}</h1>

          {/* Team Name - Always shown - Larger and bold */}
          <p className="text-sm sm:text-base md:text-lg lg:text-xl font-bold mb-2 truncate">
            {displayMyTeamName}
          </p>

          {/* Progressive Breadcrumbs based on view */}
          {view !== 'brackets' && (
            <div className="text-xs sm:text-sm opacity-80 space-y-1">
              {/* Stop and Bracket on same line */}
              <div className="truncate">
                Stop: {stopName}
                {view !== 'rounds' && currentBracket && (
                  <span className="ml-4">Bracket: {bracketName || currentBracket.name}</span>
                )}
                {stopDate && (
                  <span className="ml-2 opacity-75">• {stopDate}</span>
                )}
              </div>
              {stopLocation && (
                <div className="truncate text-xs opacity-70">📍 {stopLocation}</div>
              )}

              {view === 'games' && currentRound && (
                <div className="truncate">
                  {roundName} vs. {displayOpponentTeamName}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Back Button */}
      <div className="px-4 py-3">
        <div className="container mx-auto max-w-4xl">
          <button
            onClick={handleBack}
            className="text-primary hover:underline flex items-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-6">
        <div className="container mx-auto max-w-4xl">
          {view === 'brackets' && (
            <BracketsView brackets={brackets} onSelectBracket={loadRounds} />
          )}
          {view === 'rounds' && (
            <RoundsView rounds={rounds} onSelectRound={(roundId) => loadGames(roundId)} loading={loading} />
          )}
          {view === 'games' && (
          <GamesView
              games={games}
              roster={roster}
              canEdit={canEdit}
              token={token}
              stopId={stopId}
              bracketId={selectedBracketId!}
              roundId={selectedRoundId!}
            onUpdate={(roundIdOverride, bracketOverride) => loadGames(roundIdOverride ?? selectedRoundId!, bracketOverride ?? selectedBracketId!)}
              myTeamName={myTeamName}
              opponentTeamName={opponentTeamName}
              onBackToRounds={() => {
                setView('rounds');
                setSelectedRoundId(null);
              }}
            existingLineup={existingLineup}
            matchMeta={matchMeta}
            lineupLockReason={lineupLockReason}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function BracketsView({
  brackets,
  onSelectBracket,
}: {
  brackets: Bracket[];
  onSelectBracket: (bracketId: string) => void;
}) {
  return (
    <div>
      <h2 className="text-lg md:text-xl font-semibold text-primary mb-3">Select Bracket</h2>
      <div className="grid gap-2 md:gap-3">
        {brackets.map((bracket) => (
          <button
            key={bracket.id}
            onClick={() => onSelectBracket(bracket.id)}
            className="card p-3 md:p-4 text-left active:scale-95 hover:border-primary hover:shadow-lg transition-all w-full"
          >
            <h3 className="text-base md:text-lg font-semibold text-primary">{bracket.name}</h3>
          </button>
        ))}
      </div>
    </div>
  );
}

function RoundsView({
  rounds,
  onSelectRound,
  loading,
}: {
  rounds: Round[];
  onSelectRound: (roundId: string) => void;
  loading: boolean;
}) {
  if (loading) {
    return <div className="flex justify-center py-12"><div className="spinner"></div></div>;
  }

  return (
    <div>
      <h2 className="text-lg md:text-xl font-semibold text-primary mb-3">Select Round</h2>
      <div className="grid gap-2 md:gap-3">
        {rounds.map((round) => (
          <button
            key={round.id}
            onClick={() => onSelectRound(round.id)}
            className="card p-3 md:p-4 text-left active:scale-95 hover:border-primary hover:shadow-lg transition-all w-full"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-base md:text-lg font-semibold text-primary">Round {round.idx + 1}</h3>
                <p className="text-sm text-muted mt-1 truncate">vs {round.opponentTeamName}</p>
              </div>
              {round.lineupsComplete && (
                <span className="chip chip-success text-xs flex-shrink-0 ml-2">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Complete
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function GamesView({
  games,
  roster,
  canEdit,
  token,
  stopId,
  bracketId,
  roundId,
  onUpdate,
  myTeamName,
  opponentTeamName,
  onBackToRounds,
  existingLineup,
  matchMeta,
  lineupLockReason,
}: {
  games: Game[];
  roster: Player[];
  canEdit: boolean;
  token: string;
  stopId: string;
  bracketId: string;
  roundId: string;
  onUpdate: (roundId: string, bracketIdOverride?: string) => Promise<void>;
  myTeamName: string;
  opponentTeamName: string;
  onBackToRounds: () => void;
  existingLineup: Player[];
  matchMeta: MatchMeta | null;
  lineupLockReason: LineupLockReason;
}) {
  // State for the 4 lineup positions
  const [man1, setMan1] = useState<Player | null>(null);
  const [man2, setMan2] = useState<Player | null>(null);
  const [woman1, setWoman1] = useState<Player | null>(null);
  const [woman2, setWoman2] = useState<Player | null>(null);
  const [saving, setSaving] = useState(false);

  const menCount = roster.filter(player => player.gender === 'MALE').length;
  const womenCount = roster.filter(player => player.gender === 'FEMALE').length;
  const rosterReady = menCount >= 2 && womenCount >= 2;
  const derivedLineup = useMemo(() => {
    if (existingLineup && existingLineup.length === 4 && existingLineup.every(Boolean)) {
      return existingLineup as Player[];
    }

    const players: (Player | undefined)[] = [undefined, undefined, undefined, undefined];

    const mensDoubles = games.find(g => g.slot === 'MENS_DOUBLES');
    const womensDoubles = games.find(g => g.slot === 'WOMENS_DOUBLES');

    if (mensDoubles?.myLineup?.length === 2) {
      players[0] = mensDoubles.myLineup[0];
      players[1] = mensDoubles.myLineup[1];
    }

    if (womensDoubles?.myLineup?.length === 2) {
      players[2] = womensDoubles.myLineup[0];
      players[3] = womensDoubles.myLineup[1];
    }

    return players as Player[];
  }, [existingLineup, games]);

  const menAnchor = derivedLineup[0] || null;
  const secondMale = derivedLineup[1] || null;
  const womenAnchor = derivedLineup[2] || null;
  const secondFemale = derivedLineup[3] || null;

  const mixedOneMen = menAnchor;
  const mixedOneWomen = womenAnchor;
  const mixedTwoMen = secondMale;
  const mixedTwoWomen = secondFemale;

  const effectiveRoster = useMemo(() => {
    const map = new Map<string, Player>();
    roster.forEach(player => {
      if (!map.has(player.id)) {
        map.set(player.id, player);
      }
    });
    if (matchMeta?.opponentLineup && Array.isArray(matchMeta.opponentLineup)) {
      matchMeta.opponentLineup.forEach((player: Player) => {
        if (player && !map.has(player.id)) {
          map.set(player.id, player);
        }
      });
    }
    derivedLineup.forEach(player => {
      if (player && !map.has(player.id)) {
        map.set(player.id, player);
      }
    });
    return Array.from(map.values());
  }, [roster, derivedLineup, matchMeta]);

  // Initialize from existing lineups
  useEffect(() => {
    const lineupSource = derivedLineup;

    if (lineupSource[0]) setMan1(lineupSource[0]);
    if (lineupSource[1]) setMan2(lineupSource[1]);
    if (lineupSource[2]) setWoman1(lineupSource[2]);
    if (lineupSource[3]) setWoman2(lineupSource[3]);
  }, [derivedLineup]);

  // Get available players for each dropdown
  const getAvailablePlayers = (position: 'man1' | 'man2' | 'woman1' | 'woman2'): Player[] => {
    const usedPlayerIds = new Set([man1?.id, man2?.id, woman1?.id, woman2?.id].filter(Boolean));

    // Always include the currently selected player for this position
    const currentPlayer = position === 'man1' ? man1 : position === 'man2' ? man2 : position === 'woman1' ? woman1 : woman2;
    const gender = position.startsWith('man') ? 'MALE' : 'FEMALE';

    const uniquePlayers = new Map<string, Player>();

    if (currentPlayer && currentPlayer.gender === gender) {
      uniquePlayers.set(currentPlayer.id, currentPlayer);
      usedPlayerIds.delete(currentPlayer.id);
    }

    effectiveRoster.forEach(player => {
      if (player.gender !== gender) return;
      if (usedPlayerIds.has(player.id)) return;
      if (!uniquePlayers.has(player.id)) {
        uniquePlayers.set(player.id, player);
      }
    });

    return Array.from(uniquePlayers.values());
  };

  const saveLineups = async () => {
    if (!rosterReady) {
      alert('This team must have at least two men and two women on the stop roster before lineups can be saved.');
      return;
    }

    if (!man1 || !man2 || !woman1 || !woman2) {
      alert('Please select all 4 players before saving');
      return;
    }

    setSaving(true);
    try {
      // Save lineup using the old system
      const response = await fetch(
        `/api/captain-portal/${token}/stop/${stopId}/bracket/${bracketId}/round/${roundId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lineup: [man1, man2, woman1, woman2]
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save lineup');
      }

      const updated = await response.json().catch(() => null);
      if (updated?.match) {
        setMatchMeta(updated.match);
      }

      alert('Lineups saved successfully!');
      await onUpdate(roundId, bracketId);

      // Navigate back to rounds page
      onBackToRounds();
    } catch (error) {
      console.error('Failed to save lineups:', error);
      alert('Failed to save lineups. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const isLineupsComplete = man1 && man2 && woman1 && woman2;

  const getTiebreakerBanner = () => {
    if (!matchMeta) return null;
    const status = matchMeta.tiebreakerStatus as string | undefined;
    if (!status) return null;

    const winnerName = matchMeta.tiebreakerWinnerTeamId
      ? matchMeta.tiebreakerWinnerTeamId === matchMeta.opponentTeam?.id
        ? opponentTeamName
        : myTeamName
      : null;

    switch (status) {
      case 'tied_requires_tiebreaker':
        return {
          tone: 'warning',
          message: 'Match is tied 2-2. A tiebreaker game is required; contact the manager.',
        };
      case 'tied_pending':
        return {
          tone: 'info',
          message: 'Tiebreaker game has been scheduled. Await instructions from the manager.',
        };
      case 'decided_points':
        return {
          tone: 'success',
          message: `Match decided via total points${winnerName ? ` — ${winnerName} wins.` : '.'}`,
        };
      case 'decided_tiebreaker':
        return {
          tone: 'success',
          message: `Tiebreaker played${winnerName ? ` — ${winnerName} wins.` : '.'}`,
        };
      default:
        return null;
    }
  };

  const tiebreakerBanner = getTiebreakerBanner();

  const lineupLockedBanner = (() => {
    if (!lineupLockReason) return null;
    if (lineupLockReason === 'match_started') {
      return 'Lineup editing is locked because this match has already started.';
    }
    if (lineupLockReason === 'deadline_passed') {
      return 'Lineup deadline has passed. You can now view lineups and enter scores.';
    }
    return null;
  })();

  const lineupEditingEnabled = canEdit && lineupLockReason === null;

  const opponentMenPair = useMemo(() => {
    const core = matchMeta?.opponentLineup || [];
    return [core[0] || null, core[1] || null];
  }, [matchMeta]);

  const opponentWomenPair = useMemo(() => {
    const core = matchMeta?.opponentLineup || [];
    return [core[2] || null, core[3] || null];
  }, [matchMeta]);

  const opponentMixedOnePair = useMemo(() => {
    return [matchMeta?.opponentLineup?.[0] || null, matchMeta?.opponentLineup?.[2] || null];
  }, [matchMeta]);

  const opponentMixedTwoPair = useMemo(() => {
    const core = matchMeta?.opponentLineup || [];
    return [core[1] || null, core[3] || null];
  }, [matchMeta]);

  return (
    <div>
      {lineupEditingEnabled ? (
        /* Before Deadline: Show Players Section Only */
        <div className="card p-4 md:p-6 bg-surface-1">
          {tiebreakerBanner && (
            <div className={`mb-4 rounded-lg border px-3 py-2 text-sm ${tiebreakerBanner.tone === 'warning' ? 'bg-warning/10 border-warning/40 text-warning-dark' : tiebreakerBanner.tone === 'info' ? 'bg-info/10 border-info/40 text-info-dark' : 'bg-success/10 border-success/40 text-success-dark'}`}>
              {tiebreakerBanner.message}
            </div>
          )}

          <h3 className="text-lg md:text-xl font-semibold text-primary mb-3">Players</h3>
          <p className="text-sm text-muted mb-4">
            Select your lineup and the games will be automatically populated.
          </p>

          {lineupLockedBanner && (
            <div className="mb-4 border border-warning/40 bg-warning/10 text-warning text-sm p-3 rounded">
              {lineupLockedBanner}
            </div>
          )}

          {!rosterReady && (
            <div className="mb-4 border border-warning/40 bg-warning/10 text-warning text-sm p-3 rounded">
              {myTeamName || 'This club'} must add at least two men and two women to its stop roster before lineups can be set for this match. Current roster: {menCount} men, {womenCount} women.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6">
            {/* Men */}
            <div>
              <h4 className="text-sm font-medium text-secondary mb-3">Men</h4>
              <div className="space-y-3">
                <select
                  value={man1?.id || ''}
                  onChange={(e) => setMan1(roster.find(p => p.id === e.target.value) || null)}
                  disabled={!rosterReady}
                  className={`input w-full text-base ${!rosterReady ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <option value="">Select first male player...</option>
                  {getAvailablePlayers('man1').map(player => (
                    <option key={player.id} value={player.id}>{player.name}</option>
                  ))}
                </select>
                <select
                  value={man2?.id || ''}
                  onChange={(e) => setMan2(roster.find(p => p.id === e.target.value) || null)}
                  disabled={!rosterReady}
                  className={`input w-full text-base ${!rosterReady ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <option value="">Select second male player...</option>
                  {getAvailablePlayers('man2').map(player => (
                    <option key={player.id} value={player.id}>{player.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Women */}
            <div>
              <h4 className="text-sm font-medium text-secondary mb-3">Women</h4>
              <div className="space-y-3">
                <select
                  value={woman1?.id || ''}
                  onChange={(e) => setWoman1(roster.find(p => p.id === e.target.value) || null)}
                  disabled={!rosterReady}
                  className={`input w-full text-base ${!rosterReady ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <option value="">Select first female player...</option>
                  {getAvailablePlayers('woman1').map(player => (
                    <option key={player.id} value={player.id}>{player.name}</option>
                  ))}
                </select>
                <select
                  value={woman2?.id || ''}
                  onChange={(e) => setWoman2(roster.find(p => p.id === e.target.value) || null)}
                  disabled={!rosterReady}
                  className={`input w-full text-base ${!rosterReady ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <option value="">Select second female player...</option>
                  {getAvailablePlayers('woman2').map(player => (
                    <option key={player.id} value={player.id}>{player.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <button
            onClick={saveLineups}
            disabled={!isLineupsComplete || saving || !rosterReady}
            className="btn btn-primary disabled:opacity-50 w-full md:w-auto"
          >
            {saving ? 'Saving...' : 'Save Lineup'}
          </button>
        </div>
      ) : (
        /* After Deadline: Show Games Section Only */
        <div className="space-y-4">
          {tiebreakerBanner && (
            <div className={`rounded-lg border px-3 py-2 text-sm ${tiebreakerBanner.tone === 'warning' ? 'bg-warning/10 border-warning/40 text-warning-dark' : tiebreakerBanner.tone === 'info' ? 'bg-info/10 border-info/40 text-info-dark' : 'bg-success/10 border-success/40 text-success-dark'}`}>
              {tiebreakerBanner.message}
            </div>
          )}

          {lineupLockedBanner && (
            <div className="bg-warning/10 border border-warning text-warning px-4 py-3 rounded mb-6">
              {lineupLockedBanner}
            </div>
          )}

          <h3 className="text-lg md:text-xl font-semibold text-primary">Games</h3>

          <GamePreview
            title="Men's Doubles"
            player1={menAnchor || null}
            player2={derivedLineup[1] || null}
            game={games.find(g => g.slot === 'MENS_DOUBLES')}
            token={token}
            stopId={stopId}
            bracketId={bracketId}
            roundId={roundId}
            onUpdate={(roundIdOverride, bracketOverride) => onUpdate(roundIdOverride ?? roundId, bracketOverride ?? bracketId)}
            opponentPlayers={opponentMenPair}
          />
          <GamePreview
            title="Women's Doubles"
            player1={derivedLineup[2] || null}
            player2={derivedLineup[3] || null}
            game={games.find(g => g.slot === 'WOMENS_DOUBLES')}
            token={token}
            stopId={stopId}
            bracketId={bracketId}
            roundId={roundId}
            onUpdate={(roundIdOverride, bracketOverride) => onUpdate(roundIdOverride ?? roundId, bracketOverride ?? bracketId)}
            opponentPlayers={opponentWomenPair}
          />
          <GamePreview
            title="Mixed Doubles 1"
            player1={mixedOneMen || null}
            player2={mixedOneWomen || null}
            game={games.find(g => g.slot === 'MIXED_1')}
            token={token}
            stopId={stopId}
            bracketId={bracketId}
            roundId={roundId}
            onUpdate={(roundIdOverride, bracketOverride) => onUpdate(roundIdOverride ?? roundId, bracketOverride ?? bracketId)}
            opponentPlayers={opponentMixedOnePair}
          />
          <GamePreview
            title="Mixed Doubles 2"
            player1={mixedTwoMen || null}
            player2={mixedTwoWomen || null}
            game={games.find(g => g.slot === 'MIXED_2')}
            token={token}
            stopId={stopId}
            bracketId={bracketId}
            roundId={roundId}
            onUpdate={(roundIdOverride, bracketOverride) => onUpdate(roundIdOverride ?? roundId, bracketOverride ?? bracketId)}
            opponentPlayers={opponentMixedTwoPair}
          />
          {(() => {
            const tiebreakerGame = games.find(g => g.slot === 'TIEBREAKER');
            if (!tiebreakerGame) return null;

            const myPlayers = tiebreakerGame.myLineup && tiebreakerGame.myLineup.length === 2
              ? tiebreakerGame.myLineup
              : [menAnchor || mixedOneMen || null, mixedOneWomen || mixedTwoWomen || null];
            const opponentPlayersForTiebreaker = tiebreakerGame.opponentLineup && tiebreakerGame.opponentLineup.length === 2
              ? tiebreakerGame.opponentLineup
              : opponentMenPair;

            return (
              <GamePreview
                title="Tiebreaker"
                player1={myPlayers[0] || null}
                player2={myPlayers[1] || null}
                game={tiebreakerGame}
                token={token}
                stopId={stopId}
                bracketId={bracketId}
                roundId={roundId}
                onUpdate={(roundIdOverride, bracketOverride) => onUpdate(roundIdOverride ?? roundId, bracketOverride ?? bracketId)}
                opponentPlayers={opponentPlayersForTiebreaker as (Player | null)[]}
              data-slot="TIEBREAKER"
              />
            );
          })()}
        </div>
      )}
    </div>
  );
}

function GamePreview({
  title,
  player1,
  player2,
  game,
  token,
  stopId,
  bracketId,
  roundId,
  onUpdate,
  opponentPlayers,
}: {
  title: string;
  player1: Player | null;
  player2: Player | null;
  game?: Game;
  token: string;
  stopId: string;
  bracketId: string;
  roundId: string;
  onUpdate: (roundIdOverride?: string, bracketIdOverride?: string) => Promise<void>;
  opponentPlayers: (Player | null)[];
}) {
  const [myScore, setMyScore] = useState<string>('');
  const [opponentScore, setOpponentScore] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Initialize from game data
  useEffect(() => {
    setMyScore((prev) => {
      if (game?.mySubmittedScore !== undefined && game?.mySubmittedScore !== null) {
        return String(game.mySubmittedScore);
      }
      if (game?.myScore !== undefined && game?.myScore !== null) {
        return String(game.myScore);
      }
      if (!game?.myScoreSubmitted) {
        return '';
      }
      return prev;
    });

    setOpponentScore((prev) => {
      if (game?.opponentSubmittedScore !== undefined && game?.opponentSubmittedScore !== null) {
        return String(game.opponentSubmittedScore);
      }
      if (game?.opponentScore !== undefined && game?.opponentScore !== null) {
        return String(game.opponentScore);
      }
      if (!game?.myScoreSubmitted) {
        return '';
      }
      return prev;
    });
  }, [game?.id, game?.mySubmittedScore, game?.opponentSubmittedScore, game?.myScore, game?.opponentScore, game?.myScoreSubmitted]);

  const handleSubmitScore = async () => {
    if (!game) return;

    const myScoreNum = parseInt(myScore);
    const oppScoreNum = parseInt(opponentScore);

    if (isNaN(myScoreNum) || isNaN(oppScoreNum)) {
      alert('Please enter valid scores');
      return;
    }

    if (myScoreNum < 0 || oppScoreNum < 0) {
      alert('Scores cannot be negative');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(
        `/api/captain-portal/${token}/stop/${stopId}/bracket/${bracketId}/round/${roundId}/game/${game.id}/score`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            myScore: myScoreNum,
            opponentScore: oppScoreNum
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to submit score');
      }

      const result = await response.json();

      const nextMyScore = result.gameState?.myScore ?? myScoreNum;
      const nextOpponentScore = result.gameState?.opponentScore ?? oppScoreNum;

      if (result.confirmed) {
        alert('Score confirmed! Both teams agree.');
      } else if (result.mismatch) {
        const opp = result.opponentSubmission;
        if (opp) {
          alert(
            `Score submitted! The opponent submitted a different score (${opp.teamAScore}-${opp.teamBScore}). Please contact tournament admin to resolve.`
          );
        } else {
          alert('Score submitted, but the opponent still needs to enter their score.');
        }
      } else if (result.waitingForOpponent) {
        alert('Score submitted! Waiting for opponent to confirm.');
      } else {
        alert('Score submitted.');
      }

      setMyScore(String(nextMyScore));
      setOpponentScore(String(nextOpponentScore));

      await onUpdate(roundId, bracketId);
    } catch (error) {
      console.error('Failed to submit score:', error);
      alert('Failed to submit score. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!game) {
    return (
      <div className="card p-4 bg-surface-1 opacity-60">
        <h4 className="text-sm font-semibold text-secondary mb-2">{title}</h4>
        <div className="text-sm">
          {player1 && player2 ? (
            <span className="text-primary">{player1.name} & {player2.name}</span>
          ) : (
            <span className="text-muted italic">Not selected</span>
          )}
        </div>
      </div>
    );
  }

  const hasLineup = player1 && player2;
  const myLineup = hasLineup
    ? [player1!, player2!]
    : game?.myLineup && game.myLineup.length === 2
      ? game.myLineup
      : [];
  const myScoreSubmitted = game.myScoreSubmitted || false;
  const opponentScoreSubmitted = game.opponentScoreSubmitted || false;
  const displayMySubmittedScore =
    game.mySubmittedScore ?? game.myScore ?? (myScore !== '' ? Number(myScore) : null);
  const displayOpponentSubmittedScore =
    game.opponentSubmittedScore ?? game.opponentScore ?? (opponentScore !== '' ? Number(opponentScore) : null);

  const scoresMatch = (() => {
    if (!myScoreSubmitted || !opponentScoreSubmitted) return false;
    if (
      displayMySubmittedScore === null ||
      displayMySubmittedScore === undefined ||
      displayOpponentSubmittedScore === null ||
      displayOpponentSubmittedScore === undefined
    ) {
      return false;
    }

    if (displayMySubmittedScore === displayOpponentSubmittedScore) {
      return true;
    }

    const myPerspective = {
      mine: game.myScore ?? displayMySubmittedScore,
      theirs: game.opponentScore ?? displayOpponentSubmittedScore,
    };

    const opponentPerspective = {
      mine: displayOpponentSubmittedScore,
      theirs: displayMySubmittedScore,
    };

    return myPerspective.mine === opponentPerspective.theirs && myPerspective.theirs === opponentPerspective.mine;
  })();

  const disableInputs = game.isComplete;
  const canSubmit = !disableInputs && myScore.trim() !== '' && opponentScore.trim() !== '';

  return (
    <div className={`card p-4 ${game.isComplete ? 'bg-success/5 border-success' : ''}`}>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-secondary">{title}</h4>
          {game.isComplete && (
            <span className="chip chip-success text-xs">Complete</span>
          )}
        </div>

        {/* Lineups Display */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center text-sm mb-3">
          {/* My Team */}
          <div className="text-left">
            {myLineup.length === 2 ? (
              <div className="space-y-1">
                <div className="text-primary font-medium">{myLineup[0].name}</div>
                <div className="text-primary font-medium">{myLineup[1].name}</div>
              </div>
            ) : (
              <span className="text-muted italic">Not selected</span>
            )}
          </div>

          {/* VS */}
          <div className="text-muted font-semibold px-2">VS</div>

          {/* Opponent Team */}
          <div className="text-right">
            {opponentPlayers.filter(Boolean).length === 2 ? (
              <div className="space-y-1">
                <div className="text-secondary">{opponentPlayers[0]?.name}</div>
                <div className="text-secondary">{opponentPlayers[1]?.name}</div>
              </div>
            ) : (
              <span className="text-muted italic">Not set</span>
            )}
          </div>
        </div>

        {/* Score Entry/Display */}
        {(hasLineup || (game.myLineup && game.myLineup.length === 2)) && (
          <div className="border-t border-border pt-3">
            {game.isComplete ? (
              // Final Score Display
              <div className="flex items-center justify-center gap-4 py-2">
                <span className="text-2xl font-bold text-primary">{game.myScore}</span>
                <span className="text-muted">-</span>
                <span className="text-2xl font-bold text-primary">{game.opponentScore}</span>
              </div>
            ) : (
              // Score Entry
              <div className="space-y-3">
                {/* Score Inputs */}
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-muted mb-1">Your Score</label>
                    <input
                      type="number"
                      min="0"
                      value={myScore}
                      onChange={(e) => setMyScore(e.target.value)}
                      disabled={myScoreSubmitted || disableInputs}
                      className="input w-full"
                      placeholder="0"
                    />
                  </div>
                  <div className="text-muted pt-5">-</div>
                  <div className="flex-1">
                    <label className="block text-xs text-muted mb-1">Opponent Score</label>
                    <input
                      type="number"
                      min="0"
                      value={opponentScore}
                      onChange={(e) => setOpponentScore(e.target.value)}
                      disabled={myScoreSubmitted || disableInputs}
                      className="input w-full"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                {!myScoreSubmitted && (
                  <button
                    onClick={handleSubmitScore}
                    disabled={submitting || !canSubmit}
                    className="btn btn-primary btn-sm w-full disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : 'Submit Score'}
                  </button>
                )}

                {/* Status Messages */}
                {myScoreSubmitted && (
                  <div className="space-y-2">
                    <div className="bg-primary/10 border border-primary text-primary px-3 py-2 rounded text-xs">
                      ✓ You submitted: {displayMySubmittedScore ?? '—'} - {displayOpponentSubmittedScore ?? '—'}
                    </div>

                    {opponentScoreSubmitted ? (
                      scoresMatch ? (
                        <div className="bg-success/10 border border-success text-success px-3 py-2 rounded text-xs">
                          ✓ Both teams agree on the score!
                        </div>
                      ) : (
                        <div className="bg-warning/10 border border-warning text-warning px-3 py-2 rounded text-xs">
                          ⚠ Score mismatch! Opponent submitted: {game.opponentSubmittedScore} - {game.mySubmittedScore}
                        </div>
                      )
                    ) : (
                      <div className="bg-muted/10 border border-muted text-muted px-3 py-2 rounded text-xs">
                        Waiting for opponent to submit score...
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
