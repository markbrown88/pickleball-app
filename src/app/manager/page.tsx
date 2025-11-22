'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { fetchWithActAs } from '@/lib/fetchWithActAs';
import { saveSelectedTournament, getLastSelectedTournament } from '@/lib/tournamentStorage';
import dynamic from 'next/dynamic';

// Dynamically import the ManagerRouter which routes to the correct manager type
// This reduces initial bundle size significantly
const ManagerRouter = dynamic(
  () => import('./components/ManagerRouter').then(mod => ({ default: mod.ManagerRouter })),
  {
    loading: () => (
      <div className="card p-8 flex items-center justify-center gap-3">
        <div className="loading-spinner" />
        <span className="text-muted">Loading event manager...</span>
      </div>
    )
  }
);

type Id = string;

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

export default function ManagerPage() {
  const { user, isLoaded } = useUser();
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tournaments, setTournaments] = useState<EventManagerTournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [playerId, setPlayerId] = useState<string>('');

  // Load player ID and event manager tournaments
  useEffect(() => {
    if (!isLoaded || !user) return;

    async function loadData() {
      try {
        setLoading(true);

        // Get player profile
        const profileRes = await fetchWithActAs('/api/auth/user');
        if (!profileRes.ok) {
          throw new Error('Failed to load profile');
        }
        const profile = await profileRes.json();
        setPlayerId(profile.id);

        // Get event manager tournaments
        const tournamentsRes = await fetchWithActAs(`/api/manager/${profile.id}/tournaments`);
        if (!tournamentsRes.ok) {
          const errorData = await tournamentsRes.json().catch(() => ({}));
          console.error('Tournaments API error:', errorData);
          throw new Error(errorData.error || `Failed to load tournaments: ${tournamentsRes.status} ${tournamentsRes.statusText}`);
        }
        const data = await tournamentsRes.json();
        const items = data.items || [];
        setTournaments(items);

        // Try to restore last selected tournament, otherwise use first tournament
        if (items.length > 0) {
          const lastSelectedId = getLastSelectedTournament();
          const isLastSelectedAvailable = lastSelectedId && items.some((t: EventManagerTournament) => t.tournamentId === lastSelectedId);

          if (isLastSelectedAvailable) {
            setSelectedTournamentId(lastSelectedId);
          } else {
            setSelectedTournamentId(items[0].tournamentId);
          }
        }
      } catch (error) {
        console.error('Error loading manager data:', error);
        setErr(error instanceof Error ? error.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [isLoaded, user?.id]); // Only depend on user.id, not the entire user object

  // Get selected tournament
  const selectedTournament = tournaments.find(t => t.tournamentId === selectedTournamentId);

  if (loading) {
    return (
      <div className="min-h-screen bg-app p-6">
        <div className="card p-8 flex items-center justify-center gap-3">
          <div className="loading-spinner" />
          <span className="text-muted">Loading tournaments...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app p-6 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-primary">Event Manager</h1>
          <p className="text-muted">Manage lineups and scores for your assigned tournament stops</p>
        </div>
        {tournaments.length > 1 && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end w-full md:w-auto">
            <label htmlFor="manager-tournament" className="text-sm font-semibold text-secondary label-caps">
              Tournament:
            </label>
            <select
              id="manager-tournament"
              className="input w-full sm:max-w-sm"
              value={selectedTournamentId}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedTournamentId(newId);
                saveSelectedTournament(newId);
              }}
            >
              {tournaments.map((t) => (
                <option key={t.tournamentId} value={t.tournamentId}>
                  {t.tournamentName}
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      {err && (
        <div className="card bg-error/10 border-error/30 p-4">
          <div className="flex items-center gap-2">
            <span className="text-error font-semibold">Error:</span>
            <span className="text-error">{err}</span>
          </div>
        </div>
      )}

      {info && (
        <div className="card bg-success/10 border-success/30 p-4">
          <div className="flex items-center gap-2">
            <span className="text-success font-semibold">✓</span>
            <span className="text-success">{info}</span>
          </div>
        </div>
      )}

      {tournaments.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="max-w-md mx-auto space-y-3">
            <div className="text-5xl">📋</div>
            <h3 className="text-lg font-semibold text-secondary">No Managed Tournaments</h3>
            <p className="text-muted">
              You don't have any tournament stops assigned as Event Manager yet.
              Contact a tournament administrator to be assigned as Event Manager for tournament stops.
            </p>
          </div>
        </div>
      ) : selectedTournament ? (
        <ManagerRouter
          tournaments={[selectedTournament]}
          onError={(msg) => setErr(msg)}
          onInfo={(msg) => setInfo(msg)}
        />
      ) : null}
    </div>
  );
}
