'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ClubEditForm } from '@/components/ClubEditForm';

const PLAYERS_ENDPOINT = '/api/admin/players?take=100';

interface Player {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
}

export default function ClubNewPage() {
  const router = useRouter();

  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);

  const getBackUrl = useCallback(() => {
    return '/clubs';
  }, []);

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
    async function loadPlayers() {
      try {
        const response = await fetch(PLAYERS_ENDPOINT);
        if (!response.ok) {
          console.error('Failed to load players:', response.status, response.statusText);
          return;
        }
        const data = await response.json();
        const playersList = Array.isArray(data?.items)
          ? data.items.map((player: any) => ({
              id: player.id,
              firstName: player.firstName,
              lastName: player.lastName,
            }))
          : [];
        setPlayers(playersList);
      } catch (error) {
        console.error('Error loading players:', error);
      }
    }

    void loadPlayers();
  }, []);

  // Create a default empty club for new club
  const defaultClub = {
    fullName: '',
    name: '',
    address: '',
    city: '',
    region: '',
    country: 'Canada',
    phone: '',
    email: '',
    description: '',
    directorId: '',
    logo: '',
  };

  const saveClub = useCallback(
    async (clubData: any): Promise<boolean> => {
      setLoading(true);
      try {
        const response = await fetch('/api/admin/clubs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(clubData),
        });

        if (response.ok) {
          handleInfo('Club created successfully');
          // Redirect to clubs list after successful creation
          setTimeout(() => {
            router.push(getBackUrl());
          }, 1500);
          return true;
        }

        const error = await response.json();
        throw new Error(error?.error || 'Failed to create club');
      } catch (error) {
        handleError(error instanceof Error ? error.message : 'Failed to create club');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [router, handleError, handleInfo, getBackUrl]
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
          Back to Clubs
        </button>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2">
          Add New Club
        </h1>
        <p className="text-muted">Create a new club profile</p>
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

      <ClubEditForm
        club={defaultClub}
        players={players}
        loading={loading}
        onSave={saveClub}
      />
    </div>
  );
}
