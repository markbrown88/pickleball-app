'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PlayerEditForm } from '@/components/PlayerEditForm';
import { useAdminUser } from '@/app/admin/AdminContext';

const CLUBS_ENDPOINT = '/api/admin/clubs?sort=name:asc';

export default function PlayerNewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const admin = useAdminUser();

  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [clubs, setClubs] = useState<Array<{ id: string; name: string }>>([]);

  // Build the back URL with preserved filter parameters
  const getBackUrl = useCallback(() => {
    const params = new URLSearchParams();
    searchParams.forEach((value, key) => {
      params.set(key, value);
    });
    const queryString = params.toString();
    return `/players${queryString ? `?${queryString}` : ''}`;
  }, [searchParams]);

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

  useEffect(() => {
    async function loadClubs() {
      try {
        // Request more clubs (up to 50) to ensure we get all clubs
        const response = await fetch(`${CLUBS_ENDPOINT}&take=50`);
        if (!response.ok) {
          console.error('Failed to load clubs:', response.status, response.statusText);
          return;
        }
        const data = await response.json();
        // Map the response to ensure we have id and name fields
        const clubsList = Array.isArray(data) 
          ? data.map((club: any) => ({ id: club.id, name: club.name }))
          : [];
        setClubs(clubsList);
      } catch (error) {
        console.error('Error loading clubs:', error);
      }
    }

    void loadClubs();
  }, []);

  // Create a default empty profile for new player
  const defaultProfile = {
    id: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    gender: '',
    club: admin.isTournamentAdmin && !admin.isAppAdmin && admin.clubId ? { id: admin.clubId } : undefined,
    city: '',
    region: '',
    country: 'Canada',
    birthday: null,
    duprSingles: null,
    duprDoubles: null,
    clubRatingSingles: null,
    clubRatingDoubles: null,
    displayAge: true,
    displayLocation: true,
  };

  const savePlayer = useCallback(
    async (profileData: any): Promise<boolean> => {
      setLoading(true);
      try {
        const response = await fetch('/api/admin/players', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profileData),
        });

        if (response.ok) {
          handleInfo('Player created successfully');
          // Redirect to players list after successful creation
          setTimeout(() => {
            router.push(getBackUrl());
          }, 1500);
          return true;
        }

        const error = await response.json();
        throw new Error(error?.error || 'Failed to create player');
      } catch (error) {
        handleError(error instanceof Error ? error.message : 'Failed to create player');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [router, handleError, handleInfo]
  );

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.push(getBackUrl())}
          className="btn btn-ghost flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Players
        </button>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2">
          Add New Player
        </h1>
        <p className="text-muted">Create a new player profile</p>
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

      <PlayerEditForm
        profile={defaultProfile as any}
        clubs={clubs}
        loading={loading}
        onSave={savePlayer}
      />
    </div>
  );
}
