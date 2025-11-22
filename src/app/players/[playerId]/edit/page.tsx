'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PlayerEditForm } from '@/components/PlayerEditForm';
import type { UserProfile } from '@/types';

const CLUBS_ENDPOINT = '/api/admin/clubs?sort=name:asc';

export default function PlayerEditPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const playerId = params.playerId as string;

  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [player, setPlayer] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
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
    async function loadPlayer() {
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/players/${playerId}`);
        if (response.ok) {
          const data = await response.json();
          setPlayer(data);
        } else {
          throw new Error('Failed to load player');
        }
      } catch (error) {
        console.error('Error loading player:', error);
        handleError('Failed to load player');
      } finally {
        setLoading(false);
      }
    }

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

    void loadPlayer();
    void loadClubs();
  }, [playerId, handleError]);

  const savePlayer = useCallback(
    async (profileData: any): Promise<boolean> => {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/players/${playerId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profileData),
        });

        if (response.ok) {
          const updatedPlayer = await response.json();
          setPlayer(updatedPlayer);
          handleInfo('Player profile saved successfully');
          return true;
        }

        const error = await response.json();
        throw new Error(error?.error || 'Failed to save player');
      } catch (error) {
        handleError(error instanceof Error ? error.message : 'Failed to save player');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [playerId, handleError, handleInfo]
  );

  if (loading && !player) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="loading-spinner" aria-label="Loading player" />
      </div>
    );
  }

  if (!player) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="card text-center space-y-4">
          <h1 className="text-2xl font-semibold text-primary">Player Not Found</h1>
          <button onClick={() => router.push(getBackUrl())} className="btn btn-secondary">
            Back to Players
          </button>
        </div>
      </div>
    );
  }

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
          Edit Player: {player.firstName} {player.lastName}
        </h1>
        <p className="text-muted">Manage player profile and account details</p>
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
        profile={player}
        clubs={clubs}
        loading={loading}
        onSave={savePlayer}
      />
    </div>
  );
}
