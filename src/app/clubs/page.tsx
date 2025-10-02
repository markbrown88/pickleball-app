import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Clubs - Klyng Cup Pickleball Championship",
  description: "Discover registered Klyng Cup clubs and learn how to register your club for the ultimate pickleball championship experience.",
};

export default function ClubsPage() {
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
              <Link href="/tournaments" className="nav-link">Current Tournaments</Link>
              <Link href="/clubs" className="nav-link active">Clubs</Link>
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
            Klyng Cup Clubs
          </h1>
          <p className="text-xl text-brand-secondary mb-8">
            Join the Global Klyng Cup Community
          </p>
          <p className="text-lg text-white/90 max-w-3xl mx-auto mb-8">
            Register your club to participate in Klyng Cup tournaments anywhere in the world. 
            Create custom tournaments, manage teams, and compete in the ultimate pickleball championship format.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/clubs/register"
              className="btn btn-secondary text-lg py-4 px-8"
            >
              Register Your Club
            </Link>
            <Link 
              href="/about"
              className="btn btn-ghost text-lg py-4 px-8 border-white text-white hover:bg-white hover:text-brand-primary"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Why Register Your Club */}
      <section className="py-20 bg-surface-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-primary mb-6">
              Why Register Your Club?
            </h2>
            <p className="text-xl text-muted">
              Join the most exciting pickleball tournament format and give your club members an unforgettable experience
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="card text-center">
              <div className="bg-brand-secondary w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-4">Build Club Pride</h3>
              <p className="text-muted">
                Foster team spirit and club camaraderie through competitive multi-stop tournaments that bring your members together.
              </p>
            </div>

            <div className="card text-center">
              <div className="bg-brand-accent w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-4">Complete Management</h3>
              <p className="text-muted">
                Full control over tournament creation, team management, captain assignments, and roster building.
              </p>
            </div>

            <div className="card text-center">
              <div className="bg-status-success w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-4">Flexible Format</h3>
              <p className="text-muted">
                Design tournaments with custom brackets, multiple stops, and formats that work for your community.
              </p>
            </div>

            <div className="card text-center">
              <div className="bg-status-info w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-4">Easy Registration</h3>
              <p className="text-muted">
                Simple registration process with no minimum requirements - just register and start competing.
              </p>
            </div>

            <div className="card text-center">
              <div className="bg-status-warning w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-4">Community Building</h3>
              <p className="text-muted">
                Connect with other clubs, build relationships, and be part of the growing Klyng Cup community.
              </p>
            </div>

            <div className="card text-center">
              <div className="bg-brand-primary w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-4">Championship Glory</h3>
              <p className="text-muted">
                Compete for the ultimate championship title and bring glory to your club in the final stop.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Registration Process */}
      <section id="register" className="py-20 bg-app">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-primary mb-6">
              How to Register Your Club
            </h2>
            <p className="text-xl text-muted">
              Get your club started with Klyng Cup in just a few simple steps
            </p>
          </div>

          <div className="space-y-8">
            <div className="flex items-start space-x-6">
              <div className="bg-brand-secondary text-brand-primary w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">
                1
              </div>
              <div className="card flex-1">
                <h3 className="text-2xl font-bold text-primary mb-4">Submit Club Registration</h3>
                <p className="text-secondary mb-4">
                  Complete the club registration form with your club's information, including:
                </p>
                <ul className="list-disc list-inside text-muted space-y-2">
                  <li>Club name and description</li>
                  <li>Contact information and location</li>
                  <li>Primary administrator details</li>
                  <li>Club size and member information</li>
                </ul>
              </div>
            </div>

            <div className="flex items-start space-x-6">
              <div className="bg-brand-accent text-brand-primary w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">
                2
              </div>
              <div className="card flex-1">
                <h3 className="text-2xl font-bold text-primary mb-4">Get Approved</h3>
                <p className="text-secondary mb-4">
                  Our team will review your registration and approve your club for participation. This process typically takes 1-2 business days.
                </p>
                <p className="text-muted">
                  Once approved, you'll receive confirmation and access to the club management dashboard.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-6">
              <div className="bg-status-success text-white w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">
                3
              </div>
              <div className="card flex-1">
                <h3 className="text-2xl font-bold text-primary mb-4">Start Creating Tournaments</h3>
                <p className="text-secondary mb-4">
                  Once approved, you can immediately start creating tournaments and managing your club's participation:
                </p>
                <ul className="list-disc list-inside text-muted space-y-2">
                  <li>Create new tournaments with custom brackets</li>
                  <li>Schedule multiple stops throughout the season</li>
                  <li>Assign team captains and build rosters</li>
                  <li>Invite players to join your club</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="text-center mt-12">
            <Link 
              href="/clubs/register"
              className="btn btn-primary text-lg py-4 px-8"
            >
              Register Your Club Now
            </Link>
          </div>
        </div>
      </section>


      {/* Requirements */}
      <section className="py-20 bg-app">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-primary mb-6">
              Club Requirements
            </h2>
            <p className="text-xl text-muted">
              What you need to know before registering your club
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="card">
              <h3 className="text-2xl font-bold text-primary mb-6">What You Need</h3>
              <ul className="space-y-4">
                <li className="flex items-start space-x-3">
                  <svg className="w-6 h-6 text-status-success flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <h4 className="font-semibold text-primary">Club Information</h4>
                    <p className="text-muted">Basic club details including name, location, and contact information</p>
                  </div>
                </li>
                <li className="flex items-start space-x-3">
                  <svg className="w-6 h-6 text-status-success flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <h4 className="font-semibold text-primary">Administrator Contact</h4>
                    <p className="text-muted">Primary contact person who will manage the club's Klyng Cup participation</p>
                  </div>
                </li>
                <li className="flex items-start space-x-3">
                  <svg className="w-6 h-6 text-status-success flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <h4 className="font-semibold text-primary">Valid Email Address</h4>
                    <p className="text-muted">For receiving updates and tournament communications</p>
                  </div>
                </li>
              </ul>
            </div>

            <div className="card">
              <h3 className="text-2xl font-bold text-primary mb-6">What You Don't Need</h3>
              <ul className="space-y-4">
                <li className="flex items-start space-x-3">
                  <svg className="w-6 h-6 text-status-error flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <div>
                    <h4 className="font-semibold text-primary">Minimum Player Count</h4>
                    <p className="text-muted">No minimum number of players required to register</p>
                  </div>
                </li>
                <li className="flex items-start space-x-3">
                  <svg className="w-6 h-6 text-status-error flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <div>
                    <h4 className="font-semibold text-primary">Facility Requirements</h4>
                    <p className="text-muted">No specific facility or court requirements</p>
                  </div>
                </li>
                <li className="flex items-start space-x-3">
                  <svg className="w-6 h-6 text-status-error flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <div>
                    <h4 className="font-semibold text-primary">Registration Fees</h4>
                    <p className="text-muted">No fees required for club registration</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-brand-primary to-brand-primary-hover">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Register Your Club?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Join the Klyng Cup community and give your club members the ultimate pickleball experience.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/clubs/register"
              className="btn btn-secondary text-lg py-4 px-8"
            >
              Register Now
            </Link>
            <Link 
              href="/about"
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
                <li><Link href="/tournaments" className="text-muted hover:text-primary">Upcoming Tournaments</Link></li>
                <li><Link href="/leaderboard" className="text-muted hover:text-primary">Leaderboard</Link></li>
                <li><Link href="/rules" className="text-muted hover:text-primary">Rules & Format</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-primary mb-4">Community</h4>
              <ul className="space-y-2">
                <li><Link href="/clubs" className="text-muted hover:text-primary">Clubs</Link></li>
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
