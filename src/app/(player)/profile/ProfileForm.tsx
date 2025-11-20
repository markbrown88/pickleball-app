'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';

import {
  CA_PROVINCES,
  US_STATES,
  CountrySel,
  useProfileFormState,
} from '@/app/(player)/shared/useProfileData';

import type { UserProfile } from '@/types';
import Image from 'next/image';
import { fetchWithActAs } from '@/lib/fetchWithActAs';

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
  const [stats, setStats] = useState<any>(null);
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
      // Birthday is handled by hydrateFromProfile, no need to set it again here
      // Initialize club search with current club name
      if (profile.club) {
        setClubSearch(profile.club.name);
      }
    }
  }, [hydrateFromProfile, profile, setCountryOther, setCountrySel]);

  // Fetch tournaments, games, and stats data
  useEffect(() => {
    const fetchData = async () => {
      if (!profile) return;

      setDataLoading(true);
      try {
        // Fetch tournaments
        const tournamentsRes = await fetchWithActAs('/api/player/tournaments');
        if (tournamentsRes.ok) {
          const tournamentsData = await tournamentsRes.json();
          console.log('Tournaments API response:', tournamentsData);
          const tournamentsList = tournamentsData.tournaments || [];
          console.log('Tournaments list:', tournamentsList);
          console.log('Tournaments count:', tournamentsList.length);
          setTournaments(tournamentsList);
        } else {
          console.error('Failed to fetch tournaments:', tournamentsRes.status, tournamentsRes.statusText);
          const errorText = await tournamentsRes.text();
          console.error('Tournaments error response:', errorText);
          setTournaments([]);
        }

        // Fetch games
        const gamesRes = await fetchWithActAs('/api/player/games');
        if (gamesRes.ok) {
          const gamesData = await gamesRes.json();
          setGames(gamesData.games || []);
        }

        // Fetch stats
        const statsRes = await fetchWithActAs('/api/player/stats');
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }
      } catch (error) {
        console.error('Error fetching profile data:', error);
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [profile]);

  // Debug: Log tournaments state
  useEffect(() => {
    console.log('Tournaments state updated:', tournaments);
  }, [tournaments]);

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
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all text-white ${
                        form.gender === value
                          ? 'shadow-md'
                          : 'opacity-50 hover:opacity-75'
                      }`}
                      style={{
                        backgroundColor: form.gender === value
                          ? (value === 'MALE' ? '#3b82f6' : '#db2777')
                          : '#374151'
                      }}
                    >
                      {value === 'MALE' ? 'Male' : 'Female'}
                    </button>
                ))}
              </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-primary mb-1">Birthday</label>
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
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold text-white"
                      style={{
                        backgroundColor: form.gender === 'MALE' ? '#3b82f6' : '#db2777',
                      }}
                    >
                      {form.gender === 'MALE' ? 'M' : 'F'}
                    </span>
                    <span>{age || '—'} • {locationString}</span>
                  </div>
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
          <nav className="flex px-6">
            <button
              onClick={() => setActiveTab('performance')}
              className={`tab-button ${activeTab === 'performance' ? 'active' : ''}`}
            >
              Performance
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`tab-button ${activeTab === 'activity' ? 'active' : ''}`}
            >
              Recent Activity
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
                  {dataLoading || !stats ? (
                    <div className="text-center py-8 text-muted">
                      <p>Loading statistics...</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Match Record */}
                      <div className="border-b border-border-subtle pb-3">
                        <h4 className="text-sm font-semibold text-secondary mb-2">Match Record</h4>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm text-muted">Matches Played</span>
                          <span className="font-semibold text-primary">{stats.matchRecord.played}</span>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm text-muted">Win-Loss</span>
                          <span className="font-semibold text-primary">{stats.matchRecord.won}-{stats.matchRecord.lost}</span>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm text-muted">Win %</span>
                          <span className="font-semibold text-primary">{stats.matchRecord.winPct}%</span>
                        </div>
                      </div>

                      {/* Game Record */}
                      <div className="border-b border-border-subtle pb-3">
                        <h4 className="text-sm font-semibold text-secondary mb-2">Game Record</h4>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm text-muted">Games Played</span>
                          <span className="font-semibold text-primary">{stats.gameRecord.played}</span>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm text-muted">Win-Loss</span>
                          <span className="font-semibold text-primary">{stats.gameRecord.won}-{stats.gameRecord.lost}</span>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm text-muted">Win %</span>
                          <span className="font-semibold text-primary">{stats.gameRecord.winPct}%</span>
                        </div>
                      </div>

                      {/* Scoring */}
                      <div className="border-b border-border-subtle pb-3">
                        <h4 className="text-sm font-semibold text-secondary mb-2">Scoring</h4>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm text-muted">Avg Points For</span>
                          <span className="font-semibold text-primary">{stats.scoring.avgPointsScored}</span>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm text-muted">Avg Points Against</span>
                          <span className="font-semibold text-primary">{stats.scoring.avgPointsAllowed}</span>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm text-muted flex items-center gap-1">
                            Point Differential
                            <span
                              className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted/20 text-muted cursor-help text-xs"
                              title="Total points scored minus total points allowed across all games. Positive = scoring more than allowing."
                            >
                              ?
                            </span>
                          </span>
                          <span className="font-semibold text-primary">{stats.scoring.pointDifferential > 0 ? '+' : ''}{stats.scoring.pointDifferential}</span>
                        </div>
                      </div>

                      {/* Clutch Stats */}
                      <div>
                        <h4 className="text-sm font-semibold text-secondary mb-2 flex items-center gap-1.5">
                          Clutch Performance
                          <span
                            className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-secondary/20 text-secondary cursor-help text-xs font-normal"
                            title="Performance in high-pressure situations: close games (margin ≤2 points) and deciding games (final game of a match)"
                          >
                            ?
                          </span>
                        </h4>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm text-muted">Close Game Win %</span>
                          <span className="font-semibold text-primary">{stats.clutch.closeGameWinPct}%</span>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm text-muted">Avg Margin (Wins)</span>
                          <span className="font-semibold text-primary">{stats.clutch.avgMarginVictory}</span>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm text-muted">Avg Margin (Losses)</span>
                          <span className="font-semibold text-primary">{stats.clutch.avgMarginDefeat}</span>
                        </div>
                      </div>
                    </div>
                  )}
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
                    {tournaments.map((tournament) => {
                      const tournamentDate = tournament.date || tournament.sortDate;
                      const dateDisplay = tournamentDate 
                        ? new Date(tournamentDate).toLocaleDateString()
                        : 'Date TBD';
                      return (
                        <div key={tournament.id} className="border border-subtle rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium text-primary">{tournament.name}</h4>
                              <p className="text-sm text-muted mt-1">
                                {tournament.type?.replace(/_/g, ' ') || 'Tournament'} • {dateDisplay}
                              </p>
                              {tournament.team && (
                                <p className="text-sm text-secondary mt-1">
                                  Team: {tournament.team.name} {tournament.team.club && `(${tournament.team.club.name})`}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
            <>
              {dataLoading ? (
                <div className="text-center py-8 text-muted">
                  <p>Loading games...</p>
                </div>
              ) : games.length > 0 ? (
                <div className="space-y-2">
                  {games.map((game) => {
                    const playerScore = game.isTeamA ? game.teamAScore : game.teamBScore;
                    const opponentScore = game.isTeamA ? game.teamBScore : game.teamAScore;
                    const won = playerScore !== null && opponentScore !== null && playerScore > opponentScore;
                    const lost = playerScore !== null && opponentScore !== null && playerScore < opponentScore;

                    return (
                      <div key={game.id} className="border-l-4 border-subtle bg-surface-1 hover:bg-surface-2 transition-colors p-3">
                        {/* Tournament, Stop, Date */}
                        <div className="text-xs text-muted mb-1.5">
                          {game.tournament?.name && `${game.tournament.name} • `}
                          {game.stop?.name} • {
                            game.endedAt 
                              ? new Date(game.endedAt).toLocaleDateString()
                              : game.startedAt 
                              ? new Date(game.startedAt).toLocaleDateString()
                              : new Date(game.createdAt).toLocaleDateString()
                          }
                        </div>

                        {/* Slot */}
                        <div className="text-sm font-medium text-secondary mb-1.5">
                          {game.slot?.replace(/_/g, ' ') || 'Game'}
                        </div>

                        {/* Teams */}
                        <div className="flex items-center gap-2 text-sm mb-1.5">
                          <span className="font-medium text-primary">
                            {game.playerTeam?.name || 'Your Team'}
                          </span>
                          <span className="text-muted">vs</span>
                          <span className="font-medium text-primary">
                            {game.opponentTeam?.name || 'Opponent'}
                          </span>
                        </div>

                        {/* Result and Score */}
                        <div className="flex items-center gap-2 mb-1.5">
                          {game.isForfeit ? (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              Forfeit
                            </span>
                          ) : game.isComplete ? (
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              won ? 'bg-green-500 text-white' : lost ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {won ? 'Won' : lost ? 'Lost' : 'Complete'}
                            </span>
                          ) : game.startedAt ? (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              In Progress
                            </span>
                          ) : null}
                          {!game.isForfeit && playerScore !== null && opponentScore !== null && (
                            <span className="text-base font-semibold text-primary">
                              {playerScore} - {opponentScore}
                            </span>
                          )}
                        </div>

                        {/* Partner */}
                        {game.partner && (
                          <div className="text-sm text-muted">
                            Partner: <span className="font-medium text-secondary">
                              {game.partner.firstName && game.partner.lastName
                                ? `${game.partner.firstName} ${game.partner.lastName}`
                                : game.partner.name || 'Unknown'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted">
                  <p>No games yet</p>
                  <p className="text-sm">Game data will appear here once you play matches</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

