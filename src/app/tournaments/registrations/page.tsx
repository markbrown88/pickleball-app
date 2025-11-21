'use client';

import { useEffect, useState, useCallback } from 'react';
import { RegistrationsTab } from '../components/tabs/RegistrationsTab';
import { InvitationsTab } from '../components/tabs/InvitationsTab';
import type { UserProfile } from '@/types';

type Id = string;

type Tournament = {
  id: Id;
  name: string;
};

type Tab = 'registrations' | 'invitations';

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const contentType = response.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const error = typeof body === 'object' && body && 'error' in body ? body.error : `HTTP ${response.status}`;
    throw new Error(String(error));
  }
  return body as T;
}

function personLabel(p: { firstName?: string | null; lastName?: string | null; name?: string | null }) {
  const fn = (p.firstName ?? '').trim();
  const ln = (p.lastName ?? '').trim();
  return [fn, ln].filter(Boolean).join(' ') || (p.name ?? 'Unknown');
}

async function searchPlayersForSelect(term: string): Promise<Array<{ id: string; label: string }>> {
  const data = await api<{ items: any[] }>(`/api/admin/players/search?term=${encodeURIComponent(term)}`);
  return (data.items || []).map((player) => ({ id: player.id, label: personLabel(player) }));
}

export default function TournamentRegistrationsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<Id | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('registrations');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTournaments() {
      try {
        setLoading(true);
        const data = await api<Tournament[]>('/api/admin/tournaments');
        setTournaments(data);

        // Auto-select first tournament if available
        if (data.length > 0 && !selectedTournamentId) {
          setSelectedTournamentId(data[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tournaments');
      } finally {
        setLoading(false);
      }
    }

    void loadTournaments();
  }, [selectedTournamentId]);

  const searchPlayers = useCallback(async (term: string) => {
    return await searchPlayersForSelect(term);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="loading-spinner" aria-label="Loading tournaments" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="card bg-error/10 border-error/30 p-4">
          <div className="flex items-center gap-2">
            <span className="text-error font-semibold">Error:</span>
            <span className="text-error">{error}</span>
          </div>
        </div>
      </div>
    );
  }

  if (tournaments.length === 0) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="card text-center space-y-4">
          <h1 className="text-2xl font-semibold text-primary">No Tournaments Found</h1>
          <p className="text-muted">Create a tournament from the Setup page to manage registrations.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'registrations' as const, label: 'Registrations' },
    { id: 'invitations' as const, label: 'Invitations' },
  ];

  return (
    <section className="min-h-screen bg-app py-6">
      <div className="page-container space-y-6">
      {/* Header Card */}
      <header className="card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary">Tournament Registrations</h1>
            <p className="text-sm text-muted mt-1">
              Monitor and manage player registrations and invitations
            </p>
          </div>
          {tournaments.length > 1 && (
            <div className="flex items-center gap-3">
              <label htmlFor="tournament-select" className="text-sm font-semibold text-secondary label-caps">
                Tournament:
              </label>
              <select
                id="tournament-select"
                className="input min-w-[280px]"
                value={selectedTournamentId ?? ''}
                onChange={(e) => setSelectedTournamentId(e.target.value)}
              >
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </header>

      {/* Tabs and Content */}
      {selectedTournamentId && (
        <div className="card space-y-0">
          {/* Tabs */}
          <div className="border-b border-border-subtle">
            <nav className="flex gap-1 px-6 -mb-px" aria-label="Registration tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="px-6 py-6 min-h-[400px]">
            {activeTab === 'registrations' && (
              <RegistrationsTab tournamentId={selectedTournamentId} />
            )}

            {activeTab === 'invitations' && (
              <InvitationsTab
                tournamentId={selectedTournamentId}
                searchPlayers={searchPlayers}
              />
            )}
          </div>
        </div>
      )}
      </div>
    </section>
  );
}
