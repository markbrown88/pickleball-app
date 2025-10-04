'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { fetchWithActAs } from '@/lib/fetchWithActAs';

type Id = string;

type PlayerLite = {
  id: Id;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  gender: 'MALE' | 'FEMALE';
  dupr?: number | null;
  age?: number | null;
};

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
  }, [isLoaded, user]);

  const formatDate = (dateStr?: string | null): string => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDateRange = (start?: string | null, end?: string | null): string => {
    if (!start) return '—';
    if (!end || start === end) return formatDate(start);
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

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
        <div className="space-y-4">
          {tournaments.map((tournament) => (
            <div key={tournament.tournamentId} className="card overflow-hidden">
              <div className="px-6 py-4 bg-surface-2/50 border-b border-subtle">
                <h2 className="text-xl font-bold text-primary">{tournament.tournamentName}</h2>
                <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted">
                  <span className="flex items-center gap-1">
                    <span className="font-semibold">📍 Stops:</span> {tournament.stops.length}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="font-semibold">🏢 Clubs:</span> {tournament.clubs.length}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="font-semibold">🎯 Type:</span> {tournament.type}
                  </span>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {tournament.stops.map((stop) => (
                  <div key={stop.stopId} className="border border-subtle rounded-lg overflow-hidden">
                    <div className="px-4 py-3 bg-surface-2/30 border-b border-subtle">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-primary">{stop.stopName || 'Stop'}</h3>
                          <div className="text-sm text-muted mt-1">
                            {stop.locationName || 'Location TBD'} • {formatDateRange(stop.startAt, stop.endAt)}
                          </div>
                        </div>
                        <div className="text-sm text-muted">
                          {stop.rounds.length} rounds • {stop.rounds.reduce((sum, r) => sum + r.matchCount, 0)} matches
                        </div>
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="text-center text-muted py-8">
                        <div className="text-4xl mb-2">🚧</div>
                        <p className="font-semibold">Lineup & Score Management Coming Soon</p>
                        <p className="text-sm mt-1">
                          The full lineup editor and score entry interface will be available shortly.
                        </p>
                      </div>

                      {/* Rounds list */}
                      {stop.rounds.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-semibold text-secondary mb-2">Rounds:</h4>
                          <div className="space-y-2">
                            {stop.rounds.map((round) => (
                              <div
                                key={round.roundId}
                                className="flex items-center justify-between p-3 bg-surface-1 rounded border border-subtle"
                              >
                                <span className="text-sm font-medium">Round {round.idx + 1}</span>
                                <span className="text-sm text-muted">{round.matchCount} matches</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card p-4 text-sm text-muted">
        <p>
          <strong>Note:</strong> As an Event Manager, you are responsible for creating lineups and entering scores
          for your assigned tournament stops. The complete lineup and scoring interface is being restored and will
          be available soon.
        </p>
      </div>
    </div>
  );
}
