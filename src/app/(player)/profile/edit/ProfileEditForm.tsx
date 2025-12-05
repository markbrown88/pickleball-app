'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import type { UserProfile } from '@/types';
import { formatPhoneForDisplay, formatPhoneInput } from '@/lib/phone';
import { GenderSelector } from '@/components/GenderSelector';

interface ProfileEditFormProps {
  profile: UserProfile;
  clubs: Array<{ id: string; name: string }>;
  loading: boolean;
  onSave: (profileData: any) => Promise<boolean>;
}

export function ProfileEditForm({ profile, clubs, loading, onSave }: ProfileEditFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(profile.image || null);

  const [formData, setFormData] = useState({
    firstName: profile.firstName || '',
    lastName: profile.lastName || '',
    email: profile.email || '',
    phone: profile.phone ? formatPhoneForDisplay(profile.phone) : '',
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
    imageUrl: profile.image || '',
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB');
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setFormData(prev => ({ ...prev, imageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let value =
      e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    if (e.target.name === 'phone' && typeof value === 'string') {
      value = formatPhoneInput(value);
    }
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: value,
    }));
  };

  const name = `${formData.firstName} ${formData.lastName}`.trim() || 'Player';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Profile Image */}
      <div className="card space-y-4">
        <h2 className="text-xl font-semibold text-primary">Profile Image</h2>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative">
            {imagePreview ? (
              <div className="relative h-32 w-32 overflow-hidden rounded-full border-4 border-brand-secondary">
                <Image
                  src={imagePreview}
                  alt={name}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="flex h-32 w-32 items-center justify-center rounded-full bg-surface-2 border-4 border-subtle text-4xl font-bold text-muted">
                {name.charAt(0)}
              </div>
            )}
          </div>
          <div className="flex-1 space-y-3">
            <p className="text-sm text-muted">
              Upload a custom profile image or keep your Google avatar
            </p>
            <div className="flex gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-secondary"
              >
                Upload Image
              </button>
              {imagePreview && imagePreview !== profile.image && (
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview(profile.image || null);
                    setFormData(prev => ({ ...prev, imageUrl: profile.image || '' }));
                  }}
                  className="btn btn-ghost"
                >
                  Reset
                </button>
              )}
            </div>
            <p className="text-xs text-muted">
              Recommended: Square image, at least 200x200px. Max size: 5MB
            </p>
          </div>
        </div>
      </div>

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

          <GenderSelector
            value={formData.gender}
            onChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}
            label="Gender"
            required
          />

          <div>
            <label htmlFor="birthday" className="block text-sm font-medium text-secondary mb-2">
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
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-secondary mb-2">
              Email *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="input w-full"
              required
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-secondary mb-2">
              Phone *
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="input w-full"
              required
            />
          </div>

          <div>
            <label htmlFor="city" className="block text-sm font-medium text-secondary mb-2">
              City *
            </label>
            <input
              type="text"
              id="city"
              name="city"
              value={formData.city}
              onChange={handleChange}
              className="input w-full"
              required
            />
          </div>

          <div>
            <label htmlFor="region" className="block text-sm font-medium text-secondary mb-2">
              Province/State *
            </label>
            <input
              type="text"
              id="region"
              name="region"
              value={formData.region}
              onChange={handleChange}
              className="input w-full"
              required
            />
          </div>

          <div>
            <label htmlFor="country" className="block text-sm font-medium text-secondary mb-2">
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
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, displayAge: !prev.displayAge }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.displayAge ? 'bg-secondary' : 'bg-gray-200'
                }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.displayAge ? 'translate-x-6' : 'translate-x-1'
                  }`}
              />
            </button>
            <span className="text-sm font-medium text-primary">Display Age</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, displayLocation: !prev.displayLocation }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.displayLocation ? 'bg-secondary' : 'bg-gray-200'
                }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.displayLocation ? 'translate-x-6' : 'translate-x-1'
                  }`}
              />
            </button>
            <span className="text-sm font-medium text-primary">Display Location</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </form>
  );
}
