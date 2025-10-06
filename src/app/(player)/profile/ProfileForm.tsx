'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';

import {
  CA_PROVINCES,
  US_STATES,
  CountrySel,
  fortyYearsAgoISO,
  useProfileFormState,
} from '@/app/(player)/shared/useProfileData';

import type { UserProfile } from '@/types';
import Image from 'next/image';

type ClubOption = {
  id: string;
  name: string;
  city?: string | null;
};

type ProfileFormProps = {
  profile: UserProfile | null;
  clubs: ClubOption[];
  loading: boolean;
  onSave: (payload: {
    firstName: string;
    lastName: string;
    gender: 'MALE' | 'FEMALE';
    clubId: string;
    email: string;
    phone: string;
    city: string;
    region: string;
    country: string;
    duprSingles: string;
    duprDoubles: string;
    clubRatingSingles: string;
    clubRatingDoubles: string;
    birthday: string;
    displayAge: boolean;
    displayLocation: boolean;
    photo?: string | null;
  }) => Promise<boolean>;
  onError: (message: string | null) => void;
  onInfo: (message: string | null) => void;
};

export function ProfileForm({ profile, clubs, loading, onSave, onError, onInfo }: ProfileFormProps) {
  const {
    form,
    setForm,
    countrySel,
    setCountrySel,
    countryOther,
    setCountryOther,
    birthday,
    setBirthday,
    hydrateFromProfile,
  } = useProfileFormState(profile);

  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'performance' | 'activity'>('performance');
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [clubSearch, setClubSearch] = useState('');
  const [showClubDropdown, setShowClubDropdown] = useState(false);

  // Format phone number for display
  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone; // Return original if not 10 digits
  };

  // Filter clubs based on search
  const filteredClubs = clubs.filter(club => 
    club.name.toLowerCase().includes(clubSearch.toLowerCase()) ||
    (club.city && club.city.toLowerCase().includes(clubSearch.toLowerCase()))
  ).slice(0, 10); // Limit to 10 results

  // Click outside handler for club dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showClubDropdown) {
        const target = event.target as Element;
        if (!target.closest('.club-dropdown-container')) {
          setShowClubDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showClubDropdown]);

  useEffect(() => {
    if (profile) {
      hydrateFromProfile(profile);
      if (profile.country && profile.country !== 'Canada' && profile.country !== 'USA') {
        setCountryOther(profile.country);
        setCountrySel('Other');
      }
      if (profile.birthday) {
        const birthdayStr = profile.birthday instanceof Date 
          ? profile.birthday.toISOString().slice(0, 10)
          : '';
        setBirthday(birthdayStr);
      }
      // Initialize club search with current club name
      if (profile.club) {
        setClubSearch(profile.club.name);
      }
    } else {
      setBirthday(fortyYearsAgoISO());
    }
  }, [hydrateFromProfile, profile, setBirthday, setCountryOther, setCountrySel]);

  // Fetch tournaments and games data
  useEffect(() => {
    const fetchData = async () => {
      if (!profile) return;
      
      setDataLoading(true);
      try {
        // Fetch tournaments
        const tournamentsRes = await fetch('/api/player/tournaments');
        if (tournamentsRes.ok) {
          const tournamentsData = await tournamentsRes.json();
          setTournaments(tournamentsData.tournaments || []);
        }

        // Fetch games
        const gamesRes = await fetch('/api/player/games');
        if (gamesRes.ok) {
          const gamesData = await gamesRes.json();
          setGames(gamesData.games || []);
        }
      } catch (error) {
        console.error('Error fetching profile data:', error);
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [profile]);

  const handleChange = useCallback(<K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, [setForm]);

  const countryOptions = useMemo(() => (
    <select
      value={countrySel}
      onChange={(event) => {
        const next = event.target.value as CountrySel;
        setCountrySel(next);
        if (next !== 'Other') {
          setCountryOther('');
        }
      }}
      className="input"
    >
      <option value="Canada">Canada</option>
      <option value="USA">USA</option>
      <option value="Other">Other</option>
    </select>
  ), [countrySel, setCountrySel, setCountryOther]);

  const save = async () => {
    const country = countrySel === 'Other' ? countryOther : countrySel;

    const success = await onSave({
      firstName: form.firstName,
      lastName: form.lastName,
      gender: form.gender,
      clubId: form.clubId,
      city: form.city,
      region: form.region,
      country,
      phone: form.phone,
      email: form.email,
      duprSingles: form.duprSingles,
      duprDoubles: form.duprDoubles,
      clubRatingSingles: form.clubRatingSingles,
      clubRatingDoubles: form.clubRatingDoubles,
      birthday,
      displayAge: form.displayAge,
      displayLocation: form.displayLocation,
      photo: form.photo || undefined,
    });

    if (success) {
      setEditing(false);
      onInfo('Profile saved successfully');
    }
  };

  const cancel = () => {
    if (profile) {
      hydrateFromProfile(profile);
      setEditing(false);
      onInfo(null);
      onError(null);
    }
  };

  if (!profile) {
    return null;
  }

  // Calculate age from birthday
  const calculateAge = (birthday: string) => {
    if (!birthday) return null;
    const today = new Date();
    const birthDate = new Date(birthday);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const age = calculateAge(birthday);
  const locationString = [form.city, form.region, countrySel === 'Other' ? countryOther : countrySel]
    .filter(Boolean)
    .join(', ') || '—';

  if (editing) {
  return (
      <div className="space-y-6">
      <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-primary">Edit Profile</h2>
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={save} disabled={loading}>
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
            <button className="btn btn-ghost" onClick={cancel}>
              Cancel
            </button>
          </div>
        </div>

        {/* Edit Form - Similar to PlayerModal styling */}
        <div className="bg-surface-1 rounded-lg border border-subtle p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Left Column */}
            <div className="space-y-6">
            <div>
                <label className="block text-sm font-medium text-primary mb-1">First Name *</label>
              <input
                type="text"
                value={form.firstName}
                onChange={(event) => handleChange('firstName', event.target.value)}
                  className="input w-full"
                  placeholder="Enter first name"
              />
            </div>

            <div>
                <label className="block text-sm font-medium text-primary mb-1">Last Name *</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(event) => handleChange('lastName', event.target.value)}
                  className="input w-full"
                  placeholder="Enter last name"
              />
            </div>

            <div>
                <label className="block text-sm font-medium text-primary mb-1">Gender *</label>
                <div className="flex gap-2">
                {(['MALE', 'FEMALE'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleChange('gender', value)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        form.gender === value
                          ? 'bg-secondary text-white shadow-md'
                          : 'bg-gray-200 text-black hover:bg-gray-300'
                      }`}
                    >
                      {value === 'MALE' ? 'Male' : 'Female'}
                    </button>
                ))}
              </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-primary mb-1">Birthday *</label>
              <input
                  type="date"
                  value={birthday}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setBirthday(event.target.value)}
                  className="input w-full"
                />
          </div>

            <div>
                <label className="block text-sm font-medium text-primary mb-1">Primary Club *</label>
                <div className="relative club-dropdown-container">
                  <input
                    type="text"
                    value={clubSearch}
                    onChange={(event) => setClubSearch(event.target.value)}
                    onFocus={() => setShowClubDropdown(true)}
                    className="input w-full"
                    placeholder="Type 3+ characters to search clubs"
                  />
                  {showClubDropdown && filteredClubs.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredClubs.map((club) => (
                        <div
                          key={club.id}
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-gray-900"
                          onClick={() => {
                            handleChange('clubId', club.id);
                            setClubSearch(club.name);
                            setShowClubDropdown(false);
                          }}
                        >
                    {club.name}{club.city ? ` (${club.city})` : ''}
                        </div>
                ))}
                    </div>
                  )}
                </div>
            </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
            <div>
                <label className="block text-sm font-medium text-primary mb-1">City</label>
              <input
                type="text"
                value={form.city}
                onChange={(event) => handleChange('city', event.target.value)}
                  className="input w-full"
                  placeholder="Enter city"
              />
            </div>

            <div>
                <label className="block text-sm font-medium text-primary mb-1">Prov/State</label>
              <select
                  className="input w-full"
                value={form.region}
                onChange={(event) => handleChange('region', event.target.value)}
              >
                <option value="">Select {countrySel === 'Canada' ? 'Province' : 'State'}</option>
                {(countrySel === 'Canada' ? CA_PROVINCES : US_STATES).map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-primary mb-1">Country</label>
              {countryOptions}
              {countrySel === 'Other' && (
                <input
                  type="text"
                  value={countryOther}
                  onChange={(event) => setCountryOther(event.target.value)}
                    className="input w-full mt-2"
                  placeholder="Enter country"
                  />
                )}
          </div>

            <div>
                <label className="block text-sm font-medium text-primary mb-1">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => handleChange('phone', event.target.value)}
                  className="input w-full"
                  placeholder="Enter phone number"
              />
            </div>

            <div>
                <label className="block text-sm font-medium text-primary mb-1">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(event) => handleChange('email', event.target.value)}
                  className="input w-full"
                  placeholder="Enter email address"
                />
              </div>
            </div>
          </div>

          {/* Ratings Section */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-primary mb-4">Ratings</h3>
            <div className="grid grid-cols-4 gap-4">
              {/* DUPR Singles */}
              <div>
                <label className="block text-sm font-medium text-muted mb-1">DUPR Singles</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="8"
                  value={form.duprSingles || ''}
                  onChange={(event) => handleChange('duprSingles', event.target.value)}
                  className="input w-full"
                  placeholder="0.00"
                />
              </div>
              
              {/* DUPR Doubles */}
              <div>
                <label className="block text-sm font-medium text-muted mb-1">DUPR Doubles</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="8"
                  value={form.duprDoubles || ''}
                  onChange={(event) => handleChange('duprDoubles', event.target.value)}
                  className="input w-full"
                  placeholder="0.00"
                />
              </div>
              
              {/* Club Rating Singles */}
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Club Singles</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={form.clubRatingSingles || ''}
                  onChange={(event) => handleChange('clubRatingSingles', event.target.value)}
                  className="input w-full"
                  placeholder="0.0"
                />
              </div>
              
              {/* Club Rating Doubles */}
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Club Doubles</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={form.clubRatingDoubles || ''}
                  onChange={(event) => handleChange('clubRatingDoubles', event.target.value)}
                  className="input w-full"
                  placeholder="0.0"
                />
              </div>
            </div>
          </div>

          {/* Privacy Settings */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-primary mb-4">Privacy</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleChange('displayAge', !form.displayAge)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    form.displayAge ? 'bg-secondary' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      form.displayAge ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-sm font-medium text-primary">Display Age</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleChange('displayLocation', !form.displayLocation)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    form.displayLocation ? 'bg-secondary' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      form.displayLocation ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-sm font-medium text-primary">Display Location</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="bg-surface-1 rounded-lg border border-subtle p-6">
        <div className="flex items-start gap-6">
          {/* Profile Photo */}
          <div className="flex-shrink-0">
            <div className="w-24 h-24 rounded-full bg-surface-2 flex items-center justify-center overflow-hidden">
              {form.photo ? (
                <Image
                  src={form.photo}
                  alt="Profile"
                  width={96}
                  height={96}
                  className="w-24 h-24 rounded-full object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-surface-3 flex items-center justify-center text-muted text-2xl">
                  👤
                </div>
              )}
            </div>
          </div>

          {/* Profile Info */}
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-primary">{form.firstName} {form.lastName}</h1>
                <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-muted">
                  <span>{form.gender === 'MALE' ? 'M' : 'F'} • {age || '—'} • {locationString}</span>
                  {form.email && <span>📧 {form.email}</span>}
                  {form.phone && <span>📞 {formatPhoneNumber(form.phone)}</span>}
                  {profile?.club && <span>🏢 {profile.club.name}</span>}
                </div>
              </div>
              <button className="btn btn-ghost" onClick={() => setEditing(true)}>
                Edit Profile
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Performance/Activity Tabs */}
      <div className="bg-surface-1 rounded-lg border border-subtle">
        <div className="border-b border-subtle">
          <nav className="flex space-x-8 px-6">
            <button 
              onClick={() => setActiveTab('performance')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'performance' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-muted hover:text-primary'
              }`}
            >
              Performance
            </button>
            <button 
              onClick={() => setActiveTab('activity')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'activity' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-muted hover:text-primary'
              }`}
            >
              Activity
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'performance' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Side - Ratings and Stats */}
              <div className="space-y-8">
                {/* Ratings Section */}
                <div>
                  <h3 className="text-lg font-semibold text-primary mb-4">Ratings</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {/* DUPR Section */}
                    <div className="bg-blue-600 rounded-lg p-4">
                      <h4 className="text-md font-medium text-white mb-3 text-center">DUPR</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-white">
                            {form.duprSingles || 'NR'}
                          </div>
                          <div className="text-sm text-blue-100">Singles</div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-white">
                            {form.duprDoubles || 'NR'}
                          </div>
                          <div className="text-sm text-blue-100">Doubles</div>
                        </div>
                      </div>
                    </div>

                    {/* Club Rating Section */}
                    <div className="bg-blue-600 rounded-lg p-4">
                      <h4 className="text-md font-medium text-white mb-3 text-center">Club Rating</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-white">
                            {form.clubRatingSingles || 'NR'}
                          </div>
                          <div className="text-sm text-blue-100">Singles</div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-white">
                            {form.clubRatingDoubles || 'NR'}
                          </div>
                          <div className="text-sm text-blue-100">Doubles</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats Section */}
                <div>
                  <h3 className="text-lg font-semibold text-primary mb-4">Statistics</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-green-500">👍</span>
                        <span className="text-sm text-muted">Wins</span>
                      </div>
                      <span className="font-semibold text-primary">—</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-red-500">👎</span>
                        <span className="text-sm text-muted">Losses</span>
                      </div>
                      <span className="font-semibold text-primary">—</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-blue-500">🎯</span>
                        <span className="text-sm text-muted">Avg Points</span>
                      </div>
                      <span className="font-semibold text-primary">—</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-purple-500">👥</span>
                        <span className="text-sm text-muted">Avg Partner</span>
                      </div>
                      <span className="font-semibold text-primary">—</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-orange-500">⚔️</span>
                        <span className="text-sm text-muted">Avg Opponent</span>
                      </div>
                      <span className="font-semibold text-primary">—</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-yellow-500">⭐</span>
                        <span className="text-sm text-muted">Half-Life</span>
                      </div>
                      <span className="font-semibold text-primary">—</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side - Tournaments */}
              <div>
                <h3 className="text-lg font-semibold text-primary mb-4">Tournaments</h3>
                {dataLoading ? (
                  <div className="text-center py-8 text-muted">
                    <p>Loading tournaments...</p>
                  </div>
                ) : tournaments.length > 0 ? (
                  <div className="space-y-3">
                    {tournaments.map((tournament) => (
                      <div key={tournament.id} className="border border-subtle rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-primary">{tournament.name}</h4>
                            <p className="text-sm text-muted mt-1">
                              {tournament.type.replace('_', ' ')} • {new Date(tournament.date).toLocaleDateString()}
                            </p>
                            <p className="text-sm text-secondary mt-1">
                              Team: {tournament.team.name} ({tournament.team.club.name})
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted">
                    <p>No tournaments yet</p>
                    <p className="text-sm">Tournament data will appear here</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Activity Tab Content */
            <div>
              <h3 className="text-lg font-semibold text-primary mb-4">Recent Games</h3>
              {dataLoading ? (
                <div className="text-center py-8 text-muted">
                  <p>Loading games...</p>
                </div>
              ) : games.length > 0 ? (
                <div className="space-y-3">
                  {games.map((game) => (
                    <div key={game.id} className="border border-subtle rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-muted">
                              {game.slot?.replace('_', ' ') || 'Game'}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              game.isComplete ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {game.isComplete ? 'Complete' : 'In Progress'}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-muted">
                            <div>
                              <span className="font-medium text-primary">{game.playerTeam?.name || 'Your Team'}</span>
                              <span className="ml-2 text-secondary">({game.playerTeam?.club?.name})</span>
                            </div>
                            <span className="text-secondary">vs</span>
                            <div>
                              <span className="font-medium text-primary">{game.opponentTeam?.name || 'Opponent Team'}</span>
                              <span className="ml-2 text-secondary">({game.opponentTeam?.club?.name})</span>
                            </div>
                          </div>
                          
                          {game.teamAScore !== null && game.teamBScore !== null && (
                            <div className="mt-2 text-lg font-semibold text-primary">
                              {game.teamAScore} - {game.teamBScore}
                            </div>
                          )}
                          
                          <div className="mt-2 text-xs text-secondary">
                            {game.stop?.name} • {new Date(game.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted">
                  <p>No games yet</p>
                  <p className="text-sm">Game data will appear here</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

