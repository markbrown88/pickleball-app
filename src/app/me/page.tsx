'use client';

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { DndContext, DragEndEvent, DragStartEvent, closestCenter } from '@dnd-kit/core';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useUser, useAuth } from '@clerk/nextjs';
import { SignInButton, SignOutButton } from '@clerk/nextjs';
import Link from 'next/link';
import { UserProfile, Tournament, PlayerRegistration, TournamentsResponse, RegistrationResponse, RoleInfo } from '@/types';

// Custom strategy that disables automatic reordering
const noReorderStrategy = () => null;

type Id = string;
type CountrySel = 'Canada' | 'USA' | 'Other';

const CA_PROVINCES = ['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'] as const;

// Draggable Team Component using @dnd-kit
function DraggableTeam({ 
  team, 
  teamPosition, 
  roundId, 
  matchIndex, 
  bracketName,
  isDragging = false,
  dragPreview = null
}: { 
  team: any; 
  teamPosition: 'A' | 'B'; 
  roundId: string; 
  matchIndex: number; 
  bracketName: string;
  isDragging?: boolean;
  dragPreview?: any;
}) {
  const teamId = `${roundId}-${bracketName}-${matchIndex}-${teamPosition}`;
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: teamId,
    data: {
      roundId,
      matchIndex,
      teamPosition,
      bracketName,
      team
    }
  });

  // Determine visual state
  const isSourceTeam = dragPreview && dragPreview.sourceId === teamId;
  const isTargetTeam = dragPreview && dragPreview.targetId === teamId;
  const isBeingDragged = isDragging && isSourceTeam;
  const isPreviewTarget = isDragging && isTargetTeam;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isBeingDragged ? 0.6 : isPreviewTarget ? 0.8 : 1,
    zIndex: isBeingDragged ? 1000 : isPreviewTarget ? 999 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`px-3 py-2 border rounded cursor-move transition-all duration-200 ${
        isBeingDragged 
          ? 'opacity-60 scale-105 shadow-lg border-info bg-info/10' 
          : isPreviewTarget 
            ? 'opacity-80 scale-102 shadow-md border-success bg-success/10'
            : ''
      } ${
        !team ? 'border-dashed border-subtle bg-surface-2 cursor-not-allowed' : 'bg-surface-1 hover:shadow-md'
      }`}
    >
      {team ? (
        <div className="text-center">
          <div className="font-medium">{team.name}</div>
        </div>
      ) : (
        <div className="text-muted italic">Drop team here</div>
      )}
    </div>
  );
}
const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME',
  'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA',
  'RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
] as const;

