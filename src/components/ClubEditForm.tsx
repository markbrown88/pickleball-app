'use client';

import { useState, useEffect, useRef } from 'react';

interface Club {
  id?: string;
  fullName: string;
  name: string;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country: string;
  phone?: string | null;
  email?: string | null;
  description?: string | null;
  directorId?: string | null;
  logo?: string | null;
  director?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
}

interface Player {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
}

interface ClubEditFormProps {
  club: Club;
  players: Player[];
  loading: boolean;
  onSave: (clubData: any) => Promise<boolean>;
}

export function ClubEditForm({ club, players, loading, onSave }: ClubEditFormProps) {
  const [formData, setFormData] = useState({
    id: club.id || '',
    fullName: club.fullName || '',
    name: club.name || '',
    address: club.address || '',
    city: club.city || '',
    region: club.region || '',
    country: club.country || 'Canada',
    phone: club.phone || '',
    email: club.email || '',
    description: club.description || '',
    directorId: club.directorId || '',
    logo: club.logo || '',
  });

  const [directorSearch, setDirectorSearch] = useState(() => {
    if (club.director?.firstName || club.director?.lastName) {
      return `${club.director.firstName || ''} ${club.director.lastName || ''}`.trim();
    }
    return '';
  });
  const [showDirectorDropdown, setShowDirectorDropdown] = useState(false);
  const directorDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredPlayers = directorSearch.length >= 3
    ? players.filter(player => {
        const firstName = player.firstName || '';
        const lastName = player.lastName || '';
        const fullName = `${firstName} ${lastName}`.trim();
        const searchTerm = directorSearch.toLowerCase();
        return firstName.toLowerCase().includes(searchTerm) ||
               lastName.toLowerCase().includes(searchTerm) ||
               fullName.toLowerCase().includes(searchTerm);
      })
    : [];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (directorDropdownRef.current && !directorDropdownRef.current.contains(event.target as Node)) {
        setShowDirectorDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleDirectorSearchChange = (value: string) => {
    setDirectorSearch(value);
    setShowDirectorDropdown(value.length >= 3);
    // Clear directorId if user changes the search
    if (value !== directorSearch) {
      setFormData((prev) => ({ ...prev, directorId: '' }));
    }
  };

  const selectDirector = (player: Player) => {
    const fullName = `${player.firstName || ''} ${player.lastName || ''}`.trim();
    setFormData((prev) => ({ ...prev, directorId: player.id }));
    setDirectorSearch(fullName);
    setShowDirectorDropdown(false);
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file (JPG, PNG, etc.)');
        return;
      }

      // Validate file size (2MB max)
      if (file.size > 2 * 1024 * 1024) {
        alert('File size must be less than 2MB');
        return;
      }

      // Create a preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setFormData(prev => ({ ...prev, logo: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-6 max-w-7xl">
      {/* Left Column - Main Form Fields */}
      <div className="flex-1 space-y-6">
        {/* Basic Information */}
        <div className="card space-y-4">
          <h2 className="text-xl font-semibold text-primary">Basic Information</h2>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-secondary mb-1">
                Full Name *
              </label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                className="input w-full"
                placeholder="Enter full club name"
                required
              />
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-secondary mb-1">
                Nickname *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="input w-full"
                placeholder="Enter club nickname"
                required
              />
            </div>
          </div>
        </div>

        {/* Address Information */}
        <div className="card space-y-4">
          <h2 className="text-xl font-semibold text-primary">Address</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-secondary mb-1">
                Street Address *
              </label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="input w-full"
                placeholder="Enter street address"
                required
              />
            </div>

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-secondary mb-1">
                  City *
                </label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="input w-full"
                  placeholder="Enter city"
                  required
                />
              </div>

              <div>
                <label htmlFor="region" className="block text-sm font-medium text-secondary mb-1">
                  Province/State *
                </label>
                <input
                  type="text"
                  id="region"
                  name="region"
                  value={formData.region}
                  onChange={handleChange}
                  className="input w-full"
                  placeholder="Enter province/state"
                  required
                />
              </div>

              <div>
                <label htmlFor="country" className="block text-sm font-medium text-secondary mb-1">
                  Country *
                </label>
                <select
                  id="country"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  className="input w-full"
                  required
                >
                  <option value="Canada">Canada</option>
                  <option value="USA">United States</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="card space-y-4">
          <h2 className="text-xl font-semibold text-primary">Contact Information</h2>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-secondary mb-1">
                Email *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="input w-full"
                placeholder="Enter email address"
                required
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
                placeholder="Enter phone number"
              />
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="card space-y-4">
          <h2 className="text-xl font-semibold text-primary">Description</h2>
          <div>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="input w-full"
              rows={4}
              placeholder="Enter club description (max 300 characters)"
              maxLength={300}
            />
            <div className="flex justify-between text-xs text-muted mt-1">
              <span>{formData.description.length}/300 characters</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Right Column - Logo & Director */}
      <div className="w-full lg:w-80 flex-shrink-0">
        <div className="card space-y-4 lg:sticky lg:top-6">
          <h2 className="text-xl font-semibold text-primary">Logo & Director</h2>
          <div className="space-y-4">
            {/* Club Logo */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-secondary">
                Club Logo
              </label>
              <div className="w-full h-24 bg-surface-2 rounded-lg flex items-center justify-center border-2 border-dashed border-border-medium overflow-hidden">
                {formData.logo ? (
                  <img
                    src={formData.logo}
                    alt="Club logo preview"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <svg className="w-8 h-8 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <button
                type="button"
                className="btn btn-sm btn-ghost w-full"
                onClick={triggerFileUpload}
              >
                {formData.logo ? 'Change Logo' : 'Upload Logo'}
              </button>
              <p className="text-xs text-muted text-center">JPG, PNG up to 2MB</p>
            </div>

            {/* Director Search */}
            <div className="relative" ref={directorDropdownRef}>
              <label htmlFor="directorSearch" className="block text-sm font-medium text-secondary mb-1">
                Director *
              </label>
              <input
                type="text"
                id="directorSearch"
                value={directorSearch}
                onChange={(e) => handleDirectorSearchChange(e.target.value)}
                onFocus={() => directorSearch.length >= 3 && setShowDirectorDropdown(true)}
                className="input w-full"
                placeholder="Type 3+ characters to search..."
                required
              />
              {showDirectorDropdown && filteredPlayers.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-surface-1 border border-border-subtle rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredPlayers.map((player) => {
                    const fullName = `${player.firstName || ''} ${player.lastName || ''}`.trim();
                    return (
                      <button
                        key={player.id}
                        type="button"
                        onClick={() => selectDirector(player)}
                        className="w-full text-left px-3 py-2 hover:bg-surface-2 text-sm"
                      >
                        {fullName || 'Unknown Player'}
                      </button>
                    );
                  })}
                </div>
              )}
              {directorSearch.length > 0 && directorSearch.length < 3 && (
                <p className="text-xs text-muted mt-1">Type at least 3 characters</p>
              )}
              {!formData.directorId && directorSearch.length >= 3 && filteredPlayers.length === 0 && players.length > 0 && (
                <p className="text-xs text-error mt-1">No players found matching "{directorSearch}"</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
