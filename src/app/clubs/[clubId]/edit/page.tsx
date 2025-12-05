'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ClubEditForm } from '@/components/ClubEditForm';

const PLAYERS_ENDPOINT = '/api/admin/players?take=100';

interface Player {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
}

interface Club {
  id: string;
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

export default function ClubEditPage() {
  const router = useRouter();
  const params = useParams();
  const clubId = params.clubId as string;

  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [club, setClub] = useState<Club | null>(null);
  const [loading, setLoading] = useState(true);
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
    async function loadClub() {
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/clubs/${clubId}`);
        if (response.ok) {
          const data = await response.json();
          setClub(data);
        } else {
          throw new Error('Failed to load club');
        }
      } catch (error) {
        console.error('Error loading club:', error);
        handleError('Failed to load club');
      } finally {
        setLoading(false);
      }
    }

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

    void loadClub();
    void loadPlayers();
  }, [clubId, handleError]);

  const saveClub = useCallback(
    async (clubData: any): Promise<boolean> => {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/clubs/${clubId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(clubData),
        });

        if (response.ok) {
          const updatedClub = await response.json();
          setClub(updatedClub);
          handleInfo('Club saved successfully');
          return true;
        }

        const error = await response.json();
        throw new Error(error?.error || 'Failed to save club');
      } catch (error) {
        handleError(error instanceof Error ? error.message : 'Failed to save club');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [clubId, handleError, handleInfo]
  );

  if (loading && !club) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="loading-spinner" aria-label="Loading club" />
      </div>
    );
  }

  if (!club) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="card text-center space-y-4">
          <h1 className="text-2xl font-semibold text-primary">Club Not Found</h1>
          <button onClick={() => router.push(getBackUrl())} className="btn btn-secondary">
            Back to Clubs
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
          Back to Clubs
        </button>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2">
          Edit Club: {club.fullName}
        </h1>
        <p className="text-muted">Manage club profile and details</p>
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
        club={club}
        players={players}
        loading={loading}
        onSave={saveClub}
      />
    </div>
  );
}
