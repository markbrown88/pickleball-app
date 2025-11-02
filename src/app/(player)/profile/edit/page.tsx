
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUser, useAuth, SignInButton } from '@clerk/nextjs';

import { ProfileEditForm } from './ProfileEditForm'; // This will be the new form component
import { fetchWithActAs } from '@/lib/fetchWithActAs';

import type { UserProfile } from '@/types';

const CLUBS_ENDPOINT = '/api/admin/clubs?sort=name:asc';
const PROFILE_ENDPOINT = '/api/player/profile';

export default function ProfileEditPage() {
  const { user, isLoaded: userLoaded } = useUser();
  const { isSignedIn } = useAuth();

  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [clubsAll, setClubsAll] = useState<Array<{ id: string; name: string }>>([]);

  const notify = useCallback((message: string | null, type: 'error' | 'info') => {
    if (type === 'error') {
      setErr(message);
      if (message) setInfo(null);
    } else {
      setInfo(message);
      if (message) setErr(null);
    }
  }, []);

  const handleError = useCallback((message: string | null) => notify(message, 'error'), [notify]);
  const handleInfo = useCallback((message: string | null) => notify(message, 'info'), [notify]);

  const loadUserProfile = useCallback(async () => {
    if (!userLoaded || !isSignedIn) return;

    setProfileLoading(true);
    try {
      const response = await fetchWithActAs(PROFILE_ENDPOINT);
      if (response.ok) {
        const profile: UserProfile = await response.json();
        setUserProfile(profile);
      } else {
        throw new Error('Failed to load user profile');
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      handleError('Failed to load user profile');
    } finally {
      setProfileLoading(false);
    }
  }, [handleError, isSignedIn, userLoaded]);

  useEffect(() => {
    void loadUserProfile();
  }, [loadUserProfile]);

  useEffect(() => {
    async function loadClubs() {
      try {
        const response = await fetch(CLUBS_ENDPOINT);
        if (!response.ok) return;
        const data = await response.json();
        setClubsAll(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error loading clubs:', error);
      }
    }

    void loadClubs();
  }, []);

  const saveUserProfile = useCallback(
    async (profileData: any): Promise<boolean> => {
      if (!isSignedIn || !userProfile) return false;

      setProfileLoading(true);
      try {
        const response = await fetch(PROFILE_ENDPOINT, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...profileData,
            playerId: userProfile.id,
          }),
        });

        if (response.ok) {
          const profile: UserProfile = await response.json();
          setUserProfile(profile);
          handleInfo('Profile saved successfully');
          return true;
        }

        const error = await response.json();
        throw new Error(error?.error || 'Failed to save profile');
      } catch (error) {
        handleError(error instanceof Error ? error.message : 'Failed to save profile');
        return false;
      } finally {
        setProfileLoading(false);
      }
    },
    [handleError, handleInfo, isSignedIn, userProfile]
  );

  if (!userLoaded) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="loading-spinner" aria-label="Loading profile" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="card text-center space-y-4">
          <h1 className="text-2xl font-semibold text-primary">Welcome back</h1>
          <p className="text-muted">Sign in to manage your profile and registrations.</p>
          <SignInButton>
            <button className="btn btn-primary">Sign In</button>
          </SignInButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2">Edit Profile</h1>
        <p className="text-muted">Manage your player profile and account details</p>
      </div>

      {err && (
        <div className="alert alert-error" role="status" aria-live="assertive">
          {err}
        </div>
      )}

      {info && (
        <div className="alert alert-success" role="status" aria-live="polite">
          {info}
        </div>
      )}

      {userProfile && (
        <ProfileEditForm
            profile={userProfile}
            clubs={clubsAll}
            loading={profileLoading}
            onSave={saveUserProfile}
        />
      )}
    </div>
  );
}

