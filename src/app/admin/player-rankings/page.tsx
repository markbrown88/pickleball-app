'use client';

import { useState, useEffect, useCallback } from 'react';

type PlayerStats = {
  playerId: string;
  playerName: string;
  gamesWon: number;
  gamesPlayed: number;
  pointsScored: number;
  winPct: number;
};

type PairStats = {
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  gamesWon: number;
  gamesPlayed: number;
  pointsScored: number;
  winPct: number;
};

type BracketRankings = {
  bracketId: string;
  bracketName: string;
  topPlayers: PlayerStats[];
  topPairs: PairStats[];
};

type Tournament = {
  id: string;
  name: string;
};

type RankingsData = {
  tournament: { id: string; name: string };
  overall: {
    topPlayers: PlayerStats[];
    topPairs: PairStats[];
  };
  brackets: BracketRankings[];
};

export default function PlayerRankingsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [rankings, setRankings] = useState<RankingsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingTournaments, setLoadingTournaments] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTournaments = useCallback(async () => {
    try {
      setLoadingTournaments(true);
      const res = await fetch('/api/admin/tournaments');
      if (!res.ok) throw new Error('Failed to load tournaments');
      const data = await res.json();
      setTournaments(data);
      // Auto-select first tournament if available
      if (data.length > 0) {
        setSelectedTournamentId((prev) => prev || data[0].id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load tournaments');
    } finally {
      setLoadingTournaments(false);
    }
  }, []);

  const fetchRankings = useCallback(async (tournamentId: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/player-rankings?tournamentId=${tournamentId}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to load rankings');
      }
      const data = await res.json();
      setRankings(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load rankings');
      setRankings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch tournaments on mount
  useEffect(() => {
    fetchTournaments();
  }, [fetchTournaments]);

  // Fetch rankings when tournament changes
  useEffect(() => {
    if (selectedTournamentId) {
      fetchRankings(selectedTournamentId);
    } else {
      setRankings(null);
    }
  }, [selectedTournamentId, fetchRankings]);

  const formatWinPct = (pct: number) => `${pct.toFixed(1)}%`;
  const formatRecord = (won: number, played: number) => `${won}-${played - won}`;

  const PlayerTable = ({ players, title }: { players: PlayerStats[]; title: string }) => (
    <div className="bg-surface-1 rounded-lg border border-subtle overflow-hidden">
      <div className="bg-surface-2 px-4 py-3 border-b border-subtle">
        <h3 className="font-semibold text-primary">{title}</h3>
      </div>
      {players.length === 0 ? (
        <div className="p-4 text-center text-muted">No player data available</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 border-b border-subtle">
              <tr>
                <th className="p-3 text-left font-medium text-muted w-12">#</th>
                <th className="p-3 text-left font-medium text-muted">Player</th>
                <th className="p-3 text-center font-medium text-muted">Record</th>
                <th className="p-3 text-center font-medium text-muted">Win %</th>
                <th className="p-3 text-center font-medium text-muted">Games</th>
                <th className="p-3 text-center font-medium text-muted">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {players.map((player, idx) => (
                <tr key={player.playerId} className="hover:bg-surface-2 transition-colors">
                  <td className="p-3 font-bold text-muted">{idx + 1}</td>
                  <td className="p-3 font-medium text-primary">{player.playerName}</td>
                  <td className="p-3 text-center text-secondary">
                    {formatRecord(player.gamesWon, player.gamesPlayed)}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`font-bold ${player.winPct >= 60 ? 'text-green-600' : player.winPct >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {formatWinPct(player.winPct)}
                    </span>
                  </td>
                  <td className="p-3 text-center text-muted">{player.gamesPlayed}</td>
                  <td className="p-3 text-center text-muted">{player.pointsScored}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const PairTable = ({ pairs, title }: { pairs: PairStats[]; title: string }) => (
    <div className="bg-surface-1 rounded-lg border border-subtle overflow-hidden">
      <div className="bg-surface-2 px-4 py-3 border-b border-subtle">
        <h3 className="font-semibold text-primary">{title}</h3>
      </div>
      {pairs.length === 0 ? (
        <div className="p-4 text-center text-muted">No pair data available</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 border-b border-subtle">
              <tr>
                <th className="p-3 text-left font-medium text-muted w-12">#</th>
                <th className="p-3 text-left font-medium text-muted">Pair</th>
                <th className="p-3 text-center font-medium text-muted">Record</th>
                <th className="p-3 text-center font-medium text-muted">Win %</th>
                <th className="p-3 text-center font-medium text-muted">Games</th>
                <th className="p-3 text-center font-medium text-muted">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {pairs.map((pair, idx) => (
                <tr key={`${pair.player1Id}-${pair.player2Id}`} className="hover:bg-surface-2 transition-colors">
                  <td className="p-3 font-bold text-muted">{idx + 1}</td>
                  <td className="p-3 font-medium text-primary">
                    {pair.player1Name} & {pair.player2Name}
                  </td>
                  <td className="p-3 text-center text-secondary">
                    {formatRecord(pair.gamesWon, pair.gamesPlayed)}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`font-bold ${pair.winPct >= 60 ? 'text-green-600' : pair.winPct >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {formatWinPct(pair.winPct)}
                    </span>
                  </td>
                  <td className="p-3 text-center text-muted">{pair.gamesPlayed}</td>
                  <td className="p-3 text-center text-muted">{pair.pointsScored}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  if (loadingTournaments) {
    return <div className="p-8">Loading tournaments...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Player Rankings</h1>
          <p className="text-muted">Top 10 players and pairs by winning percentage</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-muted">Tournament:</label>
          <select
            className="input w-64"
            value={selectedTournamentId}
            onChange={(e) => setSelectedTournamentId(e.target.value)}
          >
            <option value="">Select a tournament</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="loading-spinner"></div>
        </div>
      )}

      {/* No tournament selected */}
      {!selectedTournamentId && !loading && (
        <div className="text-center py-12 text-muted">
          Select a tournament to view player rankings
        </div>
      )}

      {/* Rankings Data */}
      {rankings && !loading && (
        <div className="space-y-8">
          {/* Overall Rankings */}
          <section>
            <h2 className="text-xl font-bold text-primary mb-4 pb-2 border-b border-subtle">
              Overall Rankings - {rankings.tournament.name}
            </h2>
            <div className="grid gap-6 lg:grid-cols-2">
              <PlayerTable players={rankings.overall.topPlayers} title="Top 10 Players" />
              <PairTable pairs={rankings.overall.topPairs} title="Top 10 Pairs" />
            </div>
          </section>

          {/* Per-Bracket Rankings */}
          {rankings.brackets.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-primary mb-4 pb-2 border-b border-subtle">
                Rankings by Bracket
              </h2>
              <div className="space-y-8">
                {rankings.brackets.map((bracket) => (
                  <div key={bracket.bracketId} className="space-y-4">
                    <h3 className="text-lg font-semibold text-secondary">{bracket.bracketName}</h3>
                    <div className="grid gap-6 lg:grid-cols-2">
                      <PlayerTable
                        players={bracket.topPlayers}
                        title={`Top 10 Players - ${bracket.bracketName}`}
                      />
                      <PairTable
                        pairs={bracket.topPairs}
                        title={`Top 10 Pairs - ${bracket.bracketName}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* No data message */}
          {rankings.overall.topPlayers.length === 0 && rankings.overall.topPairs.length === 0 && (
            <div className="text-center py-12 text-muted">
              No completed games found for this tournament. Rankings will appear once games have been played and scored.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
