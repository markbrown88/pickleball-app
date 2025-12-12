'use client';

import Link from 'next/link';
import Image from 'next/image';
import { UserButton, SignedIn, SignedOut, SignInButton, SignUpButton } from '@clerk/nextjs';



export default function PricingPage() {
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
                            <Link href="/pricing" className="nav-link active">Pricing</Link>
                            <Link href="/for-clubs" className="nav-link">For Clubs</Link>
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
                        Simple, Transparent Pricing
                    </h1>
                    <p className="text-xl text-brand-secondary mb-8">
                        Start free. Upgrade when you're ready to host your own tournaments.
                    </p>
                </div>
            </section>

            {/* Pricing Tiers */}
            <section className="py-20 bg-surface-1">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-3 gap-8">

                        {/* Free Tier - For Players */}
                        <div className="card border-2 border-subtle hover:border-brand-secondary/50 transition-all duration-300">
                            <div className="text-center mb-6">
                                <h3 className="text-2xl font-bold text-primary mb-2">Player</h3>
                                <p className="text-muted mb-6">Join tournaments and compete</p>
                                <div className="flex items-baseline justify-center gap-2">
                                    <span className="text-5xl font-bold text-brand-secondary">Free</span>
                                </div>
                                <p className="text-sm text-muted mt-2">Always free for players</p>
                            </div>

                            <ul className="space-y-4 mb-8">
                                <li className="flex items-start">
                                    <svg className="w-5 h-5 text-status-success mt-1 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-secondary">Create player profile</span>
                                </li>
                                <li className="flex items-start">
                                    <svg className="w-5 h-5 text-status-success mt-1 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-secondary">Join any club</span>
                                </li>
                                <li className="flex items-start">
                                    <svg className="w-5 h-5 text-status-success mt-1 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-secondary">Register for tournaments</span>
                                </li>
                                <li className="flex items-start">
                                    <svg className="w-5 h-5 text-status-success mt-1 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-secondary">Track your stats</span>
                                </li>
                                <li className="flex items-start">
                                    <svg className="w-5 h-5 text-status-success mt-1 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-secondary">View live standings</span>
                                </li>
                            </ul>

                            <Link href="/sign-up" className="btn btn-ghost w-full">
                                Sign Up Free
                            </Link>
                        </div>

                        {/* Club Tier - Free */}
                        <div className="card border-2 border-subtle hover:border-brand-secondary/50 transition-all duration-300">
                            <div className="text-center mb-6">
                                <h3 className="text-2xl font-bold text-primary mb-2">Club</h3>
                                <p className="text-muted mb-6">Join the network</p>
                                <div className="flex items-baseline justify-center gap-2">
                                    <span className="text-5xl font-bold text-brand-secondary">Free</span>
                                </div>
                                <p className="text-sm text-muted mt-2">Free to register</p>
                            </div>

                            <ul className="space-y-4 mb-8">
                                <li className="flex items-start">
                                    <svg className="w-5 h-5 text-status-success mt-1 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-secondary">Official club profile</span>
                                </li>
                                <li className="flex items-start">
                                    <svg className="w-5 h-5 text-status-success mt-1 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-secondary">Build player roster</span>
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
                                    <span className="text-secondary">Track club rankings</span>
                                </li>
                            </ul>

                            <Link href="/club-signup" className="btn btn-secondary w-full">
                                Register Your Club
                            </Link>
                        </div>

                        {/* Host Tier - Paid */}
                        <div className="card border-2 border-brand-secondary shadow-xl relative overflow-hidden">

                            <div className="text-center mb-6">
                                <h3 className="text-2xl font-bold text-primary mb-2">Host Club</h3>
                                <p className="text-muted mb-6">Create your own tournaments</p>
                                <div className="flex items-baseline justify-center gap-1">
                                    <span className="text-5xl font-bold text-brand-primary">$69.99</span>
                                    <span className="text-xl text-muted">/month</span>
                                </div>
                                <p className="text-sm text-status-success mt-4 font-medium flex items-center justify-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    1-Month Free Trial
                                </p>
                            </div>

                            <ul className="space-y-4 mb-8">
                                <li className="flex items-start">
                                    <svg className="w-5 h-5 text-status-success mt-1 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-secondary"><strong>Everything in Club</strong></span>
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
                                    <span className="text-secondary">Round Robin & Elimination brackets</span>
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
                                    <span className="text-secondary">Custom skill divisions</span>
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

            {/* FAQ Section */}
            <section className="py-20 bg-app">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-primary mb-6">
                            Frequently Asked Questions
                        </h2>
                    </div>

                    <div className="space-y-6">
                        <div className="card">
                            <h3 className="text-xl font-bold text-primary mb-3">Is it really free for players?</h3>
                            <p className="text-muted">
                                Yes! Players can create accounts, join clubs, register for tournaments, and track their stats completely free.
                                Individual tournament entry fees may vary and are set by the tournament host.
                            </p>
                        </div>

                        <div className="card">
                            <h3 className="text-xl font-bold text-primary mb-3">What's included in the free club registration?</h3>
                            <p className="text-muted">
                                Free club registration allows you to create an official club profile, build your player roster, and participate
                                in Klyng Cup tournaments hosted by others. You can manage teams and track your club's performance across all events.
                            </p>
                        </div>

                        <div className="card">
                            <h3 className="text-xl font-bold text-primary mb-3">Can I try the Host subscription before paying?</h3>
                            <p className="text-muted">
                                Absolutely! Every Host Club subscription includes a 1-month free trial. Create tournaments, test all features,
                                and see if it's right for your club before any payment is required.
                            </p>
                        </div>

                        <div className="card">
                            <h3 className="text-xl font-bold text-primary mb-3">Can I upgrade or downgrade my subscription?</h3>
                            <p className="text-muted">
                                Yes, you can upgrade from a free Club account to a Host subscription at any time. If you cancel your Host subscription,
                                your club profile remains active and you can still participate in tournaments—you just won't be able to create new ones.
                            </p>
                        </div>

                        <div className="card">
                            <h3 className="text-xl font-bold text-primary mb-3">What payment methods do you accept?</h3>
                            <p className="text-muted">
                                We accept all major credit cards (Visa, Mastercard, American Express, Discover) through our secure payment processor.
                            </p>
                        </div>


                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 bg-gradient-to-r from-brand-primary to-brand-primary-hover">
                <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
                    <h2 className="text-4xl font-bold text-white mb-6">
                        Ready to Get Started?
                    </h2>
                    <p className="text-xl text-white/90 mb-8">
                        Join clubs and players across the country using Klyng Cup for their tournaments.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link href="/club-signup" className="btn btn-secondary text-lg py-4 px-8">
                            Start Free Trial
                        </Link>
                        <Link
                            href="/"
                            className="btn btn-ghost text-lg py-4 px-8 border-white text-white hover:bg-white hover:text-brand-primary"
                        >
                            Learn More
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
                                <li><Link href="/tournaments" className="text-muted hover:text-primary">Current Tournaments</Link></li>
                                <li><Link href="/rules" className="text-muted hover:text-primary">Rules & Format</Link></li>
                                <li><Link href="/club-signup" className="text-muted hover:text-primary">Host Your Own</Link></li>
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
                                <li><Link href="/dashboard" className="text-muted hover:text-primary">Dashboard</Link></li>
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
