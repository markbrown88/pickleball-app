import Link from 'next/link';

export default function ClubSignupSection() {
    return (
        <section className="py-20 bg-surface-2 border-y border-subtle">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                    <div className="space-y-8">
                        <div>
                            <span className="text-brand-primary font-bold tracking-wide uppercase text-sm">For Club Directors</span>
                            <h2 className="text-4xl font-bold text-primary mt-2 mb-6">
                                Bring Klyng Cup to Your Club
                            </h2>
                            <p className="text-xl text-muted leading-relaxed">
                                Host your own Klyng Cup tournaments! Register for <strong>free</strong> to create your official club profile, build your player roster, and join the growing network.
                            </p>
                        </div>

                        <ul className="space-y-4">
                            {[
                                'Create your official Club Profile & Player Roster',
                                'Register teams for local and regional tournaments',
                                'Track your club\'s ranking and player statistics',
                                'Host Club Upgrade: Create and manage your own events'
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
                                className="btn btn-secondary text-lg px-8 py-4 h-auto"
                            >
                                Register Your Club for FREE Today!
                            </Link>
                        </div>
                    </div>

                    <div className="bg-surface-1 p-8 rounded-2xl border border-subtle shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 bg-brand-secondary text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                            OPTIONAL UPGRADE
                        </div>
                        <div className="text-center space-y-6">
                            <div className="space-y-2">
                                <h3 className="text-2xl font-bold text-primary">Become a Host Club</h3>
                                <p className="text-muted">Unlock powerful tools to run your own tournaments</p>
                            </div>

                            <div className="py-8 border-y border-subtle">
                                <p className="text-sm text-muted uppercase tracking-wider font-semibold mb-2">Host Subscription</p>
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
                                    Sign up to be a Host Club today, or upgrade at any time. Create Round Robin or Double Elimination brackets, manage registrations, and run professional-grade events at your venue.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
