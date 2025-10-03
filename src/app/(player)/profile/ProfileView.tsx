'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUser, useAuth, SignInButton } from '@clerk/nextjs';

import { ProfileForm } from './ProfileForm';
import { ProfileSetup } from './ProfileSetupForm';

import type { UserProfile } from '@/types';

const CLUBS_ENDPOINT = '/api/admin/clubs?sort=name:asc';
const PROFILE_ENDPOINT = '/api/auth/user';

export function ProfilePageView() {
  const { user, isLoaded: userLoaded } = useUser();
  const { isSignedIn } = useAuth();

  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
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
      const response = await fetch(PROFILE_ENDPOINT);
      if (response.ok) {
        const profile: UserProfile = await response.json();
        setUserProfile(profile);
        setNeedsProfileSetup(false);
      } else if (response.status === 404) {
        setNeedsProfileSetup(true);
        setUserProfile(null);
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
    async (profileData: {
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
    }): Promise<boolean> => {
      if (!isSignedIn) return false;

      setProfileLoading(true);
      try {
        const method = userProfile ? 'PUT' : 'POST';
        const response = await fetch(PROFILE_ENDPOINT, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profileData),
        });

        if (response.ok) {
          const profile: UserProfile = await response.json();
          setUserProfile(profile);
          setNeedsProfileSetup(false);
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

  if (needsProfileSetup) {
    return (
      <div className="space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold text-primary">Complete Your Profile</h1>
          <p className="text-muted">
            Provide a few details so we can personalise tournaments and team assignments for you.
          </p>
        </header>

        <div className="max-w-lg mx-auto">
          <ProfileSetup user={user} clubs={clubsAll} onSave={saveUserProfile} loading={profileLoading} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2">Profile</h1>
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

      <ProfileForm
        profile={userProfile}
        clubs={clubsAll}
        loading={profileLoading}
        onSave={saveUserProfile}
        onError={handleError}
        onInfo={handleInfo}
      />
    </div>
  );
}