function fortyYearsAgoISO() {
  const t = new Date();
  t.setFullYear(t.getFullYear() - 40);
  const y = t.getFullYear();
  const m = String(t.getMonth()+1).padStart(2,'0');
  const d = String(t.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
function fmtDate(d?: string | null) {
  if (!d) return '—';
  const dt = new Date(d); const y = dt.getFullYear(); const m = String(dt.getMonth()+1).padStart(2,'0'); const day = String(dt.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function between(a?: string|null, b?: string|null) {
  if (!a && !b) return '—'; if (a && b) return `${fmtDate(a)} – ${fmtDate(b)}`; return fmtDate(a || b);
}

function formatStopDateRange(startAt?: string | null, endAt?: string | null) {
  const parse = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const start = parse(startAt);
  const end = parse(endAt);

  if (!start && !end) return '—';

  const formatFull = (date: Date) =>
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (start && end) {
    const sameYear = start.getFullYear() === end.getFullYear();
    const sameMonth = sameYear && start.getMonth() === end.getMonth();
    const sameDay = sameMonth && start.getDate() === end.getDate();

    if (sameDay) {
      return formatFull(start);
    }

    if (sameMonth) {
      const month = start.toLocaleDateString('en-US', { month: 'short' });
      return `${month}. ${start.getDate()}-${end.getDate()}, ${start.getFullYear()}`;
    }

    if (sameYear) {
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }

    return `${formatFull(start)}-${formatFull(end)}`;
  }

  const single = start || end;
  return single ? formatFull(single) : '—';
}

type Club = {
  id: Id; name: string;
  address?: string|null; city?: string|null; region?: string|null; country?: string|null; phone?: string|null;
};
type PlayerLite = { id: Id; firstName?: string|null; lastName?: string|null; name?: string|null; gender: 'MALE'|'FEMALE'; dupr?: number|null; age?: number|null; };
type ActAsPlayer = { id: Id; firstName?: string|null; lastName?: string|null; email?: string|null; isAppAdmin: boolean; };

type StopStatus = 'pending' | 'in_progress' | 'completed';

type StopRowFromAPI = {
  stopId: Id;
  stopName: string;
  locationName?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  tournamentId?: Id | null;
  tournamentName?: string | null;
  stopRoster: PlayerLite[]; // roster for THIS team (bracket) at THIS stop
  status: StopStatus;
  gamesTotal: number;
  gamesStarted: number;
  gamesCompleted: number;
};

type TeamItem = {
  id: Id;
  name: string;
  club?: Club | null;
  bracketName: string | null; // "Advanced","Intermediate","DEFAULT", null⇒"General"
  tournament: { id: Id; name: string; maxTeamSize: number | null };
  tournamentId: Id;
  roster: PlayerLite[];
  stops: StopRowFromAPI[];
  bracketLimit: number | null;       // max unique players across all stops for THIS team (bracket)
  bracketUniqueCount: number;        // current unique across all stops (from API)
};

type TournamentRow = {
  tournamentId: Id;
  tournamentName: string;
  dates: string;
  stops: Array<{
    stopId: Id;
    stopName: string;
    locationName?: string | null;
    startAt?: string | null;
    endAt?: string | null;
    status: StopStatus;
    gamesTotal: number;
    gamesStarted: number;
    gamesCompleted: number;
  }>;
  bracketTeams: Map<string, TeamItem>;
  bracketNames: string[];
};

const STOP_STATUS_META: Record<StopStatus, { label: string; badgeClass: string }> = {
  pending: {
    label: 'Pending',
    badgeClass: 'bg-warning/15 text-warning border border-warning/30',
  },
  in_progress: {
    label: 'In Progress',
    badgeClass: 'bg-info/15 text-secondary border border-secondary/30',
  },
  completed: {
    label: 'Completed',
    badgeClass: 'bg-success/15 text-success border border-success/30',
  },
};

function StopStatusBadge({ status }: { status: StopStatus }) {
  const meta = STOP_STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${meta.badgeClass}`}>
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  );
}

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

type Overview = {
  player: {
    id: Id; firstName?: string|null; lastName?: string|null; name?: string|null; gender: 'MALE'|'FEMALE';
    club?: Club|null; clubId?: Id|null; city?: string|null; region?: string|null; country?: string|null;
    phone?: string|null; email?: string|null; dupr?: number|null;
    birthdayYear?: number|null; birthdayMonth?: number|null; birthdayDay?: number|null;
    age?: number|null;
  };
  captainTeamIds: Record<string, unknown>; // will treat keys as ids
  assignments: {
    tournamentId: Id; tournamentName: string;
    stopId: Id; stopName: string; stopStartAt?: string|null; stopEndAt?: string|null;
    teamId: Id; teamName: string; teamClubName?: string|null;
  }[];
  // New fields for consolidated functionality
  captainTeams?: TeamItem[];
  eventManagerTournaments?: EventManagerTournament[];
};

type MatchStatus = 'not_started' | 'in_progress' | 'completed';

// Tournament Tab Component - Combined My Tournaments and Available Tournaments
function TournamentTab({
  userProfile,
  assignments,
  captainSet,
  onError,
  onInfo
}: {
  userProfile: UserProfile | null;
  assignments: any[];
  captainSet: Set<string>;
  onError: (message: string) => void;
  onInfo: (message: string) => void;
}) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(false);
  const [registrations, setRegistrations] = useState<Record<string, PlayerRegistration>>({});

  // Load available tournaments
  const loadTournaments = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/tournaments');
      if (response.ok) {
        const data: TournamentsResponse = await response.json();
        setTournaments(data.tournaments || []);
      } else {
        throw new Error('Failed to load tournaments');
      }
    } catch (error) {
      onError('Failed to load tournaments');
    } finally {
      setLoading(false);
    }
  };

  // Load user's registrations
  const loadRegistrations = async () => {
    if (!userProfile) return;
    
    try {
      const response = await fetch('/api/player/registrations');
      if (response.ok) {
        const data: PlayerRegistration[] = await response.json();
        const regMap: Record<string, PlayerRegistration> = {};
        data.forEach((reg: PlayerRegistration) => {
          regMap[reg.tournamentId] = reg;
        });
        setRegistrations(regMap);
      }
    } catch (error) {
      console.error('Failed to load registrations:', error);
    }
  };

  // Register for a tournament
  const registerForTournament = async (tournamentId: string, bracketId?: string) => {
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bracketId })
      });

      if (response.ok) {
        const data: { message: string; registration?: any } = await response.json();
        onInfo(data.message || 'Successfully registered for tournament');
        loadRegistrations(); // Refresh registrations
      } else {
        const error: { error: string } = await response.json();
        onError(error.error || 'Failed to register for tournament');
      }
    } catch (error) {
      onError('Failed to register for tournament');
    }
  };

  // Unregister from a tournament
  const unregisterFromTournament = async (tournamentId: string) => {
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/register`, {
        method: 'DELETE'
      });

      if (response.ok) {
        onInfo('Successfully unregistered from tournament');
        loadRegistrations(); // Refresh registrations
      } else {
        const error: { error: string } = await response.json();
        onError(error.error || 'Failed to unregister from tournament');
      }
    } catch (error) {
      onError('Failed to unregister from tournament');
    }
  };

  useEffect(() => {
    loadTournaments();
    loadRegistrations();
  }, [userProfile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  // Separate tournaments into registered and available
  const registeredTournamentIds = new Set(Object.keys(registrations));
  const myTournaments = tournaments.filter(t => registeredTournamentIds.has(t.id));
  const availableTournaments = tournaments.filter(t => !registeredTournamentIds.has(t.id));

  return (
    <div className="space-y-8">
      {/* My Tournaments Section */}
      <section>
        <h2 className="text-xl font-semibold mb-4">My Tournaments</h2>
        {assignments.length === 0 ? (
          <div className="text-center py-8 text-muted card">
            <p>You're not currently registered for any tournaments.</p>
            <p className="text-sm mt-1">Check the "Available Tournaments" section below to register.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Tournament</th>
                  <th>Team</th>
                  <th>Stop</th>
                  <th>Dates</th>
                  <th>Team Club</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((row, i) => {
                  const isCaptain = captainSet.has(row.teamId);
                  return (
                    <tr key={i}>
                      <td>
                        <button 
                          className="text-secondary hover:text-secondary-hover hover:underline font-medium"
                          onClick={() => {
                            // TODO: Navigate to tournament detail page
                            console.log('Navigate to tournament:', row.tournamentName);
                          }}
                        >
                          {row.tournamentName}
                        </button>
                      </td>
                      <td className="text-muted">{row.teamName}</td>
                      <td className="text-muted">{row.stopName}</td>
                      <td className="text-muted tabular">{between(row.stopStartAt ?? null, row.stopEndAt ?? null)}</td>
                      <td className="text-muted">{row.teamClubName ?? '—'}</td>
                      <td>
                        {isCaptain ? (
                          <span className="chip chip-warning">
                            Captain
                          </span>
                        ) : (
                          <span className="text-muted">Player</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Available Tournaments Section */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Available Tournaments</h2>
        {availableTournaments.length === 0 ? (
          <div className="text-center py-8 text-muted card">
            <p>No tournaments available for registration at this time.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {availableTournaments.map((tournament) => (
              <div key={tournament.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <button 
                      className="text-lg font-semibold text-secondary hover:text-secondary-hover hover:underline mb-2"
                      onClick={() => {
                        // TODO: Navigate to tournament detail page
                        console.log('Navigate to tournament:', tournament.name);
                      }}
                    >
                      {tournament.name}
                    </button>
                    <p className="text-sm text-muted mb-3">
                      {tournament.type} • {tournament.stops?.length || 0} stops
                    </p>
                    
                    {tournament.brackets && tournament.brackets.length > 0 && (
                      <div className="mb-3">
                        <h4 className="text-sm font-medium text-muted mb-2">Available Brackets:</h4>
                        <div className="flex flex-wrap gap-2">
                          {tournament.brackets.map((bracket: any) => (
                            <span
                              key={bracket.id}
                              className="px-2 py-1 bg-surface-2 text-muted text-sm rounded"
                            >
                              {bracket.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {tournament.stops && tournament.stops.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-muted mb-2">Stops:</h4>
                        <div className="space-y-1">
                          {tournament.stops.map((stop: any, index: number) => (
                            <div key={stop.id} className="text-sm text-muted">
                              {index + 1}. {stop.name}
                              {stop.locationName && ` • ${stop.locationName}`}
                              {stop.startAt && (
                                <span className="ml-2 text-muted">
                                  {new Date(stop.startAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="ml-6">
                    <button
                      onClick={() => registerForTournament(tournament.id)}
                      className="btn btn-primary"
                    >
                      Register
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// Tournament Registration Tab Component
function TournamentRegistrationTab({
  userProfile,
  onError,
  onInfo
}: {
  userProfile: UserProfile | null;
  onError: (message: string) => void;
  onInfo: (message: string) => void;
}) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(false);
  const [registrations, setRegistrations] = useState<Record<string, PlayerRegistration>>({});

  // Load available tournaments
  const loadTournaments = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/tournaments');
      if (response.ok) {
        const data: TournamentsResponse = await response.json();
        setTournaments(data.tournaments || []);
      } else {
        throw new Error('Failed to load tournaments');
      }
    } catch (error) {
      onError('Failed to load tournaments');
    } finally {
      setLoading(false);
    }
  };

  // Load user's registrations
  const loadRegistrations = async () => {
    if (!userProfile) return;
    
    try {
      const response = await fetch('/api/player/registrations');
      if (response.ok) {
        const data: PlayerRegistration[] = await response.json();
        const regMap: Record<string, PlayerRegistration> = {};
        data.forEach((reg: PlayerRegistration) => {
          regMap[reg.tournamentId] = reg;
        });
        setRegistrations(regMap);
      }
    } catch (error) {
      console.error('Failed to load registrations:', error);
    }
  };

  // Register for a tournament
  const registerForTournament = async (tournamentId: string, bracketId?: string) => {
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bracketId })
      });

      if (response.ok) {
        const data: { message: string; registration?: any } = await response.json();
        onInfo(data.message || 'Successfully registered for tournament');
        loadRegistrations(); // Refresh registrations
      } else {
        const error: { error: string } = await response.json();
        onError(error.error || 'Failed to register for tournament');
      }
    } catch (error) {
      onError('Failed to register for tournament');
    }
  };

  // Unregister from a tournament
  const unregisterFromTournament = async (tournamentId: string) => {
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/register`, {
        method: 'DELETE'
      });

      if (response.ok) {
        onInfo('Successfully unregistered from tournament');
        loadRegistrations(); // Refresh registrations
      } else {
        const error: { error: string } = await response.json();
        onError(error.error || 'Failed to unregister from tournament');
      }
    } catch (error) {
      onError('Failed to unregister from tournament');
    }
  };

  useEffect(() => {
    loadTournaments();
    loadRegistrations();
  }, [userProfile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">Tournament Registration</h2>
        <p className="text-muted">Register for available tournaments and manage your participation.</p>
      </div>

      {tournaments.length === 0 ? (
        <div className="text-center py-8 text-muted">
          No tournaments available for registration.
        </div>
      ) : (
        <div className="space-y-4">
          {tournaments.map((tournament) => {
            const registration = registrations[tournament.id];
            const isRegistered = !!registration;

            return (
              <div key={tournament.id} className="card">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-lg">{tournament.name}</h3>
                    <p className="text-sm text-muted">
                      {tournament.type} • {tournament.stops?.length || 0} stops
                    </p>
                  </div>
                  <div className="text-right">
                    {isRegistered ? (
                      <div className="space-y-2">
                        <span className="chip chip-success">
                          Registered
                        </span>
                        <div className="text-sm text-muted">
                          Team: {registration.teamName}
                        </div>
                        <button
                          onClick={() => unregisterFromTournament(tournament.id)}
                          className="text-sm text-error hover:text-error-hover"
                        >
                          Unregister
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => registerForTournament(tournament.id)}
                        className="btn btn-primary"
                      >
                        Register
                      </button>
                    )}
                  </div>
                </div>

                {tournament.brackets && tournament.brackets.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-sm font-medium text-muted mb-2">Available Brackets:</h4>
                    <div className="flex flex-wrap gap-2">
                      {tournament.brackets.map((bracket: any) => (
                        <span
                          key={bracket.id}
                          className="px-2 py-1 bg-surface-1 text-muted text-sm rounded"
                        >
                          {bracket.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {tournament.stops && tournament.stops.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-sm font-medium text-muted mb-2">Stops:</h4>
                    <div className="space-y-1">
                      {tournament.stops.map((stop: any, index: number) => (
                        <div key={stop.id} className="text-sm text-muted">
                          {index + 1}. {stop.name}
                          {stop.locationName && ` • ${stop.locationName}`}
                          {stop.startAt && (
                            <span className="ml-2">
                              {new Date(stop.startAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Profile Setup Form Component
function ProfileSetupForm({ 
  user, 
  clubs, 
  onSave, 
  loading 
}: { 
  user: any; 
  clubs: Club[]; 
  onSave: (data: {
    firstName: string;
    lastName: string;
    gender: 'MALE' | 'FEMALE';
    clubId: string;
    email: string;
    phone: string;
    city: string;
    region: string;
    country: string;
    dupr: string;
    birthday: string;
  }) => Promise<boolean>; 
  loading: boolean; 
}) {
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    gender: 'MALE' as 'MALE' | 'FEMALE',
    clubId: '',
    email: user?.emailAddresses?.[0]?.emailAddress || '',
    phone: user?.phoneNumbers?.[0]?.phoneNumber || '',
    city: '',
    region: '',
    country: 'Canada',
    dupr: '',
    birthday: ''
  });

  const [countrySel, setCountrySel] = useState<CountrySel>('Canada');
  const [countryOther, setCountryOther] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const country = countrySel === 'Other' ? countryOther : countrySel;
    const success = await onSave({
      ...formData,
      country
    });
    
    if (success) {
      // Form will be replaced by main interface
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-muted mb-1">First Name</label>
          <input
            type="text"
            required
            className="input"
            value={formData.firstName}
            onChange={e => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Last Name</label>
          <input
            type="text"
            required
            className="input"
            value={formData.lastName}
            onChange={e => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Gender</label>
          <select
            required
            className="input"
            value={formData.gender}
            onChange={e => setFormData(prev => ({ ...prev, gender: e.target.value as 'MALE' | 'FEMALE' }))}
          >
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Club</label>
          <select
            required
            className="input"
            value={formData.clubId}
            onChange={e => setFormData(prev => ({ ...prev, clubId: e.target.value }))}
          >
            <option value="">Select Club</option>
            {clubs.map(club => (
              <option key={club.id} value={club.id}>{club.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Email</label>
          <input
            type="email"
            className="input"
            value={formData.email}
            onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Phone</label>
          <input
            type="tel"
            className="input"
            value={formData.phone}
            onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-muted mb-1">City</label>
          <input
            type="text"
            className="input"
            value={formData.city}
            onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted mb-1">
            {countrySel === 'Canada' ? 'Province' : 'State'}
          </label>
          <select
            className="input"
            value={formData.region}
            onChange={e => setFormData(prev => ({ ...prev, region: e.target.value }))}
          >
            <option value="">Select {countrySel === 'Canada' ? 'Province' : 'State'}</option>
            {(countrySel === 'Canada' ? CA_PROVINCES : US_STATES).map(region => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Country</label>
          <select
            className="input"
            value={countrySel}
            onChange={e => {
              const sel = e.target.value as CountrySel;
              setCountrySel(sel);
              setFormData(prev => ({ ...prev, region: '' }));
            }}
          >
            <option value="Canada">Canada</option>
            <option value="USA">USA</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      {countrySel === 'Other' && (
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Country Name</label>
          <input
            type="text"
            className="input"
            value={countryOther}
            onChange={e => setCountryOther(e.target.value)}
            placeholder="Enter country name"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-muted mb-1">DUPR Rating (optional)</label>
          <input
            type="number"
            step="0.1"
            min="1.0"
            max="6.0"
            className="input"
            value={formData.dupr}
            onChange={e => setFormData(prev => ({ ...prev, dupr: e.target.value }))}
            placeholder="e.g., 4.5"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Birthday (optional)</label>
          <input
            type="date"
            className="input"
            value={formData.birthday}
            onChange={e => setFormData(prev => ({ ...prev, birthday: e.target.value }))}
          />
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary disabled:opacity-50"
        >
          {loading ? 'Creating Profile...' : 'Create Profile'}
        </button>
      </div>
    </form>
  );
}

export default function MePage() {
  const { user, isLoaded: userLoaded } = useUser();
  const { isSignedIn } = useAuth();
  
  const [err, setErr] = useState<string|null>(null);
  const [info, setInfo] = useState<string|null>(null);
  const clearMsg = () => { setErr(null); setInfo(null); };

  const [players, setPlayers] = useState<PlayerLite[]>([]);
  const [meId, setMeId] = useState<string>('');

  const [overview, setOverview] = useState<Overview | null>(null);
  const [clubsAll, setClubsAll] = useState<Club[]>([]);
  
  // Authentication state
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);

  // Act As state for App Admins
  const [actAsPlayers, setActAsPlayers] = useState<ActAsPlayer[]>([]);
  const [selectedActAsPlayer, setSelectedActAsPlayer] = useState<string>('');

  // Load user profile from Clerk authentication
  const loadUserProfile = async () => {
    if (!userLoaded || !isSignedIn) return;
    
    setProfileLoading(true);
    try {
      const response = await fetch('/api/auth/user');
      if (response.ok) {
        const profile: UserProfile = await response.json();
        setUserProfile(profile);
        setMeId(profile.id);
        setNeedsProfileSetup(false);
      } else if (response.status === 404) {
        // User not linked to a player profile yet
        setNeedsProfileSetup(true);
        setUserProfile(null);
      } else {
        throw new Error('Failed to load user profile');
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      setErr('Failed to load user profile');
    } finally {
      setProfileLoading(false);
    }
  };

  // Create or update user profile
  const saveUserProfile = async (profileData: {
    firstName: string;
    lastName: string;
    gender: 'MALE' | 'FEMALE';
    clubId: string;
    email: string;
    phone: string;
    city: string;
    region: string;
    country: string;
    dupr: string;
    birthday: string;
  }): Promise<boolean> => {
    if (!isSignedIn) return false;
    
    setProfileLoading(true);
    try {
      const method = userProfile ? 'PUT' : 'POST';
      const response = await fetch('/api/auth/user', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      });
      
      if (response.ok) {
        const profile: UserProfile = await response.json();
        setUserProfile(profile);
        setMeId(profile.id);
        setNeedsProfileSetup(false);
        setInfo('Profile saved successfully');
        return true;
      } else {
        const error: { error: string } = await response.json();
        throw new Error(error.error || 'Failed to save profile');
      }
    } catch (error) {
      console.error('Error saving user profile:', error);
      setErr(error instanceof Error ? error.message : 'Failed to save profile');
      return false;
    } finally {
      setProfileLoading(false);
    }
  };

  // Load players for "Act As" dropdown (App Admins only)
  const loadActAsPlayers = async () => {
    if (!userProfile?.isAppAdmin) return;
    
    try {
      const response = await fetch('/api/admin/act-as');
      if (response.ok) {
        const data = await response.json();
        setActAsPlayers(data.items || []);
      }
    } catch (error) {
      console.error('Error loading players for Act As:', error);
    }
  };

  // Handle "Act As" functionality
  const handleActAs = async (playerId: string) => {
    if (playerId === 'reset' || !playerId) {
      // Reset to original user
      setInfo('Acting as original user');
      setSelectedActAsPlayer('');
      await loadUserProfile();
    } else {
      try {
        const response = await fetch('/api/admin/act-as', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ targetPlayerId: playerId }),
        });

        if (response.ok) {
          const data = await response.json();
          setInfo(data.message);
          
          // Update the displayed user profile to show the target player
          const targetPlayer = data.targetPlayer;
          setUserProfile({
            ...userProfile,
            id: targetPlayer.id,
            firstName: targetPlayer.firstName,
            lastName: targetPlayer.lastName,
            email: targetPlayer.email,
            isAppAdmin: targetPlayer.isAppAdmin,
            isTournamentAdmin: targetPlayer.isTournamentAdmin || false,
            club: targetPlayer.club,
            clerkUserId: userProfile?.clerkUserId || '',
            name: targetPlayer.firstName + ' ' + targetPlayer.lastName,
            phone: userProfile?.phone || null,
            gender: userProfile?.gender || 'MALE',
            dupr: userProfile?.dupr || null,
            age: userProfile?.age || null,
            birthday: userProfile?.birthday || null,
            city: userProfile?.city || null,
            region: userProfile?.region || null,
            country: userProfile?.country || null
          });
          
          // Update meId to trigger data reload
          setMeId(targetPlayer.id);
        } else {
          const errorData = await response.json();
          setErr(errorData.error || 'Failed to act as player');
        }
      } catch (error) {
        console.error('Error acting as player:', error);
        setErr('Failed to act as player');
      }
    }
  };

  // Profile edit form
  const [showEdit, setShowEdit] = useState(false);
  const [countrySel, setCountrySel] = useState<CountrySel>('Canada');
  const [countryOther, setCountryOther] = useState('');
  const [birthday, setBirthday] = useState<string>(fortyYearsAgoISO());
  const [form, setForm] = useState<{
    firstName: string; lastName: string; gender: 'MALE'|'FEMALE';
    clubId: Id | '';
    dupr: string;
    city: string; region: string;
    phone: string; email: string;
    clubRating: string; photo: string;
  }>({
    firstName:'', lastName:'', gender:'MALE', clubId:'', dupr:'', city:'', region:'', phone:'', email:'', clubRating:'', photo:''
  });

  // Populate form with existing player data when overview loads
  useEffect(() => {
    if (overview?.player) {
      setForm(prev => ({
        ...prev,
        firstName: overview.player.firstName || '',
        lastName: overview.player.lastName || '',
        gender: overview.player.gender || 'MALE',
        clubId: overview.player.club?.id || '',
        dupr: overview.player.dupr?.toString() || '',
        city: overview.player.city || '',
        region: overview.player.region || '',
        phone: overview.player.phone || '',
        email: overview.player.email || '',
        clubRating: '',
        photo: ''
      }));
    }
  }, [overview]);

  // Captain functionality
  const [captainData, setCaptainData] = useState<{ teams: TeamItem[] }>({ teams: [] });
  const [activeTournamentId, setActiveTournamentId] = useState<Id | null>(null);
  const [captainRosters, setCaptainRosters] = useState<Record<string, Record<string, PlayerLite[]>>>({});
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'profile' | 'tournaments' | 'rosters' | 'manage' | 'register'>('tournaments');

  // Event Manager functionality
  const [eventManagerData, setEventManagerData] = useState<EventManagerTournament[]>([]);

  // Lineup management state
  const [editingLineup, setEditingLineup] = useState<{ matchId: string; teamId: string } | null>(null);
  const [editingMatch, setEditingMatch] = useState<string | null>(null);
  const [lineups, setLineups] = useState<Record<string, Record<string, PlayerLite[]>>>({});
  const [teamRosters, setTeamRosters] = useState<Record<string, PlayerLite[]>>({});
  
  // Games and match status state
  const [matchStatuses, setMatchStatuses] = useState<Record<string, MatchStatus>>({});
  const [gameStatuses, setGameStatuses] = useState<Record<string, MatchStatus>>({});
  const [games, setGames] = useState<Record<string, any[]>>({});
  const [courtNumbers, setCourtNumbers] = useState<Record<string, string>>({});
  const [creatingTiebreakers, setCreatingTiebreakers] = useState<Set<string>>(new Set());
  
  // Function to fetch team roster
  const fetchTeamRoster = async (teamId: string): Promise<PlayerLite[]> => {
    if (teamRosters[teamId]) {
      return teamRosters[teamId];
    }
    
    try {
      const response = await fetch(`/api/admin/teams/${teamId}/members`);
      if (!response.ok) {
        console.error('Failed to fetch team roster:', response.statusText);
        return [];
      }
      
      const data = await response.json();
      const roster = data.members || [];
      
      // Cache the roster
      setTeamRosters(prev => ({
        ...prev,
        [teamId]: roster
      }));
      
      return roster;
    } catch (error) {
      console.error('Error fetching team roster:', error);
      return [];
    }
  };

  // Function to start a match
  const startMatch = async (matchId: string) => {
    try {
      console.log('Starting match:', matchId);
      // Create initial games for the match
      const response = await fetch(`/api/admin/matches/${matchId}/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          games: [
            { slot: 'MENS_DOUBLES', teamAScore: null, teamBScore: null },
            { slot: 'WOMENS_DOUBLES', teamAScore: null, teamBScore: null },
            { slot: 'MIXED_1', teamAScore: null, teamBScore: null },
            { slot: 'MIXED_2', teamAScore: null, teamBScore: null }
          ]
        })
      });

      if (response.ok) {
        console.log('Match started successfully');
        setMatchStatuses(prev => ({ ...prev, [matchId]: 'in_progress' }));
        // Load the games
        await loadGamesForMatch(matchId);
      } else {
        const errorData = await response.json();
        console.error('Failed to start match:', errorData);
      }
    } catch (error) {
      console.error('Error starting match:', error);
    }
  };

  // Function to complete a match
  const completeMatch = async (matchId: string) => {
    setMatchStatuses(prev => ({ ...prev, [matchId]: 'completed' }));
  };

  // Function to load games for a match
  const loadGamesForMatch = async (matchId: string, force = false) => {
    if (!force && games[matchId]) return; // Already loaded
    
    try {
      console.log('Loading games for match:', matchId);
      const response = await fetch(`/api/admin/matches/${matchId}/games`, { cache: 'no-store' });
      if (response.ok) {
        const gamesData = await response.json();
        console.log('Loaded games data:', gamesData);
        setGames(prev => ({ ...prev, [matchId]: gamesData }));
        
        setGameStatuses(prev => {
          const next: Record<string, 'not_started' | 'in_progress' | 'completed'> = { ...prev };

          const previousGames = games[matchId] ?? [];
          const newIds = new Set(gamesData.map((game: any) => game.id));

          previousGames.forEach((game: any) => {
            if (!newIds.has(game.id)) {
              delete next[game.id];
            }
          });

          gamesData.forEach((game: any) => {
            if (game.isComplete === true) {
              next[game.id] = 'completed';
            } else if (game.startedAt) {
              next[game.id] = 'in_progress';
            } else {
              next[game.id] = 'not_started';
            }
          });

          return next;
        });
      } else {
        console.error('Failed to load games:', response.status);
      }
    } catch (error) {
      console.error('Error loading games:', error);
    }
  };

  // Function to start a game
  const startGame = async (gameId: string) => {
    try {
      setGameStatuses(prev => ({ ...prev, [gameId]: 'in_progress' }));
      
      // Update in database - when starting, set isComplete to false and startedAt to now
      const response = await fetch(`/api/admin/games/${gameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          isComplete: false,
          startedAt: new Date().toISOString()
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to start game');
      }
    } catch (error) {
      setErr(`Failed to start game: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Function to end a game
  const endGame = async (gameId: string) => {
    try {
      // Find the game to check for ties and capture the matchId
      let gameToCheck: any = null;
      let parentMatchId: string | null = null;
      for (const [matchId, matchGames] of Object.entries(games)) {
        const foundGame = matchGames?.find(game => game.id === gameId);
        if (foundGame) {
          gameToCheck = foundGame;
          parentMatchId = matchId;
          break;
        }
      }
      
      if (!gameToCheck || !parentMatchId) {
        throw new Error('Game not found');
      }
      
      // Check for ties - cannot end game if scores are equal
      const teamAScore = gameToCheck.teamAScore || 0;
      const teamBScore = gameToCheck.teamBScore || 0;
      
      if (teamAScore === teamBScore) {
        setErr('Cannot end game with tied scores. One team must win.');
        return;
      }
      
      setGameStatuses(prev => ({ ...prev, [gameId]: 'completed' }));
      
      // Update in database - when ending, set isComplete to true and endedAt to now
      const response = await fetch(`/api/admin/games/${gameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          isComplete: true,
          endedAt: new Date().toISOString()
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to end game');
      }

      // Reload games for this match so tiebreakers/updates appear immediately
      await loadGamesForMatch(parentMatchId, true);
    } catch (error) {
      setErr(`Failed to end game: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Debounced score update function
  const debouncedScoreUpdate = useRef<Record<string, NodeJS.Timeout>>({});
  
  const updateGameScore = async (gameId: string, teamAScore: number | null, teamBScore: number | null) => {
    // Clear existing timeout for this game
    if (debouncedScoreUpdate.current[gameId]) {
      clearTimeout(debouncedScoreUpdate.current[gameId]);
    }
    
    // Update local state immediately for responsive UI
    setGames(prev => {
      const newGames = { ...prev };
      Object.keys(newGames).forEach(matchId => {
        newGames[matchId] = newGames[matchId].map(game =>
          game.id === gameId ? { ...game, teamAScore, teamBScore } : game
        );
      });
      return newGames;
    });
    
    // Debounce the API call
    debouncedScoreUpdate.current[gameId] = setTimeout(async () => {
      try {
        console.log('Updating game score:', { gameId, teamAScore, teamBScore });
        const response = await fetch(`/api/admin/games/${gameId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamAScore, teamBScore })
        });

        if (response.ok) {
          console.log('Game score updated successfully');
        } else {
          const errorData = await response.json();
          console.error('Failed to update game score:', errorData);
        }
      } catch (error) {
        console.error('Error updating game score:', error);
      }
    }, 500); // 500ms debounce
  };

  // Debounced court number update function
  const debouncedCourtUpdate = useRef<Record<string, NodeJS.Timeout>>({});
  
  const updateGameCourtNumber = async (gameId: string, courtNumber: string) => {
    // Clear existing timeout for this game
    if (debouncedCourtUpdate.current[gameId]) {
      clearTimeout(debouncedCourtUpdate.current[gameId]);
    }
    
    // Update local state immediately for responsive UI
    setGames(prev => {
      const newGames = { ...prev };
      Object.keys(newGames).forEach(matchId => {
        newGames[matchId] = newGames[matchId].map(game =>
          game.id === gameId ? { ...game, courtNumber } : game
        );
      });
      return newGames;
    });
    
    // Debounce the API call
    debouncedCourtUpdate.current[gameId] = setTimeout(async () => {
      try {
        console.log('Updating game court number:', { gameId, courtNumber });
        const response = await fetch(`/api/admin/games/${gameId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courtNumber })
        });

        if (response.ok) {
          console.log('Game court number updated successfully');
        } else {
          const errorData = await response.json();
          console.error('Failed to update game court number:', errorData);
        }
      } catch (error) {
        console.error('Error updating game court number:', error);
      }
    }, 500); // 500ms debounce
  };

  const completeGame = async (gameId: string) => {
    try {
      console.log('Completing game:', { gameId });
      setGameStatuses(prev => ({ ...prev, [gameId]: 'completed' }));
      
      const response = await fetch(`/api/admin/games/${gameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isComplete: true })
      });

      if (response.ok) {
        console.log('Game completed successfully');
        // Update local state
        setGames(prev => {
          const newGames = { ...prev };
          Object.keys(newGames).forEach(matchId => {
            newGames[matchId] = newGames[matchId].map(game =>
              game.id === gameId ? { ...game, isComplete: true } : game
            );
          });
          return newGames;
        });
      } else {
        const errorData = await response.json();
        console.error('Failed to complete game:', errorData);
      }
    } catch (error) {
      console.error('Error completing game:', error);
    }
  };

  // Function to create tiebreaker
  const createTiebreaker = async (matchId: string) => {
    if (creatingTiebreakers.has(matchId)) return;
    
    try {
      setCreatingTiebreakers(prev => new Set([...prev, matchId]));
      
      const response = await fetch(`/api/admin/matches/${matchId}/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ createTiebreaker: true })
      });
      
      if (response.ok) {
        // Reload games for this match
        await loadGamesForMatch(matchId, true);
      } else {
        throw new Error('Failed to create tiebreaker');
      }
    } catch (error) {
      setErr(`Failed to create tiebreaker: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setCreatingTiebreakers(prev => {
        const newSet = new Set(prev);
        newSet.delete(matchId);
        return newSet;
      });
    }
  };

  // Function to check if any match in a round has started (game-level awareness)
  const hasAnyMatchStarted = useCallback((round: any) => {
    if (!round?.matches) return false;

    return round.matches.some((match: any) => {
      if (!match?.id) return false;

      // If the overall match is already marked as started or completed, stop here
      if (matchStatuses[match.id] === 'in_progress' || matchStatuses[match.id] === 'completed') {
        return true;
      }

      const matchGames = games[match.id] ?? match.games ?? [];

      return matchGames.some((game: any) => {
        if (!game?.id) return false;

        const status = gameStatuses[game.id];
        if (status === 'in_progress' || status === 'completed') {
          return true;
        }

        if (game.isComplete === true) return true;
        if (game.startedAt) return true;
        if (game.endedAt) return true;
        if (game.teamAScore != null || game.teamBScore != null) return true;

        return false;
      });
    });
  }, [games, gameStatuses, matchStatuses]);
  
  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);

  const captainSet = useMemo(()=> new Set(Object.keys(overview?.captainTeamIds ?? {})), [overview]);

  // Build tournament rows for captain functionality
  const captainTournamentRows: TournamentRow[] = useMemo(() => {
    const byTid = new Map<string, TournamentRow>();

    for (const team of (captainData.teams ?? [])) {
      const tid = team.tournamentId;
      const tname = team.tournament.name;

      // normalize bracket key
      const bKey = (team.bracketName || 'General').trim();

      // ensure row
      let row = byTid.get(tid);
      if (!row) {
        // derive ordered stops across all teams in this tournament
        const unionStopsMap = new Map<string, StopRowFromAPI>();
        for (const t2 of (captainData.teams ?? []).filter(x => x.tournamentId === tid)) {
          for (const s of t2.stops ?? []) unionStopsMap.set(s.stopId, s);
        }
        const unionStops = [...unionStopsMap.values()].sort((a, b) => {
          const as = a.startAt ? +new Date(a.startAt) : Number.MAX_SAFE_INTEGER;
          const bs = b.startAt ? +new Date(b.startAt) : Number.MAX_SAFE_INTEGER;
          return as - bs;
        });

        // date range
        const start = unionStops.reduce((min, s) => Math.min(min, s.startAt ? +new Date(s.startAt) : Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
        const end = unionStops.reduce((max, s) => Math.max(max, s.endAt ? +new Date(s.endAt) : (s.startAt ? +new Date(s.startAt) : 0)), 0);
        const dates = (start !== Number.MAX_SAFE_INTEGER && end !== 0)
          ? `${fmtDate(new Date(start).toISOString())} – ${fmtDate(new Date(end).toISOString())}`
          : '—';

        row = {
          tournamentId: tid,
          tournamentName: tname,
          dates,
          stops: unionStops.map(s => ({
            stopId: s.stopId,
            stopName: s.stopName,
            locationName: s.locationName ?? null,
            startAt: s.startAt ?? null,
            endAt: s.endAt ?? null,
            status: s.status ?? 'pending',
            gamesTotal: s.gamesTotal ?? 0,
            gamesStarted: s.gamesStarted ?? 0,
            gamesCompleted: s.gamesCompleted ?? 0,
          })),
          bracketTeams: new Map<string, TeamItem>(),
          bracketNames: [],
        };
        byTid.set(tid, row);
      }

      row.bracketTeams.set(bKey, team);
    }

    // finalize bracket name arrays
    for (const r of byTid.values()) {
      r.bracketNames = [...r.bracketTeams.keys()].sort((a, b) => a.localeCompare(b));
    }

    return [...byTid.values()].sort((a, b) => a.tournamentName.localeCompare(b.tournamentName));
  }, [captainData]);

  function label(p: PlayerLite) {
    const fn = (p.firstName ?? '').trim();
    const ln = (p.lastName ?? '').trim();
    const full = [fn, ln].filter(Boolean).join(' ');
    return full || (p.name ?? 'Unknown');
  }

  // Load user profile when authentication state changes
  useEffect(() => {
    if (userLoaded) {
      if (isSignedIn) {
        loadUserProfile();
      } else {
        // User not signed in, clear profile data
        setUserProfile(null);
        setMeId('');
        setNeedsProfileSetup(false);
        setOverview(null);
      }
    }
  }, [userLoaded, isSignedIn]);

  // Load players for "Act As" when user becomes App Admin
  useEffect(() => {
    if (userProfile?.isAppAdmin) {
      loadActAsPlayers();
    }
  }, [userProfile?.isAppAdmin]);

  // Initial loads (only when user is authenticated)
  useEffect(() => {
    if (!isSignedIn || !userLoaded) return;
    
    (async () => {
      try {
        clearMsg();
        // players list for dropdown
        const r = await fetch('/api/admin/players?flat=1');
        const arr = await r.json();
        const playersArr: PlayerLite[] = Array.isArray(arr) ? arr : (arr?.items ?? []);
        setPlayers(playersArr);

        // clubs for profile editing
        const rc = await fetch('/api/admin/clubs');
        const body = await rc.json();
        const clubsArr: Club[] = Array.isArray(body) ? body : (body?.items ?? []);
        setClubsAll(clubsArr);
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
  }, [isSignedIn, userLoaded]);

  // Load overview whenever meId changes
  useEffect(() => {
    if (!meId) return;
    (async () => {
      try {
        clearMsg();
        const ov = await fetch(`/api/players/${meId}/overview`).then(r => r.json());
        if (ov?.error) throw new Error(ov.error);
        setOverview(ov);
        // seed form
        const p = ov.player;
        const ctry = (p.country || 'Canada') as string;
        const sel: CountrySel = (ctry === 'Canada' || ctry === 'USA') ? (ctry as CountrySel) : 'Other';
        setCountrySel(sel);
        setCountryOther(sel === 'Other' ? ctry : '');
        setBirthday(ymdToDateString(p.birthdayYear ?? null, p.birthdayMonth ?? null, p.birthdayDay ?? null) || fortyYearsAgoISO());
        setForm({
          firstName: p.firstName || '',
          lastName: p.lastName || '',
          gender: p.gender,
          clubId: (p.clubId as any) || '',
          dupr: p.dupr != null ? String(p.dupr) : '',
          city: p.city || '',
          region: p.region || '',
          phone: p.phone || '',
          email: p.email || '',
          clubRating: p.clubRating || '',
          photo: p.photo || '',
        });
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId]);

  // Load captain data if player is a captain
  useEffect(() => {
    if (!meId || !captainSet.size) return;
    (async () => {
      try {
        console.log('Fetching captain teams for player:', meId);
        
        // Retry logic for intermittent 500 errors
        let captainResponse;
        let retries = 0;
        const maxRetries = 3;
        
        while (retries < maxRetries) {
          try {
            const response = await fetch(`/api/captain/${meId}/teams`);
            console.log('Captain teams response status:', response.status);
            
            if (response.status === 500 && retries < maxRetries - 1) {
              console.log(`Retrying captain teams fetch (attempt ${retries + 1}/${maxRetries})`);
              retries++;
              await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // Exponential backoff
              continue;
            }
            
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            captainResponse = await response.json();
            break;
          } catch (error) {
            if (retries < maxRetries - 1) {
              console.log(`Retrying captain teams fetch due to error (attempt ${retries + 1}/${maxRetries}):`, error);
              retries++;
              await new Promise(resolve => setTimeout(resolve, 1000 * retries));
            } else {
              throw error;
            }
          }
        }
        
        console.log('Captain teams data:', captainResponse);
        if (captainResponse?.error) throw new Error(captainResponse.error);
        setCaptainData(captainResponse);
        console.log('Captain teams loaded successfully');
      } catch (e) {
        console.error('Error loading captain teams:', e);
        // Handle error silently
      }
    })();
  }, [meId, captainSet.size]);

  // Load event manager data if player is an event manager
  useEffect(() => {
    if (!meId) return;
    (async () => {
      try {
        console.log('Fetching manager tournaments for player:', meId);
        
        // Retry logic for intermittent 500 errors
        let managerResponse;
        let retries = 0;
        const maxRetries = 3;
        
        while (retries < maxRetries) {
          try {
            const response = await fetch(`/api/manager/${meId}/tournaments`);
            console.log('Manager tournaments response status:', response.status);
            
            if (response.status === 500 && retries < maxRetries - 1) {
              console.log(`Retrying manager tournaments fetch (attempt ${retries + 1}/${maxRetries})`);
              retries++;
              await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // Exponential backoff
              continue;
            }
            
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            managerResponse = await response.json();
            break;
          } catch (error) {
            if (retries < maxRetries - 1) {
              console.log(`Retrying manager tournaments fetch due to error (attempt ${retries + 1}/${maxRetries}):`, error);
              retries++;
              await new Promise(resolve => setTimeout(resolve, 1000 * retries));
            } else {
              throw error;
            }
          }
        }
        
        console.log('Manager tournaments data:', managerResponse);
        if (managerResponse?.error) throw new Error(managerResponse.error);
        setEventManagerData(managerResponse.items || []);
        console.log('Manager tournaments loaded successfully');
      } catch (e) {
        console.error('Error loading manager tournaments:', e);
        // Handle error silently
      }
    })();
  }, [meId]);

  // Populate form when overview data loads
  useEffect(() => {
    if (overview?.player) {
      const player = overview.player;
      setForm({
        firstName: player.firstName || '',
        lastName: player.lastName || '',
        gender: player.gender || 'MALE',
        clubId: player.club?.id || '',
        dupr: player.dupr?.toString() || '',
        city: player.city || '',
        region: player.region || '',
        phone: player.phone || '',
        email: player.email || '',
        clubRating: '', // This will be populated from the API response
        photo: '', // This will be populated from the API response
      });
    }
  }, [overview]);

  // Handle tiebreaker creation when games are completed and tied
  useEffect(() => {
    const checkAndCreateTiebreakers = async () => {
      for (const [matchId, matchGames] of Object.entries(games)) {
        if (!matchGames || matchGames.length === 0) continue;
        
        const completedGames = matchGames.filter(g => g.slot !== 'TIEBREAKER' && g.isComplete);
        const teamAWins = completedGames.filter(g => g.teamAScore > g.teamBScore).length;
        const teamBWins = completedGames.filter(g => g.teamBScore > g.teamAScore).length;
        const needsTiebreaker = completedGames.length === 4 && teamAWins === 2 && teamBWins === 2;
        
        if (needsTiebreaker && !matchGames.find(g => g.slot === 'TIEBREAKER')) {
          try {
            const response = await fetch(`/api/admin/matches/${matchId}/games`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                games: [{
                  slot: 'TIEBREAKER',
                  teamAScore: null,
                  teamBScore: null
                }]
              })
            });
            
            if (response.ok) {
              // Reload games to get the new tiebreaker
              await loadGamesForMatch(matchId, true);
            }
          } catch (error) {
            console.error('Error creating tiebreaker:', error);
          }
        }
      }
    };
    
    checkAndCreateTiebreakers();
  }, [games]);

  function ymdToDateString(y?: number|null, m?: number|null, d?: number|null) {
    if (!y || !m || !d) return '';
    const mm = String(m).padStart(2,'0'); const dd = String(d).padStart(2,'0');
    return `${y}-${mm}-${dd}`;
  }

  async function saveProfile() {
    if (!isSignedIn) return;
    
    try {
      clearMsg();
      const country = countrySel === 'Other' ? (countryOther || '') : countrySel;
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        gender: form.gender,
        clubId: form.clubId,
        dupr: form.dupr,
        city: form.city,
        region: form.region,
        country,
        phone: form.phone,
        email: form.email,
        birthday, // YYYY-MM-DD
        clubRating: form.clubRating ? Number(form.clubRating) : null,
        photo: form.photo,
      };
      
      
      // Use the authentication-aware save function
      const success = await saveUserProfile(payload);
      if (success) {
        // refresh overview to reflect new info (age, club, etc.)
        const ov = await fetch(`/api/players/${meId}/overview`).then(x => x.json());
        setOverview(ov);
        setShowEdit(false);
      }
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  // Show loading state while authentication is loading
  if (!userLoaded) {
    return (
      <main className="p-6 max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted">Loading...</p>
          </div>
        </div>
      </main>
    );
  }

  // Show sign-in prompt if not authenticated
  if (!isSignedIn) {
    return (
      <main className="p-6 max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Welcome to Pickleball Tournaments</h1>
            <p className="text-muted mb-6">Please sign in to access your player profile and tournament information.</p>
            <SignInButton mode="modal">
              <button className="btn btn-primary">
                Sign In
              </button>
            </SignInButton>
          </div>
        </div>
      </main>
    );
  }

  // Show profile setup if user needs to create their player profile
  if (needsProfileSetup) {
    return (
      <main className="p-6 max-w-5xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Complete Your Profile</h1>
          <p className="text-muted mb-6">Please complete your player profile to access tournaments and team management.</p>
          <div className="max-w-md mx-auto">
            <ProfileSetupForm 
              user={user}
              clubs={clubsAll}
              onSave={saveUserProfile}
              loading={profileLoading}
            />
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-app">
      {/* Header */}
      <header className="bg-surface-1 border-b border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="text-2xl font-bold text-primary hover:text-primary-hover transition-colors">TournaVerse</Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/me" className="nav-link active">Player Dashboard</Link>
              {(userProfile?.isTournamentAdmin || userProfile?.isAppAdmin) && (
                <Link href="/admin" className="nav-link">Tournament Setup</Link>
              )}
              <Link href="/tournaments" className="nav-link">Scoreboard</Link>
              {userProfile?.isAppAdmin && (
                <Link href="/app-admin" className="nav-link text-secondary font-semibold">Admin</Link>
              )}
              <SignOutButton>
                <button className="btn btn-ghost hover:bg-surface-2 transition-colors">
                  Logout
                </button>
              </SignOutButton>
            </div>
          </div>
        </div>
      </header>

      {/* Banner Section */}
      <div className="bg-surface-1 border-b border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-primary">
              Welcome {userProfile?.firstName || user?.firstName || 'User'}
            </h1>
            {userProfile?.isAppAdmin && (
              <div className="flex items-center space-x-2">
                <label htmlFor="act-as-player" className="text-sm text-muted">Act As:</label>
                <select
                  id="act-as-player"
                  className="input text-sm"
                  value={selectedActAsPlayer}
                  onChange={(e) => {
                    setSelectedActAsPlayer(e.target.value);
                    handleActAs(e.target.value);
                  }}
                >
                  <option value="">Select player</option>
                  <option value="reset">Reset to original user</option>
                  {actAsPlayers.map(player => (
                    <option key={player.id} value={player.id}>
                      {player.firstName} {player.lastName}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <p className="text-muted mt-2">Manage your profile, tournaments, and team participation</p>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">


      {err && <div className="border border-error bg-error/20 text-error p-3 rounded">{err}</div>}
      {info && <div className="border border-success bg-success/20 text-success p-3 rounded">{info}</div>}


      {/* Tab Navigation */}
      <div className="border-b border-subtle">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('tournaments')}
            className={`tab-button ${
              activeTab === 'tournaments' ? 'active' : ''
            }`}
          >
            Tournaments
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`tab-button ${
              activeTab === 'profile' ? 'active' : ''
            }`}
          >
            Profile
          </button>
          {captainSet.size > 0 && (
            <button
              onClick={() => setActiveTab('rosters')}
              className={`tab-button ${
                activeTab === 'rosters' ? 'active' : ''
              }`}
            >
              Rosters
            </button>
          )}
          {eventManagerData.length > 0 && (
            <button
              onClick={() => setActiveTab('manage')}
              className={`tab-button ${
                activeTab === 'manage' ? 'active' : ''
              }`}
            >
              Manage
            </button>
          )}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'profile' && (
          <section className="space-y-6">
        <div className="flex items-center justify-end">
          <button className="btn btn-ghost text-sm" onClick={() => setShowEdit(s => !s)}>
                {showEdit ? 'Cancel' : 'Edit Profile'}
          </button>
        </div>

        {overview && (
              <div className="space-y-6">
                {/* First Row: Name */}
                <div className="text-center">
                  {showEdit ? (
                    <div className="flex gap-4 justify-center">
                      <div>
                        <input
                          type="text"
                          value={form.firstName}
                          onChange={(e) => setForm(f => ({ ...f, firstName: e.target.value }))}
                          placeholder="First Name"
                          className="text-2xl font-bold text-center border-0 border-b-2 border-subtle focus:outline-none focus:border-secondary bg-transparent text-primary placeholder-muted"
                        />
                        <label className="block text-xs text-muted mt-1">First Name</label>
                      </div>
                      <div>
                        <input
                          type="text"
                          value={form.lastName}
                          onChange={(e) => setForm(f => ({ ...f, lastName: e.target.value }))}
                          placeholder="Last Name"
                          className="text-2xl font-bold text-center border-0 border-b-2 border-subtle focus:outline-none focus:border-secondary bg-transparent text-primary placeholder-muted"
                        />
                        <label className="block text-xs text-muted mt-1">Last Name</label>
                      </div>
                    </div>
                  ) : (
                    <h2 className="text-3xl font-bold text-primary">
                      {overview.player.firstName && overview.player.lastName 
                        ? `${overview.player.firstName} ${overview.player.lastName}`
                        : overview.player.firstName || overview.player.lastName || 'Name Not Provided'
                      }
                    </h2>
                  )}
                </div>

                {/* Second Row: Three Columns */}
                <div className="grid grid-cols-3 gap-8">
                  {/* First Column: Photo */}
                  <div className="text-center">
                    <div className="w-32 h-40 bg-surface-2 rounded border-2 border-dashed border-subtle flex items-center justify-center overflow-hidden mx-auto">
                      {form.photo ? (
                        <img src={form.photo} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-muted text-sm">No Photo</span>
                      )}
                    </div>
                    {showEdit && (
                      <div className="mt-3">
                        <label className="block">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  const img = new Image();
                                  img.onload = () => {
                                    // Create canvas for cropping to 200x300 (portrait)
                                    const canvas = document.createElement('canvas');
                                    const ctx = canvas.getContext('2d');
                                    canvas.width = 200;
                                    canvas.height = 300;
                                    
                                    // Calculate crop dimensions to maintain aspect ratio
                                    const aspectRatio = img.width / img.height;
                                    const targetAspectRatio = 200 / 300;
                                    
                                    let sourceX = 0, sourceY = 0, sourceWidth = img.width, sourceHeight = img.height;
                                    
                                    if (aspectRatio > targetAspectRatio) {
                                      // Image is wider, crop width
                                      sourceWidth = img.height * targetAspectRatio;
                                      sourceX = (img.width - sourceWidth) / 2;
                                    } else {
                                      // Image is taller, crop height
                                      sourceHeight = img.width / targetAspectRatio;
                                      sourceY = (img.height - sourceHeight) / 2;
                                    }
                                    
                                    ctx?.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, 200, 300);
                                    const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                                    setForm(f => ({ ...f, photo: croppedDataUrl }));
                                  };
                                  img.src = event.target?.result as string;
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                          <span className="text-xs text-secondary hover:text-secondary-hover cursor-pointer underline">
                            {form.photo ? 'Change Photo' : 'Choose File'}
                          </span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Second Column: Sex, Age, Primary Club, Club Rating, DUPR */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="w-20 text-sm font-medium text-muted">Sex:</label>
                      {showEdit ? (
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="gender"
                              value="MALE"
                              checked={form.gender === 'MALE'}
                              onChange={(e) => setForm(f => ({ ...f, gender: e.target.value as 'MALE' | 'FEMALE' }))}
                              className="text-secondary"
                            />
                            <span className="text-sm text-muted">Male</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="gender"
                              value="FEMALE"
                              checked={form.gender === 'FEMALE'}
                              onChange={(e) => setForm(f => ({ ...f, gender: e.target.value as 'MALE' | 'FEMALE' }))}
                              className="text-secondary"
                            />
                            <span className="text-sm text-muted">Female</span>
                          </label>
                        </div>
                      ) : (
                        <span className="text-muted">{overview.player.gender || 'Not provided'}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="w-20 text-sm font-medium text-muted">Age:</label>
                      <span className="text-muted">{overview.player.age ? `${overview.player.age} years old` : 'Not calculated'}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="w-20 text-sm font-medium text-muted">Club:</label>
                      {showEdit ? (
                        <select
                          value={form.clubId || ''}
                          onChange={(e) => setForm(f => ({ ...f, clubId: e.target.value as Id }))}
                          className="input"
                        >
                          <option value="">Select Club</option>
                          {(Array.isArray(clubsAll) ? clubsAll : []).map(c => (
                            <option key={c.id} value={c.id}>{c.name}{c.city ? ` (${c.city})` : ''}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-muted">{overview.player.club?.name || 'Not provided'}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="w-20 text-sm font-medium text-muted">Rating:</label>
                      {showEdit ? (
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="10"
                          value={form.clubRating}
                          onChange={(e) => setForm(f => ({ ...f, clubRating: e.target.value }))}
                          className="input"
                        />
                      ) : (
                        <span className="text-muted">{form.clubRating || 'Not provided'}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="w-20 text-sm font-medium text-muted">DUPR:</label>
                      {showEdit ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="8"
                          value={form.dupr}
                          onChange={(e) => setForm(f => ({ ...f, dupr: e.target.value }))}
                          className="input"
                        />
                      ) : (
                        <span className="text-muted">{overview.player.dupr || 'Not provided'}</span>
                      )}
                    </div>
                  </div>

                  {/* Third Column: Address and Contact */}
                  <div className="space-y-3">
                    {/* Address Section */}
                    {!showEdit ? (
                      <div className="flex items-center gap-3">
                        <label className="w-20 text-sm font-medium text-muted">Address:</label>
                        <span className="text-muted">
                          {[
                            overview.player.city,
                            overview.player.region,
                            overview.player.country
                          ].filter(Boolean).join(', ') || 'Not provided'}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <label className="w-20 text-sm font-medium text-muted">City:</label>
                          <input
                            type="text"
                            value={form.city}
                            onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))}
                            className="input"
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="w-20 text-sm font-medium text-muted">Province/State:</label>
                          <input
                            type="text"
                            value={form.region}
                            onChange={(e) => setForm(f => ({ ...f, region: e.target.value }))}
                            className="input"
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="w-20 text-sm font-medium text-muted">Country:</label>
                          <div className="flex-1">
                            <select
                              value={countrySel}
                              onChange={(e) => setCountrySel(e.target.value as CountrySel)}
                              className="input"
                            >
                              <option value="">Select Country</option>
                              <option value="Canada">Canada</option>
                              <option value="USA">USA</option>
                              <option value="Other">Other</option>
                            </select>
                            {countrySel === 'Other' && (
                              <input
                                type="text"
                                value={countryOther}
                                onChange={(e) => setCountryOther(e.target.value)}
                                placeholder="Enter country"
                                className="w-full mt-2 px-3 py-2 border border-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Contact Section */}
                    <div className="flex items-center gap-3">
                      <label className="w-20 text-sm font-medium text-muted">Phone:</label>
                      {showEdit ? (
                        <input
                          type="tel"
                          value={form.phone}
                          onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                          className="input"
                        />
                      ) : (
                        <span className="text-muted">{overview.player.phone || 'Not provided'}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="w-20 text-sm font-medium text-muted">Email:</label>
                      {showEdit ? (
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                          className="input"
                        />
                      ) : (
                        <span className="text-muted">{overview.player.email || 'Not provided'}</span>
                      )}
                    </div>
                  </div>
                </div>
                
                {showEdit && (
                  <div className="flex gap-2 justify-end">
                    <button
                      className="btn btn-primary"
                      onClick={saveProfile}
                    >
                      Save Changes
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => setShowEdit(false)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
      </section>
        )}

        {activeTab === 'tournaments' && (
          <TournamentTab
            userProfile={userProfile}
            assignments={overview?.assignments ?? []}
            captainSet={captainSet}
            onError={(m) => setErr(m)}
            onInfo={(m) => setInfo(m)}
          />
        )}

        {activeTab === 'rosters' && captainSet.size > 0 && (
          <RostersTab
            captainTournamentRows={captainTournamentRows}
            activeTournamentId={activeTournamentId}
            setActiveTournamentId={setActiveTournamentId}
            label={label}
            onSaved={() => setInfo('Rosters saved!')}
            onError={(m) => setErr(m)}
          />
        )}


        {activeTab === 'manage' && eventManagerData.length > 0 && (
          <EventManagerTab
            tournaments={eventManagerData}
            onError={(m) => setErr(m)}
            onInfo={(m) => setInfo(m)}
            editingLineup={editingLineup}
            setEditingLineup={setEditingLineup}
            editingMatch={editingMatch}
            setEditingMatch={setEditingMatch}
            lineups={lineups}
            setLineups={setLineups}
            teamRosters={teamRosters}
            fetchTeamRoster={fetchTeamRoster}
            isDragging={isDragging || false}
            setIsDragging={setIsDragging}
            matchStatuses={matchStatuses}
            setMatchStatuses={setMatchStatuses}
            gameStatuses={gameStatuses}
            setGameStatuses={setGameStatuses}
            games={games}
            setGames={setGames}
            courtNumbers={courtNumbers}
            setCourtNumbers={setCourtNumbers}
            creatingTiebreakers={creatingTiebreakers}
            setCreatingTiebreakers={setCreatingTiebreakers}
            startMatch={startMatch}
            startGame={startGame}
            endGame={endGame}
            completeMatch={completeMatch}
            loadGamesForMatch={loadGamesForMatch}
            updateGameScore={updateGameScore}
            updateGameCourtNumber={updateGameCourtNumber}
            completeGame={completeGame}
            createTiebreaker={createTiebreaker}
            hasAnyMatchStarted={hasAnyMatchStarted}
          />
        )}
      </div>

      </main>
    </div>
  );
}

/* ================= Rosters Tab Component ================= */

function RostersTab({
  captainTournamentRows,
  activeTournamentId,
  setActiveTournamentId,
  label,
  onSaved,
  onError,
}: {
  captainTournamentRows: TournamentRow[];
  activeTournamentId: Id | null;
  setActiveTournamentId: (id: Id | null) => void;
  label: (p: PlayerLite) => string;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-primary">Manage Rosters by Bracket</h2>
        <div />
      </div>

      <div className="space-y-5">
        {captainTournamentRows.length === 0 && (
          <div className="rounded-xl border border-dashed border-subtle bg-surface-1/70 px-6 py-10 text-center text-muted">
            No captain assignments yet.
          </div>
        )}

        {captainTournamentRows.map((row) => {
          const firstTeam = Array.from(row.bracketTeams.values())[0];
          const clubName = firstTeam?.club?.name || 'Unassigned Club';
          const statusCounts = row.stops.reduce<Record<StopStatus, number>>((acc, stop) => {
            acc[stop.status] = (acc[stop.status] ?? 0) + 1;
            return acc;
          }, { pending: 0, in_progress: 0, completed: 0 });
          const isActive = activeTournamentId === row.tournamentId;

          return (
            <div
              key={row.tournamentId}
              className={`rounded-2xl border border-subtle/80 bg-surface-1 shadow-sm transition-colors ${
                isActive ? 'ring-1 ring-secondary/40' : 'hover:border-secondary/60'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-6 px-6 py-5 bg-surface-2/40">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      className="text-left text-lg font-semibold text-secondary hover:text-secondary-hover"
                      onClick={() => setActiveTournamentId(isActive ? null : row.tournamentId)}
                    >
                      {row.tournamentName}
                    </button>
                    <span className="rounded-full bg-surface-1 px-2 py-0.5 text-xs font-medium text-muted">
                      {row.dates}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs text-muted">
                    <span className="flex items-center gap-1">
                      <span className="font-medium text-primary">Club:</span>
                      {clubName}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="font-medium text-primary">Brackets:</span>
                      {row.bracketNames.length ? row.bracketNames.join(', ') : 'General'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                    {(['pending', 'in_progress', 'completed'] as StopStatus[]).map((status) => (
                      statusCounts[status] ? (
                        <span key={status} className="flex items-center gap-2">
                          <StopStatusBadge status={status} />
                          <span>
                            {statusCounts[status]} stop{statusCounts[status] === 1 ? '' : 's'}
                          </span>
                        </span>
                      ) : null
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setActiveTournamentId(isActive ? null : row.tournamentId)}
                  className="btn btn-secondary whitespace-nowrap"
                >
                  {isActive ? 'Hide Rosters' : 'Manage Rosters'}
                </button>
              </div>

              {isActive && (
                <div className="px-6 py-5">
                  <CaptainRosterEditor
                    tournamentId={row.tournamentId}
                    tournamentRow={row}
                    onClose={() => setActiveTournamentId(null)}
                    onSaved={onSaved}
                    onError={onError}
                    label={label}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted">
        Limits are enforced <em>per bracket</em>. A player cannot be rostered in multiple brackets within the same tournament.
      </p>
    </section>
  );
}

/* ================= Captain Roster Editor Component ================= */

function CaptainRosterEditor({
  tournamentId,
  tournamentRow,
  onClose,
  onSaved,
  onError,
  label,
}: {
  tournamentId: Id;
  tournamentRow: TournamentRow;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
  label: (p: PlayerLite) => string;
}) {
  const [busy, setBusy] = useState(false);
  const [rosters, setRosters] = useState<Record<string, Record<string, PlayerLite[]>>>({});

  useEffect(() => {
    const seed: Record<string, Record<string, PlayerLite[]>> = {};
    for (const s of tournamentRow.stops) {
      seed[s.stopId] = {};
      for (const b of tournamentRow.bracketNames) {
        const team = tournamentRow.bracketTeams.get(b);
        const apiStop = team?.stops.find(x => x.stopId === s.stopId);
        seed[s.stopId][b] = (apiStop?.stopRoster ?? []).slice();
      }
    }
    setRosters(seed);
  }, [tournamentRow]);

  function setStopBracketRoster(stopId: Id, bracketKey: string, next: PlayerLite[]) {
    setRosters(prev => ({
      ...prev,
      [stopId]: { ...(prev[stopId] ?? {}), [bracketKey]: next },
    }));
  }

  function copyFromPreviousStop(prevStopId: Id, targetStopId: Id) {
    const nextForCurr: Record<string, PlayerLite[]> = {};
    for (const b of tournamentRow.bracketNames) {
      nextForCurr[b] = (rosters[prevStopId]?.[b] ?? []).map(player => ({ ...player }));
    }
    setRosters(prevAll => ({ ...prevAll, [targetStopId]: nextForCurr }));
  }

  function bracketLimitFor(bracketKey: string): number | null {
    const team = tournamentRow.bracketTeams.get(bracketKey);
    if (!team) return null;
    return team.bracketLimit ?? team.tournament.maxTeamSize ?? 8;
  }

  function canAddToBracket(bracketKey: string, playerId: string, stopId: string): boolean {
    const limit = bracketLimitFor(bracketKey);
    if (!limit) return true;

    const currentStopRoster = rosters[stopId]?.[bracketKey] ?? [];
    if (currentStopRoster.some(p => p.id === playerId)) return true;

    return currentStopRoster.length + 1 <= limit;
  }

  async function saveAll() {
    setBusy(true);
    try {
      for (const s of tournamentRow.stops) {
        if (s.status !== 'pending') continue;
        for (const b of tournamentRow.bracketNames) {
          const team = tournamentRow.bracketTeams.get(b);
          if (!team) continue;
          const list = rosters[s.stopId]?.[b] ?? [];

          const limit = bracketLimitFor(b);
          if (limit && list.length > limit) {
            throw new Error(`Bracket "${b}" exceeds its limit for this stop (${list.length}/${limit})`);
          }

          const res = await fetch(`/api/captain/team/${team.id}/stops/${s.stopId}/roster`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerIds: list.map(p => p.id) }),
          });
          const j = await res.json();
          if (!res.ok || j?.error) {
            throw new Error(j?.error?.message ?? j?.error ?? 'Save failed');
          }
        }
      }
      onSaved();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const hasPendingStops = tournamentRow.stops.some(stop => stop.status === 'pending');
  const firstPending = tournamentRow.stops.find(stop => stop.status === 'pending');
  const [activeStopId, setActiveStopId] = useState<string>(firstPending?.stopId ?? tournamentRow.stops[0]?.stopId ?? '');

  useEffect(() => {
    const currentIds = new Set(tournamentRow.stops.map(stop => stop.stopId));
    if (!currentIds.has(activeStopId)) {
      const nextPending = tournamentRow.stops.find(stop => stop.status === 'pending');
      setActiveStopId(nextPending?.stopId ?? tournamentRow.stops[0]?.stopId ?? '');
    }
  }, [tournamentRow, activeStopId]);

  const activeStop = tournamentRow.stops.find(stop => stop.stopId === activeStopId) ?? tournamentRow.stops[0];
  if (!activeStop) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle pb-4">
          <div />
          <div className="flex items-center gap-2">
            <button className="btn btn-primary btn-sm" disabled>
              Save Pending Rosters
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
          </div>
        </div>
        <div className="rounded-2xl border border-subtle bg-surface-2/40 px-5 py-6 text-center text-muted">
          No stops available for this tournament.
        </div>
      </div>
    );
  }

  const activeIndex = tournamentRow.stops.findIndex(stop => stop.stopId === activeStop.stopId);
  const previousStop = activeIndex > 0 ? tournamentRow.stops[activeIndex - 1] : null;
  const isEditable = activeStop.status === 'pending';
  const excludeIdsAcrossStop = Object.values(rosters[activeStop.stopId] ?? {}).flat().map(p => p.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle pb-4">
        <div className="overflow-x-auto">
          <div className="flex gap-2">
            {tournamentRow.stops.map(stop => (
              <button
                key={stop.stopId}
                onClick={() => setActiveStopId(stop.stopId)}
                className={`whitespace-nowrap rounded-full border px-3 py-1 text-sm transition ${
                  stop.stopId === activeStop.stopId
                    ? 'border-secondary bg-secondary/20 text-secondary'
                    : 'border-subtle bg-surface-1 hover:border-secondary/40'
                }`}
              >
                <span className="font-medium">{stop.stopName}</span>
                <span className="mx-2 text-muted">|</span>
                <StopStatusBadge status={stop.status} />
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-primary btn-sm disabled:opacity-60"
            onClick={saveAll}
            disabled={!hasPendingStops || busy}
          >
            {busy ? 'Saving…' : 'Save Pending Rosters'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>

      <section className={`rounded-2xl border border-subtle/80 ${isEditable ? 'bg-surface-2/40' : 'bg-surface-2/20'}`}>
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-base font-semibold text-primary">{activeStop.stopName}</span>
              <StopStatusBadge status={activeStop.status} />
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted">
              {activeStop.locationName && <span>{activeStop.locationName}</span>}
              <span>{formatStopDateRange(activeStop.startAt, activeStop.endAt)}</span>
              {activeStop.gamesTotal > 0 && (
                <span>{activeStop.gamesCompleted}/{activeStop.gamesTotal} games complete</span>
              )}
            </div>
          </div>

          {isEditable && previousStop && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => copyFromPreviousStop(previousStop.stopId, activeStop.stopId)}
              title="Copy rosters from previous stop"
            >
              Copy previous stop
            </button>
          )}
        </div>

        <div className={`border-t border-subtle px-5 py-4 ${isEditable ? 'bg-surface-1' : 'bg-surface-1/80'}`}>
          {isEditable ? (
            <div className="grid md:grid-cols-2 gap-4">
              {tournamentRow.bracketNames.map((bKey) => {
                const team = tournamentRow.bracketTeams.get(bKey)!;
                const list = rosters[activeStop.stopId]?.[bKey] ?? [];
                const limit = bracketLimitFor(bKey);

                return (
                  <BracketRosterEditor
                    key={`${activeStop.stopId}:${bKey}`}
                    bracketName={bKey}
                    limit={limit}
                    currentCount={list.length}
                    teamId={team.id}
                    tournamentId={tournamentId}
                    list={list}
                    onChange={(next) => setStopBracketRoster(activeStop.stopId, bKey, next)}
                    canAdd={(playerId) => canAddToBracket(bKey, playerId, activeStop.stopId)}
                    excludeIdsAcrossStop={excludeIdsAcrossStop}
                    label={label}
                  />
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {tournamentRow.bracketNames.map((bKey) => {
                const list = rosters[activeStop.stopId]?.[bKey] ?? [];
                return (
                  <div key={`${activeStop.stopId}:${bKey}`} className="rounded-lg border border-subtle bg-surface-1 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-sm font-semibold text-secondary">{bKey}</h5>
                      <span className="text-xs text-muted">{list.length} player{list.length === 1 ? '' : 's'}</span>
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-muted">
                      {list.length > 0 ? (
                        list.map(player => (
                          <li key={player.id}>{label(player)}</li>
                        ))
                      ) : (
                        <li className="text-xs italic text-muted">No players assigned.</li>
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/* =============== Per-bracket editor (typeahead + list) =============== */

function BracketRosterEditor({
  bracketName,
  limit,
  currentCount,
  teamId,
  tournamentId,
  list,
  onChange,
  canAdd,
  excludeIdsAcrossStop,
  label,
}: {
  bracketName: string;
  limit: number | null;
  currentCount: number;
  teamId: Id;
  tournamentId: Id;
  list: PlayerLite[];
  onChange: (next: PlayerLite[]) => void;
  canAdd: (playerId: string) => boolean;
  excludeIdsAcrossStop: string[];
  label: (p: PlayerLite) => string;
}) {
  const [term, setTerm] = useState('');
  const [options, setOptions] = useState<PlayerLite[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  function add(p: PlayerLite) {
    if (list.some((x) => x.id === p.id)) return;
    if (excludeIdsAcrossStop.includes(p.id)) return;
    if (!canAdd(p.id)) return;
    onChange([...list, p]);
  }
  function remove(id: string) {
    onChange(list.filter((p) => p.id !== id));
  }

  // Tournament/team-aware search
  useEffect(() => {
    if (term.trim().length < 3) {
      setOptions([]); setOpen(false); return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const url = new URL('/api/admin/players/search', window.location.origin);
        url.searchParams.set('term', term.trim());
        url.searchParams.set('tournamentId', String(tournamentId));
        url.searchParams.set('teamId', String(teamId));
        if (excludeIdsAcrossStop.length) url.searchParams.set('excludeIds', excludeIdsAcrossStop.join(','));
        const res = await fetch(url.toString());
        const j = await res.json();
        const items: PlayerLite[] = (j.items ?? j.data?.items ?? []).map((p: any) => ({
          id: p.id, firstName: p.firstName, lastName: p.lastName, name: p.name, gender: p.gender,
          dupr: (p.dupr ?? null) as number | null, age: (p.age ?? null) as number | null,
        }));
        if (!cancelled) { setOptions(items); setOpen(true); }
      } catch {
        if (!cancelled) { setOptions([]); setOpen(false); }
      } finally { if (!cancelled) setLoading(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [term, teamId, tournamentId, excludeIdsAcrossStop]);

  return (
    <div className="rounded-lg border border-subtle bg-surface-1 px-4 py-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h5 className="text-sm font-semibold text-secondary">{bracketName}</h5>
          <p className="text-xs text-muted">
            Players {currentCount}{limit ? ` / ${limit}` : ''}
          </p>
        </div>
        {typeof limit === 'number' && (
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">Cap {limit}</span>
        )}
      </div>

      <div className="relative">
        <input
          className="input"
          placeholder="Search players (min 3 chars)"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onFocus={() => { if (options.length) setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
        />
        {open && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-subtle bg-surface-1 shadow-lg">
            {options.length > 0 ? (
              <ul>
                {options.map((opt) => (
                  <li
                    key={opt.id}
                    className="px-3 py-2 text-sm text-primary hover:bg-surface-2 cursor-pointer"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { add(opt); setTerm(''); setOptions([]); setOpen(false); }}
                  >
                    <div className="font-medium">{label(opt)}</div>
                    <div className="text-xs text-muted">
                      {opt.gender} • {opt.dupr ?? '—'} • {opt.age ?? '—'}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-3 py-2 text-sm text-muted">
                {loading ? 'Searching…' : 'No results yet'}
              </div>
            )}
          </div>
        )}
      </div>

      <ul className="space-y-2">
        {list.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-3 rounded border border-subtle/60 bg-surface-2 px-3 py-2"
          >
            <div className="text-sm text-primary">
              {label(p)}
              <span className="ml-2 text-xs text-muted">
                • {p.gender} • {p.dupr ?? '—'} • {p.age ?? '—'}
              </span>
            </div>
            <button
              className="btn btn-ghost btn-xs text-error"
              title="Remove player from this stop"
              onClick={() => remove(p.id)}
            >
              Remove
            </button>
          </li>
        ))}
        {list.length === 0 && (
          <li className="text-xs italic text-muted">No players assigned yet.</li>
        )}
      </ul>
    </div>
  );
}

/* ================= Game Score Box Component ================= */

function GameScoreBox({
  game,
  match,
  gameStatuses,
  lineups,
  startGame,
  endGame,
  updateGameScore,
  updateGameCourtNumber,
}: {
  game: any;
  match: any;
  gameStatuses: Record<string, 'not_started' | 'in_progress' | 'completed'>;
  lineups: Record<string, Record<string, any[]>>;
  startGame: (gameId: string) => Promise<void>;
  endGame: (gameId: string) => Promise<void>;
  updateGameScore: (gameId: string, teamAScore: number | null, teamBScore: number | null) => Promise<void>;
  updateGameCourtNumber: (gameId: string, courtNumber: string) => Promise<void>;
}) {
  const gameStatus = gameStatuses[game.id] || 'not_started';
  const isCompleted = gameStatus === 'completed';
  const isInProgress = gameStatus === 'in_progress';
  
  const getGameTitle = () => {
    switch (game.slot) {
      case 'MENS_DOUBLES': return "Men's Doubles";
      case 'WOMENS_DOUBLES': return "Women's Doubles";
      case 'MIXED_1': return "Mixed Doubles 1";
      case 'MIXED_2': return "Mixed Doubles 2";
      case 'TIEBREAKER': return "Tiebreaker";
      default: return game.slot;
    }
  };

  const getTeamALineup = () => {
    if (game.teamALineup && Array.isArray(game.teamALineup)) {
      return game.teamALineup.map((player: any) => player.name).join(' & ');
    }
    // For tiebreakers, show actual team names
    if (game.slot === 'TIEBREAKER' && match) {
      return match.teamA?.name || 'Team A';
    }
    // Generate lineup from team roster based on game slot and lineup positions
    if (match && match.teamA && lineups[match.id]) {
      const teamALineup = lineups[match.id][match.teamA.id] || [];
      // Lineup structure: [Man1, Man2, Woman1, Woman2]
      const man1 = teamALineup[0];
      const man2 = teamALineup[1];
      const woman1 = teamALineup[2];
      const woman2 = teamALineup[3];
      
      switch (game.slot) {
        case 'MENS_DOUBLES':
          return man1 && man2 ? `${man1.name} &\n${man2.name}` : 'Team A';
        case 'WOMENS_DOUBLES':
          return woman1 && woman2 ? `${woman1.name} &\n${woman2.name}` : 'Team A';
        case 'MIXED_1':
          return man1 && woman1 ? `${man1.name} &\n${woman1.name}` : 'Team A';
        case 'MIXED_2':
          return man2 && woman2 ? `${man2.name} &\n${woman2.name}` : 'Team A';
        default:
          return 'Team A';
      }
    }
    return 'Team A';
  };

  const getTeamBLineup = () => {
    if (game.teamBLineup && Array.isArray(game.teamBLineup)) {
      return game.teamBLineup.map((player: any) => player.name).join(' & ');
    }
    // For tiebreakers, show actual team names
    if (game.slot === 'TIEBREAKER' && match) {
      return match.teamB?.name || 'Team B';
    }
    // Generate lineup from team roster based on game slot and lineup positions
    if (match && match.teamB && lineups[match.id]) {
      const teamBLineup = lineups[match.id][match.teamB.id] || [];
      // Lineup structure: [Man1, Man2, Woman1, Woman2]
      const man1 = teamBLineup[0];
      const man2 = teamBLineup[1];
      const woman1 = teamBLineup[2];
      const woman2 = teamBLineup[3];
      
      switch (game.slot) {
        case 'MENS_DOUBLES':
          return man1 && man2 ? `${man1.name} &\n${man2.name}` : 'Team B';
        case 'WOMENS_DOUBLES':
          return woman1 && woman2 ? `${woman1.name} &\n${woman2.name}` : 'Team B';
        case 'MIXED_1':
          return man1 && woman1 ? `${man1.name} &\n${woman1.name}` : 'Team B';
        case 'MIXED_2':
          return man2 && woman2 ? `${man2.name} &\n${woman2.name}` : 'Team B';
        default:
          return 'Team B';
      }
    }
    return 'Team B';
  };

  const teamAScore = game.teamAScore || 0;
  const teamBScore = game.teamBScore || 0;
  const teamAWon = teamAScore > teamBScore;
  const teamBWon = teamBScore > teamAScore;

  return (
    <div className="p-1.5 bg-surface-1 border rounded space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-muted">
          {getGameTitle()}
        </div>
        <div className="flex items-center gap-1.5">
          {!isCompleted && (
            <>
              <label className="text-xs font-medium text-muted">Court #:</label>
              <input
                type="text"
                className="w-10 px-1 py-0.5 text-xs border rounded text-center"
                value={game.courtNumber || ''}
                onChange={(e) => updateGameCourtNumber(game.id, e.target.value)}
                placeholder="1"
                disabled={isCompleted}
              />
            </>
          )}
          {gameStatus !== 'completed' && (
            <button
              className={`btn btn-primary text-xs ${
                gameStatus === 'not_started' 
                  ? 'bg-success hover:bg-success-hover' 
                  : 'bg-error hover:bg-error-hover'
              } disabled:opacity-50`}
              onClick={() => {
                if (gameStatus === 'not_started') {
                  startGame(game.id);
                } else if (gameStatus === 'in_progress') {
                  endGame(game.id);
                }
              }}
            >
              {gameStatus === 'not_started' ? 'Start Game' : 'End Game'}
            </button>
          )}
        </div>
      </div>

      {isInProgress && (
        <div className="text-xs text-yellow-600 font-medium text-center">
          Game in Progress
        </div>
      )}

      <div className="flex items-center justify-between text-xs">
        {/* Team A */}
        <div className={`font-medium text-muted whitespace-pre-line ${
          isCompleted && teamAWon ? 'font-bold text-green-800' : ''
        }`}>
          {getTeamALineup()}
        </div>
        
        {/* Score A */}
        {isCompleted ? (
          <div className={`w-8 text-center ${
            teamAWon ? 'text-green-800 font-bold' : 'text-muted'
          }`}>
            {teamAScore}
          </div>
        ) : isInProgress ? (
          <input
            type="number"
            min="0"
            max="99"
            className="w-8 px-1 py-0.5 text-xs border rounded text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            value={teamAScore || ''}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 99)) {
                updateGameScore(game.id, value ? parseInt(value) : null, teamBScore);
              }
            }}
            placeholder="0"
            disabled={isCompleted}
          />
        ) : (
          <div className="w-8 text-center text-muted">-</div>
        )}
        
        {/* VS */}
        <div className="text-muted font-medium">vs</div>
        
        {/* Score B */}
        {isCompleted ? (
          <div className={`w-8 text-center ${
            teamBWon ? 'text-green-800 font-bold' : 'text-muted'
          }`}>
            {teamBScore}
          </div>
        ) : isInProgress ? (
          <input
            type="number"
            min="0"
            max="99"
            className="w-8 px-1 py-0.5 text-xs border rounded text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            value={teamBScore || ''}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 99)) {
                updateGameScore(game.id, teamAScore, value ? parseInt(value) : null);
              }
            }}
            placeholder="0"
            disabled={isCompleted}
          />
        ) : (
          <div className="w-8 text-center text-muted">-</div>
        )}
        
        {/* Team B */}
        <div className={`font-medium text-muted whitespace-pre-line ${
          isCompleted && teamBWon ? 'font-bold text-green-800' : ''
        }`}>
          {getTeamBLineup()}
        </div>
      </div>
    </div>
  );
}

/* ================= Event Manager Tab Component ================= */

function EventManagerTab({
  tournaments,
  onError,
  onInfo,
  editingLineup,
  setEditingLineup,
  editingMatch,
  setEditingMatch,
  lineups,
  setLineups,
  teamRosters,
  fetchTeamRoster,
  isDragging,
  setIsDragging,
  matchStatuses,
  setMatchStatuses,
  gameStatuses,
  setGameStatuses,
  games,
  setGames,
  courtNumbers,
  setCourtNumbers,
  creatingTiebreakers,
  setCreatingTiebreakers,
  startMatch,
  startGame,
  endGame,
  completeMatch,
  loadGamesForMatch,
  updateGameScore,
  updateGameCourtNumber,
  completeGame,
  createTiebreaker,
  hasAnyMatchStarted,
}: {
  tournaments: EventManagerTournament[];
  onError: (m: string) => void;
  onInfo: (m: string) => void;
  editingLineup: { matchId: string; teamId: string } | null;
  setEditingLineup: (value: { matchId: string; teamId: string } | null) => void;
  editingMatch: string | null;
  setEditingMatch: (value: string | null) => void;
  lineups: Record<string, Record<string, PlayerLite[]>>;
  setLineups: (value: Record<string, Record<string, PlayerLite[]>> | ((prev: Record<string, Record<string, PlayerLite[]>>) => Record<string, Record<string, PlayerLite[]>>)) => void;
  teamRosters: Record<string, PlayerLite[]>;
  fetchTeamRoster: (teamId: string) => Promise<PlayerLite[]>;
  isDragging: boolean;
  setIsDragging: (value: boolean) => void;
  matchStatuses: Record<string, 'not_started' | 'in_progress' | 'completed'>;
  setMatchStatuses: (value: Record<string, 'not_started' | 'in_progress' | 'completed'> | ((prev: Record<string, 'not_started' | 'in_progress' | 'completed'>) => Record<string, 'not_started' | 'in_progress' | 'completed'>)) => void;
  gameStatuses: Record<string, 'not_started' | 'in_progress' | 'completed'>;
  setGameStatuses: (value: Record<string, 'not_started' | 'in_progress' | 'completed'> | ((prev: Record<string, 'not_started' | 'in_progress' | 'completed'>) => Record<string, 'not_started' | 'in_progress' | 'completed'>)) => void;
  games: Record<string, any[]>;
  setGames: (value: Record<string, any[]> | ((prev: Record<string, any[]>) => Record<string, any[]>)) => void;
  courtNumbers: Record<string, string>;
  setCourtNumbers: (value: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  creatingTiebreakers: Set<string>;
  setCreatingTiebreakers: (value: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  startMatch: (matchId: string) => Promise<void>;
  startGame: (gameId: string) => Promise<void>;
  endGame: (gameId: string) => Promise<void>;
  completeMatch: (matchId: string) => Promise<void>;
  loadGamesForMatch: (matchId: string) => Promise<void>;
  updateGameScore: (gameId: string, teamAScore: number | null, teamBScore: number | null) => Promise<void>;
  updateGameCourtNumber: (gameId: string, courtNumber: string) => Promise<void>;
  completeGame: (gameId: string) => Promise<void>;
  createTiebreaker: (matchId: string) => Promise<void>;
  hasAnyMatchStarted: (round: any) => boolean;
}) {
  const [expandedTournaments, setExpandedTournaments] = useState<Set<string>>(new Set());
  const [expandedStops, setExpandedStops] = useState<Set<string>>(new Set());
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set());
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [scheduleData, setScheduleData] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!selectedStopId) {
      if (selectedRoundId !== null) {
        setSelectedRoundId(null);
      }
      setExpandedRounds(() => new Set());
      return;
    }

    const rounds = scheduleData[selectedStopId];
    if (!rounds || rounds.length === 0) {
      if (selectedRoundId !== null) {
        setSelectedRoundId(null);
      }
      setExpandedRounds(() => new Set());
      return;
    }

    const currentRoundStillExists = selectedRoundId && rounds.some(round => round.id === selectedRoundId);
    if (!currentRoundStillExists) {
      const nextRoundId = rounds[0]?.id ?? null;
      if (nextRoundId) {
        setSelectedRoundId(nextRoundId);
        setExpandedRounds(() => new Set([nextRoundId]));
      }
    } else {
      setExpandedRounds(prev => {
        if (selectedRoundId && prev.has(selectedRoundId) && prev.size === 1) {
          return prev;
        }
        return selectedRoundId ? new Set([selectedRoundId]) : new Set();
      });
    }
  }, [selectedStopId, scheduleData, selectedRoundId]);

  /* ----- Inline Round Editor state ----- */
  const [editingRounds, setEditingRounds] = useState<Set<string>>(new Set());
  const [roundMatchups, setRoundMatchups] = useState<Record<string, Array<{
    id: Id;
    isBye: boolean;
    teamA?: { id: Id; name: string; clubName?: string; bracketName?: string };
    teamB?: { id: Id; name: string; clubName?: string; bracketName?: string };
  }>>>({});
  const [updateKey, setUpdateKey] = useState(0);
  const [renderKey, setRenderKey] = useState(0);

  const toggleTournament = (tournamentId: string) => {
    setExpandedTournaments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tournamentId)) {
        newSet.delete(tournamentId);
        // Also close all stops for this tournament
        setExpandedStops(prevStops => {
          const newStopSet = new Set(prevStops);
          const tournament = tournaments.find(t => t.tournamentId === tournamentId);
          if (tournament) {
            tournament.stops.forEach(stop => newStopSet.delete(stop.stopId));
          }
          return newStopSet;
        });
      } else {
        newSet.add(tournamentId);
        // Load schedule data for all stops in this tournament when expanding
        const tournament = tournaments.find(t => t.tournamentId === tournamentId);
        if (tournament) {
          tournament.stops.forEach(stop => {
            loadSchedule(stop.stopId);
          });
        }
      }
      return newSet;
    });
  };

  const toggleStop = (stopId: string) => {
    setExpandedStops(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stopId)) {
        newSet.delete(stopId);
      } else {
        newSet.add(stopId);
        // Load schedule data when expanding
        loadSchedule(stopId);
      }
      return newSet;
    });
  };

  const toggleRound = (roundId: string) => {
    setSelectedRoundId(roundId);
    setExpandedRounds(() => new Set([roundId]));
  };

  // Convert tournament type enum to display name
  const getTournamentTypeDisplayName = (type: string) => {
    const typeMap: Record<string, string> = {
      'TEAM_FORMAT': 'Team Format',
      'SINGLE_ELIMINATION': 'Single Elimination',
      'DOUBLE_ELIMINATION': 'Double Elimination',
      'ROUND_ROBIN': 'Round Robin',
      'POOL_PLAY': 'Pool Play',
      'LADDER_TOURNAMENT': 'Ladder Tournament',
    };
    return typeMap[type] || type;
  };

  const normalizeStatus = (value: any): MatchStatus | null => {
    if (!value) return null;
    const str = String(value).toLowerCase();
    if (str.includes('complete')) return 'completed';
    if (str.includes('progress') || str.includes('live')) return 'in_progress';
    if (str.includes('start')) return 'not_started';
    if (str === 'finished' || str === 'done') return 'completed';
    return null;
  };

  const deriveGameStatus = (game: any): MatchStatus => {
    const direct = normalizeStatus(game?.status || game?.state);
    if (direct) return direct;

    if (game?.isComplete || game?.completedAt || game?.endedAt) {
      return 'completed';
    }
    if (game?.startedAt) {
      return 'in_progress';
    }
    const hasScore = (val: any) => typeof val === 'number' && !Number.isNaN(val);
    if (hasScore(game?.teamAScore) || hasScore(game?.teamBScore)) {
      return game?.isComplete ? 'completed' : 'in_progress';
    }
    return 'not_started';
  };

  const deriveMatchStatus = (match: any, gameStatusMap: Record<string, MatchStatus>): MatchStatus => {
    const direct = normalizeStatus(match?.status || match?.state);
    if (direct) return direct;

    if (match?.completedAt || match?.endedAt || match?.isComplete === true) {
      return 'completed';
    }

    const gamesList = Array.isArray(match?.games) ? match.games : [];
    let anyInProgress = false;
    let teamAWins = 0;
    let teamBWins = 0;

    gamesList.forEach((game: any) => {
      if (!game?.id) return;
      const status = gameStatusMap[game.id] ?? deriveGameStatus(game);
      if (status === 'in_progress') {
        anyInProgress = true;
      }
      if (status === 'completed') {
        const a = typeof game?.teamAScore === 'number' ? game.teamAScore : null;
        const b = typeof game?.teamBScore === 'number' ? game.teamBScore : null;
        if (a != null && b != null) {
          if (a > b) teamAWins += 1;
          else if (b > a) teamBWins += 1;
        }
      }
    });

    if (teamAWins >= 3 || teamBWins >= 3 || match?.winnerId || match?.winningTeamId) {
      return 'completed';
    }
    if (anyInProgress) {
      return 'in_progress';
    }
    if (gamesList.some((game: any) => {
      if (!game) return false;
      const status = gameStatusMap[game.id];
      if (status === 'in_progress' || status === 'completed') return true;
      if (game?.startedAt || game?.teamAScore != null || game?.teamBScore != null) return true;
      return false;
    })) {
      return 'in_progress';
    }
    return 'not_started';
  };

  const mergeMatchStatus = (derived: MatchStatus, cached?: MatchStatus | null): MatchStatus => {
    if (cached === 'completed' || derived === 'completed') return 'completed';
    if (cached === 'in_progress' || derived === 'in_progress') return 'in_progress';
    return 'not_started';
  };

  const loadSchedule = async (stopId: string, force = false) => {
    if (scheduleData[stopId] && !force) return; // Already loaded
    
    setLoading(prev => ({ ...prev, [stopId]: true }));
    try {
      const response = await fetch(`/api/admin/stops/${stopId}/schedule`);
      if (!response.ok) throw new Error('Failed to load schedule');
      const data = await response.json();
      setScheduleData(prev => ({ ...prev, [stopId]: data || [] }));

      const nextGameStatuses: Record<string, MatchStatus> = {};
      const nextMatchStatuses: Record<string, MatchStatus> = {};

      (data || []).forEach((round: any) => {
        (round?.matches || []).forEach((match: any) => {
          (match?.games || []).forEach((game: any) => {
            if (!game?.id) return;
            nextGameStatuses[game.id] = deriveGameStatus(game);
          });
        });
      });

      (data || []).forEach((round: any) => {
        (round?.matches || []).forEach((match: any) => {
          if (!match?.id) return;
          const derivedStatus = deriveMatchStatus(match, nextGameStatuses);
          const cachedStatus = matchStatuses[match.id];
          nextMatchStatuses[match.id] = mergeMatchStatus(derivedStatus, cachedStatus);
        });
      });

      if (Object.keys(nextGameStatuses).length > 0) {
        setGameStatuses(prev => ({ ...prev, ...nextGameStatuses }));
      }
      if (Object.keys(nextMatchStatuses).length > 0) {
        setMatchStatuses(prev => ({ ...prev, ...nextMatchStatuses }));
      }
      
      // Load lineups for all matches in this stop
      await loadLineupsForStop(stopId);
    } catch (e) {
      onError(`Failed to load schedule: ${(e as Error).message}`);
      setScheduleData(prev => ({ ...prev, [stopId]: [] }));
    } finally {
      setLoading(prev => ({ ...prev, [stopId]: false }));
    }
  };

  const loadLineupsForStop = async (stopId: string) => {
    try {
      const response = await fetch(`/api/admin/stops/${stopId}/lineups`);
      if (response.ok) {
        const lineupsData = await response.json();
        setLineups(prev => ({ ...prev, ...lineupsData }));
        
        // Load games for matches that have confirmed lineups
        Object.keys(lineupsData).forEach(matchId => {
          const matchLineups = lineupsData[matchId];
          const teamAId = Object.keys(matchLineups)[0];
          const teamBId = Object.keys(matchLineups)[1];
          
          if (matchLineups[teamAId]?.length === 4 && matchLineups[teamBId]?.length === 4) {
            loadGamesForMatch(matchId, true);
          }
        });
      }
    } catch (error) {
      console.error('Error loading lineups for stop:', error);
    }
  };

  const copyLineupsFromPreviousRound = useCallback(async (stopId: string, roundIdx: number) => {
    const rounds = scheduleData[stopId];
    if (!rounds || roundIdx <= 0) {
      onInfo('No previous round available to copy lineups from.');
      return;
    }

    const currentRound = rounds[roundIdx];
    const previousRound = rounds[roundIdx - 1];

    if (!currentRound?.matches || !previousRound?.matches) {
      onInfo('No previous round matches found to copy lineups.');
      return;
    }

    const teamLineupMap = new Map<string, PlayerLite[]>();

    previousRound.matches.forEach((prevMatch: any) => {
      const prevMatchLineups = lineups[prevMatch.id];
      if (!prevMatchLineups) return;

      const teamAId = prevMatch.teamA?.id;
      const teamBId = prevMatch.teamB?.id;

      if (teamAId && prevMatchLineups[teamAId]?.length) {
        teamLineupMap.set(teamAId, prevMatchLineups[teamAId].map((p: PlayerLite) => ({ ...p })));
      }
      if (teamBId && prevMatchLineups[teamBId]?.length) {
        teamLineupMap.set(teamBId, prevMatchLineups[teamBId].map((p: PlayerLite) => ({ ...p })));
      }
    });

    const updates: Record<string, Record<string, PlayerLite[]>> = {};
    let copiedTeams = 0;

    currentRound.matches.forEach((match: any) => {
      const matchUpdates: Record<string, PlayerLite[]> = {};

      const applyTeam = (team: any) => {
        if (!team?.id) return;
        const previousLineup = teamLineupMap.get(team.id);
        if (!previousLineup || previousLineup.length === 0) return;
        matchUpdates[team.id] = previousLineup.map((p) => ({ ...p }));
        copiedTeams += 1;
      };

      applyTeam(match.teamA);
      applyTeam(match.teamB);

      if (Object.keys(matchUpdates).length > 0) {
        updates[match.id] = matchUpdates;
      }
    });

    if (Object.keys(updates).length === 0) {
      onInfo('No previous lineups found to copy.');
      return;
    }

    try {
      const response = await fetch(`/api/admin/stops/${stopId}/lineups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineups: updates }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to copy lineups');
      }

      setLineups((prev) => {
        const next = { ...prev };
        for (const [matchId, teamMap] of Object.entries(updates)) {
          const existing = { ...(next[matchId] ?? {}) };
          for (const [teamId, players] of Object.entries(teamMap)) {
            existing[teamId] = players.map((p) => ({ ...p }));
          }
          next[matchId] = existing;
        }
        return next;
      });

      await Promise.all(Object.keys(updates).map((matchId) => loadGamesForMatch(matchId, true)));

      onInfo(`Copied previous lineups for ${copiedTeams} team${copiedTeams === 1 ? '' : 's'}.`);
    } catch (error) {
      console.error('Error copying previous lineups:', error);
      onError(error instanceof Error ? error.message : 'Failed to copy lineups');
    }
  }, [scheduleData, lineups, loadGamesForMatch, onError, onInfo]);

  const generateSchedule = async (stopId: string, stopName: string) => {
    setLoading(prev => ({ ...prev, [stopId]: true }));
    try {
      const response = await fetch(`/api/admin/stops/${stopId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overwrite: true, // Always delete existing matchups and start fresh
          slots: ['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_1', 'MIXED_2', 'TIEBREAKER']
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate schedule');
      }
      
      const result = await response.json();
      onInfo(`Matchups regenerated: ${result.roundsCreated} rounds, ${result.matchesCreated} matches, ${result.gamesCreated} games`);
      
      // Reload schedule data
      await loadSchedule(stopId, true); // Force reload
    } catch (e) {
      onError(`Failed to generate schedule: ${(e as Error).message}`);
    } finally {
      setLoading(prev => ({ ...prev, [stopId]: false }));
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString();
  };

  const getStopStats = (stop: EventManagerTournament['stops'][number]) => {
    const schedule = scheduleData[stop.stopId];

    if (schedule && schedule.length > 0) {
      const rounds = schedule.length;
      const matches = schedule.reduce((acc: number, round: any) => acc + (round.matches?.length || 0), 0);
      const gamesCount = schedule.reduce((acc: number, round: any) => {
        return (
          acc +
          (round.matches?.reduce((matchAcc: number, match: any) => {
            const matchGames = games[match.id] ?? match.games ?? [];
            return matchAcc + (Array.isArray(matchGames) ? matchGames.length : 0);
          }, 0) || 0)
        );
      }, 0);

      return { rounds, matches, games: gamesCount };
    }

    const rounds = stop.rounds.length;
    const matches = stop.rounds.reduce((acc, round) => acc + (round.matchCount || 0), 0);
    const gamesCount = stop.rounds.reduce((acc, round) => acc + (round.gameCount || 0), 0);

    return { rounds, matches, games: gamesCount };
  };

  const activeTournament = selectedStopId
    ? tournaments.find(tournament => tournament.stops.some(stop => stop.stopId === selectedStopId))
    : null;
  const activeStop = activeTournament?.stops.find(stop => stop.stopId === selectedStopId) ?? null;
  const activeSchedule = activeStop ? scheduleData[activeStop.stopId] ?? [] : [];
  const stopHasAnyGameStarted = activeSchedule.some((round: any) => hasAnyMatchStarted(round));
  const isScheduleLoading = activeStop ? !!loading[activeStop.stopId] : false;

  const renderRoundCard = (round: any, roundIdx: number, schedule: any[]) => {
    const previousRoundAvailable = roundIdx > 0 && !!schedule[roundIdx - 1];
    const isEditing = editingRounds.has(round.id);
    const matches = getMatchesForRound(round, isEditing);

    const matchStatusesInRound = matches.map((match: any) => {
      const derivedStatus = deriveMatchStatus(match, gameStatuses);
      const cachedStatus = matchStatuses[match.id];
      return {
        match,
        status: mergeMatchStatus(derivedStatus, cachedStatus),
      };
    });

    const roundHasCompletedAllMatches = matches.length > 0 && matchStatusesInRound.every(({ status }) => status === 'completed');
    const roundHasStarted = matchStatusesInRound.some(({ status }) => status === 'in_progress' || status === 'completed');

    const roundStatusLabel = roundHasCompletedAllMatches ? 'Completed' : roundHasStarted ? 'In Progress' : 'Pending';

    // Force re-render when updateKey changes
    const _ = updateKey;

    return (
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
          <span>Status: {roundStatusLabel}</span>
          <div className="flex flex-wrap items-center gap-2">
            {previousRoundAvailable && !roundHasStarted && (
              <button
                className="px-3 py-1 font-medium text-secondary underline-offset-2 hover:underline"
                onClick={() => {
                  if (!activeStop) return;
                  copyLineupsFromPreviousRound(activeStop.stopId, roundIdx);
                }}
              >
                Copy Previous Lineups
              </button>
            )}
            {isEditing ? (
              <button
                className="btn btn-secondary btn-xs"
                onClick={() => {
                  saveRoundMatchups(round.id);
                }}
              >
                Confirm Matchups
              </button>
            ) : !roundHasStarted ? (
              <button
                className="btn btn-outline btn-xs"
                onClick={() => {
                  toggleRoundEdit(round.id);
                }}
              >
                Edit Matchups
              </button>
            ) : null}
          </div>
        </div>

        {isEditing && (
          <div className="mt-4 rounded-lg border border-info bg-info/10 px-3 py-2 text-xs text-info">
            <strong className="font-semibold">Drag to reorder.</strong> Move teams within the same bracket to adjust matchups.
          </div>
        )}

        <div className="mt-0 space-y-5">
          {(() => {
            const matchesByBracket: Record<string, any[]> = {};

            matches.forEach((match: any, matchIdx: number) => {
              const bracketName = match.bracketName || 'Unknown Bracket';

              if (!matchesByBracket[bracketName]) {
                matchesByBracket[bracketName] = [];
              }

              matchesByBracket[bracketName].push({ ...match, originalIndex: matchIdx });
            });

            // Ensure each bracket has unique local indices
            Object.keys(matchesByBracket).forEach((bracketName) => {
              matchesByBracket[bracketName].forEach((match: any, localIdx: number) => {
                match.localIndex = localIdx;
              });
            });

            return Object.entries(matchesByBracket).map(([bracketName, bracketMatches]) => (
              <div key={`${round.id}-${bracketName}`} className="space-y-3">
                <h6 className="text-sm font-semibold text-muted uppercase tracking-wide">
                  {bracketName}
                </h6>

                {isEditing ? (
                  <DndContext
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={bracketMatches
                        .map((match: any) => [
                          `${round.id}-${bracketName}-${match.localIndex}-A`,
                          `${round.id}-${bracketName}-${match.localIndex}-B`,
                        ])
                        .flat()}
                      strategy={noReorderStrategy}
                    >
                      <div className="space-y-3">
                        {bracketMatches.map((match: any) => {
                          const localIndex = match.localIndex;

                          return (
                            <div
                              key={`${match.id}-${localIndex}`}
                              className="rounded-lg border border-dashed border-subtle bg-surface-2 p-3 shadow-sm"
                            >
                              <div className="mb-3 flex items-center justify-between text-xs text-muted">
                                <span>Match {match.originalIndex + 1}</span>
                                {match.isBye && (
                                  <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
                                    Bye
                                  </span>
                                )}
                              </div>

                              {!match.isBye ? (
                                <div className="grid gap-3 md:grid-cols-2">
                                  <DraggableTeam
                                    team={match.teamA}
                                    teamPosition="A"
                                    roundId={round.id}
                                    matchIndex={localIndex}
                                    bracketName={bracketName}
                                    isDragging={
                                      activeId === `${round.id}-${bracketName}-${localIndex}-A` ||
                                      (dragPreview && (
                                        dragPreview.sourceId === `${round.id}-${bracketName}-${localIndex}-A` ||
                                        dragPreview.targetId === `${round.id}-${bracketName}-${localIndex}-A`
                                      )) ||
                                      false
                                    }
                                    dragPreview={dragPreview}
                                  />

                                  <DraggableTeam
                                    team={match.teamB}
                                    teamPosition="B"
                                    roundId={round.id}
                                    matchIndex={localIndex}
                                    bracketName={bracketName}
                                    isDragging={
                                      activeId === `${round.id}-${bracketName}-${localIndex}-B` ||
                                      (dragPreview && (
                                        dragPreview.sourceId === `${round.id}-${bracketName}-${localIndex}-B` ||
                                        dragPreview.targetId === `${round.id}-${bracketName}-${localIndex}-B`
                                      )) ||
                                      false
                                    }
                                    dragPreview={dragPreview}
                                  />
                                </div>
                              ) : (
                                <div className="flex items-center gap-3 text-sm">
                                  <span className="font-medium">
                                    {match.teamA?.name || 'TBD'} vs {match.teamB?.name || 'TBD'}
                                  </span>
                                </div>
                              )}

                              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                            {(() => {
                                  const hasAnyGameStarted =
                                    games[match.id]?.some(
                                      (game) =>
                                        gameStatuses[game.id] === 'in_progress' || gameStatuses[game.id] === 'completed',
                                    ) || false;

                                  if (
                                    hasAnyGameStarted ||
                                    matchStatuses[match.id] === 'in_progress' ||
                                    matchStatuses[match.id] === 'completed'
                                  ) {
                                    return null;
                                  }

                                  return null;
                                })()}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
                ) : (
                  <div className="space-y-4">
                    {bracketMatches.map((match: any) => {
                      const matchId = match.id;
                      const matchGames = games[matchId] ?? match.games ?? [];
                      const derivedStatus = deriveMatchStatus(match, gameStatuses);
                      const matchStatus = mergeMatchStatus(derivedStatus, matchStatuses[matchId]);
                      const canEditLineups = matchStatus !== 'completed';
                      const teamALineup = lineups[matchId]?.[match.teamA?.id || 'teamA'] || [];
                      const teamBLineup = lineups[matchId]?.[match.teamB?.id || 'teamB'] || [];
                      const hasAnyGameStarted = matchGames.some(
                        (game: any) =>
                          gameStatuses[game.id] === 'in_progress' || gameStatuses[game.id] === 'completed',
                      );

                      return (
                        <div key={matchId} className="rounded-xl border border-subtle bg-surface-2 p-4 shadow-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-primary">
                              {match.teamA?.name || 'Team A'} vs {match.teamB?.name || 'Team B'}
                              {(() => {
                                const bracketLabel = match.bracketName || match.teamA?.bracketName || match.teamB?.bracketName;
                                return bracketLabel ? ` - ${bracketLabel}` : '';
                              })()}
                            </p>
                          </div>

                          <div className="mt-3 space-y-3">
                            {editingMatch === matchId ? (
                              <div className="rounded-lg border border-subtle bg-surface-1 p-4">
                                <InlineLineupEditor
                                  matchId={matchId}
                                  stopId={activeStop?.stopId || ''}
                                  teamA={match.teamA}
                                  teamB={match.teamB}
                                  lineups={lineups}
                                  fetchTeamRoster={fetchTeamRoster}
                                  onSave={async (lineupPayload) => {
                                    if (!activeStop) return;
                                    try {
                                      if (
                                        lineupPayload.teamA.length !== 4 ||
                                        lineupPayload.teamB.length !== 4
                                      ) {
                                        throw new Error(
                                          `Invalid lineup: Team A has ${lineupPayload.teamA.length} players, Team B has ${lineupPayload.teamB.length} players. Need exactly 4 each.`,
                                        );
                                      }

                                      const response = await fetch(`/api/admin/stops/${activeStop.stopId}/lineups`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          lineups: {
                                            [matchId]: {
                                              [match.teamA?.id || 'teamA']: lineupPayload.teamA,
                                              [match.teamB?.id || 'teamB']: lineupPayload.teamB,
                                            },
                                          },
                                        }),
                                      });

                                      if (!response.ok) {
                                        const errorText = await response.text();
                                        throw new Error(`Save failed: ${response.status} ${errorText}`);
                                      }

                                      setLineups((prev) => ({
                                        ...prev,
                                        [matchId]: {
                                          [match.teamA?.id || 'teamA']: lineupPayload.teamA,
                                          [match.teamB?.id || 'teamB']: lineupPayload.teamB,
                                        },
                                      }));

                                      await loadGamesForMatch(matchId, true);

                                      setEditingMatch(null);
                                      onInfo('Lineups saved successfully!');
                                    } catch (error) {
                                      console.error('Error saving lineups:', error);
                                      onError(
                                        `Failed to save lineups: ${
                                          error instanceof Error ? error.message : 'Unknown error'
                                        }`,
                                      );
                                    }
                                  }}
                                  onCancel={() => setEditingMatch(null)}
                                />
                              </div>
                            ) : (
                              !hasAnyGameStarted && (
                                <div className="flex flex-col gap-3 text-sm">
                                  <div className="rounded-lg border border-subtle bg-surface-1 p-3">
                                    <div className="mb-1 font-medium text-primary">
                                      {match.teamA?.name || 'Team A'}
                                    </div>
                                    <div className="space-y-1 text-xs text-muted">
                                      {teamALineup.length > 0 ? (
                                        teamALineup.map((player, idx) => (
                                          <div key={player.id}>
                                            {idx + 1}. {player.name} ({player.gender === 'MALE' ? 'M' : 'F'})
                                          </div>
                                        ))
                                      ) : (
                                        <div>No lineup set</div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="rounded-lg border border-subtle bg-surface-1 p-3">
                                    <div className="mb-1 font-medium text-primary">
                                      {match.teamB?.name || 'Team B'}
                                    </div>
                                    <div className="space-y-1 text-xs text-muted">
                                      {teamBLineup.length > 0 ? (
                                        teamBLineup.map((player, idx) => (
                                          <div key={player.id}>
                                            {idx + 1}. {player.name} ({player.gender === 'MALE' ? 'M' : 'F'})
                                          </div>
                                        ))
                                      ) : (
                                        <div>No lineup set</div>
                                      )}
                                    </div>
                                  </div>

                                  {canEditLineups && (
                                    <div>
                                      <button
                                        className="btn btn-xs btn-primary"
                                        onClick={() => setEditingMatch(matchId)}
                                      >
                                        Edit Lineups
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )
                            )}

                            {/* Games Display - only show when both teams have confirmed lineups */}
                            {lineups[match.id] &&
                              lineups[match.id][match.teamA?.id || 'teamA']?.length === 4 &&
                              lineups[match.id][match.teamB?.id || 'teamB']?.length === 4 && (
                                <div className="space-y-4">
                                  <div className="grid gap-3 md:grid-cols-2">
                                    {games[match.id]
                                      ?.filter((game) => game.slot === 'MENS_DOUBLES' || game.slot === 'WOMENS_DOUBLES')
                                      .map((game) => (
                                        <GameScoreBox
                                          key={game.id}
                                          game={game}
                                          match={match}
                                          gameStatuses={gameStatuses}
                                          lineups={lineups}
                                          startGame={startGame}
                                          endGame={endGame}
                                          updateGameScore={updateGameScore}
                                          updateGameCourtNumber={updateGameCourtNumber}
                                        />
                                      ))}
                                  </div>

                                  <div className="grid gap-3 md:grid-cols-2">
                                    {games[match.id]
                                      ?.filter((game) => game.slot === 'MIXED_1' || game.slot === 'MIXED_2')
                                      .map((game) => (
                                        <GameScoreBox
                                          key={game.id}
                                          game={game}
                                          match={match}
                                          gameStatuses={gameStatuses}
                                          lineups={lineups}
                                          startGame={startGame}
                                          endGame={endGame}
                                          updateGameScore={updateGameScore}
                                          updateGameCourtNumber={updateGameCourtNumber}
                                        />
                                      ))}
                                  </div>

                                  {(() => {
                                    const completedGames =
                                      games[match.id]?.filter((g) => g.slot !== 'TIEBREAKER' && g.isComplete) || [];
                                    const teamAWins = completedGames.filter((g) => g.teamAScore > g.teamBScore).length;
                                    const teamBWins = completedGames.filter((g) => g.teamBScore > g.teamAScore).length;
                                    const needsTiebreaker =
                                      completedGames.length === 4 && teamAWins === 2 && teamBWins === 2;

                                    return (
                                      needsTiebreaker &&
                                      games[match.id]?.find((g) => g.slot === 'TIEBREAKER') && (
                                        <GameScoreBox
                                          game={games[match.id].find((g) => g.slot === 'TIEBREAKER')}
                                          match={match}
                                          gameStatuses={gameStatuses}
                                          lineups={lineups}
                                          startGame={startGame}
                                          endGame={endGame}
                                          updateGameScore={updateGameScore}
                                          updateGameCourtNumber={updateGameCourtNumber}
                                        />
                                      )
                                    );
                                  })()}
                                </div>
                              )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ));
          })()}
        </div>
      </div>
    );
  };

  const toggleRoundEdit = (roundId: string) => {
    setEditingRounds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(roundId)) {
        newSet.delete(roundId);
        // Remove from roundMatchups when closing edit mode
        setRoundMatchups(prev => {
          const newMatchups = { ...prev };
          delete newMatchups[roundId];
          return newMatchups;
        });
      } else {
        newSet.add(roundId);
        // Load round data when opening edit mode, but only if we don't already have it
        if (!roundMatchups[roundId]) {
        loadRoundMatchups(roundId);
        }
      }
      return newSet;
    });
  };

  const loadRoundMatchups = async (roundId: string) => {
    try {
      const response = await fetch(`/api/admin/rounds/${roundId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const roundData = await response.json();
      
      if (!roundData.matches) {
        return;
      }
      
      const matches = roundData.matches.map((match: any) => ({
        id: match.id,
        isBye: match.isBye,
        bracketName: match.bracketName, // Add bracketName at match level
        teamA: match.teamA ? {
          id: match.teamA.id,
          name: match.teamA.name,
          clubName: match.teamA.clubName || undefined,
          bracketName: match.teamA.bracketName || undefined,
        } : undefined,
        teamB: match.teamB ? {
          id: match.teamB.id,
          name: match.teamB.name,
          clubName: match.teamB.clubName || undefined,
          bracketName: match.teamB.bracketName || undefined,
        } : undefined,
        games: match.games || [], // Include the games array
      }));

      setRoundMatchups(prev => ({
          ...prev,
          [roundId]: matches
      }));
    } catch (e) {
      onError((e as Error).message);
    }
  };


  // @dnd-kit drag handlers
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    sourceId: string;
    targetId: string;
    sourceTeam: any;
    targetTeam: any;
  } | null>(null);
  const isProcessingRef = useRef(false);
  const lastDragEndRef = useRef<string | null>(null);
  const dragOperationIdRef = useRef<string | null>(null);
  const dragEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const operationId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    dragOperationIdRef.current = operationId;
    const activeId = event.active.id as string;
    const activeData = event.active.data.current;
    
    setActiveId(activeId);
    setIsDragging(true);
    isProcessingRef.current = false;
    setDragPreview(null); // Clear any previous preview
  }, []);

  const handleDragOver = useCallback((event: any) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) {
      setDragPreview(null);
      return;
    }

    const activeData = active.data.current;
    const overData = over.data.current;

    if (!activeData || !overData || activeData.bracketName !== overData.bracketName) {
      setDragPreview(null);
      return;
    }

    // Set up the swap preview
    setDragPreview({
      sourceId: active.id,
      targetId: over.id,
      sourceTeam: activeData.team,
      targetTeam: overData.team
    });
  }, []);

  // Auto-save function for drag and drop (doesn't exit edit mode)
  const autoSaveRoundMatchups = async (roundId: string) => {
    const matches = roundMatchups[roundId];
    if (!matches) return;
    
    try {
      // Create the update payload
      const updates = matches.map(match => ({
        gameId: match.id,
        teamAId: match.teamA?.id || null,
        teamBId: match.teamB?.id || null,
      }));

      await fetch(`/api/admin/rounds/${roundId}/matchups`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
    } catch (e) {
      onError((e as Error).message);
    }
  };

  // Save and confirm function (exits edit mode)
  const saveRoundMatchups = async (roundId: string) => {
    const matches = roundMatchups[roundId];
    if (!matches) return;
    
    try {
      // Create the update payload
      const updates = matches.map(match => ({
        gameId: match.id,
        teamAId: match.teamA?.id || null,
        teamBId: match.teamB?.id || null,
      }));

      await fetch(`/api/admin/rounds/${roundId}/matchups`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });

      // Exit edit mode
      setEditingRounds(prev => {
        const newSet = new Set(prev);
        newSet.delete(roundId);
        return newSet;
      });
      
      // Refresh the schedule data
      const stopId = Object.keys(scheduleData).find(stopId => 
        scheduleData[stopId].some(round => round.id === roundId)
      );
      if (stopId) {
        await loadSchedule(stopId, true); // Force reload
        // Also refresh the round matchups for this specific round
        await loadRoundMatchups(roundId);
      }
      
      onInfo('Matchups confirmed and saved!');
    } catch (e) {
      onError((e as Error).message);
    }
  };

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    
    // Clear all drag state
    setActiveId(null);
    setIsDragging(false);
    setDragPreview(null);
    
    if (!over || active.id === over.id) {
      return;
    }
    
    const activeData = active.data.current;
    const overData = over.data.current;
    
    if (!activeData || !overData) {
      return;
    }
    
    // Check if teams are in the same bracket
    if (activeData.bracketName !== overData.bracketName) {
      return;
    }
    
    // Get bracket-specific match indices
    const sourceLocalMatchIndex = activeData.matchIndex;
    const targetLocalMatchIndex = overData.matchIndex;
    const sourceTeamPosition = activeData.teamPosition;
    const targetTeamPosition = overData.teamPosition;
    const roundId = activeData.roundId;
    const bracketName = activeData.bracketName;
    
    // Get current matches and filter by bracket
    const currentMatches = [...(roundMatchups[roundId] || [])];
    const bracketMatches = currentMatches.filter(match => 
      (match.teamA?.bracketName || match.teamB?.bracketName) === bracketName
    );
    
    // Get the actual global indices for the bracket matches
    const sourceGlobalIndex = currentMatches.findIndex(match => 
      (match.teamA?.bracketName || match.teamB?.bracketName) === bracketName && 
      bracketMatches.indexOf(match) === sourceLocalMatchIndex
    );
    const targetGlobalIndex = currentMatches.findIndex(match => 
      (match.teamA?.bracketName || match.teamB?.bracketName) === bracketName && 
      bracketMatches.indexOf(match) === targetLocalMatchIndex
    );
    
    if (sourceGlobalIndex === -1 || targetGlobalIndex === -1) {
      return;
    }
    
    // Perform the swap using global indices
    const sourceMatch = { ...currentMatches[sourceGlobalIndex] };
    const targetMatch = { ...currentMatches[targetGlobalIndex] };
    
    // Perform the swap - directly swap the teams
    const sourceTeam = activeData.team;
    const targetTeam = overData.team;
    
    if (sourceTeamPosition === 'A' && targetTeamPosition === 'A') {
      sourceMatch.teamA = targetTeam;
      targetMatch.teamA = sourceTeam;
    } else if (sourceTeamPosition === 'B' && targetTeamPosition === 'B') {
      sourceMatch.teamB = targetTeam;
      targetMatch.teamB = sourceTeam;
    } else if (sourceTeamPosition === 'A' && targetTeamPosition === 'B') {
      sourceMatch.teamA = targetTeam;
      targetMatch.teamB = sourceTeam;
    } else if (sourceTeamPosition === 'B' && targetTeamPosition === 'A') {
      sourceMatch.teamB = targetTeam;
      targetMatch.teamA = sourceTeam;
    }
    
    // Update the matches array
    const newMatches = [...currentMatches];
    newMatches[sourceGlobalIndex] = sourceMatch;
    newMatches[targetGlobalIndex] = targetMatch;
    
    // Update state
    setRoundMatchups(prev => ({
      ...prev,
      [roundId]: newMatches
    }));
    
    // Auto-save
    try {
      await autoSaveRoundMatchups(roundId);
    } catch (error) {
      // Handle error silently
    }
    
  }, [roundMatchups, autoSaveRoundMatchups]);
  





  // Memoized function to get matches for a round
  const getMatchesForRound = useCallback((round: any, isEditing: boolean) => {
    const matches = isEditing ? (roundMatchups[round.id] || round.matches) : round.matches;
    return matches;
  }, [roundMatchups]);


  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-xl border border-subtle bg-surface-1 overflow-hidden">
          <div className="border-b border-subtle px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Tournaments
            </p>
          </div>
          <div className="space-y-4 p-4">
            {tournaments.map((tournament) => {
              const isExpanded = expandedTournaments.has(tournament.tournamentId);
              return (
                <div key={tournament.tournamentId} className="space-y-3">
                  <button
                    className="flex w-full items-center justify-between rounded-lg border border-transparent bg-surface-2 px-3 py-2 text-left transition hover:border-subtle hover:bg-surface-3"
                    onClick={() => toggleTournament(tournament.tournamentId)}
                  >
                    <div>
                      <p className="text-sm font-semibold text-primary">
                        {tournament.tournamentName} - {getTournamentTypeDisplayName(tournament.type)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">{tournament.stops.length} stops</p>
                    </div>
                    <span className={`text-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                      ▶
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="space-y-2">
                      {tournament.stops.map((stop) => {
                        const stats = getStopStats(stop);
                        const isSelected = selectedStopId === stop.stopId;
                        return (
                          <button
                            key={stop.stopId}
                            className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                              isSelected
                                ? 'border-secondary bg-secondary/10 text-primary shadow-sm'
                                : 'border-transparent hover:border-subtle hover:bg-surface-2'
                            }`}
                            onClick={() => {
                              setExpandedTournaments((prev) => {
                                const next = new Set(prev);
                                next.add(tournament.tournamentId);
                                return next;
                              });
                              setSelectedStopId(stop.stopId);
                              setSelectedRoundId(null);
                              loadSchedule(stop.stopId);
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold">{stop.stopName}</p>
                                <p className="mt-1 text-xs text-muted">
                                  {(stop.locationName ? `${stop.locationName} • ` : '') + formatStopDateRange(stop.startAt ?? null, stop.endAt ?? null)}
                                </p>
                              </div>
                              {isSelected && (
                                <span className="text-secondary text-lg" aria-hidden="true">▶</span>
                              )}
                            </div>
                            <div className="mt-3 flex gap-3 text-xs text-muted">
                              <span>{stats.rounds} rounds</span>
                              <span>{stats.matches} matches</span>
                              <span>{stats.games} games</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {tournaments.length === 0 && (
              <div className="rounded-lg border border-dashed border-subtle p-6 text-center text-sm text-muted">
                You are not assigned as an event manager for any tournaments.
              </div>
            )}
          </div>
        </aside>

        <section className="space-y-6">
          {activeStop ? (
            <>
              {!stopHasAnyGameStarted && (
                <div className="mb-4 flex justify-end">
                  <button
                    className="btn btn-primary disabled:opacity-60"
                    onClick={() => generateSchedule(activeStop.stopId, activeStop.stopName)}
                    disabled={isScheduleLoading}
                  >
                    {isScheduleLoading ? 'Regenerating…' : 'Regenerate Matchups'}
                  </button>
                </div>
              )}

              {isScheduleLoading ? (
                <div className="rounded-xl border border-dashed border-subtle p-12 text-center text-muted">
                  Loading schedule…
                </div>
              ) : activeSchedule.length === 0 ? (
                <div className="rounded-xl border border-dashed border-subtle p-12 text-center text-muted">
                  No matchups generated yet. Click "Regenerate Matchups" to create them.
                </div>
              ) : (
                <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
                  <div className="rounded-xl border border-subtle bg-surface-1 overflow-hidden">
                    <div className="border-b border-subtle px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Rounds</p>
                    </div>
                    <div className="p-4">
                      <div className="space-y-2">
                        {activeSchedule.map((round) => {
                          const isActive = expandedRounds.has(round.id);
                          const roundMatches = round.matches || [];
                          const matchStatusSummaries = roundMatches.map((match: any) => {
                            const derivedStatus = deriveMatchStatus(match, gameStatuses);
                            const cachedStatus = matchStatuses[match.id];
                            return mergeMatchStatus(derivedStatus, cachedStatus);
                          });
                          const roundCompleted = roundMatches.length > 0 && matchStatusSummaries.every(status => status === 'completed');
                          const roundInProgress = matchStatusSummaries.some(status => status === 'in_progress' || status === 'completed');
                          const statusLabel = roundCompleted ? 'Completed' : roundInProgress ? 'In Progress' : 'Pending';
                          const statusTone = roundCompleted ? 'text-success' : roundInProgress ? 'text-info' : 'text-muted';

                          return (
                            <button
                              key={round.id}
                              className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                                isActive
                                  ? 'border-secondary bg-secondary/10 text-primary shadow-sm'
                                  : 'border-transparent hover:border-subtle hover:bg-surface-2'
                              }`}
                              onClick={() => toggleRound(round.id)}
                            >
                              <div className="flex items-center justify-between text-sm font-medium">
                                <span>Round {round.idx + 1}</span>
                                <span className={`text-xs ${statusTone}`}>{statusLabel}</span>
                              </div>
                              <div className="mt-1 text-xs text-muted">{roundMatches.length} matches</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-subtle bg-surface-1 overflow-hidden">
                    <div className="border-b border-subtle px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Matches, Games &amp; Scores</p>
                    </div>
                    <div className="p-4">
                      <div className="space-y-6">
                        {activeSchedule.map((round, roundIdx) => {
                          if (!expandedRounds.has(round.id)) return null;
                          return (
                            <div key={`${round.id}-${roundIdx}`}>{renderRoundCard(round, roundIdx, activeSchedule)}</div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-subtle p-12 text-center text-muted">
              Select a stop to manage rounds, matchups, and lineups.
            </div>
          )}
        </section>
      </div>

      {editingLineup && (
        <LineupEditor
          matchId={editingLineup.matchId}
          teamId={editingLineup.teamId}
          teamName="Team Name"
          availablePlayers={[]}
          currentLineup={lineups[editingLineup.matchId]?.[editingLineup.teamId] || []}
          onSave={(lineup) => {
            setLineups((prev) => {
              const next = { ...prev };
              if (!next[editingLineup.matchId]) {
                next[editingLineup.matchId] = {};
              }
              next[editingLineup.matchId][editingLineup.teamId] = lineup;
              return next;
            });
            setEditingLineup(null);
          }}
          onCancel={() => setEditingLineup(null)}
        />
      )}
    </div>
  );
}

/* ================= Lineup Editor Component ================= */
function LineupEditor({
  matchId,
  teamId,
  teamName,
  availablePlayers,
  currentLineup,
  onSave,
  onCancel,
}: {
  matchId: string;
  teamId: string;
  teamName: string;
  availablePlayers: PlayerLite[];
  currentLineup: PlayerLite[];
  onSave: (lineup: PlayerLite[]) => void;
  onCancel: () => void;
}) {
  const [lineup, setLineup] = useState<PlayerLite[]>(currentLineup);
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set(currentLineup.map(p => p.id)));

  const men = availablePlayers.filter(p => p.gender === 'MALE');
  const women = availablePlayers.filter(p => p.gender === 'FEMALE');

  const addPlayer = (player: PlayerLite) => {
    if (selectedPlayers.has(player.id)) return;
    if (lineup.length >= 4) return;
    
    const genderCount = lineup.filter(p => p.gender === player.gender).length;
    if (genderCount >= 2) return;

    setLineup(prev => [...prev, player]);
    setSelectedPlayers(prev => new Set([...prev, player.id]));
  };

  const removePlayer = (playerId: string) => {
    setLineup(prev => prev.filter(p => p.id !== playerId));
    setSelectedPlayers(prev => {
      const newSet = new Set(prev);
      newSet.delete(playerId);
      return newSet;
    });
  };

  const handleSave = () => {
    onSave(lineup);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-surface-1 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Edit Lineup - {teamName}</h3>
          <button
            className="text-muted hover:text-muted"
            onClick={onCancel}
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-muted mb-2">
            Select 4 players: 2 men and 2 women
          </p>
          <div className="flex gap-2">
            <span className={`px-2 py-1 rounded text-xs ${lineup.filter(p => p.gender === 'MALE').length === 2 ? 'bg-green-100 text-green-800' : 'bg-surface-1 text-muted'}`}>
              Men: {lineup.filter(p => p.gender === 'MALE').length}/2
            </span>
            <span className={`px-2 py-1 rounded text-xs ${lineup.filter(p => p.gender === 'FEMALE').length === 2 ? 'bg-green-100 text-green-800' : 'bg-surface-1 text-muted'}`}>
              Women: {lineup.filter(p => p.gender === 'FEMALE').length}/2
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <h4 className="font-medium mb-2">Men ({men.length} available)</h4>
            <div className="space-y-1 max-h-40 overflow-auto">
              {men.map(player => (
                <button
                  key={player.id}
                  className={`w-full text-left px-2 py-1 rounded text-sm ${
                    selectedPlayers.has(player.id)
                      ? 'bg-blue-100 text-info'
                      : 'hover:bg-surface-1'
                  }`}
                  onClick={() => addPlayer(player)}
                  disabled={selectedPlayers.has(player.id) || lineup.length >= 4 || lineup.filter(p => p.gender === 'MALE').length >= 2}
                >
                  {player.firstName} {player.lastName}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">Women ({women.length} available)</h4>
            <div className="space-y-1 max-h-40 overflow-auto">
              {women.map(player => (
                <button
                  key={player.id}
                  className={`w-full text-left px-2 py-1 rounded text-sm ${
                    selectedPlayers.has(player.id)
                      ? 'bg-blue-100 text-info'
                      : 'hover:bg-surface-1'
                  }`}
                  onClick={() => addPlayer(player)}
                  disabled={selectedPlayers.has(player.id) || lineup.length >= 4 || lineup.filter(p => p.gender === 'FEMALE').length >= 2}
                >
                  {player.firstName} {player.lastName}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-4">
          <h4 className="font-medium mb-2">Selected Lineup ({lineup.length}/4)</h4>
          <div className="space-y-1">
            {lineup.map(player => (
              <div key={player.id} className="flex items-center justify-between px-2 py-1 bg-surface-2 rounded">
                <span className="text-sm">
                  {player.firstName} {player.lastName} ({player.gender === 'MALE' ? 'M' : 'F'})
                </span>
                <button
                  className="text-red-600 hover:text-red-800"
                  onClick={() => removePlayer(player.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            className="btn btn-ghost"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            onClick={handleSave}
            disabled={lineup.length !== 4}
          >
            Save Lineup
          </button>
        </div>
      </div>
    </div>
  );
}

// Inline Lineup Editor Component
function InlineLineupEditor({
  matchId,
  stopId,
  teamA,
  teamB,
  fetchTeamRoster,
  lineups,
  onSave,
  onCancel,
}: {
  matchId: string;
  stopId: string;
  teamA: { id: string; name: string };
  teamB: { id: string; name: string };
  fetchTeamRoster: (teamId: string) => Promise<PlayerLite[]>;
  lineups: Record<string, Record<string, PlayerLite[]>>;
  onSave: (lineups: { teamA: PlayerLite[]; teamB: PlayerLite[] }) => void;
  onCancel: () => void;
}) {
  const [teamALineup, setTeamALineup] = useState<(PlayerLite | undefined)[]>([undefined, undefined, undefined, undefined]);
  const [teamBLineup, setTeamBLineup] = useState<(PlayerLite | undefined)[]>([undefined, undefined, undefined, undefined]);
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [loadedRosters, setLoadedRosters] = useState<{ teamA: PlayerLite[]; teamB: PlayerLite[] }>({ teamA: [], teamB: [] });
  const matchLineups = useMemo(() => lineups[matchId] || {}, [lineups, matchId]);

  const getLineupForTeam = (teamId: string, fallbackKey: 'teamA' | 'teamB'): PlayerLite[] => {
    return matchLineups[teamId] ?? matchLineups[fallbackKey] ?? [];
  };

  // Fetch team rosters for this specific stop when component mounts
  useEffect(() => {
    const loadRosters = async () => {
      if (teamA.id && teamB.id && stopId) {
        try {
          const [responseA, responseB] = await Promise.all([
            fetch(`/api/captain/team/${teamA.id}/stops/${stopId}/roster`),
            fetch(`/api/captain/team/${teamB.id}/stops/${stopId}/roster`)
          ]);
          
          const [dataA, dataB] = await Promise.all([
            responseA.json(),
            responseB.json()
          ]);
          
          const normalize = (p: any): PlayerLite => ({
            id: p.id,
            firstName: p.firstName ?? null,
            lastName: p.lastName ?? null,
            name: p.name ?? `${[p.firstName, p.lastName].filter(Boolean).join(' ')}`.trim(),
            gender: p.gender,
            dupr: p.dupr ?? null,
            age: p.age ?? null,
          });

          const rosterA: PlayerLite[] = (dataA.items || []).map(normalize);
          const rosterB: PlayerLite[] = (dataB.items || []).map(normalize);

          const ensureLineupPlayers = (roster: PlayerLite[], lineup: PlayerLite[] = []) => {
            const byId = new Map(roster.map(player => [player.id, player]));
            lineup.forEach(player => {
              if (!player) return;
              if (!byId.has(player.id)) {
                byId.set(player.id, {
                  ...player,
                  name: player.name ?? `${[player.firstName, player.lastName].filter(Boolean).join(' ')}`.trim(),
                });
              }
            });
            return Array.from(byId.values());
          };

          const enhancedRosterA = ensureLineupPlayers(rosterA, getLineupForTeam(teamA.id, 'teamA'));
          const enhancedRosterB = ensureLineupPlayers(rosterB, getLineupForTeam(teamB.id, 'teamB'));
          
          setLoadedRosters({ teamA: enhancedRosterA, teamB: enhancedRosterB });
        } catch (error) {
          console.error('Failed to load stop-specific rosters:', error);
          // Fallback to tournament-wide rosters
          const [fallbackA, fallbackB] = await Promise.all([
            fetchTeamRoster(teamA.id),
            fetchTeamRoster(teamB.id)
          ]);

          const mergeFallback = (roster: PlayerLite[], lineup: PlayerLite[] = []) => {
            const byId = new Map(roster.map(player => [player.id, player]));
            lineup.forEach(player => {
              if (!player) return;
              if (!byId.has(player.id)) {
                byId.set(player.id, {
                  ...player,
                  name: player.name ?? `${[player.firstName, player.lastName].filter(Boolean).join(' ')}`.trim(),
                });
              }
            });
            return Array.from(byId.values());
          };

          setLoadedRosters({
            teamA: mergeFallback(fallbackA, getLineupForTeam(teamA.id, 'teamA')),
            teamB: mergeFallback(fallbackB, getLineupForTeam(teamB.id, 'teamB')),
          });
        }
      }
    };
    loadRosters();
  }, [teamA.id, teamB.id, stopId]);

  // Initialize lineups and handle lineup changes for this specific match
  useEffect(() => {
    const teamALineupData = getLineupForTeam(teamA.id, 'teamA');
    const teamBLineupData = getLineupForTeam(teamB.id, 'teamB');

    // Only update if the data has actually changed
    const currentTeamAIds = teamALineup.map(p => p?.id).filter(Boolean);
    const currentTeamBIds = teamBLineup.map(p => p?.id).filter(Boolean);
    const newTeamAIds = teamALineupData.map(p => p.id);
    const newTeamBIds = teamBLineupData.map(p => p.id);

    const teamAChanged = JSON.stringify([...currentTeamAIds].sort()) !== JSON.stringify([...newTeamAIds].sort());
    const teamBChanged = JSON.stringify([...currentTeamBIds].sort()) !== JSON.stringify([...newTeamBIds].sort());

    if (teamAChanged || teamBChanged) {
      setTeamALineup([
        teamALineupData[0] || undefined,
        teamALineupData[1] || undefined,
        teamALineupData[2] || undefined,
        teamALineupData[3] || undefined
      ]);

      setTeamBLineup([
        teamBLineupData[0] || undefined,
        teamBLineupData[1] || undefined,
        teamBLineupData[2] || undefined,
        teamBLineupData[3] || undefined
      ]);

      const allSelectedPlayers = new Set([
        ...teamALineupData.map(p => p.id),
        ...teamBLineupData.map(p => p.id)
      ]);
      setSelectedPlayers(allSelectedPlayers);
    }
  }, [matchId, teamA.id, teamB.id, matchLineups]);

  const addPlayerToLineup = (player: PlayerLite, teamId: string, slotIndex: number) => {
    const isTeamA = teamId === teamA.id;
    const currentLineup = isTeamA ? teamALineup : teamBLineup;
    const currentPlayer = currentLineup[slotIndex];
    
    // Check gender constraints: slots 0,1 are male, slots 2,3 are female
    const expectedGender = slotIndex < 2 ? 'MALE' : 'FEMALE';
    if (player.gender !== expectedGender) return;

    // Update selectedPlayers first to avoid race conditions
    setSelectedPlayers(prev => {
      const newSet = new Set(prev);
      
      // Remove current player from selectedPlayers if there is one
      if (currentPlayer) {
        newSet.delete(currentPlayer.id);
      }
      
      // Add the new player
      newSet.add(player.id);
      
      return newSet;
    });

    // Update lineup state
    const nextLineup = (prev: (PlayerLite | undefined)[]) => {
      const copy = [...prev];
      for (let i = 0; i < copy.length; i += 1) {
        if (copy[i]?.id === player.id) copy[i] = undefined;
      }
      copy[slotIndex] = player;
      return copy;
    };

    if (isTeamA) {
      setTeamALineup(nextLineup);
    } else {
      setTeamBLineup(nextLineup);
    }
  };

  const removePlayerFromLineup = (playerId: string, teamId: string, slotIndex: number) => {
    const isTeamA = teamId === teamA.id;
    
    // Update selectedPlayers first
    setSelectedPlayers(prev => {
      const newSet = new Set(prev);
      newSet.delete(playerId);
      return newSet;
    });
    
    // Update lineup state
    if (isTeamA) {
      setTeamALineup(prev => {
        const newLineup = [...prev];
        newLineup[slotIndex] = undefined as any;
        return newLineup;
      });
    } else {
      setTeamBLineup(prev => {
        const newLineup = [...prev];
        newLineup[slotIndex] = undefined as any;
        return newLineup;
      });
    }
  };

  const getAvailablePlayers = (teamId: string, slotIndex: number) => {
    const isTeamA = teamId === teamA.id;
    const roster = isTeamA ? loadedRosters.teamA : loadedRosters.teamB;
    const expectedGender = slotIndex < 2 ? 'MALE' : 'FEMALE';
    const currentLineup = isTeamA ? teamALineup : teamBLineup;
    const currentPlayer = currentLineup[slotIndex];
    
    // Filter by gender and exclude players selected in OTHER slots
    return roster.filter(p => {
      if (p.gender && p.gender !== expectedGender) return false;
      
      // If this is the currently selected player in this slot, include them
      if (currentPlayer && p.id === currentPlayer.id) return true;
      
      // Otherwise, exclude if they're selected in any other slot
      return !selectedPlayers.has(p.id);
    });
  };

  const isLineupComplete = teamALineup.filter(p => p !== undefined).length === 4 && teamBLineup.filter(p => p !== undefined).length === 4;

  const handleSave = async () => {
    if (isSaving) return; // Prevent double-clicks
    
    setIsSaving(true);
    try {
      await onSave({ 
        teamA: teamALineup.filter(p => p !== undefined) as PlayerLite[], 
        teamB: teamBLineup.filter(p => p !== undefined) as PlayerLite[] 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const formatPlayerName = (player?: PlayerLite) => {
    if (!player) return '';
    if (player.name && player.name.trim().length > 0) return player.name;
    const combined = [player.firstName, player.lastName].filter(Boolean).join(' ').trim();
    return combined || player.id;
  };

  const renderSlotSelect = (
    team: { id: string; name: string },
    lineup: (PlayerLite | undefined)[],
    slotIndex: number,
    labelPrefix: string
  ) => {
    const currentPlayer = lineup[slotIndex];
    const available = getAvailablePlayers(team.id, slotIndex);
    const hasCurrentInOptions = currentPlayer
      ? available.some(player => player.id === currentPlayer.id)
      : false;

    const onSelectChange = (value: string) => {
      if (value) {
        const roster = team.id === teamA.id ? loadedRosters.teamA : loadedRosters.teamB;
        const player = roster.find(p => p.id === value) || currentPlayer;
        if (player) addPlayerToLineup(player, team.id, slotIndex);
      } else if (currentPlayer) {
        removePlayerFromLineup(currentPlayer.id, team.id, slotIndex);
      }
    };

    return (
      <div className="flex items-center gap-2" key={`${team.id}:${slotIndex}`}>
        <label className="text-xs font-medium w-4">{slotIndex + 1}:</label>
        <select
          className="flex-1 p-1 text-xs border rounded bg-surface-2 text-primary"
          value={currentPlayer?.id ?? ''}
          onChange={(e) => onSelectChange(e.target.value)}
        >
          <option value="">{`${labelPrefix} Player ${slotIndex + 1}`}</option>
          {currentPlayer && !hasCurrentInOptions && (
            <option value={currentPlayer.id}>{formatPlayerName(currentPlayer)}</option>
          )}
          {available.map(player => (
            <option key={player.id} value={player.id}>
              {formatPlayerName(player)}
            </option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div className="mt-3 p-3 bg-surface-2 rounded border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Edit Lineups</h3>
        <div className="flex gap-2">
          <button
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            onClick={handleSave}
            disabled={!isLineupComplete || isSaving}
          >
            {isSaving ? 'Saving...' : 'Confirm Lineup'}
          </button>
          <button
            className="btn btn-ghost text-xs"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Team A */}
        <div>
          <h4 className="text-xs font-medium mb-2 text-muted">{teamA.name}</h4>
          <div className="space-y-2">
            {[0, 1, 2, 3].map(index =>
              renderSlotSelect(teamA, teamALineup, index, 'Select')
            )}
          </div>
        </div>

        {/* Team B */}
        <div>
          <h4 className="text-xs font-medium mb-2 text-muted">{teamB.name}</h4>
          <div className="space-y-2">
            {[0, 1, 2, 3].map(index =>
              renderSlotSelect(teamB, teamBLineup, index, 'Select')
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
