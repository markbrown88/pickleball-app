'use client';

import { useState, useCallback } from 'react';
import { Search, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';

type Player = {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  clubName: string | null;
  createdAt: string;
  registrationCount: number;
  teamCount: number;
  disabled: boolean;
};

export default function MergePlayersPage() {
  const [searchTerm1, setSearchTerm1] = useState('');
  const [searchTerm2, setSearchTerm2] = useState('');
  const [searchResults1, setSearchResults1] = useState<Player[]>([]);
  const [searchResults2, setSearchResults2] = useState<Player[]>([]);
  const [selectedPlayer1, setSelectedPlayer1] = useState<Player | null>(null);
  const [selectedPlayer2, setSelectedPlayer2] = useState<Player | null>(null);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const searchPlayers = async (term: string): Promise<Player[]> => {
    if (term.trim().length < 2) return [];

    const response = await fetch(
      `/api/admin/players?search=${encodeURIComponent(term)}&take=10`
    );

    if (!response.ok) {
      throw new Error('Failed to search players');
    }

    const data = await response.json();
    return data.items || [];
  };

  const handleSearch1 = useCallback(async (term: string) => {
    setSearchTerm1(term);
    if (term.trim().length < 2) {
      setSearchResults1([]);
      return;
    }

    try {
      setLoading(true);
      const results = await searchPlayers(term);
      setSearchResults1(results);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch2 = useCallback(async (term: string) => {
    setSearchTerm2(term);
    if (term.trim().length < 2) {
      setSearchResults2([]);
      return;
    }

    try {
      setLoading(true);
      const results = await searchPlayers(term);
      setSearchResults2(results);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelectPlayer1 = (player: Player) => {
    setSelectedPlayer1(player);
    setSearchResults1([]);
    setSearchTerm1('');
  };

  const handleSelectPlayer2 = (player: Player) => {
    setSelectedPlayer2(player);
    setSearchResults2([]);
    setSearchTerm2('');
  };

  const handleMerge = async () => {
    if (!selectedPlayer1 || !selectedPlayer2) return;

    if (selectedPlayer1.id === selectedPlayer2.id) {
      setError('Cannot merge a player with themselves');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to merge these players?\n\n` +
        `${selectedPlayer1.name || selectedPlayer1.email} will be kept as the primary profile.\n` +
        `${selectedPlayer2.name || selectedPlayer2.email} will be merged into it and then disabled.\n\n` +
        `This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setMerging(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/app-admin/players/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryPlayerId: selectedPlayer1.id,
          secondaryPlayerId: selectedPlayer2.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to merge players');
      }

      const result = await response.json();
      setSuccess(
        `Successfully merged ${result.mergedCount} records. ${selectedPlayer2.name || selectedPlayer2.email} has been disabled.`
      );
      setSelectedPlayer1(null);
      setSelectedPlayer2(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to merge players');
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">Merge Player Profiles</h1>
        <p className="text-muted mt-2">
          Consolidate duplicate player accounts by merging them into a single profile.
        </p>
      </div>

      {/* Warning Message */}
      <div className="card bg-yellow-50 border-2 border-yellow-200">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-yellow-900">Important Notes</h3>
            <ul className="text-sm text-yellow-800 mt-2 space-y-1 list-disc list-inside">
              <li>The primary player (left) will be kept as the main profile</li>
              <li>All registrations, teams, and relationships from the secondary player will be transferred</li>
              <li>The secondary player profile will be disabled after merging</li>
              <li>This action cannot be undone - please verify carefully before merging</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="border border-error bg-error/10 text-error p-4 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="border border-green-600 bg-green-50 text-green-800 p-4 rounded flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Player Selection */}
      <div className="grid md:grid-cols-3 gap-6 items-start">
        {/* Primary Player */}
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-primary mb-1">
              Primary Player (Keep)
            </h2>
            <p className="text-sm text-muted">This profile will be retained</p>
          </div>

          {!selectedPlayer1 ? (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchTerm1}
                  onChange={(e) => handleSearch1(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded"
                />
              </div>

              {searchResults1.length > 0 && (
                <div className="card border-2 border-secondary max-h-96 overflow-y-auto">
                  {searchResults1.map((player) => (
                    <button
                      key={player.id}
                      onClick={() => handleSelectPlayer1(player)}
                      className="w-full text-left p-3 hover:bg-gray-50 border-b last:border-b-0 transition-colors"
                    >
                      <div className="font-medium">
                        {player.name || `${player.firstName} ${player.lastName}`.trim()}
                      </div>
                      <div className="text-sm text-muted">{player.email}</div>
                      {player.clubName && (
                        <div className="text-xs text-muted mt-1">{player.clubName}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="card border-2 border-green-200 bg-green-50">
              <div className="space-y-3">
                <div>
                  <div className="font-semibold text-lg">
                    {selectedPlayer1.name ||
                      `${selectedPlayer1.firstName} ${selectedPlayer1.lastName}`.trim()}
                  </div>
                  <div className="text-sm text-muted">{selectedPlayer1.email}</div>
                  {selectedPlayer1.phone && (
                    <div className="text-sm text-muted">{selectedPlayer1.phone}</div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-muted">Club</div>
                    <div className="font-medium">{selectedPlayer1.clubName || 'None'}</div>
                  </div>
                  <div>
                    <div className="text-muted">Registrations</div>
                    <div className="font-medium">{selectedPlayer1.registrationCount}</div>
                  </div>
                  <div>
                    <div className="text-muted">Teams</div>
                    <div className="font-medium">{selectedPlayer1.teamCount}</div>
                  </div>
                  <div>
                    <div className="text-muted">Created</div>
                    <div className="font-medium">
                      {new Date(selectedPlayer1.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedPlayer1(null)}
                  className="text-sm text-secondary hover:text-secondary-hover font-medium"
                >
                  Change Selection
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center h-full pt-16">
          <ArrowRight className="w-12 h-12 text-secondary" />
        </div>

        {/* Secondary Player */}
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-primary mb-1">
              Secondary Player (Merge)
            </h2>
            <p className="text-sm text-muted">This profile will be merged and disabled</p>
          </div>

          {!selectedPlayer2 ? (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchTerm2}
                  onChange={(e) => handleSearch2(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded"
                />
              </div>

              {searchResults2.length > 0 && (
                <div className="card border-2 border-secondary max-h-96 overflow-y-auto">
                  {searchResults2.map((player) => (
                    <button
                      key={player.id}
                      onClick={() => handleSelectPlayer2(player)}
                      className="w-full text-left p-3 hover:bg-gray-50 border-b last:border-b-0 transition-colors"
                    >
                      <div className="font-medium">
                        {player.name || `${player.firstName} ${player.lastName}`.trim()}
                      </div>
                      <div className="text-sm text-muted">{player.email}</div>
                      {player.clubName && (
                        <div className="text-xs text-muted mt-1">{player.clubName}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="card border-2 border-orange-200 bg-orange-50">
              <div className="space-y-3">
                <div>
                  <div className="font-semibold text-lg">
                    {selectedPlayer2.name ||
                      `${selectedPlayer2.firstName} ${selectedPlayer2.lastName}`.trim()}
                  </div>
                  <div className="text-sm text-muted">{selectedPlayer2.email}</div>
                  {selectedPlayer2.phone && (
                    <div className="text-sm text-muted">{selectedPlayer2.phone}</div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-muted">Club</div>
                    <div className="font-medium">{selectedPlayer2.clubName || 'None'}</div>
                  </div>
                  <div>
                    <div className="text-muted">Registrations</div>
                    <div className="font-medium">{selectedPlayer2.registrationCount}</div>
                  </div>
                  <div>
                    <div className="text-muted">Teams</div>
                    <div className="font-medium">{selectedPlayer2.teamCount}</div>
                  </div>
                  <div>
                    <div className="text-muted">Created</div>
                    <div className="font-medium">
                      {new Date(selectedPlayer2.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedPlayer2(null)}
                  className="text-sm text-secondary hover:text-secondary-hover font-medium"
                >
                  Change Selection
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Merge Button */}
      {selectedPlayer1 && selectedPlayer2 && (
        <div className="flex justify-center pt-6">
          <button
            onClick={handleMerge}
            disabled={merging}
            className="btn btn-primary btn-lg"
          >
            {merging ? 'Merging Players...' : 'Merge Players'}
          </button>
        </div>
      )}
    </div>
  );
}
