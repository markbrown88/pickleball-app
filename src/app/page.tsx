'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { UserButton, SignedIn, SignedOut, SignInButton, SignUpButton, useUser } from '@clerk/nextjs';

type Tournament = { 
  id: string; 
  name: string; 
  description?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  status?: string;
  createdAt: string;
};

type UserProfile = {
  id: string;
  firstName: string | null;
  isAppAdmin: boolean;
};

export default function Home() {
  const { user, isLoaded } = useUser();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function fetchTournaments() {
    try {
      setLoading(true);
      const response = await fetch('/api/tournaments', { cache: 'no-store' });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tournaments: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.tournaments && Array.isArray(data.tournaments)) {
        // Sort by start date, nearest first
        const sorted = data.tournaments.sort((a: Tournament, b: Tournament) => {
          const dateA = a.startDate ? new Date(a.startDate).getTime() : new Date(a.createdAt).getTime();
          const dateB = b.startDate ? new Date(b.startDate).getTime() : new Date(b.createdAt).getTime();
          return dateA - dateB;
        });
        setTournaments(sorted);
      } else {
        setTournaments([]);
      }
    } catch (error) {
      console.error('Error fetching tournaments:', error);
      setErr(error instanceof Error ? error.message : 'Failed to load tournaments');
    } finally {
      setLoading(false);
    }
  }

  // Fetch user profile for App Admin check
  useEffect(() => {
    async function fetchUserProfile() {
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
    
    fetchUserProfile();
  }, [user]);

  useEffect(() => {
    fetchTournaments();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'upcoming':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

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
              <SignedIn>
                <div className="flex items-center space-x-4">
                  <Link 
                    href="/me" 
                    className="text-gray-300 hover:text-white transition-colors"
                  >
                    Dashboard
                  </Link>
                  {userProfile?.isAppAdmin && (
                    <Link 
                      href="/app-admin"
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
                    >
                      Admin
                    </Link>
                  )}
                  <UserButton afterSignOutUrl="/" />
                </div>
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="bg-transparent border border-gray-300 text-gray-300 hover:text-white hover:border-white px-4 py-2 rounded-lg transition-colors">
                    Login
                  </button>
                </SignInButton>
              </SignedOut>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
            TournaVerse
          </h1>
          <p className="text-xl text-gray-400 mb-8">
            Powered by <span className="text-blue-400 font-semibold">Klyng</span>
          </p>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-12">
            The ultimate platform for managing pickleball tournaments. 
            Create, organize, and compete in tournaments with ease.
          </p>
          
          <SignedOut>
            <SignUpButton mode="modal">
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-lg text-lg transition-colors shadow-lg hover:shadow-xl">
                Get Started
              </button>
            </SignUpButton>
          </SignedOut>
        </div>

        {/* Upcoming Tournaments Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">
            Upcoming Tournaments
          </h2>
          
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : err ? (
            <div className="text-center py-12">
              <p className="text-red-400 mb-4">{err}</p>
              <button 
                onClick={fetchTournaments}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : tournaments.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">No tournaments available at the moment.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {tournaments.map((tournament) => (
                <div 
                  key={tournament.id} 
                  className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-colors shadow-lg hover:shadow-xl"
                >
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-xl font-semibold text-white line-clamp-2">
                      {tournament.name}
                    </h3>
                    {tournament.status && (
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(tournament.status)}`}>
                        {tournament.status}
                      </span>
                    )}
                  </div>
                  
                  {tournament.description && (
                    <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                      {tournament.description}
                    </p>
                  )}
                  
                  <div className="space-y-2">
                    {tournament.location && (
                      <div className="flex items-center text-gray-300">
                        <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-sm">{tournament.location}</span>
                      </div>
                    )}
                    
                    {tournament.startDate && (
                      <div className="flex items-center text-gray-300">
                        <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm">
                          {formatDate(tournament.startDate)}
                          {tournament.endDate && tournament.endDate !== tournament.startDate && 
                            ` - ${formatDate(tournament.endDate)}`
                          }
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-6">
                    <Link 
                      href={`/tournament/${tournament.id}`}
                      className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center py-2 px-4 rounded-lg transition-colors"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="text-center">
            <div className="bg-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Easy Management</h3>
            <p className="text-gray-400">Create and manage tournaments with our intuitive interface.</p>
          </div>
          
          <div className="text-center">
            <div className="bg-green-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Team Collaboration</h3>
            <p className="text-gray-400">Work together with captains and event managers seamlessly.</p>
          </div>
          
          <div className="text-center">
            <div className="bg-purple-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Real-time Stats</h3>
            <p className="text-gray-400">Track scores, standings, and tournament progress in real-time.</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-400">
            <p>&copy; 2024 TournaVerse. Powered by Klyng.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
