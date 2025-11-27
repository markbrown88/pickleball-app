'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { formatDateUTC } from '@/lib/utils';

type Player = {
  id: string;
  name: string;
  gender: 'MALE' | 'FEMALE';
};

type Game = {
  id: string;
  slot: string;
  myLineup?: Player[];
  opponentLineup?: Player[];
  myScore?: number | null;
  opponentScore?: number | null;
  isComplete: boolean;
  startedAt: string | null;
  courtNumber?: number | null;
};

type Bracket = {
  id: string;
  name: string;
  team: { id: string; name: string };
  opponentTeam: { id: string; name: string } | null;
  roster: Player[];
  lineup: Player[];
  opponentLineup: Player[];
  games: Game[];
};

type Match = {
  id: string;
  roundId: string;
  stopId: string;
  opponent: { id: string; name: string };
  hasStarted: boolean;
  location?: string;
  date?: string;
};

type MatchData = {
  tournament: { id: string; name: string; type: string };
  club: { id: string; name: string };
  match: Match | null;
  brackets: Bracket[];
  message?: string;
};

export default function MatchPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();

  const [data, setData] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lineup state: bracketId -> [man1, man2, woman1, woman2]
  const [lineups, setLineups] = useState<Record<string, (Player | null)[]>>({});

  const loadMatchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/captain-portal/${token}/match`);
      if (!response.ok) {
        throw new Error('Failed to load match data');
      }
      const matchData = await response.json();
      setData(matchData);

      // Initialize lineup state from existing lineups
      const initialLineups: Record<string, (Player | null)[]> = {};
      matchData.brackets?.forEach((bracket: Bracket) => {
        if (bracket.lineup && bracket.lineup.length === 4) {
          initialLineups[bracket.id] = bracket.lineup;
        } else {
          initialLineups[bracket.id] = [null, null, null, null];
        }
      });
      setLineups(initialLineups);
    } catch (err) {
      console.error('Failed to load match data:', err);
      setError('Failed to load match data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadMatchData();
  }, [loadMatchData]);

  const handleSaveAllLineups = async () => {
    if (!data?.match) return;

    setSaving(true);
    try {
      // Validate all lineups
      const lineupsToSave = data.brackets.map(bracket => {
        const lineup = lineups[bracket.id];
        if (!lineup || lineup.some(p => p === null)) {
          throw new Error(`Please complete lineup for ${bracket.name} bracket`);
        }

        // Validate 2 men, 2 women
        const men = lineup.filter(p => p?.gender === 'MALE');
        const women = lineup.filter(p => p?.gender === 'FEMALE');

        if (men.length !== 2 || women.length !== 2) {
          throw new Error(`${bracket.name} bracket must have exactly 2 men and 2 women`);
        }

        return {
          bracketId: bracket.id,
          lineup: lineup
        };
      });

      const response = await fetch(`/api/captain-portal/${token}/match/lineup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: data.match.id,
          lineups: lineupsToSave
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save lineups');
      }

      alert('All lineups saved successfully!');
      await loadMatchData(); // Reload to get updated state
    } catch (err) {
      console.error('Failed to save lineups:', err);
      alert(err instanceof Error ? err.message : 'Failed to save lineups. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const updateLineup = (bracketId: string, slotIndex: number, player: Player | null) => {
    setLineups(prev => {
      const newLineups = { ...prev };
      const bracketLineup = [...(newLineups[bracketId] || [null, null, null, null])];

      // Remove player from other slots if exists
      for (let i = 0; i < bracketLineup.length; i++) {
        if (bracketLineup[i]?.id === player?.id) {
          bracketLineup[i] = null;
        }
      }

      // Add player to new slot
      bracketLineup[slotIndex] = player;
      newLineups[bracketId] = bracketLineup;

      return newLineups;
    });
  };

  const areAllLineupsComplete = () => {
    if (!data?.brackets) return false;
    return data.brackets.every(bracket => {
      const lineup = lineups[bracket.id];
      return lineup && lineup.every(p => p !== null);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-1">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-1">
        <div className="card p-6 max-w-md">
          <h2 className="text-lg font-semibold text-error mb-2">Error</h2>
          <p className="text-muted">{error || 'Failed to load match data'}</p>
          <button
            onClick={() => router.push(`/captain/${token}`)}
            className="btn btn-primary mt-4"
          >
            Back to Tournament
          </button>
        </div>
      </div>
    );
  }

  if (!data.match) {
    return (
      <div className="min-h-screen">
        {/* Header */}
        <div className="sticky top-0 bg-primary text-white py-3 px-4 z-50 shadow-lg">
          <div className="container mx-auto max-w-4xl">
            <h1 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold mb-1">
              {data.tournament.name}
            </h1>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl font-bold">
              {data.club.name}
            </p>
          </div>
        </div>

        {/* Back Button */}
        <div className="px-4 py-3">
          <div className="container mx-auto max-w-4xl">
            <button
              onClick={() => router.push(`/captain/${token}`)}
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
            <div className="card p-6 text-center">
              <h2 className="text-lg font-semibold text-muted mb-2">No Active Match</h2>
              <p className="text-muted">
                {data.message || 'Waiting for your next match. Check back later.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { match, brackets } = data;

  return (
    <div className="min-h-screen">
      {/* Sticky Header */}
      <div className="sticky top-0 bg-primary text-white py-3 px-4 z-50 shadow-lg">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold mb-1">
            {data.tournament.name}
          </h1>
          <p className="text-sm sm:text-base md:text-lg lg:text-xl font-bold mb-2">
            {data.club.name}
          </p>
          <div className="text-xs sm:text-sm opacity-80">
            <div>vs. {match.opponent.name}</div>
            {match.location && <div className="text-xs opacity-70 mt-1">📍 {match.location}</div>}
            {match.date && <div className="text-xs opacity-70">📅 {formatDateUTC(match.date)}</div>}
          </div>
        </div>
      </div>

      {/* Back Button */}
      <div className="px-4 py-3">
        <div className="container mx-auto max-w-4xl">
          <button
            onClick={() => router.push(`/captain/${token}`)}
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
          {!match.hasStarted ? (
            /* Lineup Selection Mode */
            <>
              <div className="mb-4">
                <h2 className="text-lg md:text-xl font-semibold text-primary mb-2">
                  Select Lineups for All Brackets
                </h2>
                <p className="text-sm text-muted">
                  Choose 2 men and 2 women for each skill bracket. The games will be automatically populated.
                </p>
              </div>

              <div className="space-y-4">
                {brackets.map(bracket => (
                  <BracketLineupCard
                    key={bracket.id}
                    bracket={bracket}
                    lineup={lineups[bracket.id] || [null, null, null, null]}
                    onUpdateLineup={(slotIndex, player) => updateLineup(bracket.id, slotIndex, player)}
                  />
                ))}
              </div>

              <div className="mt-6">
                <button
                  onClick={handleSaveAllLineups}
                  disabled={!areAllLineupsComplete() || saving}
                  className="btn btn-primary w-full md:w-auto disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save All Lineups'}
                </button>
              </div>
            </>
          ) : (
            /* Game Score Entry Mode */
            <>
              <div className="mb-4">
                <h2 className="text-lg md:text-xl font-semibold text-primary mb-2">
                  Games
                </h2>
                <p className="text-sm text-muted">
                  Enter scores for each game across all skill brackets.
                </p>
              </div>

              <div className="space-y-4">
                {brackets.map(bracket => (
                  <BracketGamesCard
                    key={bracket.id}
                    bracket={bracket}
                    token={token}
                    stopId={match.stopId}
                    roundId={match.roundId}
                    onUpdate={loadMatchData}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Component for lineup selection for one bracket
function BracketLineupCard({
  bracket,
  lineup,
  onUpdateLineup,
}: {
  bracket: Bracket;
  lineup: (Player | null)[];
  onUpdateLineup: (slotIndex: number, player: Player | null) => void;
}) {
  const menRoster = bracket.roster.filter(p => p.gender === 'MALE');
  const womenRoster = bracket.roster.filter(p => p.gender === 'FEMALE');

  const getAvailablePlayers = (slotIndex: number): Player[] => {
    const expectedGender = slotIndex < 2 ? 'MALE' : 'FEMALE';
    const roster = expectedGender === 'MALE' ? menRoster : womenRoster;

    const currentPlayer = lineup[slotIndex];
    const usedPlayerIds = new Set(
      lineup.filter((p, idx) => p && idx !== slotIndex).map(p => p!.id)
    );

    return roster.filter(p => !usedPlayerIds.has(p.id) || p.id === currentPlayer?.id);
  };

  const rosterReady = menRoster.length >= 2 && womenRoster.length >= 2;

  return (
    <div className="card p-4 md:p-6 bg-surface-1">
      <h3 className="text-base md:text-lg font-semibold text-blue-400 mb-3">
        {bracket.name} Bracket
      </h3>

      {!rosterReady && (
        <div className="mb-4 border border-warning/40 bg-warning/10 text-warning text-sm p-3 rounded">
          This bracket must have at least 2 men and 2 women in its roster before lineups can be set.
          Current roster: {menRoster.length} men, {womenRoster.length} women.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Men */}
        <div>
          <h4 className="text-sm font-medium text-secondary mb-3">Men</h4>
          <div className="space-y-3">
            <select
              value={lineup[0]?.id || ''}
              onChange={(e) => {
                const player = menRoster.find(p => p.id === e.target.value) || null;
                onUpdateLineup(0, player);
              }}
              disabled={!rosterReady}
              className={`input w-full text-base ${!rosterReady ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <option value="">Select first male player...</option>
              {getAvailablePlayers(0).map(player => (
                <option key={player.id} value={player.id}>{player.name}</option>
              ))}
            </select>
            <select
              value={lineup[1]?.id || ''}
              onChange={(e) => {
                const player = menRoster.find(p => p.id === e.target.value) || null;
                onUpdateLineup(1, player);
              }}
              disabled={!rosterReady}
              className={`input w-full text-base ${!rosterReady ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <option value="">Select second male player...</option>
              {getAvailablePlayers(1).map(player => (
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
              value={lineup[2]?.id || ''}
              onChange={(e) => {
                const player = womenRoster.find(p => p.id === e.target.value) || null;
                onUpdateLineup(2, player);
              }}
              disabled={!rosterReady}
              className={`input w-full text-base ${!rosterReady ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <option value="">Select first female player...</option>
              {getAvailablePlayers(2).map(player => (
                <option key={player.id} value={player.id}>{player.name}</option>
              ))}
            </select>
            <select
              value={lineup[3]?.id || ''}
              onChange={(e) => {
                const player = womenRoster.find(p => p.id === e.target.value) || null;
                onUpdateLineup(3, player);
              }}
              disabled={!rosterReady}
              className={`input w-full text-base ${!rosterReady ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <option value="">Select second female player...</option>
              {getAvailablePlayers(3).map(player => (
                <option key={player.id} value={player.id}>{player.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

// Component for game score entry for one bracket
function BracketGamesCard({
  bracket,
  token,
  stopId,
  roundId,
  onUpdate,
}: {
  bracket: Bracket;
  token: string;
  stopId: string;
  roundId: string;
  onUpdate: () => void;
}) {
  return (
    <div className="card p-4 md:p-6 bg-surface-1">
      <h3 className="text-base md:text-lg font-semibold text-blue-400 mb-3">
        {bracket.name} Bracket
      </h3>

      <div className="space-y-3">
        {bracket.games.map(game => (
          <GameCard
            key={game.id}
            game={game}
            token={token}
            stopId={stopId}
            bracketId={bracket.id}
            roundId={roundId}
            onUpdate={onUpdate}
          />
        ))}
      </div>
    </div>
  );
}

// Component for individual game score entry
function GameCard({
  game,
  token,
  stopId,
  bracketId,
  roundId,
  onUpdate,
}: {
  game: Game;
  token: string;
  stopId: string;
  bracketId: string;
  roundId: string;
  onUpdate: () => void;
}) {
  const [myScore, setMyScore] = useState<string>(game.myScore?.toString() || '');
  const [opponentScore, setOpponentScore] = useState<string>(game.opponentScore?.toString() || '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMyScore(game.myScore?.toString() || '');
    setOpponentScore(game.opponentScore?.toString() || '');
  }, [game.myScore, game.opponentScore]);

  const handleSubmitScore = async () => {
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
      // Use the existing Team Format score submission endpoint
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

      if (result.confirmed) {
        alert('Score confirmed! Both teams agree.');
      } else if (result.mismatch) {
        alert('Score submitted! The opponent submitted a different score. Please contact tournament admin to resolve.');
      } else if (result.waitingForOpponent) {
        alert('Score submitted! Waiting for opponent to confirm.');
      } else {
        alert('Score submitted.');
      }

      await onUpdate();
    } catch (error) {
      console.error('Failed to submit score:', error);
      alert('Failed to submit score. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const slotName = game.slot === 'MENS_DOUBLES' ? "Men's Doubles" :
                   game.slot === 'WOMENS_DOUBLES' ? "Women's Doubles" :
                   game.slot === 'MIXED_1' ? 'Mixed Doubles 1' :
                   game.slot === 'MIXED_2' ? 'Mixed Doubles 2' : game.slot;

  return (
    <div className={`border rounded-lg p-3 ${game.isComplete ? 'bg-success/5 border-success' : 'border-border'}`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold">{slotName}</h4>
        {game.isComplete && (
          <span className="chip chip-success text-xs">Complete</span>
        )}
        {game.courtNumber && (
          <span className="text-xs text-muted">Court {game.courtNumber}</span>
        )}
      </div>

      {/* Lineups */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center text-sm mb-3">
        <div className="text-left">
          {game.myLineup && game.myLineup.length === 2 ? (
            <div className="space-y-1">
              <div className="text-primary">{game.myLineup[0].name}</div>
              <div className="text-primary">{game.myLineup[1].name}</div>
            </div>
          ) : (
            <span className="text-muted italic">Not set</span>
          )}
        </div>
        <div className="text-muted font-semibold">VS</div>
        <div className="text-right">
          {game.opponentLineup && game.opponentLineup.length === 2 ? (
            <div className="space-y-1">
              <div className="text-secondary">{game.opponentLineup[0].name}</div>
              <div className="text-secondary">{game.opponentLineup[1].name}</div>
            </div>
          ) : (
            <span className="text-muted italic">Not set</span>
          )}
        </div>
      </div>

      {/* Score Entry */}
      {game.myLineup && game.myLineup.length === 2 && (
        <div className="border-t border-border pt-3">
          {game.isComplete ? (
            <div className="flex items-center justify-center gap-4 py-2">
              <span className="text-2xl font-bold text-primary">{game.myScore}</span>
              <span className="text-muted">-</span>
              <span className="text-2xl font-bold text-primary">{game.opponentScore}</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-muted mb-1">Your Score</label>
                  <input
                    type="number"
                    min="0"
                    value={myScore}
                    onChange={(e) => setMyScore(e.target.value)}
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
                    className="input w-full"
                    placeholder="0"
                  />
                </div>
              </div>
              <button
                onClick={handleSubmitScore}
                disabled={submitting || myScore === '' || opponentScore === ''}
                className="btn btn-primary btn-sm w-full disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Score'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
