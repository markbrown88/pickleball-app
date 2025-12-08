import Link from 'next/link';

export default function ClubSignupSection() {
    return (
        <section className="py-20 bg-surface-2 border-y border-subtle">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                    <div className="space-y-8">
                        <div>
                            <h2 className="text-4xl font-bold text-primary mb-6">
                                Run Your Club's Tournaments with Klyng Cup
                            </h2>
                            <p className="text-xl text-muted leading-relaxed">
                                Transform how you manage your club's pickleball events.
                                From local round robins to multi-stop championship series,
                                Klyng Cup gives you the tools to create professional-grade tournaments.
                            </p>
                        </div>

                        <ul className="space-y-4">
                            {[
                                'Manage your club profile and player roster',
                                'Run seeded Round Robin & Double Elimination tournaments',
                                'Participate in regional and national Klyng Cup events',
                                'Track player statistics, match history, and rankings'
                            ].map((item, i) => (
                                <li key={i} className="flex items-start">
                                    <svg className="w-6 h-6 text-brand-primary mt-1 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-lg text-primary">{item}</span>
                                </li>
                            ))}
                        </ul>

                        <div className="flex flex-col sm:flex-row gap-4 pt-4">
                            <Link
                                href="/club-signup"
                                className="btn btn-primary text-lg px-8 py-4 h-auto"
                            >
                                Sign Up Your Club
                            </Link>
                            <Link
                                href="/about"
                                className="btn btn-outline text-lg px-8 py-4 h-auto"
                            >
                                Learn More
                            </Link>
                        </div>
                    </div>

                    <div className="bg-surface-1 p-8 rounded-2xl border border-subtle shadow-xl">
                        <div className="text-center space-y-6">
                            <div className="space-y-2">
                                <h3 className="text-2xl font-bold text-primary">Club Tournament Management</h3>
                                <p className="text-muted">Everything you need to run successful events</p>
                            </div>

                            <div className="py-8 border-y border-subtle">
                                <p className="text-sm text-muted uppercase tracking-wider font-semibold mb-2">Starting at</p>
                                <div className="flex items-baseline justify-center gap-1">
                                    <span className="text-5xl font-bold text-brand-primary">$69.99</span>
                                    <span className="text-xl text-muted">/month</span>
                                </div>
                                <p className="text-sm text-status-success mt-4 font-medium flex items-center justify-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    1-Month Free Trial Included
                                </p>
                            </div>

                            <div className="space-y-4">
                                <p className="text-sm text-muted">
                                    <strong>Free Option Available:</strong> Register your club for free to participate in other tournaments without management features.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
