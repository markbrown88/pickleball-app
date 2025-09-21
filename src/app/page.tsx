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

  const getStatusChip = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'chip-success';
      case 'upcoming':
        return 'chip-info';
      case 'completed':
        return 'chip';
      default:
        return 'chip-warning';
    }
  };

  return (
    <div className="min-h-screen bg-app">
      {/* Header */}
      <header className="bg-surface-1 border-b border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-primary">TournaVerse</h1>
            </div>
            <div className="flex items-center space-x-4">
              <SignedIn>
                <div className="flex items-center space-x-4">
                  <Link 
                    href="/me" 
                    className="nav-link"
                  >
                    Dashboard
                  </Link>
                  {userProfile?.isAppAdmin && (
                    <Link 
                      href="/app-admin"
                      className="btn btn-primary"
                    >
                      Admin
                    </Link>
                  )}
                  <UserButton afterSignOutUrl="/" />
                </div>
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="btn btn-ghost">
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
          <h1 className="text-5xl md:text-6xl font-bold text-primary mb-4">
            TournaVerse
          </h1>
          <p className="text-xl text-muted mb-8">
            Powered by <span className="text-secondary font-semibold">Klyng</span>
          </p>
          <p className="text-lg text-secondary max-w-2xl mx-auto mb-12">
            The ultimate platform for managing pickleball tournaments. 
            Create, organize, and compete in tournaments with ease.
          </p>
          
          <SignedOut>
            <SignUpButton mode="modal">
              <button className="btn btn-secondary text-lg py-4 px-8">
                Get Started
              </button>
            </SignUpButton>
          </SignedOut>
        </div>

        {/* Upcoming Tournaments Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-primary mb-8 text-center">
            Upcoming Tournaments
          </h2>
          
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="loading-spinner"></div>
            </div>
          ) : err ? (
            <div className="text-center py-12">
              <p className="text-error mb-4">{err}</p>
              <button 
                onClick={fetchTournaments}
                className="btn btn-ghost"
              >
                Try Again
              </button>
            </div>
          ) : tournaments.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted text-lg">No tournaments available at the moment.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {tournaments.map((tournament) => (
                <div 
                  key={tournament.id} 
                  className="card"
                >
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-xl font-semibold text-primary line-clamp-2">
                      {tournament.name}
                    </h3>
                    {tournament.status && (
                      <span className={`chip ${getStatusChip(tournament.status)}`}>
                        {tournament.status}
                      </span>
                    )}
                  </div>
                  
                  {tournament.description && (
                    <p className="text-muted text-sm mb-4 line-clamp-2">
                      {tournament.description}
                    </p>
                  )}
                  
                  <div className="space-y-2">
                    {tournament.location && (
                      <div className="flex items-center text-secondary">
                        <svg className="w-4 h-4 mr-2 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-sm">{tournament.location}</span>
                      </div>
                    )}
                    
                    {tournament.startDate && (
                      <div className="flex items-center text-secondary">
                        <svg className="w-4 h-4 mr-2 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm tabular">
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
                      className="btn btn-primary w-full"
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
            <div className="bg-info w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-primary mb-2">Easy Management</h3>
            <p className="text-muted">Create and manage tournaments with our intuitive interface.</p>
          </div>
          
          <div className="text-center">
            <div className="bg-success w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-primary mb-2">Team Collaboration</h3>
            <p className="text-muted">Work together with captains and event managers seamlessly.</p>
          </div>
          
          <div className="text-center">
            <div className="bg-accent w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-primary mb-2">Real-time Stats</h3>
            <p className="text-muted">Track scores, standings, and tournament progress in real-time.</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-surface-1 border-t border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-muted">
            <p>&copy; 2024 TournaVerse. Powered by Klyng.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
