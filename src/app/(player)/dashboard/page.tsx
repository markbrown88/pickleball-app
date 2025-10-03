'use client';

import { useEffect, useMemo, useReducer } from 'react';
import { useAuth, useUser, SignInButton } from '@clerk/nextjs';
import Link from 'next/link';

import type { PlayerRegistration, Tournament, TournamentsResponse, UserProfile } from '@/types';

import type { DashboardOverview, PlayerAssignment } from './types';

const PROFILE_ENDPOINT = '/api/auth/user';
const OVERVIEW_ENDPOINT = (playerId: string) => `/api/players/${playerId}/overview`;
const REGISTRATIONS_ENDPOINT = '/api/player/registrations';
const TOURNAMENTS_ENDPOINT = '/api/tournaments';

type DashboardState = {
  overview: DashboardOverview | null;
  registrations: Record<string, PlayerRegistration>;
  tournaments: Tournament[];
  err: string | null;
  loading: boolean;
};

type DashboardAction =
  | { type: 'load:start' }
  | {
      type: 'load:success';
      payload: {
        overview: DashboardOverview | null;
        registrations: PlayerRegistration[];
        tournaments: Tournament[];
      };
    }
  | { type: 'load:error'; payload: string };

function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'load:start':
      return { ...state, loading: true, err: null };
    case 'load:success': {
      const registrationMap: Record<string, PlayerRegistration> = {};
      action.payload.registrations.forEach((registration) => {
        registrationMap[registration.tournamentId] = registration;
      });

      return {
        overview: action.payload.overview,
        registrations: registrationMap,
        tournaments: action.payload.tournaments,
        err: null,
        loading: false,
      };
    }
    case 'load:error':
      return { ...state, loading: false, err: action.payload };
    default:
      return state;
  }
}

const initialState: DashboardState = {
  overview: null,
  registrations: {},
  tournaments: [],
  err: null,
  loading: true,
};

async function fetchDashboardData(): Promise<{
  overview: DashboardOverview | null;
  registrations: PlayerRegistration[];
  tournaments: Tournament[];
}> {
  const profileResponse = await fetch(PROFILE_ENDPOINT);
  let overviewData: DashboardOverview | null = null;

  if (profileResponse.ok) {
    const profile: UserProfile = await profileResponse.json();
    const overviewResponse = await fetch(OVERVIEW_ENDPOINT(profile.id));
    const overviewJson = await overviewResponse.json();

    overviewData = {
      player: profile,
      assignments: overviewJson?.assignments ?? [],
    };
  }

  const [registrationsResponse, tournamentsResponse] = await Promise.all([
    fetch(REGISTRATIONS_ENDPOINT),
    fetch(TOURNAMENTS_ENDPOINT),
  ]);

  const registrationsList: PlayerRegistration[] = registrationsResponse.ok ? await registrationsResponse.json() : [];
  const tournamentsJson: TournamentsResponse = tournamentsResponse.ok
    ? await tournamentsResponse.json()
    : { tournaments: [] };

  return {
    overview: overviewData,
    registrations: registrationsList,
    tournaments: tournamentsJson.tournaments ?? [],
  };
}

