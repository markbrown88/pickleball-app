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
  
  // State for dropdown functionality
  const [playerQueries, setPlayerQueries] = useState<Record<string, string>>({});
  const [playerOptions, setPlayerOptions] = useState<Record<string, Array<{ id: string; label: string }>>>({});

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

  // Dropdown functions for player selection
  const setPlayerQuery = (tournamentId: string, query: string) => {
    setPlayerQueries(prev => ({ ...prev, [tournamentId]: query }));
    setPlayerOptions(prev => ({ ...prev, [tournamentId]: [] }));
    
    if (query.trim().length >= 3) {
      // Search for players
      const filteredPlayers = players
        .filter(player => {
          const fullName = `${player.firstName || ''} ${player.lastName || ''}`.trim().toLowerCase();
          const email = player.email?.toLowerCase() || '';
          const searchTerm = query.toLowerCase();
          
          return fullName.includes(searchTerm) || email.includes(searchTerm);
        })
        .map(player => ({
          id: player.id,
          label: `${player.firstName} ${player.lastName}`
        }));
      
      setPlayerOptions(prev => ({ ...prev, [tournamentId]: filteredPlayers }));
    }
  };

  const assignPlayerAsAdmin = async (tournamentId: string, playerId: string) => {
    // Check if tournament already has an admin
    const tournament = tournaments.find(t => t.id === tournamentId);
    if (tournament && tournament.admins.length > 0) {
      setError('Only one admin allowed per tournament');
      return;
    }

    // Check if this player is already assigned to this tournament
    const existingAdmin = tournament?.admins.find(admin => admin.playerId === playerId);
    if (existingAdmin) {
      setError('This player is already assigned as admin for this tournament');
      return;
    }

    try {
      const response = await fetch('/api/app-admin/tournament-admins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tournamentId,
          playerId
        })
      });

      if (response.ok) {
        // Reload tournaments to show updated admin list
        const tournamentsRes = await fetch('/api/app-admin/tournaments');
        if (tournamentsRes.ok) {
          const data = await tournamentsRes.json();
          setTournaments(data.tournaments || []);
        }
        // Clear the query
        setPlayerQueries(prev => ({ ...prev, [tournamentId]: '' }));
        setPlayerOptions(prev => ({ ...prev, [tournamentId]: [] }));
        setError(null); // Clear any previous errors
      } else {
        const error = await response.json();
        if (error.error?.includes('Unique constraint failed')) {
          setError('This player is already assigned as admin for this tournament');
        } else {
          setError(error.error || 'Failed to assign tournament admin');
        }
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-primary">Access Denied</h1>
          <p className="text-muted">Please sign in to access this page.</p>
        </div>
      </div>
    );
  }

  if (!userProfile?.isAppAdmin) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-primary">Access Denied</h1>
          <p className="text-muted">You need App Admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app">
      {/* Header */}
      <header className="bg-surface-1 border-b border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <a href="/" className="text-2xl font-bold text-primary hover:text-primary-hover transition-colors">TournaVerse</a>
            </div>
            <div className="flex items-center space-x-4">
              <a href="/dashboard" className="nav-link">Player Dashboard</a>
              <a href="/admin" className="nav-link">Tournament Setup</a>
              <a href="/tournaments" className="nav-link">Scoreboard</a>
              <a href="/app-admin" className="nav-link active text-secondary font-semibold">Admin</a>
              <button 
                onClick={() => {
                  // Add logout functionality here
                  window.location.href = '/api/auth/logout';
                }}
                className="btn btn-ghost hover:bg-surface-2 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Banner Section */}
      <div className="bg-surface-1 border-b border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-primary">Admin Dashboard</h1>
          <p className="text-muted mt-2">Manage tournaments, assign admins, and oversee the platform</p>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {error && (
          <div className="border border-error bg-error/20 text-error p-3 rounded">
            {error}
          </div>
        )}


        {/* Tournaments List */}
        <section>
          <h2 className="text-xl font-semibold mb-4 text-primary">Tournaments</h2>
          {tournaments.length === 0 ? (
            <div className="text-center py-8 text-muted card">
              <p>No tournaments found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto" style={{ overflow: 'visible' }}>
              <table className="table" style={{ overflow: 'visible' }}>
                <thead>
                  <tr>
                    <th>Tournament</th>
                    <th>Status</th>
                    <th>Teams</th>
                    <th>Stops</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Tournament Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {tournaments.map((tournament) => (
                    <tr key={tournament.id}>
                      <td>
                        <div>
                          <div className="font-medium text-primary">{tournament.name}</div>
                          {tournament.description && (
                            <div className="text-sm text-muted">{tournament.description}</div>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`chip ${
                          tournament.status === 'Complete' ? 'chip-success' :
                          tournament.status === 'In Progress' ? 'chip-warning' :
                          tournament.status === 'Upcoming' ? 'chip-info' :
                          'chip-error'
                        }`}>
                          {tournament.status}
                        </span>
                      </td>
                      <td className="text-muted tabular">{tournament._count.teams}</td>
                      <td className="text-muted tabular">{tournament._count.stops}</td>
                      <td className="text-muted tabular">
                        {tournament.startDate ? new Date(tournament.startDate).toLocaleDateString() : 'TBD'}
                      </td>
                      <td className="text-muted tabular">
                        {tournament.endDate ? new Date(tournament.endDate).toLocaleDateString() : 'TBD'}
                      </td>
                      <td style={{ position: 'relative', overflow: 'visible' }}>
                        <div className="space-y-2">
                          {/* Existing admins */}
                          {tournament.admins.map((admin) => (
                            <div key={`${admin.tournamentId}-${admin.playerId}`} className="flex items-center justify-between">
                              <span className="text-muted">
                                {admin.player.firstName} {admin.player.lastName}
                              </span>
                              <button
                                onClick={() => removeTournamentAdmin(`${admin.tournamentId}-${admin.playerId}`)}
                                className="text-error hover:text-error-hover text-xs"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                          
                          {/* Add new admin dropdown - only show if no admin exists */}
                          {tournament.admins.length === 0 && (
                            <div className="relative" style={{ position: 'relative', zIndex: 10 }}>
                              <input
                                className="input text-sm w-full"
                                placeholder="Type 3+ chars to search players..."
                                value={playerQueries[tournament.id] || ''}
                                onChange={(e) => setPlayerQuery(tournament.id, e.target.value)}
                              />
                              {playerOptions[tournament.id] && playerOptions[tournament.id].length > 0 && (
                                <div 
                                  className="absolute border border-subtle rounded mt-1 bg-surface-1 max-h-40 overflow-auto w-full shadow-lg z-50" 
                                  style={{ 
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    zIndex: 9999
                                  }}
                                >
                                  {playerOptions[tournament.id].map((player) => (
                                    <button
                                      key={player.id}
                                      className="block w-full text-left px-3 py-2 hover:bg-surface-2 text-sm text-primary"
                                      onClick={() => assignPlayerAsAdmin(tournament.id, player.id)}
                                    >
                                      {player.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
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
