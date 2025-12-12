'use client';

import Link from 'next/link';
import Image from 'next/image';
import { UserButton, SignedIn, SignedOut, SignInButton, SignUpButton } from '@clerk/nextjs';



export default function ForClubsPage() {
    return (
        <div className="min-h-screen bg-app">
            {/* Header */}
            <header className="bg-surface-1 border-b border-subtle">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-24 md:h-24 py-[10px]">
                        <div className="flex items-center">
                            <Link href="/" className="flex items-center">
                                <Image
                                    src="/images/klyng-cup.png"
                                    alt="Klyng Cup"
                                    width={120}
                                    height={65}
                                    className="h-8 md:h-[65px] w-auto"
                                    priority
                                />
                            </Link>
                        </div>
                        <nav className="hidden md:flex items-center space-x-8">
                            <Link href="/about" className="nav-link">About</Link>
                            <Link href="/#tournaments" className="nav-link">Tournaments</Link>
                            <Link href="/pricing" className="nav-link">Pricing</Link>
                            <Link href="/for-clubs" className="nav-link active">For Clubs</Link>
                        </nav>
                        <div className="flex items-center space-x-4">
                            <SignedIn>
                                <div className="flex items-center space-x-4">
                                    <Link href="/dashboard" className="btn btn-primary">
                                        Dashboard
                                    </Link>
                                    <UserButton afterSignOutUrl="/" />
                                </div>
                            </SignedIn>
                            <SignedOut>
                                <SignInButton mode="modal" fallbackRedirectUrl="/dashboard">
                                    <button className="btn btn-ghost">Login</button>
                                </SignInButton>
                                <SignUpButton mode="modal" fallbackRedirectUrl="/dashboard">
                                    <button className="btn btn-primary">Sign Up</button>
                                </SignUpButton>
                            </SignedOut>
                        </div>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="py-20 bg-gradient-to-br from-brand-primary to-brand-primary-hover">
                <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
                    <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
                        Bring Klyng Cup to Your Club
                    </h1>
                    <p className="text-xl text-brand-secondary mb-8">
                        Join the growing network of clubs using Klyng Cup for their tournaments.
                        Start free, upgrade when you're ready to host.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link href="/club-signup" className="btn btn-secondary text-lg py-4 px-8">
                            Join Free
                        </Link>
                        <Link href="/pricing" className="btn btn-ghost text-lg py-4 px-8 border-white text-white hover:bg-white hover:text-brand-primary">
                            View Pricing
                        </Link>
                    </div>
                </div>
            </section>

            {/* Problem/Solution */}
            <section className="py-20 bg-surface-1">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-primary mb-6">
                            Stop Managing Tournaments with Spreadsheets
                        </h2>
                        <p className="text-xl text-muted max-w-3xl mx-auto">
                            Running pickleball tournaments shouldn't be a headache. Klyng Cup gives you professional-grade
                            tools to create, manage, and score tournaments—without the chaos.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="card text-center">
                            <div className="bg-status-error/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg className="w-8 h-8 text-status-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-primary mb-4">Manual Scoring</h3>
                            <p className="text-muted">
                                Tired of tracking scores on paper and updating spreadsheets by hand?
                            </p>
                        </div>

                        <div className="card text-center">
                            <div className="bg-status-error/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg className="w-8 h-8 text-status-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-primary mb-4">Registration Chaos</h3>
                            <p className="text-muted">
                                Managing player registrations through emails and texts is overwhelming.
                            </p>
                        </div>

                        <div className="card text-center">
                            <div className="bg-status-error/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg className="w-8 h-8 text-status-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-primary mb-4">Limited Engagement</h3>
                            <p className="text-muted">
                                One-off tournaments don't build lasting community or keep players coming back.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Two Paths */}
            <section className="py-20 bg-app">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-primary mb-6">
                            Choose Your Path
                        </h2>
                        <p className="text-xl text-muted max-w-3xl mx-auto">
                            Start by joining the network for free. Upgrade to host your own tournaments when you're ready.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                        {/* Free Path */}
                        <div className="card border-2 border-subtle hover:border-brand-secondary/50 transition-all duration-300">
                            <div className="text-center mb-6">
                                <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-secondary/20 rounded-full mb-4">
                                    <svg className="w-8 h-8 text-brand-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-bold text-primary mb-2">Join the Network</h3>
                                <p className="text-muted mb-4">Participate in Klyng Cup tournaments</p>
                                <div className="text-4xl font-bold text-brand-secondary mb-2">Free</div>
                                <p className="text-sm text-muted">Always free</p>
                            </div>

                            <ul className="space-y-3 mb-8">
                                <li className="flex items-start">
                                    <svg className="w-5 h-5 text-status-success mt-1 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-secondary">Create official club profile</span>
                                </li>
                                <li className="flex items-start">
                                    <svg className="w-5 h-5 text-status-success mt-1 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-secondary">Build and manage player roster</span>
                                </li>
                                <li className="flex items-start">
                                    <svg className="w-5 h-5 text-status-success mt-1 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-secondary">Join Klyng Cup tournaments</span>
                                </li>
                                <li className="flex items-start">
                                    <svg className="w-5 h-5 text-status-success mt-1 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-secondary">Manage team rosters</span>
                                </li>
                                <li className="flex items-start">
                                    <svg className="w-5 h-5 text-status-success mt-1 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-secondary">Track club rankings and stats</span>
                                </li>
                            </ul>

                            <Link href="/club-signup" className="btn btn-secondary w-full">
                                Join Free
                            </Link>
                        </div>

                        {/* Paid Path */}
                        <div className="card border-2 border-brand-secondary shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 bg-brand-secondary text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                                MOST POPULAR
                            </div>

                            <div className="text-center mb-6 pt-4">
                                <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-primary/20 rounded-full mb-4">
                                    <svg className="w-8 h-8 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-bold text-primary mb-2">Host Tournaments</h3>
                                <p className="text-muted mb-4">Create and manage your own events</p>
                                <div className="flex items-baseline justify-center gap-1 mb-2">
                                    <span className="text-4xl font-bold text-brand-primary">$69.99</span>
                                    <span className="text-xl text-muted">/month</span>
                                </div>
                                <p className="text-sm text-status-success font-medium flex items-center justify-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    1-Month Free Trial
                                </p>
                            </div>

                            <ul className="space-y-3 mb-8">
                                <li className="flex items-start">
                                    <svg className="w-5 h-5 text-status-success mt-1 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-secondary"><strong>Everything in Free</strong></span>
                                </li>
                                <li className="flex items-start">
                                    <svg className="w-5 h-5 text-status-success mt-1 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-secondary">Create unlimited tournaments</span>
                                </li>
                                <li className="flex items-start">
                                    <svg className="w-5 h-5 text-status-success mt-1 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-secondary">Multi-stop championships</span>
                                </li>
                                <li className="flex items-start">
                                    <svg className="w-5 h-5 text-status-success mt-1 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-secondary">Automated bracket generation</span>
                                </li>
                                <li className="flex items-start">
                                    <svg className="w-5 h-5 text-status-success mt-1 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-secondary">Live scoring & standings</span>
                                </li>
                                <li className="flex items-start">
                                    <svg className="w-5 h-5 text-status-success mt-1 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-secondary">Registration management</span>
                                </li>
                                <li className="flex items-start">
                                    <svg className="w-5 h-5 text-status-success mt-1 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-secondary">Priority support</span>
                                </li>
                            </ul>

                            <Link href="/club-signup" className="btn btn-primary w-full">
                                Start Free Trial
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Key Features */}
            <section className="py-20 bg-surface-1">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-primary mb-6">
                            Everything You Need to Run Professional Tournaments
                        </h2>
                        <p className="text-xl text-muted max-w-3xl mx-auto">
                            Our platform handles the complexity so you can focus on creating great experiences for your players.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="card text-center hover:shadow-xl transition-shadow duration-300">
                            <div className="bg-brand-secondary/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg className="w-8 h-8 text-brand-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-primary mb-4">Automated Brackets</h3>
                            <p className="text-muted">
                                Generate Round Robin or Double Elimination brackets instantly. No more manual bracket creation.
                            </p>
                        </div>

                        <div className="card text-center hover:shadow-xl transition-shadow duration-300">
                            <div className="bg-brand-accent/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg className="w-8 h-8 text-brand-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-primary mb-4">Live Scoring</h3>
                            <p className="text-muted">
                                Real-time score updates and standings. Players and spectators see results instantly.
                            </p>
                        </div>

                        <div className="card text-center hover:shadow-xl transition-shadow duration-300">
                            <div className="bg-status-success/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg className="w-8 h-8 text-status-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-primary mb-4">Registration Management</h3>
                            <p className="text-muted">
                                Handle player registrations, payments, and team assignments all in one place.
                            </p>
                        </div>

                        <div className="card text-center hover:shadow-xl transition-shadow duration-300">
                            <div className="bg-status-info/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg className="w-8 h-8 text-status-info" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-primary mb-4">Multi-Stop Championships</h3>
                            <p className="text-muted">
                                Create season-long tournaments with multiple stops and cumulative points tracking.
                            </p>
                        </div>

                        <div className="card text-center hover:shadow-xl transition-shadow duration-300">
                            <div className="bg-status-warning/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg className="w-8 h-8 text-status-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-primary mb-4">Custom Skill Divisions</h3>
                            <p className="text-muted">
                                Create brackets based on DUPR ratings, skill levels, or any criteria that works for you.
                            </p>
                        </div>

                        <div className="card text-center hover:shadow-xl transition-shadow duration-300">
                            <div className="bg-brand-primary/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg className="w-8 h-8 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-primary mb-4">Mobile-Friendly</h3>
                            <p className="text-muted">
                                Manage tournaments from anywhere. Players can view brackets and scores on their phones.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 bg-gradient-to-r from-brand-primary to-brand-primary-hover">
                <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
                    <h2 className="text-4xl font-bold text-white mb-6">
                        Ready to Transform Your Club's Tournaments?
                    </h2>
                    <p className="text-xl text-white/90 mb-8">
                        Join 50+ clubs already using Klyng Cup. Start free, upgrade when you're ready.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link href="/club-signup" className="btn btn-secondary text-lg py-4 px-8">
                            Join Free
                        </Link>
                        <Link href="/pricing" className="btn btn-ghost text-lg py-4 px-8 border-white text-white hover:bg-white hover:text-brand-primary">
                            View Pricing
                        </Link>
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
                                <li><Link href="/tournaments" className="text-muted hover:text-primary">Tournaments</Link></li>
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
                            <h4 className="font-semibold text-primary mb-4">Quick Links</h4>
                            <ul className="space-y-2">
                                <li><Link href="/" className="text-muted hover:text-primary">Home</Link></li>
                                <li><Link href="/pricing" className="text-muted hover:text-primary">Pricing</Link></li>
                                <li><Link href="/for-clubs" className="text-muted hover:text-primary">For Clubs</Link></li>
                            </ul>
                        </div>
                    </div>
                    <div className="border-t border-subtle mt-8 pt-8 text-center text-muted">
                        <p>&copy; 2025 Klyng Cup. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
