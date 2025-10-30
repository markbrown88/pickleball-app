'use client';

import { useState } from 'react';
import type { UserProfile } from '@/types';

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
    phone: profile.phone || '',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: value,
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="card space-y-4">
        <h2 className="text-xl font-semibold text-primary">Basic Information</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-secondary mb-2">
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

          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-secondary mb-2">
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

          <div>
            <label htmlFor="gender" className="block text-sm font-medium text-secondary mb-2">
              Gender *
            </label>
            <select
              id="gender"
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              className="input w-full"
              required
            >
              <option value="">Select...</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
          </div>

          <div>
            <label htmlFor="birthday" className="block text-sm font-medium text-secondary mb-2">
              Birthday
            </label>
            <input
              type="date"
              id="birthday"
              name="birthday"
              value={formData.birthday}
              onChange={handleChange}
              className="input w-full"
            />
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="card space-y-4">
        <h2 className="text-xl font-semibold text-primary">Contact Information</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-secondary mb-2">
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
            <label htmlFor="phone" className="block text-sm font-medium text-secondary mb-2">
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
            <label htmlFor="city" className="block text-sm font-medium text-secondary mb-2">
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
            <label htmlFor="region" className="block text-sm font-medium text-secondary mb-2">
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
            <label htmlFor="country" className="block text-sm font-medium text-secondary mb-2">
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

      {/* Club & Ratings */}
      <div className="card space-y-4">
        <h2 className="text-xl font-semibold text-primary">Club & Ratings</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="clubId" className="block text-sm font-medium text-secondary mb-2">
              Club *
            </label>
            <select
              id="clubId"
              name="clubId"
              value={formData.clubId}
              onChange={handleChange}
              className="input w-full"
              required
            >
              <option value="">Select club...</option>
              {clubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="duprSingles" className="block text-sm font-medium text-secondary mb-2">
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
            <label htmlFor="duprDoubles" className="block text-sm font-medium text-secondary mb-2">
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
            <label htmlFor="clubRatingSingles" className="block text-sm font-medium text-secondary mb-2">
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
            <label htmlFor="clubRatingDoubles" className="block text-sm font-medium text-secondary mb-2">
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

      {/* Privacy Settings */}
      <div className="card space-y-4">
        <h2 className="text-xl font-semibold text-primary">Privacy Settings</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="displayAge"
              name="displayAge"
              checked={formData.displayAge}
              onChange={handleChange}
              className="w-4 h-4"
            />
            <label htmlFor="displayAge" className="text-sm text-secondary">
              Display age on profile
            </label>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="displayLocation"
              name="displayLocation"
              checked={formData.displayLocation}
              onChange={handleChange}
              className="w-4 h-4"
            />
            <label htmlFor="displayLocation" className="text-sm text-secondary">
              Display location on profile
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
