'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatDateUTC, formatDateRangeUTC } from '@/lib/utils';

interface Tournament {
  id: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  registrationStatus?: string;
}

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTournaments();
  }, []);

  const loadTournaments = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tournaments');
      if (response.ok) {
        const data = await response.json();
        const items = Array.isArray(data?.tournaments) ? data.tournaments : [];
        // Filter to show OPEN and INVITE_ONLY tournaments (past, ongoing, and upcoming)
        const openTournaments = items.filter((t: Tournament) =>
          t.registrationStatus === 'OPEN' || t.registrationStatus === 'INVITE_ONLY'
        );
        // Sort by start date, most recent first
        const sorted = openTournaments.sort((a: Tournament, b: Tournament) => {
          const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
          const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
          return dateB - dateA; // Most recent first
        });
        setTournaments(sorted);
      } else {
        setError('Failed to load tournaments');
      }
    } catch (err) {
      setError(`Failed to load tournaments: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner"></div>
          <p className="mt-4 text-muted">Loading tournaments...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="text-center">
          <div className="text-error text-xl mb-4">⚠️ Error</div>
          <p className="text-muted">{error}</p>
          <button 
            onClick={loadTournaments}
            className="btn btn-primary mt-4"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Results</h1>
          <p className="text-muted">Select a tournament to view results from all stops</p>
        </div>

        <div className="grid gap-6">
          {tournaments.map((tournament) => (
            <Link
              key={tournament.id}
              href={`/tournament/${tournament.id}`}
              className="block card hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-primary mb-2">
                    {tournament.name}
                  </h2>
                  {tournament.description && (
                    <p className="text-muted mb-3">{tournament.description}</p>
                  )}
                  <div className="flex items-center space-x-6 text-sm text-muted">
                    {formatDateRangeUTC(tournament.startDate, tournament.endDate)}
                  </div>
                </div>
                <div className="text-primary">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {tournaments.length === 0 && (
          <div className="text-center py-12">
            <div className="text-muted text-lg mb-4">No tournaments found</div>
            <p className="text-muted">Create a tournament to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
