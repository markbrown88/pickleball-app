import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "About Klyng Cup - Multi-Stop Pickleball Championship",
  description: "Learn about the unique Klyng Cup format, where clubs compete across multiple stops in the ultimate pickleball championship experience.",
};

export default function AboutPage() {
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
              <Link href="/about" className="nav-link active">About</Link>
              <Link href="/tournaments" className="nav-link">Current Tournaments</Link>
              <Link href="/rules" className="nav-link">Rules & Format</Link>
            </nav>
            <div className="flex items-center space-x-4">
              <Link href="/" className="btn btn-ghost">
                Home
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-brand-primary to-brand-primary-hover">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            About Klyng Cup
          </h1>
          <p className="text-xl text-brand-secondary mb-8">
            The Ultimate Customizable Tournament Format
          </p>
        </div>
      </section>

      {/* What is Klyng Cup */}
      <section className="py-20 bg-surface-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-primary mb-6">
              What is Klyng Cup?
            </h2>
            <p className="text-xl text-muted">
              Klyng Cup is a high-stakes, high-fun, co-ed interclub league where pride, teamwork, 
              and performance take center court. This customizable tournament format can be adapted 
              for any community, anywhere in the world, creating an interclub league like no other.
            </p>
          </div>

          <div className="prose prose-lg max-w-none">
            <p className="text-lg text-secondary mb-6">
              Unlike traditional single-location tournaments, Klyng Cup creates an ongoing competitive 
              experience where teams from multiple clubs compete across various stops throughout the season. 
              Each match matters as teams accumulate points toward the ultimate championship destination.
            </p>

            <p className="text-lg text-secondary mb-6">
              This unique format fosters club pride, builds lasting relationships, and creates 
              compelling storylines as teams battle for position in the standings. The cumulative 
              point system ensures that every stop is important, keeping the competition exciting 
              from start to finish. Best of all, every aspect can be customized to fit your community's needs.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-app">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-primary mb-6">
              How Klyng Cup Works
            </h2>
            <p className="text-xl text-muted">
              Understanding the unique tournament structure that makes Klyng Cup special
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-8">
              <div className="card">
                <h3 className="text-2xl font-bold text-primary mb-4">Multi-Stop Format</h3>
                <p className="text-secondary mb-4">
                  Tournaments consist of multiple stops held at different locations throughout the season. 
                  Each stop is a complete tournament event where teams compete in various brackets.
                </p>
                <ul className="list-disc list-inside text-muted space-y-2">
                  <li>Teams compete at every stop in the tournament</li>
                  <li>Each stop can have different venues and formats</li>
                  <li>The final stop serves as the championship destination</li>
                  <li>Flexible number of stops based on tournament design</li>
                </ul>
              </div>

              <div className="card">
                <h3 className="text-2xl font-bold text-primary mb-4">Point System</h3>
                <p className="text-secondary mb-4">
                  Teams earn points at every stop based on their match results, creating 
                  ongoing competition and strategic depth throughout the season.
                </p>
                <ul className="list-disc list-inside text-muted space-y-2">
                  <li><strong>3 points</strong> for each match win</li>
                  <li><strong>1 point</strong> for each match loss</li>
                  <li>Points accumulate across all stops</li>
                  <li>Team standings are updated after each stop</li>
                </ul>
              </div>
            </div>

            <div className="space-y-8">
              <div className="card">
                <h3 className="text-2xl font-bold text-primary mb-4">Flexible Brackets</h3>
                <p className="text-secondary mb-4">
                  Tournament administrators have complete flexibility to design brackets 
                  that best suit their community and competition level.
                </p>
                <ul className="list-disc list-inside text-muted space-y-2">
                  <li>Skill-based brackets (3.0, 3.5, 4.0, etc.)</li>
                  <li>Category-based brackets (Beginner, Intermediate, Advanced, Pro)</li>
                  <li>Custom bracket names and structures</li>
                  <li>Multiple brackets per tournament</li>
                </ul>
              </div>

              <div className="card">
                <h3 className="text-2xl font-bold text-primary mb-4">Club-Centric Competition</h3>
                <p className="text-secondary mb-4">
                  Klyng Cup emphasizes club pride and team camaraderie, bringing together 
                  communities around their local pickleball clubs.
                </p>
                <ul className="list-disc list-inside text-muted space-y-2">
                  <li>Players must affiliate with a primary club</li>
                  <li>Teams represent their clubs in competition</li>
                  <li>Club administrators manage teams and rosters</li>
                  <li>Championship glory belongs to the entire club</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-20 bg-surface-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-primary mb-6">
              Key Features
            </h2>
            <p className="text-xl text-muted">
              What makes Klyng Cup the premier pickleball tournament experience
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="card text-center">
              <div className="bg-brand-secondary w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-4">Real-Time Leaderboards</h3>
              <p className="text-muted">
                Track team standings and individual performance across all stops with live updates and detailed statistics.
              </p>
            </div>

            <div className="card text-center">
              <div className="bg-brand-accent w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-4">Comprehensive Management</h3>
              <p className="text-muted">
                Complete tournament management platform for clubs to handle teams, captains, rosters, and logistics.
              </p>
            </div>

            <div className="card text-center">
              <div className="bg-status-success w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-4">Flexible Administration</h3>
              <p className="text-muted">
                Tournament administrators have complete control over brackets, stops, and competition formats.
              </p>
            </div>

            <div className="card text-center">
              <div className="bg-status-info w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-4">Community Building</h3>
              <p className="text-muted">
                Foster club pride and build lasting relationships through competitive team-based play.
              </p>
            </div>

            <div className="card text-center">
              <div className="bg-status-warning w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-4">Inclusive Competition</h3>
              <p className="text-muted">
                Flexible bracket systems accommodate players of all skill levels and competition preferences.
              </p>
            </div>

            <div className="card text-center">
              <div className="bg-brand-primary w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-4">Championship Destination</h3>
              <p className="text-muted">
                The final stop serves as the ultimate championship event, crowning the season's best team.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-brand-primary to-brand-primary-hover">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Experience Klyng Cup?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Join the most exciting pickleball tournament format and be part of something special.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/" className="btn btn-secondary text-lg py-4 px-8">
              Get Started
            </Link>
            <Link 
              href="/rules"
              className="btn btn-ghost text-lg py-4 px-8 border-white text-white hover:bg-white hover:text-brand-primary"
            >
              Learn the Rules
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
                <li><Link href="/dashboard" className="text-muted hover:text-primary">Dashboard</Link></li>
                <li><Link href="/profile" className="text-muted hover:text-primary">Profile</Link></li>
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