export default function DashboardPage() {
  const { isSignedIn } = useAuth();
  const { isLoaded: userLoaded } = useUser();

  const [state, dispatch] = useReducer(dashboardReducer, initialState);
  const { overview, err, tournaments, registrations, loading } = state;

  useEffect(() => {
    if (!userLoaded || !isSignedIn) return;

    let cancelled = false;

    const load = async () => {
      dispatch({ type: 'load:start' });
      try {
        const data = await fetchDashboardData();
        if (!cancelled) {
          dispatch({ type: 'load:success', payload: data });
        }
      } catch (error) {
        console.error('Failed to load dashboard data', error);
        if (!cancelled) {
          dispatch({ type: 'load:error', payload: 'Unable to load dashboard' });
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, userLoaded]);

  const assignments = useMemo<PlayerAssignment[]>(() => overview?.assignments ?? [], [overview?.assignments]);

  const registeredTournaments = useMemo(() => {
    if (!tournaments.length) return [] as Tournament[];
    return tournaments.filter((tournament) => {
      if (registrations[tournament.id]) return true;
      return assignments.some((assignment) => assignment.tournamentId === tournament.id);
    });
  }, [assignments, registrations, tournaments]);

  const availableTournaments = useMemo(() => {
    if (!tournaments.length) return [] as Tournament[];
    return tournaments.filter((tournament) => {
      if (registrations[tournament.id]) return false;
      return !assignments.some((assignment) => assignment.tournamentId === tournament.id);
    });
  }, [assignments, registrations, tournaments]);

  if (!isSignedIn) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="card text-center space-y-4">
          <h1 className="text-2xl font-semibold text-primary">Welcome to TournaVerse</h1>
          <p className="text-muted">Sign in to view your tournaments and manage registrations.</p>
          <SignInButton>
            <button className="btn btn-primary">Sign In</button>
          </SignInButton>
        </div>
      </div>
    );
  }

  if (loading || !userLoaded) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="loading-spinner" aria-label="Loading dashboard" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-primary">Home</h1>
        <p className="text-muted">View your active teams, upcoming stops, and register for new tournaments.</p>
      </header>

      {err && <div className="alert alert-error">{err}</div>}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">My Teams</h2>
        {assignments.length === 0 ? (
          <div className="card text-center py-10 text-muted">
            <p>You are not currently assigned to any teams.</p>
            <p className="text-sm mt-2">Check the available tournaments below to register.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {assignments.map((assignment) => (
              <div key={`${assignment.tournamentId}:${assignment.teamId}`} className="card space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-primary">{assignment.tournamentName}</h3>
                    <p className="text-sm text-muted">{assignment.bracket}</p>
                  </div>
                  <Link href={`/tournament/${assignment.tournamentId}`} className="btn btn-ghost btn-sm">
                    View
                  </Link>
                </div>
                <div className="text-sm text-muted space-y-1">
                  <div className="font-medium text-secondary">{assignment.teamName}</div>
                  <div>Role: Player</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Registered Tournaments</h2>
        {registeredTournaments.length === 0 ? (
          <p className="text-muted">You have not registered for any upcoming tournaments.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {registeredTournaments.map((tournament) => (
              <div key={tournament.id} className="card space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-primary">{tournament.name}</h3>
                    <p className="text-sm text-muted">{tournament.type.replace('_', ' ')}</p>
                  </div>
                  <Link href={`/tournament/${tournament.id}`} className="btn btn-ghost btn-sm">
                    View
                  </Link>
                </div>
                <div className="text-sm text-muted space-y-1">
                  {tournament.stops?.length ? (
                    <div>
                      Stops:
                      <ul className="mt-1 space-y-0.5">
                        {tournament.stops.map((stop) => (
                          <li key={stop.id}>{stop.name} • {new Date(stop.startAt).toLocaleDateString()}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div>No stops scheduled yet.</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Available Tournaments</h2>
        {availableTournaments.length === 0 ? (
          <p className="text-muted">No tournaments available for registration right now. Check back soon!</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {availableTournaments.map((tournament) => (
              <div key={tournament.id} className="card space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-primary">{tournament.name}</h3>
                    <p className="text-sm text-muted">{tournament.type.replace('_', ' ')}</p>
                  </div>
                  <Link href={`/tournament/${tournament.id}`} className="btn btn-primary btn-sm">
                    Register
                  </Link>
                </div>
                {tournament.stops?.length ? (
                  <div className="text-sm text-muted">
                    Next stop:{' '}
                    {new Date(tournament.stops[0].startAt).toLocaleDateString()}
                  </div>
                ) : (
                  <div className="text-sm text-muted">Schedule coming soon</div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}


