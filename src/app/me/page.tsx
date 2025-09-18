'use client';

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { DndContext, DragEndEvent, DragStartEvent, closestCenter } from '@dnd-kit/core';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useUser, useAuth } from '@clerk/nextjs';
import { SignInButton, SignOutButton } from '@clerk/nextjs';
import { UserProfile, Tournament, PlayerRegistration, TournamentsResponse, RegistrationResponse } from '@/types';

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
          ? 'opacity-60 scale-105 shadow-lg border-blue-400 bg-blue-50' 
          : isPreviewTarget 
            ? 'opacity-80 scale-102 shadow-md border-green-400 bg-green-50'
            : ''
      } ${
        !team ? 'border-dashed border-gray-300 bg-gray-50 cursor-not-allowed' : 'bg-white hover:shadow-md'
      }`}
    >
      {team ? (
        <div className="text-center">
          <div className="font-medium">{team.name}</div>
        </div>
      ) : (
        <div className="text-gray-400 italic">Drop team here</div>
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

type Club = {
  id: Id; name: string;
  address?: string|null; city?: string|null; region?: string|null; country?: string|null; phone?: string|null;
};
type PlayerLite = { id: Id; firstName?: string|null; lastName?: string|null; name?: string|null; gender: 'MALE'|'FEMALE'; dupr?: number|null; age?: number|null; };

type StopRowFromAPI = {
  stopId: Id;
  stopName: string;
  locationName?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  tournamentId?: Id | null;
  tournamentName?: string | null;
  stopRoster: PlayerLite[]; // roster for THIS team (bracket) at THIS stop
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
  stops: Array<{ stopId: Id; stopName: string; locationName?: string | null; startAt?: string | null; endAt?: string | null }>;
  bracketTeams: Map<string, TeamItem>;
  bracketNames: string[];
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">Tournament Registration</h2>
        <p className="text-gray-600">Register for available tournaments and manage your participation.</p>
      </div>

      {tournaments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No tournaments available for registration.
        </div>
      ) : (
        <div className="space-y-4">
          {tournaments.map((tournament) => {
            const registration = registrations[tournament.id];
            const isRegistered = !!registration;

            return (
              <div key={tournament.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-lg">{tournament.name}</h3>
                    <p className="text-sm text-gray-600">
                      {tournament.type} • {tournament.stops?.length || 0} stops
                    </p>
                  </div>
                  <div className="text-right">
                    {isRegistered ? (
                      <div className="space-y-2">
                        <span className="inline-block px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                          Registered
                        </span>
                        <div className="text-sm text-gray-600">
                          Team: {registration.teamName}
                        </div>
                        <button
                          onClick={() => unregisterFromTournament(tournament.id)}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          Unregister
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => registerForTournament(tournament.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Register
                      </button>
                    )}
                  </div>
                </div>

                {tournament.brackets && tournament.brackets.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Available Brackets:</h4>
                    <div className="flex flex-wrap gap-2">
                      {tournament.brackets.map((bracket: any) => (
                        <span
                          key={bracket.id}
                          className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded"
                        >
                          {bracket.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {tournament.stops && tournament.stops.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Stops:</h4>
                    <div className="space-y-1">
                      {tournament.stops.map((stop: any, index: number) => (
                        <div key={stop.id} className="text-sm text-gray-600">
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
          <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
          <input
            type="text"
            required
            className="w-full border rounded px-3 py-2"
            value={formData.firstName}
            onChange={e => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
          <input
            type="text"
            required
            className="w-full border rounded px-3 py-2"
            value={formData.lastName}
            onChange={e => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
          <select
            required
            className="w-full border rounded px-3 py-2"
            value={formData.gender}
            onChange={e => setFormData(prev => ({ ...prev, gender: e.target.value as 'MALE' | 'FEMALE' }))}
          >
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Club</label>
          <select
            required
            className="w-full border rounded px-3 py-2"
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            className="w-full border rounded px-3 py-2"
            value={formData.email}
            onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input
            type="tel"
            className="w-full border rounded px-3 py-2"
            value={formData.phone}
            onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2"
            value={formData.city}
            onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {countrySel === 'Canada' ? 'Province' : 'State'}
          </label>
          <select
            className="w-full border rounded px-3 py-2"
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
          <select
            className="w-full border rounded px-3 py-2"
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Country Name</label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2"
            value={countryOther}
            onChange={e => setCountryOther(e.target.value)}
            placeholder="Enter country name"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">DUPR Rating (optional)</label>
          <input
            type="number"
            step="0.1"
            min="1.0"
            max="6.0"
            className="w-full border rounded px-3 py-2"
            value={formData.dupr}
            onChange={e => setFormData(prev => ({ ...prev, dupr: e.target.value }))}
            placeholder="e.g., 4.5"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Birthday (optional)</label>
          <input
            type="date"
            className="w-full border rounded px-3 py-2"
            value={formData.birthday}
            onChange={e => setFormData(prev => ({ ...prev, birthday: e.target.value }))}
          />
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
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
  const [activeTab, setActiveTab] = useState<'profile' | 'tournaments' | 'teams' | 'manage' | 'register'>('profile');

  // Event Manager functionality
  const [eventManagerData, setEventManagerData] = useState<EventManagerTournament[]>([]);

  // Lineup management state
  const [editingLineup, setEditingLineup] = useState<{ matchId: string; teamId: string } | null>(null);
  const [editingMatch, setEditingMatch] = useState<string | null>(null);
  const [lineups, setLineups] = useState<Record<string, Record<string, PlayerLite[]>>>({});
  const [teamRosters, setTeamRosters] = useState<Record<string, PlayerLite[]>>({});
  
  // Games and match status state
  const [matchStatuses, setMatchStatuses] = useState<Record<string, 'not_started' | 'in_progress' | 'completed'>>({});
  const [gameStatuses, setGameStatuses] = useState<Record<string, 'not_started' | 'in_progress' | 'completed'>>({});
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
  const loadGamesForMatch = async (matchId: string) => {
    if (games[matchId]) return; // Already loaded
    
    try {
      console.log('Loading games for match:', matchId);
      const response = await fetch(`/api/admin/matches/${matchId}/games`);
      if (response.ok) {
        const gamesData = await response.json();
        console.log('Loaded games data:', gamesData);
        setGames(prev => ({ ...prev, [matchId]: gamesData }));
        
        // Initialize game statuses from database
        const newGameStatuses: Record<string, 'not_started' | 'in_progress' | 'completed'> = {};
        gamesData.forEach((game: any) => {
          // Map isComplete field to game status - use startedAt to determine if actually started
          if (game.isComplete === true) {
            newGameStatuses[game.id] = 'completed';
          } else if (game.isComplete === false && game.startedAt) {
            newGameStatuses[game.id] = 'in_progress';
          } else {
            newGameStatuses[game.id] = 'not_started';
          }
        });
        setGameStatuses(prev => ({ ...prev, ...newGameStatuses }));
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
      // Find the game to check for ties
      let gameToCheck = null;
      for (const matchGames of Object.values(games)) {
        const foundGame = matchGames?.find(game => game.id === gameId);
        if (foundGame) {
          gameToCheck = foundGame;
          break;
        }
      }
      
      if (!gameToCheck) {
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
        await loadGamesForMatch(matchId);
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

  // Function to check if any match in a round has started
  const hasAnyMatchStarted = (round: any) => {
    if (!round.matches) return false;
    return round.matches.some((match: any) => 
      matchStatuses[match.id] === 'in_progress' || matchStatuses[match.id] === 'completed'
    );
  };
  
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
              await loadGamesForMatch(matchId);
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
            <p className="text-gray-600">Loading...</p>
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
            <p className="text-gray-600 mb-6">Please sign in to access your player profile and tournament information.</p>
            <SignInButton mode="modal">
              <button className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">
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
          <p className="text-gray-600 mb-6">Please complete your player profile to access tournaments and team management.</p>
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
    <main className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Player</h1>
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className="mr-2">Welcome,</span>
            <span className="font-medium">{userProfile?.firstName || user?.firstName || 'User'}</span>
          </div>
          <SignOutButton>
            <button className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 border border-gray-300">
              Sign Out
            </button>
          </SignOutButton>
        </div>
      </div>

      {err && <div className="border border-red-300 bg-red-50 text-red-700 p-3 rounded">{err}</div>}
      {info && <div className="border border-green-300 bg-green-50 text-green-700 p-3 rounded">{info}</div>}


      {/* Tab Navigation */}
      <div className="border-b">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'profile'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('tournaments')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'tournaments'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Tournaments
          </button>
          {captainSet.size > 0 && (
            <button
              onClick={() => setActiveTab('teams')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'teams'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Teams
            </button>
          )}
          <button
            onClick={() => setActiveTab('register')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'register'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Register
          </button>
          {eventManagerData.length > 0 && (
            <button
              onClick={() => setActiveTab('manage')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'manage'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
          <button className="text-sm border rounded px-2 py-1 hover:bg-gray-50" onClick={() => setShowEdit(s => !s)}>
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
                          className="text-2xl font-bold text-center border-0 border-b-2 border-gray-300 focus:outline-none focus:border-blue-500 bg-transparent"
                        />
                        <label className="block text-xs text-gray-500 mt-1">First Name</label>
                      </div>
                      <div>
                        <input
                          type="text"
                          value={form.lastName}
                          onChange={(e) => setForm(f => ({ ...f, lastName: e.target.value }))}
                          placeholder="Last Name"
                          className="text-2xl font-bold text-center border-0 border-b-2 border-gray-300 focus:outline-none focus:border-blue-500 bg-transparent"
                        />
                        <label className="block text-xs text-gray-500 mt-1">Last Name</label>
                      </div>
                    </div>
                  ) : (
                    <h2 className="text-3xl font-bold text-gray-900">
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
                    <div className="w-32 h-40 bg-gray-200 rounded border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden mx-auto">
                      {form.photo ? (
                        <img src={form.photo} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-gray-500 text-sm">No Photo</span>
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
                          <span className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer underline">
                            {form.photo ? 'Change Photo' : 'Choose File'}
                          </span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Second Column: Sex, Age, Primary Club, Club Rating, DUPR */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="w-20 text-sm font-medium text-gray-700">Sex:</label>
                      {showEdit ? (
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="gender"
                              value="MALE"
                              checked={form.gender === 'MALE'}
                              onChange={(e) => setForm(f => ({ ...f, gender: e.target.value as 'MALE' | 'FEMALE' }))}
                              className="text-blue-600"
                            />
                            <span className="text-sm">Male</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="gender"
                              value="FEMALE"
                              checked={form.gender === 'FEMALE'}
                              onChange={(e) => setForm(f => ({ ...f, gender: e.target.value as 'MALE' | 'FEMALE' }))}
                              className="text-blue-600"
                            />
                            <span className="text-sm">Female</span>
                          </label>
                        </div>
                      ) : (
                        <span className="text-gray-900">{overview.player.gender || 'Not provided'}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="w-20 text-sm font-medium text-gray-700">Age:</label>
                      <span className="text-gray-900">{overview.player.age ? `${overview.player.age} years old` : 'Not calculated'}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="w-20 text-sm font-medium text-gray-700">Club:</label>
                      {showEdit ? (
                        <select
                          value={form.clubId || ''}
                          onChange={(e) => setForm(f => ({ ...f, clubId: e.target.value as Id }))}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select Club</option>
                          {(Array.isArray(clubsAll) ? clubsAll : []).map(c => (
                            <option key={c.id} value={c.id}>{c.name}{c.city ? ` (${c.city})` : ''}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-gray-900">{overview.player.club?.name || 'Not provided'}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="w-20 text-sm font-medium text-gray-700">Rating:</label>
                      {showEdit ? (
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="10"
                          value={form.clubRating}
                          onChange={(e) => setForm(f => ({ ...f, clubRating: e.target.value }))}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <span className="text-gray-900">{form.clubRating || 'Not provided'}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="w-20 text-sm font-medium text-gray-700">DUPR:</label>
                      {showEdit ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="8"
                          value={form.dupr}
                          onChange={(e) => setForm(f => ({ ...f, dupr: e.target.value }))}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <span className="text-gray-900">{overview.player.dupr || 'Not provided'}</span>
                      )}
                    </div>
                  </div>

                  {/* Third Column: Address and Contact */}
                  <div className="space-y-3">
                    {/* Address Section */}
                    {!showEdit ? (
                      <div className="flex items-center gap-3">
                        <label className="w-20 text-sm font-medium text-gray-700">Address:</label>
                        <span className="text-gray-900">
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
                          <label className="w-20 text-sm font-medium text-gray-700">City:</label>
                          <input
                            type="text"
                            value={form.city}
                            onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="w-20 text-sm font-medium text-gray-700">Province/State:</label>
                          <input
                            type="text"
                            value={form.region}
                            onChange={(e) => setForm(f => ({ ...f, region: e.target.value }))}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="w-20 text-sm font-medium text-gray-700">Country:</label>
                          <div className="flex-1">
                            <select
                              value={countrySel}
                              onChange={(e) => setCountrySel(e.target.value as CountrySel)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Contact Section */}
                    <div className="flex items-center gap-3">
                      <label className="w-20 text-sm font-medium text-gray-700">Phone:</label>
                      {showEdit ? (
                        <input
                          type="tel"
                          value={form.phone}
                          onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <span className="text-gray-900">{overview.player.phone || 'Not provided'}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="w-20 text-sm font-medium text-gray-700">Email:</label>
                      {showEdit ? (
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <span className="text-gray-900">{overview.player.email || 'Not provided'}</span>
                      )}
                    </div>
                  </div>
                </div>
                
                {showEdit && (
                  <div className="flex gap-2 justify-end">
                    <button
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      onClick={saveProfile}
                    >
                      Save Changes
                    </button>
                    <button
                      className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
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
          <section className="space-y-3">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Tournament</th>
                <th className="py-2 pr-4">Team</th>
                <th className="py-2 pr-4">Stop</th>
                <th className="py-2 pr-4">Dates</th>
                <th className="py-2 pr-4">Team Club</th>
                <th className="py-2 pr-4">Role</th>
              </tr>
            </thead>
            <tbody>
              {(overview?.assignments ?? []).length === 0 && (
                <tr><td colSpan={6} className="py-4 text-gray-600">No assignments yet.</td></tr>
              )}
              {(overview?.assignments ?? []).map((row, i) => {
                const isCaptain = captainSet.has(row.teamId);
                return (
                  <tr key={i} className="border-b">
                    <td className="py-2 pr-4">{row.tournamentName}</td>
                    <td className="py-2 pr-4">{row.teamName}</td>
                    <td className="py-2 pr-4">{row.stopName}</td>
                    <td className="py-2 pr-4">{between(row.stopStartAt ?? null, row.stopEndAt ?? null)}</td>
                    <td className="py-2 pr-4">{row.teamClubName ?? '—'}</td>
                    <td className="py-2 pr-4">
                      {isCaptain ? <span className="px-2 py-0.5 rounded-full border border-amber-400 bg-amber-50">Captain</span> : 'Player'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
        )}

        {activeTab === 'teams' && captainSet.size > 0 && (
          <TeamsTab
            captainTournamentRows={captainTournamentRows}
            activeTournamentId={activeTournamentId}
            setActiveTournamentId={setActiveTournamentId}
            label={label}
            onSaved={() => setInfo('Rosters saved!')}
            onError={(m) => setErr(m)}
          />
        )}

        {activeTab === 'register' && (
          <TournamentRegistrationTab
            userProfile={userProfile}
            onError={(m) => setErr(m)}
            onInfo={(m) => setInfo(m)}
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
  );
}

/* ================= Teams Tab Component ================= */

function TeamsTab({
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
      <h2 className="text-lg font-semibold">Teams</h2>
      
      {/* Tournament List */}
      <div className="space-y-4">
        {captainTournamentRows.length === 0 && (
          <div className="text-gray-600">No captain assignments yet.</div>
        )}
        
        {captainTournamentRows.map((row) => (
          <div key={row.tournamentId} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 
                  className="text-lg font-medium text-blue-600 cursor-pointer hover:text-blue-800"
                  onClick={() => setActiveTournamentId(activeTournamentId === row.tournamentId ? null : row.tournamentId)}
                >
                  {row.tournamentName} <span className="text-xs text-black">- {row.dates}</span>
                </h3>
                <p className="text-sm text-gray-600">
                  Team: {Array.from(row.bracketTeams.values())[0]?.club?.name || 'Unknown'}
                </p>
                <p className="text-sm text-gray-500">
                  Brackets: {row.bracketNames.length ? row.bracketNames.join(', ') : 'General'}
                </p>
              </div>
              <button
                onClick={() => setActiveTournamentId(activeTournamentId === row.tournamentId ? null : row.tournamentId)}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {activeTournamentId === row.tournamentId ? 'Hide Rosters' : 'Manage Rosters'}
              </button>
            </div>
            
            {/* Roster Management - Inline */}
            {activeTournamentId === row.tournamentId && (
              <CaptainRosterEditor
                tournamentId={row.tournamentId}
                tournamentRow={row}
                onClose={() => setActiveTournamentId(null)}
                onSaved={onSaved}
                onError={onError}
                label={label}
              />
            )}
          </div>
        ))}
      </div>
      
      <p className="text-xs text-gray-500">
        Limits are enforced <em>per bracket</em> (unique players across all stops). A player cannot be on multiple brackets in the same tournament.
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

  // Initialize rosters from tournament data
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
      [stopId]: { ...(prev[stopId] ?? {}), [bracketKey]: next }
    }));
  }


  // Bracket limit for a given bracket (team)
  function bracketLimitFor(bracketKey: string): number | null {
    const team = tournamentRow.bracketTeams.get(bracketKey);
    if (!team) return null;
    return (team.bracketLimit ?? team.tournament.maxTeamSize ?? 8);
  }

  // Can we add this player to THIS bracket at THIS stop without breaking the bracket-level cap?
  function canAddToBracket(bracketKey: string, playerId: string, stopId: string): boolean {
    const limit = bracketLimitFor(bracketKey);
    if (!limit) return true; // unlimited

    // Check limit for THIS stop only (not across all stops)
    const currentStopRoster = rosters[stopId]?.[bracketKey] ?? [];
    const currentStopCount = currentStopRoster.length;
    
    // If player is already in this stop's roster, they can be added
    if (currentStopRoster.some(p => p.id === playerId)) return true;
    
    // Check if adding this player would exceed the limit for this stop
    return (currentStopCount + 1) <= limit;
  }

  // Save: PUT per (team × stop)
  async function saveAll() {
    setBusy(true);
    try {
      for (const s of tournamentRow.stops) {
        for (const b of tournamentRow.bracketNames) {
          const team = tournamentRow.bracketTeams.get(b);
          if (!team) continue;
          const list = rosters[s.stopId]?.[b] ?? [];

          // Soft check again for newly added players vs bracket cap for this stop
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
    } finally { setBusy(false); }
  }

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h4 className="text-md font-semibold">Manage Bracket Rosters</h4>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50" onClick={saveAll} disabled={busy}>
              {busy ? 'Saving…' : 'Save All'}
            </button>
            <button className="text-sm underline" onClick={onClose}>Close</button>
          </div>
        </div>

          {/* One block per stop; inside, one roster editor per bracket */}
          {tournamentRow.stops.map((s, idx) => {
            const prev = idx > 0 ? tournamentRow.stops[idx - 1] : null;

            return (
              <div key={s.stopId} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">
                    {s.stopName}
                    <span className="text-gray-500"> • {s.locationName ?? '—'} • {between(s.startAt, s.endAt)}</span>
                  </div>

                  {prev && (
                    <button
                      className="ml-3 px-2 py-1 border rounded text-sm"
                      onClick={() => {
                        const nextForCurr: Record<string, PlayerLite[]> = {};
                        for (const b of tournamentRow.bracketNames) {
                          nextForCurr[b] = (rosters[prev.stopId]?.[b] ?? []).slice();
                        }
                        setRosters(prevAll => ({ ...prevAll, [s.stopId]: nextForCurr }));
                      }}
                      title="Copy rosters from previous stop (per bracket)"
                    >
                      Copy from previous stop
                    </button>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {tournamentRow.bracketNames.map((bKey) => {
                    const team = tournamentRow.bracketTeams.get(bKey)!;
                    const list = rosters[s.stopId]?.[bKey] ?? [];

                    const limit = bracketLimitFor(bKey);
                    const currentStopCount = list.length;
                    const stopProgress = `${currentStopCount} / ${limit ?? '∞'}`;

                    // prevent picking same player into multiple brackets at the SAME stop (UX)
                    const excludeIdsAcrossStop = Object.values(rosters[s.stopId] ?? {}).flat().map(p => p.id);

                    return (
                      <BracketRosterEditor
                        key={`${s.stopId}:${bKey}`}
                        title={`${bKey} — ${stopProgress} for this stop`}
                        stop={s}
                        teamId={team.id}
                        tournamentId={tournamentId}
                        list={list}
                        onChange={(next) => setStopBracketRoster(s.stopId, bKey, next)}
                        canAdd={(playerId) => canAddToBracket(bKey, playerId, s.stopId)}
                        excludeIdsAcrossStop={excludeIdsAcrossStop}
                        label={label}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
  );
}

/* =============== Per-bracket editor (typeahead + list) =============== */

function BracketRosterEditor({
  title,
  stop,
  teamId,
  tournamentId,
  list,
  onChange,
  canAdd,
  excludeIdsAcrossStop,
  label,
}: {
  title: string;
  stop: { stopId: Id; stopName: string; locationName?: string | null; startAt?: string | null; endAt?: string | null };
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
    <div className="border rounded p-3 space-y-2">
      <div className="font-medium">{title}</div>

      <div className="relative">
        <input
          className="w-full rounded px-2 py-2 border"
          placeholder={'Type at least 3 characters to search'}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onFocus={() => { if (options.length) setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
        />
        {open && options.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full bg-white rounded shadow">
            {options.map((opt) => (
              <li
                key={opt.id}
                className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { add(opt); setTerm(''); setOptions([]); setOpen(false); }}
                title="Add to this stop for this bracket"
              >
                {label(opt)}{' '}
                <span className="text-gray-500">• {opt.gender} • {opt.dupr ?? '—'} • {opt.age ?? '—'}</span>
              </li>
            ))}
            {loading && <li className="px-3 py-2 text-sm text-gray-500">Searching…</li>}
          </ul>
        )}
      </div>

      <ul className="space-y-1">
        {list.map((p) => (
          <li key={p.id} className="flex items-center justify-between">
            <span className="text-sm">
              {label(p)} <span className="text-gray-500">• {p.gender} • {p.dupr ?? '—'} • {p.age ?? '—'}</span>
            </span>
            <button className="text-gray-500 hover:text-red-600 text-sm" title="Remove" onClick={() => remove(p.id)}>🗑️</button>
          </li>
        ))}
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
    <div className="p-1.5 bg-white border rounded space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-gray-700">
          {getGameTitle()}
        </div>
        <div className="flex items-center gap-1.5">
          {!isCompleted && (
            <>
              <label className="text-xs font-medium text-gray-600">Court #:</label>
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
              className={`px-2 py-1 text-xs rounded text-white ${
                gameStatus === 'not_started' 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-red-600 hover:bg-red-700'
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
        <div className={`font-medium text-gray-700 whitespace-pre-line ${
          isCompleted && teamAWon ? 'font-bold text-green-800' : ''
        }`}>
          {getTeamALineup()}
        </div>
        
        {/* Score A */}
        {isCompleted ? (
          <div className={`w-8 text-center ${
            teamAWon ? 'text-green-800 font-bold' : 'text-gray-700'
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
          <div className="w-8 text-center text-gray-400">-</div>
        )}
        
        {/* VS */}
        <div className="text-gray-400 font-medium">vs</div>
        
        {/* Score B */}
        {isCompleted ? (
          <div className={`w-8 text-center ${
            teamBWon ? 'text-green-800 font-bold' : 'text-gray-700'
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
          <div className="w-8 text-center text-gray-400">-</div>
        )}
        
        {/* Team B */}
        <div className={`font-medium text-gray-700 whitespace-pre-line ${
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
  const [scheduleData, setScheduleData] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

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
    setExpandedRounds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(roundId)) {
        newSet.delete(roundId);
      } else {
        // Close all other rounds first (only one open at a time)
        newSet.clear();
        newSet.add(roundId);
      }
      return newSet;
    });
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

  const loadSchedule = async (stopId: string, force = false) => {
    if (scheduleData[stopId] && !force) return; // Already loaded
    
    setLoading(prev => ({ ...prev, [stopId]: true }));
    try {
      const response = await fetch(`/api/admin/stops/${stopId}/schedule`);
      if (!response.ok) throw new Error('Failed to load schedule');
      const data = await response.json();
      setScheduleData(prev => ({ ...prev, [stopId]: data || [] }));
      
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
            loadGamesForMatch(matchId);
          }
        });
      }
    } catch (error) {
      console.error('Error loading lineups for stop:', error);
    }
  };

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
    <div className="space-y-4">

      {/* Tournament Accordions */}
      <div className="space-y-3">
        {tournaments.map((tournament) => (
          <div key={tournament.tournamentId} className="border rounded-lg">
            {/* Tournament Header */}
            <div className="flex items-center justify-between p-4 bg-gray-50 border-b">
              <h3 className="font-medium text-lg">{tournament.tournamentName}</h3>
              <div className="text-sm text-gray-600">
                {getTournamentTypeDisplayName(tournament.type)} • {tournament.stops.length} stops
              </div>
            </div>

            {/* Stops Tabs */}
            <div className="p-4">
              {/* Stop Tabs */}
              <div className="border-b border-gray-200 mb-4">
                <nav className="flex space-x-8" aria-label="Tabs">
                  {tournament.stops.map((stop) => (
                    <button
                      key={stop.stopId}
                      onClick={() => {
                        setSelectedStopId(stop.stopId);
                        loadSchedule(stop.stopId);
                      }}
                      className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                        selectedStopId === stop.stopId
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {stop.stopName}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Selected Stop Content */}
              {selectedStopId && (() => {
                const stop = tournament.stops.find(s => s.stopId === selectedStopId);
                if (!stop) return null;
                
                return (
                  <div>
                    {/* Stop Info */}
                    <div className="flex items-center justify-between mb-4 p-2 bg-gray-50 rounded">
                      <div>
                        <p className="text-sm text-gray-600">
                          {stop.locationName && `${stop.locationName} • `}
                          {formatDate(stop.startAt ?? null)} - {formatDate(stop.endAt ?? null)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {scheduleData[stop.stopId]?.length || 0} rounds • {scheduleData[stop.stopId]?.reduce((acc: number, r: any) => acc + (r.matches?.length || 0), 0) || 0} matches • {scheduleData[stop.stopId]?.reduce((acc: number, r: any) => acc + (r.matches?.reduce((matchAcc: number, m: any) => matchAcc + (m.games?.length || 0), 0) || 0), 0) || 0} games
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!scheduleData[stop.stopId]?.some((round: any) => hasAnyMatchStarted(round)) && (
                        <button
                          className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
                          onClick={() => generateSchedule(stop.stopId, stop.stopName)}
                          disabled={loading[stop.stopId]}
                        >
                          {loading[stop.stopId] ? 'Regenerating...' : 'Regenerate Matchups'}
                        </button>
                        )}
                      </div>
                    </div>

                    {/* Schedule Content */}
                    <div className="bg-white">
                        {loading[stop.stopId] ? (
                          <div className="text-center py-4 text-gray-500">Loading schedule...</div>
                        ) : !scheduleData[stop.stopId] || scheduleData[stop.stopId].length === 0 ? (
                          <div className="text-center py-4 text-gray-500">
                            No matchups generated yet. Click "Regenerate Matchups" to create them.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="space-y-2">
                              {scheduleData[stop.stopId].map((round, roundIdx) => {
                                const isEditing = editingRounds.has(round.id);
                                const matches = getMatchesForRound(round, isEditing);
                                
                                // Force re-render when updateKey changes
                                const _ = updateKey;
                                
                                
                                return (
                                  <div key={`${round.id}-${renderKey}-${updateKey}`} className="border rounded">
                                    {/* Round Header */}
                                    <div 
                                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                                      onClick={() => toggleRound(round.id)}
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className={`transform transition-transform ${expandedRounds.has(round.id) ? 'rotate-90' : ''}`}>
                                          ▶
                                        </div>
                                        <h6 className="font-medium text-sm">Round {round.idx + 1}</h6>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {isEditing ? (
                                            <button
                                              className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                saveRoundMatchups(round.id);
                                              }}
                                            >
                                            Confirm Matchups
                                            </button>
                                        ) : !hasAnyMatchStarted(round) ? (
                                          <button
                                            className="px-2 py-1 border rounded text-xs bg-blue-50 hover:bg-blue-100"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleRoundEdit(round.id);
                                            }}
                                          >
                                            Edit Matchups
                                          </button>
                                        ) : (
                                          <span className="text-xs text-gray-500">Match in progress</span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Round Content */}
                                    {expandedRounds.has(round.id) && (
                                      <div className="p-3 border-t bg-gray-50">
                                    
                                    {isEditing && (
                                      <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                                        <strong>Drag teams to swap:</strong> Drag any team over another team to swap their positions.
                                      </div>
                                    )}
                                    
                                    {(() => {
                                      // Group matches by bracket for visual separation
                                      const matchesByBracket: Record<string, any[]> = {};
                                      
                                      matches.forEach((match: any, matchIdx: number) => {
                                        const bracketName = match.bracketName || 'Unknown Bracket';
                                        
                                        if (!matchesByBracket[bracketName]) {
                                          matchesByBracket[bracketName] = [];
                                        }
                                        
                                        matchesByBracket[bracketName].push({ ...match, originalIndex: matchIdx });
                                      });
                                      
                                      // Ensure each bracket has unique local indices
                                      Object.keys(matchesByBracket).forEach(bracketName => {
                                        matchesByBracket[bracketName].forEach((match: any, localIdx: number) => {
                                          match.localIndex = localIdx;
                                        });
                                      });
                                      
                                      return Object.entries(matchesByBracket).map(([bracketName, bracketMatches]) => (
                                        <div key={bracketName} className="space-y-2 mb-4">
                                          <h6 className="font-medium text-sm text-gray-700 border-b pb-1">
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
                                                items={bracketMatches.map((match: any) => [
                                                  `${round.id}-${bracketName}-${match.localIndex}-A`,
                                                  `${round.id}-${bracketName}-${match.localIndex}-B`
                                                ]).flat()}
                                                strategy={noReorderStrategy}
                                    >
                                      <div className="space-y-1">
                                                  {bracketMatches.map((match: any, localMatchIdx: number) => {
                                                    const matchIdx = match.originalIndex;
                                                    const localIndex = match.localIndex;
                                                    return (
                                        <div key={match.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                                                {!match.isBye ? (
                                            <div className="flex items-center gap-2 flex-1">
                                              {/* Team A */}
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
                                                    )) || false
                                                  }
                                                  dragPreview={dragPreview}
                                              />
                                              
                                              <span className="text-gray-500">vs</span>
                                              
                                              {/* Team B */}
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
                                                    )) || false
                                                  }
                                                  dragPreview={dragPreview}
                                              />
                                            </div>
                                          ) : (
                                            <div className="flex items-center gap-3">
                                              <span className="font-medium">
                                                {match.teamA?.name || 'TBD'} vs {match.teamB?.name || 'TBD'}
                                              </span>
                                              {match.isBye && (
                                                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                                  BYE
                                                </span>
                                              )}
                                            </div>
                                          )}
                                          
                                          <div className="flex items-center gap-2">
                                              {(() => {
                                                // Hide Edit Lineup button if any game has started
                                                const hasAnyGameStarted = games[match.id]?.some(game => 
                                                  gameStatuses[game.id] === 'in_progress' || gameStatuses[game.id] === 'completed'
                                                ) || false;
                                                
                                                if (hasAnyGameStarted || matchStatuses[match.id] === 'in_progress' || matchStatuses[match.id] === 'completed') {
                                                  return null;
                                                }
                                                
                                                return (
                                                  <button
                                                    className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                                    onClick={() => {
                                                      console.log('Edit Lineups clicked for match:', match.id);
                                                      setEditingMatch(editingMatch === match.id ? null : match.id);
                                                    }}
                                                  >
                                                    {editingMatch === match.id ? 'Cancel' : 'Edit Lineups'}
                                                  </button>
                                                );
                                              })()}
                                            </div>
                                          </div>
                                                  );
                                                })}
                                              </div>
                                            </SortableContext>
                                          </DndContext>
                                          
                                        ) : (
                                            <div className="space-y-1">
                                              {bracketMatches.map((match: any, localMatchIdx: number) => {
                                                const matchIdx = match.originalIndex;
                                                return (
                                                  <div key={match.id} className="p-2 bg-gray-50 rounded text-sm">
                                                    {/* Confirmed Lineup Display with buttons */}
                                                    {!editingMatch && (() => {
                                                      // Hide lineup area if any game has started
                                                      const hasAnyGameStarted = games[match.id]?.some(game => 
                                                        gameStatuses[game.id] === 'in_progress' || gameStatuses[game.id] === 'completed'
                                                      ) || false;
                                                      
                                                      if (hasAnyGameStarted) {
                                                        return null;
                                                      }
                                                      
                                                      return (
                                                      <div className="flex items-start gap-3">
                                                        {/* Team A Lineup Box */}
                                                        <div className="flex-1 p-2 bg-green-50 border border-green-200 rounded text-sm">
                                                          <div className="font-medium text-green-800 mb-1">{match.teamA?.name || 'Team A'}</div>
                                                          <div className="text-green-700">
                                                            {lineups[match.id] && lineups[match.id][match.teamA?.id || 'teamA']?.length > 0 ? (
                                                              lineups[match.id][match.teamA?.id || 'teamA']?.map((player, idx) => (
                                                                <div key={player.id} className="text-xs">
                                                                  {idx + 1}. {player.name} ({player.gender === 'MALE' ? 'M' : 'F'})
                                                                </div>
                                                              ))
                                                            ) : (
                                                              <div className="text-xs text-gray-500">No lineup set</div>
                                                            )}
                                                          </div>
                                                        </div>
                                                        
                                                        {/* VS separator */}
                                                        <div className="text-gray-500 font-medium text-sm">vs</div>
                                                        
                                                        {/* Team B Lineup Box */}
                                                        <div className="flex-1 p-2 bg-green-50 border border-green-200 rounded text-sm">
                                                          <div className="font-medium text-green-800 mb-1">{match.teamB?.name || 'Team B'}</div>
                                                          <div className="text-green-700">
                                                            {lineups[match.id] && lineups[match.id][match.teamB?.id || 'teamB']?.length > 0 ? (
                                                              lineups[match.id][match.teamB?.id || 'teamB']?.map((player, idx) => (
                                                                <div key={player.id} className="text-xs">
                                                                  {idx + 1}. {player.name} ({player.gender === 'MALE' ? 'M' : 'F'})
                                                                </div>
                                                              ))
                                                            ) : (
                                                              <div className="text-xs text-gray-500">No lineup set</div>
                                                            )}
                                                          </div>
                                                        </div>
                                                        
                                                        {/* Buttons */}
                                                        <div className="flex flex-col gap-2">
                                                          {matchStatuses[match.id] !== 'in_progress' && matchStatuses[match.id] !== 'completed' && (
                                                            <button
                                                              className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                                              onClick={() => {
                                                                console.log('Edit Lineups clicked for match:', match.id);
                                                                setEditingMatch(editingMatch === match.id ? null : match.id);
                                                              }}
                                                            >
                                                              {editingMatch === match.id ? 'Cancel' : 'Edit Lineups'}
                                                            </button>
                                                          )}
                                                        </div>
                                                      </div>
                                                      );
                                                    })()}
                                                    
                                                    {/* Games Display - only show when both teams have confirmed lineups */}
                                                    {lineups[match.id] && 
                                                     lineups[match.id][match.teamA?.id || 'teamA']?.length === 4 && 
                                                     lineups[match.id][match.teamB?.id || 'teamB']?.length === 4 && (
                                                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                                                        <h4 className="text-sm font-semibold text-blue-800 mb-3">
                                                          Scores - {match.teamA?.name || 'Team A'} vs {match.teamB?.name || 'Team B'}
                                                        </h4>
                                                        <div className="space-y-4">
                                                          {/* Men's and Women's Doubles Row */}
                                                          <div className="grid grid-cols-2 gap-3">
                                                            {games[match.id]?.filter(game => game.slot === 'MENS_DOUBLES' || game.slot === 'WOMENS_DOUBLES').map((game) => (
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

                                                          {/* Mixed Doubles 1 & 2 Row */}
                                                          <div className="grid grid-cols-2 gap-3">
                                                            {games[match.id]?.filter(game => game.slot === 'MIXED_1' || game.slot === 'MIXED_2').map((game) => (
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
                                                          
                                                          {/* Tiebreaker Game - only show when all 4 games are complete and tied */}
                                                          {(() => {
                                                            const completedGames = games[match.id]?.filter(g => g.slot !== 'TIEBREAKER' && g.isComplete) || [];
                                                            const teamAWins = completedGames.filter(g => g.teamAScore > g.teamBScore).length;
                                                            const teamBWins = completedGames.filter(g => g.teamBScore > g.teamAScore).length;
                                                            const needsTiebreaker = completedGames.length === 4 && teamAWins === 2 && teamBWins === 2;
                                                            
                                                            return needsTiebreaker && games[match.id]?.find(g => g.slot === 'TIEBREAKER') && (
                                                              <GameScoreBox
                                                                game={games[match.id].find(g => g.slot === 'TIEBREAKER')}
                                                                match={match}
                                                                gameStatuses={gameStatuses}
                                                                lineups={lineups}
                                                                startGame={startGame}
                                                                endGame={endGame}
                                                                updateGameScore={updateGameScore}
                                                                updateGameCourtNumber={updateGameCourtNumber}
                                                              />
                                                            );
                                                          })()}
                                                        </div>
                                                      </div>
                                                    )}
                                                    
                                                    {/* Third row: Inline Lineup Editor */}
                                                    {editingMatch === match.id && (
                                                      <div className="mt-2">
                                                        <InlineLineupEditor
                                                          matchId={match.id}
                                                          stopId={round.stopId}
                                                          teamA={match.teamA || { id: 'teamA', name: 'Team A' }}
                                                          teamB={match.teamB || { id: 'teamB', name: 'Team B' }}
                                                          teamARoster={teamRosters[match.teamA?.id || ''] || []}
                                                          teamBRoster={teamRosters[match.teamB?.id || ''] || []}
                                                          fetchTeamRoster={fetchTeamRoster}
                                                          lineups={lineups}
                                                          onSave={async (lineups) => {
                                                            console.log('Save button clicked (non-draggable), lineups data:', lineups);
                                                            try {
                                                              // Validate lineups have 4 players each
                                                              if (lineups.teamA.length !== 4 || lineups.teamB.length !== 4) {
                                                                throw new Error(`Invalid lineup: Team A has ${lineups.teamA.length} players, Team B has ${lineups.teamB.length} players. Need exactly 4 each.`);
                                                              }
                                                              
                                                              console.log('Saving lineups for teams (non-draggable):', {
                                                                teamA: { id: match.teamA?.id, players: lineups.teamA.map(p => ({ id: p.id, name: p.name })) },
                                                                teamB: { id: match.teamB?.id, players: lineups.teamB.map(p => ({ id: p.id, name: p.name })) }
                                                              });
                                                              
                                                              // Use batch save API
                                                              const response = await fetch(`/api/admin/stops/${stop.stopId}/lineups`, {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({
                                                                  lineups: {
                                                                    [match.id]: {
                                                                      [match.teamA?.id || 'teamA']: lineups.teamA,
                                                                      [match.teamB?.id || 'teamB']: lineups.teamB
                                                                    }
                                                                  }
                                                                })
                                                              });
                                                              
                                                              if (!response.ok) {
                                                                const errorText = await response.text();
                                                                throw new Error(`Save failed: ${response.status} ${errorText}`);
                                                              }
                                                              
                                                              // Update local state
                                                              setLineups(prev => ({
                                                                ...prev,
                                                                [match.id]: {
                                                                  [match.teamA?.id || 'teamA']: lineups.teamA,
                                                                  [match.teamB?.id || 'teamB']: lineups.teamB
                                                                }
                                                              }));
                                                              
                                                              // Load games for this match to show them immediately
                                                              await loadGamesForMatch(match.id);
                                                              
                                                              setEditingMatch(null);
                                                              onInfo('Lineups saved successfully!');
                                                            } catch (error) {
                                                              console.error('Error saving lineups:', error);
                                                              onError(`Failed to save lineups: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                                            }
                                                          }}
                                                          onCancel={() => setEditingMatch(null)}
                                                        />
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      ));
                                    })()}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        ))}
      </div>


      {/* No tournaments message */}
      {tournaments.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          You are not assigned as an event manager for any tournaments.
        </div>
      )}

      {/* Lineup Editor Modal */}
      {editingLineup && (
        <LineupEditor
          matchId={editingLineup.matchId}
          teamId={editingLineup.teamId}
          teamName="Team Name" // TODO: Get actual team name
          availablePlayers={[]} // TODO: Get team roster
          currentLineup={lineups[editingLineup.matchId]?.[editingLineup.teamId] || []}
          onSave={(lineup) => {
            setLineups(prev => {
              const newLineups = { ...prev };
              if (!newLineups[editingLineup.matchId]) {
                newLineups[editingLineup.matchId] = {};
              }
              newLineups[editingLineup.matchId][editingLineup.teamId] = lineup;
              return newLineups;
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
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Edit Lineup - {teamName}</h3>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={onCancel}
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            Select 4 players: 2 men and 2 women
          </p>
          <div className="flex gap-2">
            <span className={`px-2 py-1 rounded text-xs ${lineup.filter(p => p.gender === 'MALE').length === 2 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              Men: {lineup.filter(p => p.gender === 'MALE').length}/2
            </span>
            <span className={`px-2 py-1 rounded text-xs ${lineup.filter(p => p.gender === 'FEMALE').length === 2 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
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
                      ? 'bg-blue-100 text-blue-800'
                      : 'hover:bg-gray-100'
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
                      ? 'bg-blue-100 text-blue-800'
                      : 'hover:bg-gray-100'
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
              <div key={player.id} className="flex items-center justify-between px-2 py-1 bg-gray-50 rounded">
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
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
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
  teamARoster,
  teamBRoster,
  fetchTeamRoster,
  lineups,
  onSave,
  onCancel,
}: {
  matchId: string;
  stopId: string;
  teamA: { id: string; name: string };
  teamB: { id: string; name: string };
  teamARoster: PlayerLite[];
  teamBRoster: PlayerLite[];
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
          
          const rosterA = dataA.items || [];
          const rosterB = dataB.items || [];
          
          setLoadedRosters({ teamA: rosterA, teamB: rosterB });
        } catch (error) {
          console.error('Failed to load stop-specific rosters:', error);
          // Fallback to tournament-wide rosters
          const [rosterA, rosterB] = await Promise.all([
            fetchTeamRoster(teamA.id),
            fetchTeamRoster(teamB.id)
          ]);
          setLoadedRosters({ teamA: rosterA, teamB: rosterB });
        }
      }
    };
    loadRosters();
  }, [teamA.id, teamB.id, stopId, fetchTeamRoster]);

  // Initialize lineups when component mounts or when editing starts
  useEffect(() => {
    // Check if we have existing lineups for this match
    const existingLineups = lineups[matchId];
    if (existingLineups) {
      const teamALineupData = existingLineups[teamA.id] || [];
      const teamBLineupData = existingLineups[teamB.id] || [];
      
      // Set the lineups with existing data
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
      
      // Set selected players
      const allSelectedPlayers = new Set([
        ...teamALineupData.map(p => p.id),
        ...teamBLineupData.map(p => p.id)
      ]);
      setSelectedPlayers(allSelectedPlayers);
    } else {
      // Reset to empty state
      setTeamALineup([undefined, undefined, undefined, undefined]);
      setTeamBLineup([undefined, undefined, undefined, undefined]);
      setSelectedPlayers(new Set());
    }
  }, [matchId, teamA.id, teamB.id]); // Removed 'lineups' from dependencies

  // Separate effect to handle lineup changes for this specific match
  useEffect(() => {
    const existingLineups = lineups[matchId];
    if (existingLineups) {
      const teamALineupData = existingLineups[teamA.id] || [];
      const teamBLineupData = existingLineups[teamB.id] || [];
      
      // Only update if the data has actually changed
      const currentTeamAIds = teamALineup.map(p => p?.id).filter(Boolean);
      const currentTeamBIds = teamBLineup.map(p => p?.id).filter(Boolean);
      const newTeamAIds = teamALineupData.map(p => p.id);
      const newTeamBIds = teamBLineupData.map(p => p.id);
      
      const teamAChanged = JSON.stringify(currentTeamAIds.sort()) !== JSON.stringify(newTeamAIds.sort());
      const teamBChanged = JSON.stringify(currentTeamBIds.sort()) !== JSON.stringify(newTeamBIds.sort());
      
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
    }
  }, [lineups[matchId]]); // Only watch this specific match's lineup data

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
      
      // Remove the new player from selectedPlayers if they're already selected elsewhere
      if (newSet.has(player.id)) {
        newSet.delete(player.id);
      }
      
      // Add the new player
      newSet.add(player.id);
      
      return newSet;
    });

    // Update lineup state
    if (isTeamA) {
      setTeamALineup(prev => {
        const newLineup = [...prev];
        
        // Remove the new player from other slots if they exist
        for (let i = 0; i < newLineup.length; i++) {
          if (newLineup[i]?.id === player.id) {
            newLineup[i] = undefined;
          }
        }
        
        // Add player to the new slot
        newLineup[slotIndex] = player;
        return newLineup;
      });
    } else {
      setTeamBLineup(prev => {
        const newLineup = [...prev];
        
        // Remove the new player from other slots if they exist
        for (let i = 0; i < newLineup.length; i++) {
          if (newLineup[i]?.id === player.id) {
            newLineup[i] = undefined;
          }
        }
        
        // Add player to the new slot
        newLineup[slotIndex] = player;
        return newLineup;
      });
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
      if (p.gender !== expectedGender) return false;
      
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

  return (
    <div className="mt-3 p-3 bg-gray-50 rounded border">
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
            className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Team A */}
        <div>
          <h4 className="text-xs font-medium mb-2 text-gray-600">{teamA.name}</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium w-4">1:</label>
              <select
                className="flex-1 p-1 text-xs border rounded"
                value={teamALineup[0]?.id || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    const player = loadedRosters.teamA.find(p => p.id === e.target.value);
                    if (player) addPlayerToLineup(player, teamA.id, 0);
                  } else if (teamALineup[0]) {
                    removePlayerFromLineup(teamALineup[0].id, teamA.id, 0);
                  }
                }}
              >
                <option value="">Select Player 1</option>
                {getAvailablePlayers(teamA.id, 0).map(player => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium w-4">2:</label>
              <select
                className="flex-1 p-1 text-xs border rounded"
                value={teamALineup[1]?.id || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    const player = loadedRosters.teamA.find(p => p.id === e.target.value);
                    if (player) addPlayerToLineup(player, teamA.id, 1);
                  } else if (teamALineup[1]) {
                    removePlayerFromLineup(teamALineup[1].id, teamA.id, 1);
                  }
                }}
              >
                <option value="">Select Player 2</option>
                {getAvailablePlayers(teamA.id, 1).map(player => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium w-4">3:</label>
              <select
                className="flex-1 p-1 text-xs border rounded"
                value={teamALineup[2]?.id || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    const player = loadedRosters.teamA.find(p => p.id === e.target.value);
                    if (player) addPlayerToLineup(player, teamA.id, 2);
                  } else if (teamALineup[2]) {
                    removePlayerFromLineup(teamALineup[2].id, teamA.id, 2);
                  }
                }}
              >
                <option value="">Select Player 3</option>
                {getAvailablePlayers(teamA.id, 2).map(player => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium w-4">4:</label>
              <select
                className="flex-1 p-1 text-xs border rounded"
                value={teamALineup[3]?.id || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    const player = loadedRosters.teamA.find(p => p.id === e.target.value);
                    if (player) addPlayerToLineup(player, teamA.id, 3);
                  } else if (teamALineup[3]) {
                    removePlayerFromLineup(teamALineup[3].id, teamA.id, 3);
                  }
                }}
              >
                <option value="">Select Player 4</option>
                {getAvailablePlayers(teamA.id, 3).map(player => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Team B */}
        <div>
          <h4 className="text-xs font-medium mb-2 text-gray-600">{teamB.name}</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium w-4">1:</label>
              <select
                className="flex-1 p-1 text-xs border rounded"
                value={teamBLineup[0]?.id || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    const player = loadedRosters.teamB.find(p => p.id === e.target.value);
                    if (player) addPlayerToLineup(player, teamB.id, 0);
                  } else if (teamBLineup[0]) {
                    removePlayerFromLineup(teamBLineup[0].id, teamB.id, 0);
                  }
                }}
              >
                <option value="">Select Player 1</option>
                {getAvailablePlayers(teamB.id, 0).map(player => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium w-4">2:</label>
              <select
                className="flex-1 p-1 text-xs border rounded"
                value={teamBLineup[1]?.id || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    const player = loadedRosters.teamB.find(p => p.id === e.target.value);
                    if (player) addPlayerToLineup(player, teamB.id, 1);
                  } else if (teamBLineup[1]) {
                    removePlayerFromLineup(teamBLineup[1].id, teamB.id, 1);
                  }
                }}
              >
                <option value="">Select Player 2</option>
                {getAvailablePlayers(teamB.id, 1).map(player => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium w-4">3:</label>
              <select
                className="flex-1 p-1 text-xs border rounded"
                value={teamBLineup[2]?.id || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    const player = loadedRosters.teamB.find(p => p.id === e.target.value);
                    if (player) addPlayerToLineup(player, teamB.id, 2);
                  } else if (teamBLineup[2]) {
                    removePlayerFromLineup(teamBLineup[2].id, teamB.id, 2);
                  }
                }}
              >
                <option value="">Select Player 3</option>
                {getAvailablePlayers(teamB.id, 2).map(player => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium w-4">4:</label>
              <select
                className="flex-1 p-1 text-xs border rounded"
                value={teamBLineup[3]?.id || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    const player = loadedRosters.teamB.find(p => p.id === e.target.value);
                    if (player) addPlayerToLineup(player, teamB.id, 3);
                  } else if (teamBLineup[3]) {
                    removePlayerFromLineup(teamBLineup[3].id, teamB.id, 3);
                  }
                }}
              >
                <option value="">Select Player 4</option>
                {getAvailablePlayers(teamB.id, 3).map(player => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
