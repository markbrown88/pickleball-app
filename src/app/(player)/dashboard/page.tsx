'use client';

import { useEffect, useMemo, useReducer, useState } from 'react';
import { useAuth, useUser, SignInButton } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import type { PlayerRegistration, Tournament, TournamentsResponse, UserProfile } from '@/types';
import type { DashboardOverview, PlayerAssignment } from './types';
import { TournamentCard, type TournamentCardData } from './components/TournamentCard';
import { formatDateUTC } from '@/lib/utils';
import { fetchWithActAs } from '@/lib/fetchWithActAs';

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
      // For multi-stop tournaments, a player may have multiple registrations
      // Group by tournamentId and collect all stopIds
      const registrationMap: Record<string, PlayerRegistration & { allStopIds?: string[] }> = {};
      action.payload.registrations.forEach((registration) => {
        if (registrationMap[registration.tournamentId]) {
          // Merge stopIds from multiple registrations
          const existing = registrationMap[registration.tournamentId];
          const newStopIds = registration.stopIds || [];
          const existingStopIds = existing.allStopIds || existing.stopIds || [];
          registrationMap[registration.tournamentId] = {
            ...existing,
            allStopIds: [...new Set([...existingStopIds, ...newStopIds])],
          };
        } else {
          registrationMap[registration.tournamentId] = {
            ...registration,
            allStopIds: registration.stopIds || [],
          };
        }
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
  const profileResponse = await fetchWithActAs(PROFILE_ENDPOINT);
  let overviewData: DashboardOverview | null = null;

  if (profileResponse.ok) {
    const profile: UserProfile = await profileResponse.json();
    const overviewResponse = await fetchWithActAs(OVERVIEW_ENDPOINT(profile.id));
    const overviewJson = await overviewResponse.json();

    overviewData = {
      player: profile,
      assignments: overviewJson?.assignments ?? [],
    };
  }

  const [registrationsResponse, tournamentsResponse] = await Promise.all([
    fetchWithActAs(REGISTRATIONS_ENDPOINT),
    fetch(TOURNAMENTS_ENDPOINT), // Tournaments endpoint is public, no act-as needed
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
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'registrations'>('upcoming');

  const [state, dispatch] = useReducer(dashboardReducer, initialState);
  const { overview, err, tournaments, registrations, loading } = state;

  // Check if profile needs setup and redirect if necessary
  useEffect(() => {
    if (!userLoaded || !isSignedIn) return;

    let cancelled = false;

    const checkProfileSetup = async () => {
      try {
        const profileResponse = await fetchWithActAs(PROFILE_ENDPOINT);
        if (profileResponse.ok) {
          const profile: UserProfile & { needsProfileSetup?: boolean } = await profileResponse.json();
          // Check if profile needs setup (from API response or if missing required fields)
          const needsSetup = profile.needsProfileSetup || 
            !profile.firstName || 
            !profile.lastName || 
            !profile.gender ||
            !profile.club;
          
          if (needsSetup && !cancelled) {
            // Redirect to profile page to complete setup
            router.push('/profile');
            return;
          }
        }
      } catch (error) {
        console.error('Error checking profile setup:', error);
      }
    };

    void checkProfileSetup();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, userLoaded, router]);

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

  // Group assignments by tournament
  const assignmentsByTournament = useMemo(() => {
    const grouped = new Map<string, PlayerAssignment[]>();
    assignments.forEach((assignment) => {
      const key = assignment.tournamentId;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(assignment);
    });
    return Array.from(grouped.entries()).map(([tournamentId, assignments]) => ({
      tournamentId,
      tournamentName: assignments[0]?.tournamentName ?? '',
      assignments,
    }));
  }, [assignments]);

  // Filter tournaments by date and registration status
  const { upcomingTournaments, pastTournaments } = useMemo(() => {
    const now = new Date();
    const upcoming: TournamentCardData[] = [];
    const past: TournamentCardData[] = [];

    tournaments.forEach((tournament) => {
      // Show tournament if:
      // 1. Registration is OPEN, OR
      // 2. Player is already registered for it
      const isPlayerRegistered = !!registrations[tournament.id];
      const isRegistrationOpen = tournament.registrationStatus === 'OPEN';

      if (!isPlayerRegistered && !isRegistrationOpen) {
        // Skip closed/invite-only tournaments that player is not registered for
        return;
      }

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
  }, [tournaments, registrations]);

  // Convert registrations object to array and sort by date
  const registrationsList = useMemo(() => {
    return Object.values(registrations).sort((a, b) => {
      const dateA = new Date(a.registeredAt).getTime();
      const dateB = new Date(b.registeredAt).getTime();
      return dateB - dateA; // Most recent first
    });
  }, [registrations]);

  // Registration action handlers
  const handleRegister = (tournamentId: string) => {
    // Redirect to the full registration page that collects club and bracket info
    window.location.href = `/register/${tournamentId}`;
  };

  const handleRequestInvite = async (tournamentId: string) => {
    try {
      const response = await fetchWithActAs(`/api/player/tournaments/${tournamentId}/request-invite`, {
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
      const response = await fetchWithActAs(`/api/player/tournaments/${tournamentId}/join-waitlist`, {
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

  const formatAmount = (amountInCents: number | null | undefined, registrationType?: string) => {
    if (registrationType === 'FREE') return 'Free';
    if (!amountInCents) return '$0.00';
    const price = `$${(amountInCents / 100).toFixed(2)}`;
    // Add "+HST" for paid tournaments
    return registrationType === 'PAID' ? `${price} +HST` : price;
  };

  const getPaymentStatusBadge = (status?: string) => {
    switch (status) {
      case 'PAID':
      case 'COMPLETED':
        return <span className="chip chip-success">Paid</span>;
      case 'PENDING':
        return <span className="chip chip-warning">Pending</span>;
      case 'FAILED':
        return <span className="chip chip-error">Failed</span>;
      case 'REFUNDED':
        return <span className="chip chip-muted">Refunded</span>;
      default:
        return <span className="chip chip-muted">Unknown</span>;
    }
  };

  const getRegistrationStatusBadge = (status: string | null) => {
    switch (status) {
      case 'REGISTERED':
        return <span className="chip chip-success">Registered</span>;
      case 'WITHDRAWN':
        return <span className="chip chip-muted">Withdrawn</span>;
      case 'REJECTED':
        return <span className="chip chip-error">Rejected</span>;
      case 'PENDING_INVITE':
        return <span className="chip chip-warning">Pending Invite</span>;
      case 'WAITLISTED':
        return <span className="chip chip-info">Waitlisted</span>;
      default:
        return <span className="chip chip-muted">Unknown</span>;
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-primary">Dashboard</h1>
        <p className="text-muted">View your teams, tournaments, and register for upcoming events.</p>
      </header>

      {err && <div className="alert alert-error">{err}</div>}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">My Teams</h2>
        {assignmentsByTournament.length === 0 ? (
          <div className="card text-center py-10 text-muted">
            <p>You are not currently assigned to any teams.</p>
            <p className="text-sm mt-2">Register for a tournament below to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {assignmentsByTournament.map((tournamentGroup) => (
              <div key={tournamentGroup.tournamentId} className="card space-y-4">
                <div className="flex items-start justify-between border-b border-border-subtle pb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-primary">{tournamentGroup.tournamentName}</h3>
                  </div>
                  <Link href={`/tournament/${tournamentGroup.tournamentId}`} className="btn btn-ghost btn-sm">
                    View
                  </Link>
                </div>
                
                <div className="space-y-3">
                  {tournamentGroup.assignments.map((assignment, idx) => (
                    <div key={`${assignment.teamId}:${assignment.stopId}`} className={idx > 0 ? 'border-t border-border-subtle pt-3' : ''}>
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-secondary">{assignment.teamName}</div>
                          </div>
                          <div className="text-sm">
                            <span className={`chip ${assignment.isCaptain ? 'chip-success' : 'chip-muted'}`}>
                              {assignment.isCaptain ? 'Captain' : 'Player'}
                            </span>
                          </div>
                        </div>

                        <div className="text-sm text-muted space-y-1">
                          <div>
                            <span className="font-medium">Stop:</span> {assignment.stopName}
                            {assignment.stopStartAt && (
                              <span className="ml-1">
                                ({new Date(assignment.stopStartAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })})
                              </span>
                            )}
                          </div>
                          {assignment.bracketName && (
                            <div>
                              <span className="font-medium">Bracket:</span> {assignment.bracketName}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Main Tabs */}
      <div className="border-b border-border-subtle">
        <nav className="flex gap-1 -mb-px" aria-label="Dashboard tabs">
          <button
            className={`tab-button ${activeTab === 'upcoming' ? 'active' : ''}`}
            onClick={() => setActiveTab('upcoming')}
          >
            Upcoming Tournaments ({upcomingTournaments.length})
          </button>
          <button
            className={`tab-button ${activeTab === 'past' ? 'active' : ''}`}
            onClick={() => setActiveTab('past')}
          >
            Past Tournaments ({pastTournaments.length})
          </button>
          <button
            className={`tab-button ${activeTab === 'registrations' ? 'active' : ''}`}
            onClick={() => setActiveTab('registrations')}
          >
            Registrations & Payments ({registrationsList.length})
          </button>
        </nav>
      </div>

      {/* Upcoming Tournaments Tab */}
      {activeTab === 'upcoming' && (
        <section className="space-y-4">
          {upcomingTournaments.length === 0 ? (
            <div className="card text-center py-10 text-muted">
              <p>No upcoming tournaments found.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {upcomingTournaments.map((tournament) => {
                const registration = registrations[tournament.id];
                const registeredStopIds = (registration as any)?.allStopIds || registration?.stopIds || [];

                return (
                  <TournamentCard
                    key={tournament.id}
                    tournament={tournament}
                    playerRegistrationStatus={registration?.status ?? null}
                    registeredStopIds={registeredStopIds}
                    paymentStatus={registration?.paymentStatus ?? null}
                    registrationId={registration?.id}
                    onRegister={handleRegister}
                    onRequestInvite={handleRequestInvite}
                    onJoinWaitlist={handleJoinWaitlist}
                  />
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Past Tournaments Tab */}
      {activeTab === 'past' && (
        <section className="space-y-4">
          {pastTournaments.length === 0 ? (
            <div className="card text-center py-10 text-muted">
              <p>No past tournaments found.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {pastTournaments.map((tournament) => {
                const registration = registrations[tournament.id];
                const registeredStopIds = (registration as any)?.allStopIds || registration?.stopIds || [];

                return (
                  <TournamentCard
                    key={tournament.id}
                    tournament={tournament}
                    playerRegistrationStatus={registration?.status ?? null}
                    registeredStopIds={registeredStopIds}
                    paymentStatus={registration?.paymentStatus ?? null}
                    registrationId={registration?.id}
                    onRegister={handleRegister}
                    onRequestInvite={handleRequestInvite}
                    onJoinWaitlist={handleJoinWaitlist}
                  />
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Registrations & Payments Tab */}
      {activeTab === 'registrations' && (
        <section className="space-y-4">
          {registrationsList.length === 0 ? (
            <div className="card text-center py-10 text-muted">
              <p>You haven't registered for any tournaments yet.</p>
              <p className="text-sm mt-2">Browse tournaments above to get started.</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-1">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium text-secondary">Registration Details</th>
                      <th className="text-left p-3 text-sm font-medium text-secondary">Registration Status</th>
                      <th className="text-left p-3 text-sm font-medium text-secondary">Payment Status</th>
                      <th className="text-left p-3 text-sm font-medium text-secondary">Amount</th>
                      <th className="text-left p-3 text-sm font-medium text-secondary">Registered</th>
                      <th className="text-right p-3 text-sm font-medium text-secondary">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrationsList.map((registration) => (
                      <tr key={registration.tournamentId} className="border-t border-border-subtle hover:bg-surface-2">
                        <td className="p-3">
                          <div className="font-medium text-primary">{registration.tournamentName}</div>
                          <div className="text-sm text-muted mt-1 space-y-1">
                            {registration.stops && registration.stops.length > 0 ? (
                              registration.stops.map((stop, idx) => (
                                <div key={stop.stopId} className={idx > 0 ? 'mt-2 pt-2 border-t border-border-subtle' : ''}>
                                  <div className="font-medium text-secondary">Stop: {stop.stopName}</div>
                                  {stop.brackets && stop.brackets.length > 0 && (
                                    <div className="ml-2 mt-1">
                                      <span className="text-muted">Brackets: </span>
                                      {stop.brackets.map((bracket, bIdx) => (
                                        <span key={bracket.bracketId}>
                                          {bIdx > 0 && ', '}
                                          {bracket.bracketName}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div className="text-muted">No stops selected</div>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          {getRegistrationStatusBadge(registration.status)}
                        </td>
                        <td className="p-3">
                          {registration.paymentStatus ? getPaymentStatusBadge(registration.paymentStatus) : '-'}
                        </td>
                        <td className="p-3">
                          <span className="font-medium">
                            {formatAmount(registration.amountPaid, registration.registrationType)}
                          </span>
                        </td>
                        <td className="p-3 text-sm text-muted">
                          {new Date(registration.registeredAt).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex gap-2 justify-end">
                            {registration.paymentStatus === 'PENDING' && registration.id && (
                              <Link
                                href={`/register/${registration.tournamentId}/payment/status/${registration.id}`}
                                className="btn btn-primary btn-sm"
                              >
                                Pay Now
                              </Link>
                            )}
                            {registration.paymentStatus === 'PAID' && registration.id && (
                              <Link
                                href={`/register/${registration.tournamentId}/payment/status/${registration.id}`}
                                className="btn btn-ghost btn-sm"
                              >
                                Receipt
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}


