'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { UserProfile } from '@/types';

interface TournamentAdmin {
  id: string;
  playerId: string;
  tournamentId: string;
  player: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  };
  tournament: {
    id: string;
    name: string;
    startDate: Date | null;
    endDate: Date | null;
  };
}

interface Tournament {
  id: string;
  name: string;
  description: string | null;
  startDate: Date | null;
  endDate: Date | null;
  location: string | null;
  status: string;
  maxTeams: number | null;
  registrationDeadline: Date | null;
  createdAt: Date;
  updatedAt: Date;
  admins: TournamentAdmin[];
  _count: {
    teams: number;
    stops: number;
  };
}

interface Player {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  isAppAdmin: boolean;
}

export default function AppAdminPage() {
  const { user, isLoaded } = useUser();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTournament, setSelectedTournament] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');

  // Check if user is App Admin
  useEffect(() => {
    async function checkUserProfile() {
      if (!user) return;
      
      try {
        const response = await fetch('/api/auth/user');
        if (response.ok) {
          const profile = await response.json();
          setUserProfile(profile);
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
      }
    }
    
    checkUserProfile();
  }, [user]);

  // Load tournaments and players
  useEffect(() => {
    async function loadData() {
      if (!userProfile?.isAppAdmin) return;
      
      try {
        setLoading(true);
        const [tournamentsRes, playersRes] = await Promise.all([
          fetch('/api/app-admin/tournaments'),
          fetch('/api/app-admin/players')
        ]);

        if (!tournamentsRes.ok || !playersRes.ok) {
          throw new Error('Failed to load data');
        }

        const tournamentsData = await tournamentsRes.json();
        const playersData = await playersRes.json();

        setTournaments(tournamentsData.tournaments || []);
        setPlayers(playersData.players || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [userProfile]);

  // Assign tournament admin
  const assignTournamentAdmin = async () => {
    if (!selectedTournament || !selectedPlayer) return;

    try {
      const response = await fetch('/api/app-admin/tournament-admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: selectedTournament,
          playerId: selectedPlayer
        })
      });

      if (response.ok) {
        // Reload tournaments to show updated admin list
        const tournamentsRes = await fetch('/api/app-admin/tournaments');
        if (tournamentsRes.ok) {
          const data = await tournamentsRes.json();
          setTournaments(data.tournaments || []);
        }
        setSelectedPlayer('');
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to assign tournament admin');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Remove tournament admin
  const removeTournamentAdmin = async (adminId: string) => {
    try {
      const response = await fetch(`/api/app-admin/tournament-admins/${adminId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Reload tournaments to show updated admin list
        const tournamentsRes = await fetch('/api/app-admin/tournaments');
        if (tournamentsRes.ok) {
          const data = await tournamentsRes.json();
          setTournaments(data.tournaments || []);
        }
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to remove tournament admin');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-gray-400">Please sign in to access this page.</p>
        </div>
      </div>
    );
  }

  if (!userProfile?.isAppAdmin) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-gray-400">You need App Admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-white">TournaVerse</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm">
                <span className="mr-2 text-gray-300">Welcome,</span>
                <span className="font-medium text-white">{userProfile?.firstName || user?.firstName || 'User'}</span>
              </div>
              <a
                href="/me"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
              >
                Back to Dashboard
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Banner Section */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-white">App Admin Dashboard</h1>
          <p className="text-gray-400 mt-2">Manage tournaments, assign admins, and oversee the platform</p>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {error && (
          <div className="border border-red-500 bg-red-900/20 text-red-400 p-3 rounded">
            {error}
          </div>
        )}

        {/* Tournament Admin Assignment */}
        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Tournament Admin Assignment</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Select Tournament</label>
              <select
                value={selectedTournament || ''}
                onChange={(e) => setSelectedTournament(e.target.value)}
                className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white"
              >
                <option value="">Choose a tournament</option>
                {tournaments.map(tournament => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Select Player</label>
              <select
                value={selectedPlayer}
                onChange={(e) => setSelectedPlayer(e.target.value)}
                className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white"
              >
                <option value="">Choose a player</option>
                {players.map(player => (
                  <option key={player.id} value={player.id}>
                    {player.firstName} {player.lastName} ({player.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={assignTournamentAdmin}
                disabled={!selectedTournament || !selectedPlayer}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Assign Admin
              </button>
            </div>
          </div>
        </section>

        {/* Tournaments List */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Tournaments</h2>
          {tournaments.length === 0 ? (
            <div className="text-center py-8 text-gray-400 bg-gray-800 rounded-lg">
              <p>No tournaments found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-700 bg-gray-800">
                    <th className="py-3 px-4 font-medium text-gray-300">Tournament</th>
                    <th className="py-3 px-4 font-medium text-gray-300">Status</th>
                    <th className="py-3 px-4 font-medium text-gray-300">Teams</th>
                    <th className="py-3 px-4 font-medium text-gray-300">Stops</th>
                    <th className="py-3 px-4 font-medium text-gray-300">Created</th>
                    <th className="py-3 px-4 font-medium text-gray-300">Tournament Admins</th>
                  </tr>
                </thead>
                <tbody>
                  {tournaments.map((tournament) => (
                    <tr key={tournament.id} className="border-b border-gray-700 hover:bg-gray-800">
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium text-white">{tournament.name}</div>
                          {tournament.description && (
                            <div className="text-sm text-gray-400">{tournament.description}</div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 rounded-full bg-gray-700 text-gray-300 text-xs">
                          {tournament.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-300">{tournament._count.teams}</td>
                      <td className="py-3 px-4 text-gray-300">{tournament._count.stops}</td>
                      <td className="py-3 px-4 text-gray-300">
                        {new Date(tournament.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {tournament.admins.map((admin) => (
                            <div key={`${admin.tournamentId}-${admin.playerId}`} className="flex items-center justify-between">
                              <span className="text-gray-300">
                                {admin.player.firstName} {admin.player.lastName}
                              </span>
                              <button
                                onClick={() => removeTournamentAdmin(`${admin.tournamentId}-${admin.playerId}`)}
                                className="text-red-400 hover:text-red-300 text-xs"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                          {tournament.admins.length === 0 && (
                            <span className="text-gray-500 text-xs">No admins assigned</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
