'use client';

import { use, useState, useEffect } from 'react';
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
  const [lineupDeadline, setLineupDeadline] = useState<string | null>(null);
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [roster, setRoster] = useState<Player[]>([]);
  const [isTeamA, setIsTeamA] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [loading, setLoading] = useState(true);

  // Breadcrumb data
  const [tournamentName, setTournamentName] = useState('');
  const [bracketName, setBracketName] = useState('');
  const [myTeamName, setMyTeamName] = useState('');
  const [opponentTeamName, setOpponentTeamName] = useState('');
  const [roundName, setRoundName] = useState('');

  useEffect(() => {
    loadBrackets();
  }, [stopId]);

  const loadBrackets = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/captain-portal/${token}/stop/${stopId}`);
      const data = await response.json();
      setStopName(data.stop.name);
      setLineupDeadline(data.stop.lineupDeadline);
      setBrackets(data.brackets);
    } catch (error) {
      console.error('Failed to load brackets:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRounds = async (bracketId: string) => {
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
  };

  const loadGames = async (roundId: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/captain-portal/${token}/stop/${stopId}/bracket/${selectedBracketId}/round/${roundId}`
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setGames(data.games || []);
      setRoster(data.roster || []);
      setIsTeamA(data.isTeamA || false);
      setCanEdit(!data.deadlinePassed);
      setSelectedRoundId(roundId);

      // Set breadcrumb data
      setTournamentName(data.tournament?.name || '');
      setBracketName(data.bracket?.name || '');
      setMyTeamName(data.myTeam?.name || '');
      setOpponentTeamName(data.match?.opponentTeam?.name || '');
      setRoundName(data.round?.name || `Round ${(data.round?.idx || 0) + 1}`);

      setView('games');
    } catch (error) {
      console.error('Failed to load games:', error);
      setGames([]);
      setRoster([]);
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="min-h-screen bg-surface-1">
      {/* Header */}
      <div className="bg-primary text-white py-6 px-4">
        <div className="container mx-auto max-w-4xl">
          <button
            onClick={handleBack}
            className="text-white hover:underline mb-3 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          {/* Breadcrumbs */}
          {view === 'games' && tournamentName && (
            <div className="text-sm opacity-90 mb-2 flex flex-wrap items-center gap-2">
              <span>{tournamentName}</span>
              <span>›</span>
              <span>{stopName}</span>
              <span>›</span>
              <span>{bracketName}</span>
              <span>›</span>
              <span className="font-semibold bg-white/20 px-2 py-0.5 rounded">{myTeamName}</span>
              <span>›</span>
              <span>{roundName}</span>
            </div>
          )}

          <h1 className="text-2xl font-bold">{stopName}</h1>
          {lineupDeadline && (
            <DeadlineDisplay deadline={lineupDeadline} />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto max-w-4xl px-4 py-8">
        {view === 'brackets' && (
          <BracketsView brackets={brackets} onSelectBracket={loadRounds} />
        )}
        {view === 'rounds' && (
          <RoundsView rounds={rounds} onSelectRound={loadGames} loading={loading} />
        )}
        {view === 'games' && (
          <GamesView
            games={games}
            roster={roster}
            isTeamA={isTeamA}
            canEdit={canEdit}
            token={token}
            stopId={stopId}
            bracketId={selectedBracketId!}
            roundId={selectedRoundId!}
            onUpdate={loadGames}
            myTeamName={myTeamName}
            opponentTeamName={opponentTeamName}
          />
        )}
      </div>
    </div>
  );
}

function DeadlineDisplay({ deadline }: { deadline: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const end = new Date(deadline);
      const diff = end.getTime() - now.getTime();

      if (diff < 0) {
        setTimeLeft('Deadline passed');
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        setTimeLeft(days > 0 ? `${days}d ${hours % 24}h remaining` : `${hours}h remaining`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [deadline]);

  return (
    <p className="text-sm opacity-90 mt-1">
      Lineup Deadline: {timeLeft}
    </p>
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
      <h2 className="text-xl font-semibold text-primary mb-4">Select Bracket</h2>
      <div className="grid gap-4">
        {brackets.map((bracket) => (
          <button
            key={bracket.id}
            onClick={() => onSelectBracket(bracket.id)}
            className="card p-6 text-left hover:shadow-lg hover:border-primary transition-all"
          >
            <h3 className="text-lg font-semibold text-primary">{bracket.name}</h3>
            <p className="text-sm text-muted mt-1">Team: {bracket.teamName}</p>
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
      <h2 className="text-xl font-semibold text-primary mb-4">Select Round</h2>
      <div className="grid gap-4">
        {rounds.map((round) => (
          <button
            key={round.id}
            onClick={() => onSelectRound(round.id)}
            className="card p-6 text-left hover:shadow-lg hover:border-primary transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-primary">Round {round.idx + 1}</h3>
                <p className="text-sm text-muted mt-1">vs {round.opponentTeamName}</p>
              </div>
              {round.lineupsComplete && (
                <span className="chip chip-success text-xs">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
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
  isTeamA,
  canEdit,
  token,
  stopId,
  bracketId,
  roundId,
  onUpdate,
  myTeamName,
  opponentTeamName,
}: {
  games: Game[];
  roster: Player[];
  isTeamA: boolean;
  canEdit: boolean;
  token: string;
  stopId: string;
  bracketId: string;
  roundId: string;
  onUpdate: (roundId: string) => void;
  myTeamName: string;
  opponentTeamName: string;
}) {
  // State for the 4 lineup positions
  const [man1, setMan1] = useState<Player | null>(null);
  const [man2, setMan2] = useState<Player | null>(null);
  const [woman1, setWoman1] = useState<Player | null>(null);
  const [woman2, setWoman2] = useState<Player | null>(null);
  const [saving, setSaving] = useState(false);

  // Initialize from existing lineups
  useEffect(() => {
    const mensDoubles = games.find(g => g.slot === 'MENS_DOUBLES');
    const womensDoubles = games.find(g => g.slot === 'WOMENS_DOUBLES');

    if (mensDoubles?.myLineup?.length === 2) {
      setMan1(mensDoubles.myLineup[0]);
      setMan2(mensDoubles.myLineup[1]);
    }

    if (womensDoubles?.myLineup?.length === 2) {
      setWoman1(womensDoubles.myLineup[0]);
      setWoman2(womensDoubles.myLineup[1]);
    }
  }, [games]);

  // Get available players for each dropdown
  const getAvailablePlayers = (position: 'man1' | 'man2' | 'woman1' | 'woman2'): Player[] => {
    const usedPlayerIds = new Set([man1?.id, man2?.id, woman1?.id, woman2?.id].filter(Boolean));

    // Always include the currently selected player for this position
    const currentPlayer = position === 'man1' ? man1 : position === 'man2' ? man2 : position === 'woman1' ? woman1 : woman2;
    if (currentPlayer) {
      usedPlayerIds.delete(currentPlayer.id);
    }

    const gender = position.startsWith('man') ? 'MALE' : 'FEMALE';
    return roster.filter(p => p.gender === gender && !usedPlayerIds.has(p.id));
  };

  const saveLineups = async () => {
    if (!man1 || !man2 || !woman1 || !woman2) {
      alert('Please select all 4 players before saving');
      return;
    }

    setSaving(true);
    try {
      // Build lineup data for all games
      const lineups = {
        MENS_DOUBLES: [man1.id, man2.id],
        WOMENS_DOUBLES: [woman1.id, woman2.id],
        MIXED_1: [man1.id, woman1.id],
        MIXED_2: [man2.id, woman2.id],
      };

      // Save all lineups
      await Promise.all(
        games.map(game => {
          const lineup = lineups[game.slot as keyof typeof lineups];
          if (!lineup) return Promise.resolve();

          return fetch(
            `/api/captain-portal/${token}/stop/${stopId}/bracket/${bracketId}/round/${roundId}/game/${game.id}/lineup`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lineup })
            }
          );
        })
      );

      alert('Lineups saved successfully!');
      onUpdate(roundId);
    } catch (error) {
      console.error('Failed to save lineups:', error);
      alert('Failed to save lineups. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const isLineupsComplete = man1 && man2 && woman1 && woman2;

  return (
    <div>
      {/* Header with team names */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-primary mb-2">
          Games - <span className="bg-primary/10 px-3 py-1 rounded">{myTeamName}</span> vs. {opponentTeamName}
        </h2>
      </div>

      {!canEdit && (
        <div className="bg-warning/10 border border-warning text-warning px-4 py-3 rounded mb-6">
          Lineup deadline has passed. Lineups are now read-only.
        </div>
      )}

      {/* Lineup Selection */}
      {canEdit && (
        <div className="card p-6 mb-6 bg-surface-2">
          <h3 className="text-lg font-semibold text-primary mb-3">Select Your Lineup</h3>
          <p className="text-sm text-muted mb-4">
            Select players for any game. Your selections will automatically populate the games.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Men */}
            <div>
              <h4 className="text-sm font-medium text-secondary mb-3">Men</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-muted mb-1">Man 1</label>
                  <select
                    value={man1?.id || ''}
                    onChange={(e) => setMan1(roster.find(p => p.id === e.target.value) || null)}
                    className="input w-full"
                  >
                    <option value="">Select player...</option>
                    {getAvailablePlayers('man1').map(player => (
                      <option key={player.id} value={player.id}>{player.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Man 2</label>
                  <select
                    value={man2?.id || ''}
                    onChange={(e) => setMan2(roster.find(p => p.id === e.target.value) || null)}
                    className="input w-full"
                  >
                    <option value="">Select player...</option>
                    {getAvailablePlayers('man2').map(player => (
                      <option key={player.id} value={player.id}>{player.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Women */}
            <div>
              <h4 className="text-sm font-medium text-secondary mb-3">Women</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-muted mb-1">Woman 1</label>
                  <select
                    value={woman1?.id || ''}
                    onChange={(e) => setWoman1(roster.find(p => p.id === e.target.value) || null)}
                    className="input w-full"
                  >
                    <option value="">Select player...</option>
                    {getAvailablePlayers('woman1').map(player => (
                      <option key={player.id} value={player.id}>{player.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Woman 2</label>
                  <select
                    value={woman2?.id || ''}
                    onChange={(e) => setWoman2(roster.find(p => p.id === e.target.value) || null)}
                    className="input w-full"
                  >
                    <option value="">Select player...</option>
                    {getAvailablePlayers('woman2').map(player => (
                      <option key={player.id} value={player.id}>{player.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={saveLineups}
            disabled={!isLineupsComplete || saving}
            className="btn btn-primary disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Lineup'}
          </button>
        </div>
      )}

      {/* Games Preview */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-primary">Games</h3>

        <GamePreview
          title="Men's Doubles"
          player1={man1}
          player2={man2}
          game={games.find(g => g.slot === 'MENS_DOUBLES')}
          token={token}
          stopId={stopId}
          bracketId={bracketId}
          roundId={roundId}
          onUpdate={() => onUpdate(roundId)}
        />
        <GamePreview
          title="Women's Doubles"
          player1={woman1}
          player2={woman2}
          game={games.find(g => g.slot === 'WOMENS_DOUBLES')}
          token={token}
          stopId={stopId}
          bracketId={bracketId}
          roundId={roundId}
          onUpdate={() => onUpdate(roundId)}
        />
        <GamePreview
          title="Mixed Doubles 1"
          player1={man1}
          player2={woman1}
          game={games.find(g => g.slot === 'MIXED_1')}
          token={token}
          stopId={stopId}
          bracketId={bracketId}
          roundId={roundId}
          onUpdate={() => onUpdate(roundId)}
        />
        <GamePreview
          title="Mixed Doubles 2"
          player1={man2}
          player2={woman2}
          game={games.find(g => g.slot === 'MIXED_2')}
          token={token}
          stopId={stopId}
          bracketId={bracketId}
          roundId={roundId}
          onUpdate={() => onUpdate(roundId)}
        />
      </div>
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
}: {
  title: string;
  player1: Player | null;
  player2: Player | null;
  game?: Game;
  token: string;
  stopId: string;
  bracketId: string;
  roundId: string;
  onUpdate: () => void;
}) {
  const [myScore, setMyScore] = useState<string>('');
  const [opponentScore, setOpponentScore] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Initialize from game data
  useEffect(() => {
    if (game?.mySubmittedScore !== null && game?.mySubmittedScore !== undefined) {
      setMyScore(String(game.mySubmittedScore));
    }
    if (game?.opponentSubmittedScore !== null && game?.opponentSubmittedScore !== undefined) {
      setOpponentScore(String(game.opponentSubmittedScore));
    }
  }, [game]);

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

      if (result.mismatch) {
        alert(`Score submitted! The opponent submitted a different score (${result.opponentSubmission.myScore}-${result.opponentSubmission.opponentScore}). Please contact tournament admin to resolve.`);
      } else if (result.confirmed) {
        alert('Score confirmed! Both teams agree.');
      } else {
        alert('Score submitted! Waiting for opponent to confirm.');
      }

      onUpdate();
    } catch (error) {
      console.error('Failed to submit score:', error);
      alert('Failed to submit score. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!game) {
    return (
      <div className="card p-4 bg-surface-2 opacity-60">
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
  const canSubmitScore = hasLineup && !game.isComplete;
  const myScoreSubmitted = game.myScoreSubmitted || false;
  const opponentScoreSubmitted = game.opponentScoreSubmitted || false;
  const scoresMatch =
    myScoreSubmitted &&
    opponentScoreSubmitted &&
    game.mySubmittedScore === game.opponentSubmittedScore &&
    game.opponentSubmittedScore === game.myScore;

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
            {hasLineup ? (
              <div className="space-y-1">
                <div className="text-primary font-medium">{player1.name}</div>
                <div className="text-primary font-medium">{player2.name}</div>
              </div>
            ) : (
              <span className="text-muted italic">Not selected</span>
            )}
          </div>

          {/* VS */}
          <div className="text-muted font-semibold px-2">VS</div>

          {/* Opponent Team */}
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

        {/* Score Entry/Display */}
        {hasLineup && (
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
                      disabled={myScoreSubmitted}
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
                      disabled={myScoreSubmitted}
                      className="input w-full"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                {!myScoreSubmitted && (
                  <button
                    onClick={handleSubmitScore}
                    disabled={submitting || !myScore || !opponentScore}
                    className="btn btn-primary btn-sm w-full disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : 'Submit Score'}
                  </button>
                )}

                {/* Status Messages */}
                {myScoreSubmitted && (
                  <div className="space-y-2">
                    <div className="bg-primary/10 border border-primary text-primary px-3 py-2 rounded text-xs">
                      ✓ You submitted: {game.mySubmittedScore} - {game.opponentSubmittedScore}
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
