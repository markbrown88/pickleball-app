'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { fetchWithActAs } from '@/lib/fetchWithActAs';
import { EventManagerTab } from './components/EventManagerTab';

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
          throw new Error('Failed to load tournaments');
        }
        const data = await tournamentsRes.json();
        setTournaments(data.items || []);
      } catch (error) {
        console.error('Error loading manager data:', error);
        setErr(error instanceof Error ? error.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [isLoaded, user?.id]); // Only depend on user.id, not the entire user object

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
      <header>
        <h1 className="text-3xl font-bold text-primary">Event Manager</h1>
        <p className="text-muted mt-1">Manage lineups and scores for your assigned tournament stops</p>
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
      ) : (
        <EventManagerTab
          tournaments={tournaments}
          onError={(msg) => setErr(msg)}
          onInfo={(msg) => setInfo(msg)}
        />
      )}
    </div>
  );
}
