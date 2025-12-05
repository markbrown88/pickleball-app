'use client';

import { useState, useEffect, useRef } from 'react';
import type { UserProfile } from '@/types';
import { formatPhoneForDisplay, formatPhoneInput } from '@/lib/phone';
import { GenderSelector } from '@/components/GenderSelector';

interface PlayerEditFormProps {
  profile: UserProfile;
  clubs: Array<{ id: string; name: string }>;
  loading: boolean;
  onSave: (profileData: any) => Promise<boolean>;
}

export function PlayerEditForm({ profile, clubs, loading, onSave }: PlayerEditFormProps) {
  const [formData, setFormData] = useState({
    firstName: profile.firstName || '',
    lastName: profile.lastName || '',
    email: profile.email || '',
    phone: formatPhoneForDisplay(profile.phone),
    gender: profile.gender || '',
    clubId: profile.club?.id || '',
    city: profile.city || '',
    region: profile.region || '',
    country: profile.country || 'Canada',
    birthday: profile.birthday ? new Date(profile.birthday).toISOString().split('T')[0] : '',
    duprSingles: profile.duprSingles?.toString() || '',
    duprDoubles: profile.duprDoubles?.toString() || '',
    clubRatingSingles: profile.clubRatingSingles?.toString() || '',
    clubRatingDoubles: profile.clubRatingDoubles?.toString() || '',
    displayAge: profile.displayAge ?? true,
    displayLocation: profile.displayLocation ?? true,
  });

  const [clubSearch, setClubSearch] = useState(profile.club?.name || '');
  const [showClubDropdown, setShowClubDropdown] = useState(false);
  const clubDropdownRef = useRef<HTMLDivElement>(null);

  // Debug: Log clubs when they change
  useEffect(() => {
    if (clubs.length > 0) {
    }
  }, [clubs]);

  const filteredClubs = clubSearch.length >= 3
    ? clubs.filter(club => {
        const clubName = club.name?.toLowerCase() || '';
        const searchTerm = clubSearch.toLowerCase();
        return clubName.includes(searchTerm);
      })
    : [];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clubDropdownRef.current && !clubDropdownRef.current.contains(event.target as Node)) {
        setShowClubDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let value =
      e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    if (e.target.name === 'phone') {
      value = formatPhoneInput(String(value));
    }
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: value,
    }));
  };

  const handleClubSearchChange = (value: string) => {
    setClubSearch(value);
    setShowClubDropdown(value.length >= 3);
    // Clear clubId if user changes the search
    if (value !== clubSearch) {
      setFormData((prev) => ({ ...prev, clubId: '' }));
    }
  };

  const selectClub = (club: { id: string; name: string }) => {
    setFormData((prev) => ({ ...prev, clubId: club.id }));
    setClubSearch(club.name);
    setShowClubDropdown(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-6 max-w-7xl">
      {/* Left Column - Basic Information & Contact Information */}
      <div className="flex-1 space-y-6">
        {/* Basic Information */}
        <div className="card space-y-4">
          <h2 className="text-xl font-semibold text-primary">Basic Information</h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-1">
            <label htmlFor="firstName" className="block text-sm font-medium text-secondary mb-1">
              First Name *
            </label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              className="input w-full"
              required
            />
          </div>

          <div className="sm:col-span-1">
            <label htmlFor="lastName" className="block text-sm font-medium text-secondary mb-1">
              Last Name *
            </label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              className="input w-full"
              required
            />
          </div>

          <div className="sm:col-span-1">
            <GenderSelector
              value={formData.gender}
              onChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}
              label="Gender"
              required
            />
          </div>

          <div className="sm:col-span-1">
            <label htmlFor="birthday" className="block text-sm font-medium text-secondary mb-1">
              Birthday *
            </label>
            <input
              type="date"
              id="birthday"
              name="birthday"
              value={formData.birthday}
              onChange={handleChange}
              className="input w-full sm:max-w-[240px]"
              required
            />
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="card space-y-4">
        <h2 className="text-xl font-semibold text-primary">Contact Information</h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <label htmlFor="email" className="block text-sm font-medium text-secondary mb-1">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="input w-full"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-secondary mb-1">
              Phone
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="input w-full"
            />
          </div>

          <div>
            <label htmlFor="city" className="block text-sm font-medium text-secondary mb-1">
              City
            </label>
            <input
              type="text"
              id="city"
              name="city"
              value={formData.city}
              onChange={handleChange}
              className="input w-full"
            />
          </div>

          <div>
            <label htmlFor="region" className="block text-sm font-medium text-secondary mb-1">
              Province/State
            </label>
            <input
              type="text"
              id="region"
              name="region"
              value={formData.region}
              onChange={handleChange}
              className="input w-full"
            />
          </div>

          <div>
            <label htmlFor="country" className="block text-sm font-medium text-secondary mb-1">
              Country
            </label>
            <select
              id="country"
              name="country"
              value={formData.country}
              onChange={handleChange}
              className="input w-full"
            >
              <option value="Canada">Canada</option>
              <option value="USA">United States</option>
              <option value="Mexico">Mexico</option>
            </select>
          </div>
        </div>
        </div>

        {/* Privacy Settings */}
        <div className="card space-y-4">
          <h2 className="text-xl font-semibold text-primary">Privacy Settings</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, displayAge: !prev.displayAge }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.displayAge ? 'bg-secondary' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.displayAge ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm font-medium text-primary">Display Age</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, displayLocation: !prev.displayLocation }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.displayLocation ? 'bg-secondary' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.displayLocation ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm font-medium text-primary">Display Location</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Right Column - Club & Ratings */}
      <div className="w-full lg:w-80 flex-shrink-0">
        <div className="card space-y-4 lg:sticky lg:top-6">
          <h2 className="text-xl font-semibold text-primary">Club & Ratings</h2>
          <div className="space-y-4">
            <div className="relative" ref={clubDropdownRef}>
              <label htmlFor="clubSearch" className="block text-sm font-medium text-secondary mb-1">
                Club *
              </label>
              <input
                type="text"
                id="clubSearch"
                value={clubSearch}
                onChange={(e) => handleClubSearchChange(e.target.value)}
                onFocus={() => clubSearch.length >= 3 && setShowClubDropdown(true)}
                className="input w-full"
                placeholder="Type 3+ characters to search..."
                required
              />
              {showClubDropdown && filteredClubs.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-surface-1 border border-border-subtle rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredClubs.map((club) => (
                    <button
                      key={club.id}
                      type="button"
                      onClick={() => selectClub(club)}
                      className="w-full text-left px-3 py-2 hover:bg-surface-2 text-sm"
                    >
                      {club.name}
                    </button>
                  ))}
                </div>
              )}
              {clubSearch.length > 0 && clubSearch.length < 3 && (
                <p className="text-xs text-muted mt-1">Type at least 3 characters</p>
              )}
              {!formData.clubId && clubSearch.length >= 3 && filteredClubs.length === 0 && clubs.length > 0 && (
                <p className="text-xs text-error mt-1">No clubs found matching "{clubSearch}"</p>
              )}
              {!formData.clubId && clubSearch.length >= 3 && filteredClubs.length === 0 && clubs.length === 0 && (
                <p className="text-xs text-warning mt-1">No clubs loaded. Please refresh the page.</p>
              )}
            </div>

            <div>
              <label htmlFor="duprSingles" className="block text-sm font-medium text-secondary mb-1">
                DUPR Singles
              </label>
              <input
                type="number"
                step="0.1"
                id="duprSingles"
                name="duprSingles"
                value={formData.duprSingles}
                onChange={handleChange}
                className="input w-full"
                placeholder="e.g., 4.5"
              />
            </div>

            <div>
              <label htmlFor="duprDoubles" className="block text-sm font-medium text-secondary mb-1">
                DUPR Doubles
              </label>
              <input
                type="number"
                step="0.1"
                id="duprDoubles"
                name="duprDoubles"
                value={formData.duprDoubles}
                onChange={handleChange}
                className="input w-full"
                placeholder="e.g., 5.0"
              />
            </div>

            <div>
              <label htmlFor="clubRatingSingles" className="block text-sm font-medium text-secondary mb-1">
                Club Rating Singles
              </label>
              <input
                type="number"
                step="0.1"
                id="clubRatingSingles"
                name="clubRatingSingles"
                value={formData.clubRatingSingles}
                onChange={handleChange}
                className="input w-full"
                placeholder="e.g., 4.0"
              />
            </div>

            <div>
              <label htmlFor="clubRatingDoubles" className="block text-sm font-medium text-secondary mb-1">
                Club Rating Doubles
              </label>
              <input
                type="number"
                step="0.1"
                id="clubRatingDoubles"
                name="clubRatingDoubles"
                value={formData.clubRatingDoubles}
                onChange={handleChange}
                className="input w-full"
                placeholder="e.g., 4.5"
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
