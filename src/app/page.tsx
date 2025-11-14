'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { UserButton, SignedIn, SignedOut, SignInButton, SignUpButton, useUser } from '@clerk/nextjs';
import { formatDateRangeUTC } from '@/lib/utils';

type TournamentStop = {
  id: string;
  name: string;
  startAt: string | null;
  endAt: string | null;
  locationName: string | null;
};

type Tournament = { 
  id: string; 
  name: string; 
  description?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  status?: string;
  registrationStatus?: string;
  createdAt: string;
  stops?: TournamentStop[];
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
        const now = new Date(); // Current local time
        
        // Filter to show OPEN and INVITE_ONLY tournaments that haven't ended yet
        const futureTournaments = data.tournaments.filter((t: Tournament) => {
          // Must be OPEN or INVITE_ONLY
          if (t.registrationStatus !== 'OPEN' && t.registrationStatus !== 'INVITE_ONLY') return false;
          
          // Check if tournament hasn't ended yet
          if (t.endDate) {
            const endDate = new Date(t.endDate);
            return endDate > now;
          }
          
          // If no endDate, check startDate
          if (t.startDate) {
            const startDate = new Date(t.startDate);
            return startDate > now;
          }
          
          // If no dates, include it (shouldn't happen but be safe)
          return true;
        });
        
        // Sort by start date, nearest first
        const sorted = futureTournaments.sort((a: Tournament, b: Tournament) => {
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

  // Helper function to find next upcoming stop for multi-stop tournaments
  const getNextStop = (tournament: Tournament): TournamentStop | null => {
    if (!tournament.stops || tournament.stops.length === 0) return null;
    
    const now = new Date();
    const upcomingStops = tournament.stops
      .filter(stop => {
        if (!stop.startAt) return false;
        const stopDate = new Date(stop.startAt);
        return stopDate > now;
      })
      .sort((a, b) => {
        const dateA = a.startAt ? new Date(a.startAt).getTime() : 0;
        const dateB = b.startAt ? new Date(b.startAt).getTime() : 0;
        return dateA - dateB;
      });
    
    return upcomingStops.length > 0 ? upcomingStops[0] : null;
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
              <Link href="/" className="text-2xl font-bold text-primary">
                Klyng Cup
              </Link>
            </div>
            <nav className="hidden md:flex items-center space-x-8">
              <Link href="/about" className="nav-link">About</Link>
              <a href="#tournaments" className="nav-link">Current Tournaments</a>
              <Link href="/rules" className="nav-link">Rules & Format</Link>
            </nav>
            {/* Mobile Navigation */}
            <div className="md:hidden">
              <button className="text-primary hover:text-secondary">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
            <div className="flex items-center space-x-4">
              <SignedIn>
                <div className="flex items-center space-x-4">
                  <Link 
                    href="/dashboard" 
                    className="btn btn-primary"
                  >
                    Dashboard
                  </Link>
                  <UserButton afterSignOutUrl="/" />
                </div>
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal" fallbackRedirectUrl="/dashboard">
                  <button className="btn btn-ghost">
                    Login
                  </button>
                </SignInButton>
                <SignUpButton mode="modal" fallbackRedirectUrl="/dashboard">
                  <button className="btn btn-primary">
                    Sign Up
                  </button>
                </SignUpButton>
              </SignedOut>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 bg-surface-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left side - Content */}
            <div className="text-center lg:text-left">
              <h1 className="text-5xl md:text-7xl font-bold text-primary mb-6">
                Klyng Cup
          </h1>
              <p className="text-xl md:text-2xl text-brand-secondary mb-4 font-semibold">
                Battle of the Clubs
              </p>
              <p className="text-lg text-muted max-w-2xl mx-auto lg:mx-0 mb-12 leading-relaxed">
                A high-stakes, high-fun, co-ed interclub league where pride, teamwork, and performance take center court. 
                Pickleball clubs compete in a customizable multi-stop championship series unlike anything else in the sport.
              </p>
              
              {/* Klyng Cup-Pickleplex Tournament Card */}
              {(() => {
                const klyngCupPickleplex = tournaments.find((t: Tournament) => 
                  t.name.toLowerCase().includes('klyng cup') && 
                  (t.name.toLowerCase().includes('pickleplex') || t.name.toLowerCase().includes('pickle plex'))
                );
                
                if (klyngCupPickleplex) {
                  const nextStop = getNextStop(klyngCupPickleplex);
                  const isMultiStop = klyngCupPickleplex.stops && klyngCupPickleplex.stops.length > 1;
                  const isInviteOnly = klyngCupPickleplex.registrationStatus === 'INVITE_ONLY';
                  
                  return (
                    <div className="card hover:shadow-lg transition-shadow duration-300 max-w-2xl mx-auto lg:mx-0">
                      <div className="flex items-start justify-between mb-4">
                        <h3 className="text-xl font-semibold text-primary line-clamp-2">
                          {klyngCupPickleplex.name}
                        </h3>
                        {klyngCupPickleplex.status && (
                          <span className={`chip ${getStatusChip(klyngCupPickleplex.status)}`}>
                            {klyngCupPickleplex.status}
                          </span>
                        )}
                      </div>
                      
                      {klyngCupPickleplex.description && (
                        <p className="text-muted text-sm mb-4 line-clamp-2">
                          {klyngCupPickleplex.description}
                        </p>
                      )}
                      
                      <div className="space-y-2 mb-6">
                        {isMultiStop && nextStop ? (
                          <>
                            <div className="flex items-center text-secondary">
                              <svg className="w-4 h-4 mr-2 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span className="text-sm">Next Stop: {nextStop.name}</span>
                            </div>
                            {nextStop.startAt && (
                              <div className="flex items-center text-secondary">
                                <svg className="w-4 h-4 mr-2 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="text-sm tabular">
                                  {formatDateRangeUTC(nextStop.startAt, nextStop.endAt)}
                                </span>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            {klyngCupPickleplex.location && (
                              <div className="flex items-center text-secondary">
                                <svg className="w-4 h-4 mr-2 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span className="text-sm">{klyngCupPickleplex.location}</span>
                              </div>
                            )}
                            {klyngCupPickleplex.startDate && (
                              <div className="flex items-center text-secondary">
                                <svg className="w-4 h-4 mr-2 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="text-sm tabular">
                                  {formatDateRangeUTC(klyngCupPickleplex.startDate, klyngCupPickleplex.endDate)}
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <Link 
                          href={`/tournament/${klyngCupPickleplex.id}`}
                          className="btn btn-primary flex-1"
                        >
                          View Results
                        </Link>
                        {!isInviteOnly && (
                          <SignedOut>
                            <SignUpButton mode="modal" fallbackRedirectUrl={`/register/${klyngCupPickleplex.id}`}>
                              <button className="btn btn-secondary">
                                Register
                              </button>
                            </SignUpButton>
                          </SignedOut>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* Right side - Photo */}
            <div className="relative">
              <div className="relative h-96 lg:h-[500px] rounded-2xl overflow-hidden shadow-2xl">
                <div 
                  className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                  style={{ backgroundImage: 'url(/images/klyngcup-trophy.jpeg)' }}
                ></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                {/* Decorative elements */}
                <div className="absolute top-6 right-6 w-16 h-16 bg-brand-accent/20 rounded-full blur-lg"></div>
                <div className="absolute bottom-6 left-6 w-12 h-12 bg-brand-secondary/20 rounded-full blur-md"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Photo Stripe Section */}
      <section className="py-16 bg-gradient-to-r from-surface-1 to-surface-2">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Photo 1 - Competitive Match */}
            <div className="relative h-80 rounded-lg overflow-hidden shadow-lg group">
              <div 
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: 'url(/images/klyng1.jpg)' }}
              ></div>
              <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/70 to-brand-accent/70"></div>
              <div className="absolute bottom-4 left-4 right-4">
                <div className="text-center text-white bg-black/60 backdrop-blur-sm rounded-lg p-4">
                  <svg className="w-12 h-12 mx-auto mb-2 opacity-90" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  <p className="text-sm font-semibold">Competitive Matches</p>
                </div>
              </div>
            </div>

            {/* Photo 2 - Team Spirit */}
            <div className="relative h-80 rounded-lg overflow-hidden shadow-lg group">
              <div 
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: 'url(/images/klyng4.jpg)' }}
              ></div>
              <div className="absolute inset-0 bg-gradient-to-br from-brand-accent/70 to-status-success/70"></div>
              <div className="absolute bottom-4 left-4 right-4">
                <div className="text-center text-white bg-black/60 backdrop-blur-sm rounded-lg p-4">
                  <svg className="w-12 h-12 mx-auto mb-2 opacity-90" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                  </svg>
                  <p className="text-sm font-semibold">Team Spirit</p>
                </div>
              </div>
            </div>

            {/* Photo 3 - Championship */}
            <div className="relative h-80 rounded-lg overflow-hidden shadow-lg group">
              <div 
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: 'url(/images/klyng3.jpg)' }}
              ></div>
              <div className="absolute inset-0 bg-gradient-to-br from-status-success/70 to-brand-primary/70"></div>
              <div className="absolute bottom-4 left-4 right-4">
                <div className="text-center text-white bg-black/60 backdrop-blur-sm rounded-lg p-4">
                  <svg className="w-12 h-12 mx-auto mb-2 opacity-90" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  <p className="text-sm font-semibold">Championship Glory</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What Makes Klyng Cup Unique */}
      <section className="py-20 bg-gradient-to-b from-surface-1 to-surface-2">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-primary mb-6">
              What Makes Klyng Cup Different
            </h2>
            <p className="text-xl text-muted max-w-3xl mx-auto">
              Experience pickleball like never before with our unique tournament format designed for clubs and communities.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="card text-center group hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
              <div className="bg-gradient-to-br from-brand-secondary to-brand-accent w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300">
                <svg className="w-10 h-10 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-4">Flexible Tournament Format</h3>
              <p className="text-muted">
                Create single-day tournaments or multi-stop championship series. Scale from one event to as many stops as you want, with each stop at different venues culminating in an epic championship final.
              </p>
            </div>

            <div className="card text-center group hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
              <div className="bg-gradient-to-br from-brand-accent to-status-info w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-4">Cumulative Point System</h3>
              <p className="text-muted">
                Teams earn points at every stop based on match results, creating ongoing competition and strategic depth throughout the tournament series.
              </p>
            </div>

            <div className="card text-center group hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
              <div className="bg-gradient-to-br from-status-success to-brand-secondary w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-4">Co-ed Interclub League</h3>
              <p className="text-muted">
                Each club sends teams in customizable skill divisions. Create brackets based on DUPR ratings, skill levels, or any criteria that works for your community.
              </p>
            </div>

            <div className="card text-center group hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
              <div className="bg-gradient-to-br from-status-info to-brand-accent w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-4">Flexible Skill Divisions</h3>
              <p className="text-muted">
                Create custom brackets and divisions that work for your community. Use DUPR ratings, skill categories, or any other criteria to ensure fair and exciting competition.
              </p>
            </div>

            <div className="card text-center group hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
              <div className="bg-gradient-to-br from-status-warning to-brand-secondary w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-4">Flexible Tournament Formats</h3>
              <p className="text-muted">
                Choose from round robin, elimination, or custom formats. Every team gets maximum playing time with fair competition designed for your community.
              </p>
            </div>

            <div className="card text-center group hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
              <div className="bg-gradient-to-br from-brand-primary to-status-success w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-4">Custom Tiebreaker Options</h3>
              <p className="text-muted">
                Add excitement with custom tiebreaker formats like the DreamBreaker singles rotation, or choose traditional methods that work best for your tournament.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Action Photo Stripe */}
      <section className="py-20 bg-gradient-to-r from-brand-primary/5 to-brand-accent/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left side - Photo */}
            <div className="relative">
              <div className="relative h-80 rounded-2xl overflow-hidden shadow-2xl">
                <div 
                  className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                  style={{ backgroundImage: 'url(/images/klyng2.jpg)' }}
                ></div>
                <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/60 to-brand-accent/60"></div>
                <div className="absolute bottom-6 left-6 right-6">
                  <div className="flex items-center text-white bg-black/70 backdrop-blur-sm rounded-xl p-6">
                    <svg className="w-16 h-16 mr-4 opacity-90 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    <div>
                      <h3 className="text-xl font-bold mb-2">Intense Competition</h3>
                      <p className="text-base font-medium">Every match matters in the Klyng Cup</p>
                    </div>
                  </div>
                </div>
                <div className="absolute top-4 right-4">
                  <div className="bg-black/70 backdrop-blur-sm rounded-full px-4 py-2">
                    <span className="text-white text-sm font-semibold">Action Shot</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side - Content */}
            <div className="space-y-6">
              <h2 className="text-4xl font-bold text-primary">
                Experience the Energy
              </h2>
              <p className="text-xl text-muted leading-relaxed">
                Feel the intensity of competitive pickleball as clubs battle for supremacy. 
                Every serve, every volley, every point counts toward championship glory.
              </p>
              <div className="grid grid-cols-2 gap-6 pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-brand-primary mb-2">100+</div>
                  <div className="text-muted">Matches Played</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-brand-accent mb-2">50+</div>
                  <div className="text-muted">Clubs Competing</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

        {/* Upcoming Tournaments Section */}
      <section id="tournaments" className="py-20 bg-app">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-primary mb-6">
              Upcoming Klyng Cup Tournaments
          </h2>
            <p className="text-xl text-muted max-w-3xl mx-auto">
              Join the excitement! Register for upcoming tournaments and start your journey to the championship.
            </p>
          </div>
          
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
              <p className="text-muted text-lg mb-6">No tournaments available at the moment.</p>
              <p className="text-muted">Check back soon for upcoming Klyng Cup events!</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {tournaments.slice(0, 6).map((tournament) => {
                const nextStop = getNextStop(tournament);
                const isMultiStop = tournament.stops && tournament.stops.length > 1;
                const isInviteOnly = tournament.registrationStatus === 'INVITE_ONLY';
                
                return (
                  <div 
                    key={tournament.id} 
                    className="card hover:shadow-lg transition-shadow duration-300"
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
                    
                    <div className="space-y-2 mb-6">
                      {isMultiStop && nextStop ? (
                        <>
                          <div className="flex items-center text-secondary">
                            <svg className="w-4 h-4 mr-2 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="text-sm">Next Stop: {nextStop.name}</span>
                          </div>
                          {nextStop.startAt && (
                            <div className="flex items-center text-secondary">
                              <svg className="w-4 h-4 mr-2 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="text-sm tabular">
                                {formatDateRangeUTC(nextStop.startAt, nextStop.endAt)}
                              </span>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
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
                                {formatDateRangeUTC(tournament.startDate, tournament.endDate)}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Link 
                        href={`/tournament/${tournament.id}`}
                        className="btn btn-primary flex-1"
                      >
                        View Results
                      </Link>
                      {!isInviteOnly && (
                        <SignedOut>
                          <SignUpButton mode="modal" fallbackRedirectUrl={`/register/${tournament.id}`}>
                            <button className="btn btn-secondary">
                              Register
                            </button>
                          </SignUpButton>
                        </SignedOut>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tournaments.length > 6 && (
            <div className="text-center mt-8">
              <Link href="/tournaments" className="btn btn-ghost">
                View All Tournaments
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-gradient-to-b from-surface-2 to-surface-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-primary mb-6">
              How Klyng Cup Works
            </h2>
            <p className="text-xl text-muted max-w-3xl mx-auto">
              A flexible tournament format that can be customized for any community, anywhere in the world. 
              From single-day events to multi-stop championship series.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12">
            {/* For Players */}
            <div>
              <h3 className="text-2xl font-bold text-primary mb-8 text-center">For Players</h3>
              <div className="space-y-6">
                <div className="flex items-start space-x-4 group">
                  <div className="bg-gradient-to-br from-brand-secondary to-brand-accent text-brand-primary w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300">
                    1
                  </div>
                  <div>
                    <h4 className="font-semibold text-primary mb-2">Register to Play!</h4>
                    <p className="text-muted">Create your Klyng Cup account and select your primary club affiliation to be eligible for any Klyng Cup tournament.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4 group">
                  <div className="bg-gradient-to-br from-brand-accent to-status-info text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300">
                    2
                  </div>
                  <div>
                    <h4 className="font-semibold text-primary mb-2">Join a Team</h4>
                    <p className="text-muted">Get invited by your club captain or join an available team roster for upcoming Klyng Cup tournaments.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4 group">
                  <div className="bg-gradient-to-br from-status-success to-brand-secondary text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300">
                    3
                  </div>
                  <div>
                    <h4 className="font-semibold text-primary mb-2">Compete & Earn Points</h4>
                    <p className="text-muted">Play matches at each event, earn points for your team, and help your club climb the standings.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4 group">
                  <div className="bg-gradient-to-br from-brand-primary to-status-warning text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300">
                    4
                  </div>
                  <div>
                    <h4 className="font-semibold text-primary mb-2">Championship Glory</h4>
                    <p className="text-muted">Help your team reach the championship and compete for the ultimate Klyng Cup title.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* For Clubs */}
            <div>
              <h3 className="text-2xl font-bold text-primary mb-8 text-center">For Clubs</h3>
              <div className="space-y-6">
                <div className="flex items-start space-x-4 group">
                  <div className="bg-gradient-to-br from-brand-accent to-status-info text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300">
                    1
                  </div>
                  <div>
                    <h4 className="font-semibold text-primary mb-2">Create Custom Tournaments</h4>
                    <p className="text-muted">Design tournaments with custom brackets, skill divisions, and stop schedules that work for your community.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4 group">
                  <div className="bg-gradient-to-br from-status-info to-brand-secondary text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300">
                    2
                  </div>
                  <div>
                    <h4 className="font-semibold text-primary mb-2">Manage Teams & Captains</h4>
                    <p className="text-muted">Assign team captains, build rosters, and manage your club's participation in Klyng Cup tournaments.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4 group">
                  <div className="bg-gradient-to-br from-status-success to-brand-accent text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300">
                    3
                  </div>
                  <div>
                    <h4 className="font-semibold text-primary mb-2">Track Performance</h4>
                    <p className="text-muted">Monitor team standings, view detailed statistics, and celebrate your club's achievements across all events.</p>
                  </div>
                </div>
          </div>
            </div>
          </div>
        </div>
      </section>

      {/* Championship Photo Stripe */}
      <section className="py-20 bg-gradient-to-r from-surface-1 to-surface-2">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-primary mb-6">
              Championship Moments
            </h2>
            <p className="text-xl text-muted max-w-3xl mx-auto">
              Witness the intensity, skill, and passion that defines Klyng Cup competition
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Photo 1 */}
            <div className="relative h-64 rounded-xl overflow-hidden shadow-lg group hover:shadow-xl transition-shadow duration-300">
              <div 
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: 'url(/images/klyng5.jpg)' }}
              ></div>
              <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/70 to-brand-secondary/70"></div>
              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex items-center text-white bg-black/70 backdrop-blur-sm rounded-lg p-4">
                  <svg className="w-12 h-12 mr-3 opacity-90 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  <p className="font-semibold text-sm">Victory</p>
                </div>
              </div>
            </div>

            {/* Photo 2 */}
            <div className="relative h-64 rounded-xl overflow-hidden shadow-lg group hover:shadow-xl transition-shadow duration-300">
              <div 
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: 'url(/images/klyng6.jpg)' }}
              ></div>
              <div className="absolute inset-0 bg-gradient-to-br from-brand-accent/70 to-status-info/70"></div>
              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex items-center text-white bg-black/70 backdrop-blur-sm rounded-lg p-4">
                  <svg className="w-12 h-12 mr-3 opacity-90 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                  </svg>
                  <p className="font-semibold text-sm">Teamwork</p>
                </div>
              </div>
            </div>

            {/* Photo 3 */}
            <div className="relative h-64 rounded-xl overflow-hidden shadow-lg group hover:shadow-xl transition-shadow duration-300">
              <div 
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: 'url(/images/klyng7.jpg)' }}
              ></div>
              <div className="absolute inset-0 bg-gradient-to-br from-status-success/70 to-brand-accent/70"></div>
              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex items-center text-white bg-black/70 backdrop-blur-sm rounded-lg p-4">
                  <svg className="w-12 h-12 mr-3 opacity-90 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  <p className="font-semibold text-sm">Skill</p>
                </div>
              </div>
            </div>

            {/* Photo 4 */}
            <div className="relative h-64 rounded-xl overflow-hidden shadow-lg group hover:shadow-xl transition-shadow duration-300">
              <div 
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: 'url(/images/klyng8.jpg)' }}
              ></div>
              <div className="absolute inset-0 bg-gradient-to-br from-status-warning/70 to-brand-primary/70"></div>
              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex items-center text-white bg-black/70 backdrop-blur-sm rounded-lg p-4">
                  <svg className="w-12 h-12 mr-3 opacity-90 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <p className="font-semibold text-sm">Excellence</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-brand-primary to-brand-primary-hover relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-r from-brand-primary/95 to-brand-primary-hover/95"></div>
          <div className="absolute inset-0 bg-black/10"></div>
          {/* Decorative elements */}
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-brand-accent/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-brand-secondary/10 rounded-full blur-2xl"></div>
        </div>
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8 relative z-10">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Experience Klyng Cup?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Join the most exciting pickleball tournament format. Whether you're a player or a club, 
            Klyng Cup can be customized for your community anywhere in the world.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <SignedOut>
              <SignUpButton mode="modal" fallbackRedirectUrl="/dashboard">
                <button className="btn btn-secondary text-lg py-4 px-8 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300">
                  Register to Play!
                </button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Link 
                href="/dashboard"
                className="btn btn-secondary text-lg py-4 px-8 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
              >
                Go to Dashboard
              </Link>
              <a 
                href="#tournaments"
                className="btn btn-ghost text-lg py-4 px-8 border-white text-white hover:bg-white hover:text-brand-primary shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
              >
                Current Tournaments
              </a>
            </SignedIn>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-surface-1 border-t border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-xl font-bold text-primary mb-4">Klyng Cup</h3>
              <p className="text-muted mb-4">
                The ultimate multi-stop pickleball championship experience for clubs and communities.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-primary mb-4">Tournament</h4>
              <ul className="space-y-2">
                <li><a href="#tournaments" className="text-muted hover:text-primary">Current Tournaments</a></li>
                <li><Link href="/rules" className="text-muted hover:text-primary">Rules & Format</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-primary mb-4">Community</h4>
              <ul className="space-y-2">
                <li><Link href="/about" className="text-muted hover:text-primary">About Us</Link></li>
                <li><Link href="/contact" className="text-muted hover:text-primary">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-primary mb-4">Account</h4>
              <ul className="space-y-2">
                <SignedOut>
                  <li><SignInButton mode="modal" fallbackRedirectUrl="/dashboard"><button className="text-muted hover:text-primary">Login</button></SignInButton></li>
                  <li><SignUpButton mode="modal" fallbackRedirectUrl="/dashboard"><button className="text-muted hover:text-primary">Sign Up</button></SignUpButton></li>
                </SignedOut>
                <SignedIn>
                  <li><Link href="/dashboard" className="text-muted hover:text-primary">Dashboard</Link></li>
                  <li><Link href="/profile" className="text-muted hover:text-primary">Profile</Link></li>
                </SignedIn>
              </ul>
            </div>
          </div>
          <div className="border-t border-subtle mt-8 pt-8 text-center text-muted">
            <p>&copy; 2024 Klyng Cup. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}