'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Tournament {
  id: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
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
        setTournaments(items);
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tournaments...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ Error</div>
          <p className="text-gray-600">{error}</p>
          <button 
            onClick={loadTournaments}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Tournaments</h1>
          <p className="text-gray-600">Select a tournament to view results from all stops</p>
        </div>

        <div className="grid gap-6">
          {tournaments.map((tournament) => (
            <Link
              key={tournament.id}
              href={`/tournament/${tournament.id}`}
              className="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    {tournament.name}
                  </h2>
                  {tournament.description && (
                    <p className="text-gray-600 mb-3">{tournament.description}</p>
                  )}
                  <div className="flex items-center space-x-6 text-sm text-gray-500">
                    {tournament.startDate && (
                      <span>Start: {new Date(tournament.startDate).toLocaleDateString()}</span>
                    )}
                    {tournament.endDate && (
                      <span>End: {new Date(tournament.endDate).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="text-blue-600">
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
            <div className="text-gray-500 text-lg mb-4">No tournaments found</div>
            <p className="text-gray-400">Create a tournament to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
