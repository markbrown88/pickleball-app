'use client';

import { useState } from 'react';

type InvitePlayersTabProps = {
  tournamentId: string;
};

type PlayerSearchResult = {
  id: string;
  name: string;
  email: string | null;
};

export function InvitePlayersTab({ tournamentId }: InvitePlayersTabProps) {
  const [inviteType, setInviteType] = useState<'existing' | 'email'>('existing');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState<PlayerSearchResult[]>([]);

  // For email invites
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');

  // Common fields
  const [expiryDays, setExpiryDays] = useState(7);
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSearch(query: string) {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const response = await fetch(
        `/api/admin/players/search?term=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        console.error('Search failed:', response.status);
        setSearchResults([]);
        return;
      }

      const results = await response.json();
      // Map items to expected format
      const players = (results.items || []).map((item: any) => ({
        id: item.id,
        name: item.name || `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Unknown',
        email: null, // API doesn't return email
      }));
      setSearchResults(players);
    } catch (error) {
      console.error('Error searching players:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function togglePlayerSelection(player: PlayerSearchResult) {
    const isSelected = selectedPlayers.some(p => p.id === player.id);
    if (isSelected) {
      setSelectedPlayers(selectedPlayers.filter(p => p.id !== player.id));
    } else {
      setSelectedPlayers([...selectedPlayers, player]);
    }
  }

  async function handleSendInvites() {
    if (inviteType === 'existing' && selectedPlayers.length === 0) {
      alert('Please select at least one player to invite');
      return;
    }

    if (inviteType === 'email' && (!inviteEmail || !inviteName)) {
      alert('Please enter both email and name');
      return;
    }

    try {
      setSending(true);

      if (inviteType === 'existing') {
        // Send invites to existing players
        const response = await fetch(`/api/admin/tournaments/${tournamentId}/invites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerIds: selectedPlayers.map(p => p.id),
            expiryDays,
            notes,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          alert(error.error || 'Failed to send invites');
          return;
        }

        const result = await response.json();
        alert(`Successfully sent ${result.count} invite(s)`);

        // Reset form
        setSelectedPlayers([]);
        setSearchQuery('');
        setSearchResults([]);
        setNotes('');
      } else {
        // Send invite by email
        const response = await fetch(`/api/admin/tournaments/${tournamentId}/invites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inviteEmail,
            inviteName,
            expiryDays,
            notes,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          alert(error.error || 'Failed to send invite');
          return;
        }

        const result = await response.json();
        alert(result.message);

        // Reset form
        setInviteEmail('');
        setInviteName('');
        setNotes('');
      }
    } catch (error) {
      console.error('Error sending invites:', error);
      alert('Failed to send invites');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Invite Type Toggle */}
      <div className="card">
        <div className="flex gap-2 border-b border-border-subtle pb-4">
          <button
            className={`btn ${inviteType === 'existing' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setInviteType('existing')}
          >
            Invite Existing Players
          </button>
          <button
            className={`btn ${inviteType === 'email' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setInviteType('email')}
          >
            Invite by Email
          </button>
        </div>

        {/* Existing Players */}
        {inviteType === 'existing' && (
          <div className="space-y-4 mt-4">
            <div>
              <label className="label">Search Players</label>
              <input
                type="text"
                className="input"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  handleSearch(e.target.value);
                }}
              />
            </div>

            {/* Search Results */}
            {searching && (
              <div className="text-center text-muted py-4">Searching...</div>
            )}

            {!searching && searchResults.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-muted">Select players to invite:</div>
                {searchResults.map((player) => {
                  const isSelected = selectedPlayers.some(p => p.id === player.id);
                  return (
                    <div
                      key={player.id}
                      className={`p-3 border rounded cursor-pointer hover:bg-surface-1 ${
                        isSelected ? 'border-primary bg-primary/10' : 'border-border-subtle'
                      }`}
                      onClick={() => togglePlayerSelection(player)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-primary">{player.name}</div>
                          <div className="text-sm text-muted">{player.email}</div>
                        </div>
                        {isSelected && (
                          <span className="chip chip-primary">Selected</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Selected Players */}
            {selectedPlayers.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">
                  Selected Players ({selectedPlayers.length}):
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedPlayers.map((player) => (
                    <div
                      key={player.id}
                      className="chip chip-primary cursor-pointer"
                      onClick={() => togglePlayerSelection(player)}
                    >
                      {player.name} ✕
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Email Invite */}
        {inviteType === 'email' && (
          <div className="space-y-4 mt-4">
            <div>
              <label className="label">Player Name</label>
              <input
                type="text"
                className="input"
                placeholder="John Doe"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Email Address</label>
              <input
                type="email"
                className="input"
                placeholder="john@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Common Fields */}
        <div className="space-y-4 mt-4 pt-4 border-t border-border-subtle">
          <div>
            <label className="label">Invite Expires In (days)</label>
            <input
              type="number"
              className="input"
              min="1"
              max="30"
              value={expiryDays}
              onChange={(e) => setExpiryDays(parseInt(e.target.value) || 7)}
            />
            <div className="text-sm text-muted mt-1">
              Invite will expire on {new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toLocaleDateString()}
            </div>
          </div>

          <div>
            <label className="label">Notes (optional)</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Add a personal message..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <button
            className="btn btn-primary w-full"
            onClick={handleSendInvites}
            disabled={sending || (inviteType === 'existing' && selectedPlayers.length === 0)}
          >
            {sending ? 'Sending Invites...' : `Send Invite${inviteType === 'existing' && selectedPlayers.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
