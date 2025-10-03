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
    dupr: string;
    birthday: string;
    clubRating?: number | null;
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
    } else {
      setBirthday(fortyYearsAgoISO());
    }
  }, [hydrateFromProfile, profile, setBirthday, setCountryOther, setCountrySel]);

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
      dupr: form.dupr,
      city: form.city,
      region: form.region,
      country,
      phone: form.phone,
      email: form.email,
      birthday,
      clubRating: form.clubRating ? Number(form.clubRating) : null,
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

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-primary">Profile Details</h2>
        {!editing ? (
          <button className="btn btn-ghost" onClick={() => setEditing(true)}>
            Edit Profile
          </button>
        ) : (
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={save} disabled={loading}>
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
            <button className="btn btn-ghost" onClick={cancel}>
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="col-span-1">
          <div className="rounded-2xl border border-dashed border-subtle bg-surface-2/40 p-6 text-center">
            <div className="mx-auto flex h-40 w-32 items-center justify-center overflow-hidden rounded-xl bg-surface-1">
              {form.photo ? (
                <Image
                  src={form.photo}
                  alt="Profile"
                  width={80}
                  height={80}
                  className="h-20 w-20 rounded-full object-cover"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center text-muted">No photo</div>
              )}
            </div>
            {editing && (
              <div className="mt-3">
                <label className="text-xs text-secondary hover:text-secondary-hover">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;

                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const img = document.createElement('img');
                        img.onload = () => {
                          const canvas = document.createElement('canvas');
                          const ctx = canvas.getContext('2d');
                          canvas.width = 200;
                          canvas.height = 300;

                          const aspectRatio = img.width / img.height;
                          const targetAspectRatio = 200 / 300;

                          let sourceX = 0;
                          let sourceY = 0;
                          let sourceWidth = img.width;
                          let sourceHeight = img.height;

                          if (aspectRatio > targetAspectRatio) {
                            sourceWidth = img.height * targetAspectRatio;
                            sourceX = (img.width - sourceWidth) / 2;
                          } else {
                            sourceHeight = img.width / targetAspectRatio;
                            sourceY = (img.height - sourceHeight) / 2;
                          }

                          ctx?.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, 200, 300);
                          const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                          handleChange('photo', croppedDataUrl);
                        };
                        img.src = ev.target?.result as string;
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                  {form.photo ? 'Change Photo' : 'Upload Photo'}
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="col-span-2 space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-muted">First Name</label>
              <input
                type="text"
                value={form.firstName}
                onChange={(event) => handleChange('firstName', event.target.value)}
                className="input"
                disabled={!editing}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted">Last Name</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(event) => handleChange('lastName', event.target.value)}
                className="input"
                disabled={!editing}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted">Gender</label>
              <div className="flex gap-4">
                {(['MALE', 'FEMALE'] as const).map((value) => (
                  <label key={value} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="gender"
                      value={value}
                      checked={form.gender === value}
                      onChange={(event) => handleChange('gender', event.target.value as 'MALE' | 'FEMALE')}
                      disabled={!editing}
                    />
                    <span className="text-sm text-muted">{value === 'MALE' ? 'Male' : 'Female'}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted">DUPR Rating</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="8"
                value={form.dupr}
                onChange={(event) => handleChange('dupr', event.target.value)}
                className="input"
                disabled={!editing}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-muted">Club</label>
              <select
                className="input"
                value={form.clubId || ''}
                onChange={(event) => handleChange('clubId', event.target.value)}
                disabled={!editing}
              >
                <option value="">Select Club</option>
                {clubs.map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.name}{club.city ? ` (${club.city})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-muted">Club Rating</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={form.clubRating}
                onChange={(event) => handleChange('clubRating', event.target.value)}
                className="input"
                disabled={!editing}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted">City</label>
              <input
                type="text"
                value={form.city}
                onChange={(event) => handleChange('city', event.target.value)}
                className="input"
                disabled={!editing}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted">Province/State</label>
              <select
                className="input"
                value={form.region}
                onChange={(event) => handleChange('region', event.target.value)}
                disabled={!editing}
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
              <label className="text-sm font-medium text-muted">Country</label>
              {countryOptions}
              {countrySel === 'Other' && (
                <input
                  type="text"
                  value={countryOther}
                  onChange={(event) => setCountryOther(event.target.value)}
                  className="input mt-2"
                  placeholder="Enter country"
                  disabled={!editing}
                />
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-muted">Birthday</label>
              <input
                type="date"
                value={birthday}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setBirthday(event.target.value)}
                className="input"
                disabled={!editing}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-muted">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => handleChange('phone', event.target.value)}
                className="input"
                disabled={!editing}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(event) => handleChange('email', event.target.value)}
                className="input"
                disabled={!editing}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

