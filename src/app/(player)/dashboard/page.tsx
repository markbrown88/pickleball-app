'use client';

import { useEffect, useMemo, useReducer, useState } from 'react';
import { useAuth, useUser, SignInButton } from '@clerk/nextjs';
import Link from 'next/link';

import type { PlayerRegistration, Tournament, TournamentsResponse, UserProfile } from '@/types';
import type { DashboardOverview, PlayerAssignment } from './types';
import { TournamentCard, type TournamentCardData } from './components/TournamentCard';
import { formatDateUTC } from '@/lib/utils';

const PROFILE_ENDPOINT = '/api/auth/user';
const OVERVIEW_ENDPOINT = (playerId: string) => `/api/players/${playerId}/overview`;
const REGISTRATIONS_ENDPOINT = '/api/player/registrations';
const TOURNAMENTS_ENDPOINT = '/api/tournaments';

type DashboardState = {
  overview: DashboardOverview | null;
  registrations: Record<string, PlayerRegistration>;
  tournaments: TournamentCardData[];
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
        tournaments: TournamentCardData[];
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
  tournaments: TournamentCardData[];
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

  // Map Tournament to TournamentCardData
  const tournamentsData = (tournamentsJson.tournaments ?? []).map((t: any): TournamentCardData => {
    return {
      id: t.id,
      name: t.name,
      type: t.type,
      startDate: t.startDate,
      endDate: t.endDate,
      location: t.location,
      registrationStatus: t.registrationStatus || 'CLOSED',
      registrationType: t.registrationType || 'FREE',
      registrationCost: t.registrationCost || null,
      maxPlayers: t.maxPlayers || null,
      restrictionNotes: t.restrictionNotes || [],
      isWaitlistEnabled: t.isWaitlistEnabled || false,
      registeredCount: t.registeredCount || 0,
      stops: t.stops || [],
    };
  });

  return {
    overview: overviewData,
    registrations: registrationsList,
    tournaments: tournamentsData,
  };
}

export default function DashboardPage() {
  const { isSignedIn } = useAuth();
  const { isLoaded: userLoaded } = useUser();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

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

  // Filter tournaments by date
  const { upcomingTournaments, pastTournaments } = useMemo(() => {
    const now = new Date();
    const upcoming: TournamentCardData[] = [];
    const past: TournamentCardData[] = [];

    tournaments.forEach((tournament) => {
      const endDate = tournament.endDate ? new Date(tournament.endDate) : null;
      if (endDate && endDate < now) {
        past.push(tournament);
      } else {
        upcoming.push(tournament);
      }
    });

    // Sort upcoming by start date (soonest first)
    upcoming.sort((a, b) => {
      const dateA = a.startDate ? new Date(a.startDate).getTime() : Infinity;
      const dateB = b.startDate ? new Date(b.startDate).getTime() : Infinity;
      return dateA - dateB;
    });

    // Sort past by end date (most recent first)
    past.sort((a, b) => {
      const dateA = a.endDate ? new Date(a.endDate).getTime() : 0;
      const dateB = b.endDate ? new Date(b.endDate).getTime() : 0;
      return dateB - dateA;
    });

    return { upcomingTournaments: upcoming, pastTournaments: past };
  }, [tournaments]);

  // Registration action handlers
  const handleRegister = async (tournamentId: string) => {
    try {
      const response = await fetch(`/api/player/tournaments/${tournamentId}/register`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Failed to register');
        return;
      }

      alert(`Successfully registered for tournament!${data.registration.requiresPayment ? ' Please complete payment.' : ''}`);

      // Reload dashboard data
      const newData = await fetchDashboardData();
      dispatch({ type: 'load:success', payload: newData });
    } catch (error) {
      console.error('Registration error:', error);
      alert('Failed to register for tournament');
    }
  };

  const handleRequestInvite = async (tournamentId: string) => {
    try {
      const response = await fetch(`/api/player/tournaments/${tournamentId}/request-invite`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Failed to request invite');
        return;
      }

      alert('Invite request submitted! You will be notified when it is reviewed.');

      // Reload dashboard data
      const newData = await fetchDashboardData();
      dispatch({ type: 'load:success', payload: newData });
    } catch (error) {
      console.error('Invite request error:', error);
      alert('Failed to request invite');
    }
  };

  const handleJoinWaitlist = async (tournamentId: string) => {
    try {
      const response = await fetch(`/api/player/tournaments/${tournamentId}/join-waitlist`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Failed to join waitlist');
        return;
      }

      alert(`Joined waitlist at position ${data.waitlist.position}!`);

      // Reload dashboard data
      const newData = await fetchDashboardData();
      dispatch({ type: 'load:success', payload: newData });
    } catch (error) {
      console.error('Waitlist error:', error);
      alert('Failed to join waitlist');
    }
  };

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

  const displayTournaments = activeTab === 'upcoming' ? upcomingTournaments : pastTournaments;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-primary">Dashboard</h1>
        <p className="text-muted">View your teams, tournaments, and register for upcoming events.</p>
      </header>

      {err && <div className="alert alert-error">{err}</div>}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">My Teams</h2>
        {assignments.length === 0 ? (
          <div className="card text-center py-10 text-muted">
            <p>You are not currently assigned to any teams.</p>
            <p className="text-sm mt-2">Register for a tournament below to get started.</p>
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
                  <div>Role: {assignment.isCaptain ? 'Captain' : 'Player'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Tournaments Section with Tabs */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Tournaments</h2>
        </div>

        {/* Tabs */}
        <div className="border-b border-border-subtle">
          <nav className="flex gap-1 -mb-px" aria-label="Tournament tabs">
            <button
              className={`tab-button ${activeTab === 'upcoming' ? 'active' : ''}`}
              onClick={() => setActiveTab('upcoming')}
            >
              Upcoming ({upcomingTournaments.length})
            </button>
            <button
              className={`tab-button ${activeTab === 'past' ? 'active' : ''}`}
              onClick={() => setActiveTab('past')}
            >
              Past ({pastTournaments.length})
            </button>
          </nav>
        </div>

        {/* Tournament Cards */}
        {displayTournaments.length === 0 ? (
          <div className="card text-center py-10 text-muted">
            <p>No {activeTab} tournaments found.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {displayTournaments.map((tournament) => (
              <TournamentCard
                key={tournament.id}
                tournament={tournament}
                playerRegistrationStatus={registrations[tournament.id]?.status ?? null}
                onRegister={handleRegister}
                onRequestInvite={handleRequestInvite}
                onJoinWaitlist={handleJoinWaitlist}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}


