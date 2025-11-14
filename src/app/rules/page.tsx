import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Rules & Format - Klyng Cup Pickleball Championship",
  description: "Learn about the unique Klyng Cup tournament format, rules, and structure that makes it the ultimate pickleball championship experience.",
};

export default function RulesPage() {
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
              <Link href="/rules" className="nav-link active">Rules & Format</Link>
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
            Rules & Format
          </h1>
          <p className="text-xl text-brand-secondary mb-8">
            The Ultimate Customizable Tournament Format
          </p>
          <p className="text-lg text-white/90 max-w-3xl mx-auto">
            Learn about the flexible co-ed interclub league format, customizable match structure, and rules that make Klyng Cup 
            the most exciting team-based pickleball competition format anywhere in the world.
          </p>
        </div>
      </section>

      {/* Tournament Format */}
      <section className="py-20 bg-surface-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-primary mb-6">
              Tournament Format
            </h2>
            <p className="text-xl text-muted">
              The flexible co-ed interclub league format that can be customized for any community
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-8">
              <div className="card">
                <h3 className="text-2xl font-bold text-primary mb-4">Flexible Tournament Structure</h3>
                <p className="text-secondary mb-4">
                  Klyng Cup tournaments can be single-day events or multi-stop championship series. 
                  Create the perfect format for your community - from one-day tournaments to as many stops as you want.
                </p>
                <ul className="list-disc list-inside text-muted space-y-2">
                  <li>Single-day tournaments or multi-stop series</li>
                  <li>Customizable number of stops (1 to unlimited)</li>
                  <li>Flexible schedule and timing</li>
                  <li>Various venue options and locations</li>
                  <li>Championship final at the last stop (for multi-stop events)</li>
                  <li>Round robin or elimination formats available</li>
                </ul>
              </div>

              <div className="card">
                <h3 className="text-2xl font-bold text-primary mb-4">Flexible Team Structure</h3>
                <p className="text-secondary mb-4">
                  Each participating club can send teams in customizable skill divisions that work for your community.
                </p>
                <ul className="list-disc list-inside text-muted space-y-2">
                  <li>Customizable skill divisions and brackets</li>
                  <li>Flexible team sizes and roster limits</li>
                  <li>Co-ed format with gender requirements</li>
                  <li>Club Pro or Captain manages each team</li>
                  <li>Adaptable to any skill level or community needs</li>
                </ul>
              </div>
            </div>

            <div className="space-y-8">
              <div className="card">
                <h3 className="text-2xl font-bold text-primary mb-4">Flexible Brackets</h3>
                <p className="text-secondary mb-4">
                  Tournament administrators have complete flexibility to design brackets that best suit their community.
                </p>
                <ul className="list-disc list-inside text-muted space-y-2">
                  <li>Skill-based brackets (3.0, 3.5, 4.0, 4.5, 5.0+)</li>
                  <li>Category-based brackets (Beginner, Intermediate, Advanced, Pro)</li>
                  <li>Custom bracket names and structures</li>
                  <li>Multiple brackets per tournament</li>
                  <li>Mixed doubles, men's doubles, women's doubles formats</li>
                </ul>
              </div>

              <div className="card">
                <h3 className="text-2xl font-bold text-primary mb-4">Championship Destination</h3>
                <p className="text-secondary mb-4">
                  The final stop serves as the ultimate championship event, where the season's best team is crowned.
                </p>
                <ul className="list-disc list-inside text-muted space-y-2">
                  <li>Teams qualify based on cumulative points</li>
                  <li>Championship stop features the top teams</li>
                  <li>Special championship brackets and formats</li>
                  <li>Ultimate prize and recognition for winners</li>
                  <li>Celebration of the entire season's competition</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Point System */}
      <section className="py-20 bg-app">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-primary mb-6">
              Point System
            </h2>
            <p className="text-xl text-muted">
              How teams accumulate points throughout the tournament series
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="card text-center">
              <div className="bg-status-success w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl font-bold text-white">3</span>
              </div>
              <h3 className="text-2xl font-bold text-primary mb-4">Match Win</h3>
              <p className="text-muted mb-4">
                Teams earn 3 points for each match they win, regardless of the stop, bracket, or opponent.
              </p>
              <div className="bg-surface-2 rounded-lg p-4">
                <p className="text-sm text-muted">
                  <strong>Example:</strong> If a team wins 4 matches at a stop, they earn 12 points.
                </p>
              </div>
            </div>

            <div className="card text-center">
              <div className="bg-status-warning w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl font-bold text-white">1</span>
              </div>
              <h3 className="text-2xl font-bold text-primary mb-4">Match Loss</h3>
              <p className="text-muted mb-4">
                Teams still earn 1 point for each match loss, ensuring participation is always rewarded.
              </p>
              <div className="bg-surface-2 rounded-lg p-4">
                <p className="text-sm text-muted">
                  <strong>Example:</strong> If a team loses 2 matches at a stop, they still earn 2 points.
                </p>
              </div>
            </div>

            <div className="card text-center">
              <div className="bg-brand-secondary w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-primary mb-4">Cumulative Points</h3>
              <p className="text-muted mb-4">
                Points accumulate across all stops, creating ongoing competition throughout the season.
              </p>
              <div className="bg-surface-2 rounded-lg p-4">
                <p className="text-sm text-muted">
                  <strong>Example:</strong> Team with 45 points after 3 stops leads the standings.
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-2xl font-bold text-primary mb-6">Tiebreaker Rules</h3>
            <p className="text-secondary mb-6">
              When teams are tied in total points, the following criteria determine ranking:
            </p>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-lg font-semibold text-primary mb-4">Primary Tiebreakers</h4>
                <ol className="list-decimal list-inside text-muted space-y-2">
                  <li>Head-to-head record between tied teams</li>
                  <li>Win percentage (wins ÷ total matches)</li>
                  <li>Total matches played</li>
                </ol>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-primary mb-4">Secondary Tiebreakers</h4>
                <ol className="list-decimal list-inside text-muted space-y-2">
                  <li>Most recent stop performance</li>
                  <li>Points earned in championship stop</li>
                  <li>Coin flip (if all else is equal)</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Match Formats */}
      <section className="py-20 bg-surface-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-primary mb-6">
              Match Format
            </h2>
            <p className="text-xl text-muted">
              Round by round team-vs-team battles with the exciting DreamBreaker tiebreaker
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="card mb-8">
              <h3 className="text-2xl font-bold text-primary mb-6">Team-vs-Team Battle Format</h3>
              <p className="text-secondary mb-6">
                Each team-vs-team battle includes four matches played in sequence:
              </p>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="bg-brand-secondary text-brand-primary w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                      1
                    </div>
                    <span className="font-semibold text-primary">Men's Doubles</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="bg-brand-secondary text-brand-primary w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                      2
                    </div>
                    <span className="font-semibold text-primary">Women's Doubles</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="bg-brand-secondary text-brand-primary w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                      3
                    </div>
                    <span className="font-semibold text-primary">Mixed Doubles #1</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="bg-brand-secondary text-brand-primary w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                      4
                    </div>
                    <span className="font-semibold text-primary">Mixed Doubles #2</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card mb-8">
              <h3 className="text-2xl font-bold text-primary mb-6">Scoring & Tiebreaker</h3>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-lg font-semibold text-primary mb-4">Game Scoring</h4>
                  <ul className="space-y-2 text-muted">
                    <li>• Games played to 11 points</li>
                    <li>• Regular scoring, hard stop</li>
                    <li>• Standard pickleball rules apply</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-primary mb-4">DreamBreaker Tiebreaker</h4>
                  <ul className="space-y-2 text-muted">
                    <li>• If teams are tied 2-2 after 4 matches</li>
                    <li>• Singles rotation showdown</li>
                    <li>• Played to 15 with rally scoring</li>
                    <li>• Every player gets on the court</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="text-2xl font-bold text-primary mb-6">Team Roster Rules</h3>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-lg font-semibold text-primary mb-4">Advanced Division</h4>
                  <ul className="space-y-2 text-muted">
                    <li>• Players rated DUPR 4.1+</li>
                    <li>• Max one 5.5+ player per round</li>
                    <li>• Up to 16 players per team</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-primary mb-4">Intermediate Division</h4>
                  <ul className="space-y-2 text-muted">
                    <li>• Players rated DUPR 4.1 and below</li>
                    <li>• Up to 16 players per team</li>
                    <li>• 4 players compete per round</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Rules & Regulations */}
      <section className="py-20 bg-app">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-primary mb-6">
              Rules & Regulations
            </h2>
            <p className="text-xl text-muted">
              Important rules and guidelines for Klyng Cup participation
            </p>
          </div>

          <div className="space-y-8">
            <div className="card">
              <h3 className="text-2xl font-bold text-primary mb-4">Player Eligibility</h3>
              <ul className="list-disc list-inside text-muted space-y-2">
                <li>All players must be registered members of Klyng Cup</li>
                <li>Players must be affiliated with a registered club</li>
                <li>Players can only represent one club per tournament</li>
                <li>Age and skill level requirements vary by bracket</li>
                <li>Players must comply with all tournament-specific rules</li>
              </ul>
            </div>

            <div className="card">
              <h3 className="text-2xl font-bold text-primary mb-4">Match Conduct</h3>
              <ul className="list-disc list-inside text-muted space-y-2">
                <li>All matches follow standard pickleball rules (USAPA/IFP)</li>
                <li>Good sportsmanship is required at all times</li>
                <li>Disputes should be resolved by tournament officials</li>
                <li>Unsportsmanlike conduct may result in disqualification</li>
                <li>Match results must be reported promptly</li>
              </ul>
            </div>

            <div className="card">
              <h3 className="text-2xl font-bold text-primary mb-4">Tournament Administration</h3>
              <ul className="list-disc list-inside text-muted space-y-2">
                <li>Club administrators manage team rosters and lineups</li>
                <li>Team captains coordinate match participation</li>
                <li>Tournament officials oversee match scheduling and results</li>
                <li>All decisions by tournament officials are final</li>
                <li>Appeals process available for serious disputes</li>
              </ul>
            </div>

            <div className="card">
              <h3 className="text-2xl font-bold text-primary mb-4">Scoring & Results</h3>
              <ul className="list-disc list-inside text-muted space-y-2">
                <li>Match results are recorded immediately after completion</li>
                <li>Points are awarded based on match outcomes (3 for win, 1 for loss)</li>
                <li>Standings are updated after each stop</li>
                <li>Final standings determine championship qualification</li>
                <li>All results are subject to verification and correction</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-surface-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-primary mb-6">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-muted">
              Common questions about Klyng Cup rules and format
            </p>
          </div>

          <div className="space-y-6">
            <div className="card">
              <h3 className="text-xl font-bold text-primary mb-3">How many stops are in a typical Klyng Cup tournament?</h3>
              <p className="text-muted">
                The number of stops varies by tournament. Some tournaments have 3-4 stops, while others may have 6-8 stops. 
                Tournament administrators determine the number of stops based on their community's needs and schedule.
              </p>
            </div>

            <div className="card">
              <h3 className="text-xl font-bold text-primary mb-3">Can a player switch clubs during a tournament?</h3>
              <p className="text-muted">
                No, players must remain with their registered club for the entire duration of a tournament. 
                However, players can switch clubs between different tournaments.
              </p>
            </div>

            <div className="card">
              <h3 className="text-xl font-bold text-primary mb-3">What happens if a team can't attend a stop?</h3>
              <p className="text-muted">
                Teams that miss a stop forfeit all potential points for that stop. This can significantly impact 
                their standings, so it's important for teams to plan their participation carefully.
              </p>
            </div>

            <div className="card">
              <h3 className="text-xl font-bold text-primary mb-3">How are brackets determined?</h3>
              <p className="text-muted">
                Tournament administrators have complete flexibility to create brackets based on skill levels, 
                categories, or any other criteria that work for their community. This allows for customized 
                competition that fits local needs.
              </p>
            </div>

            <div className="card">
              <h3 className="text-xl font-bold text-primary mb-3">What happens in case of weather delays?</h3>
              <p className="text-muted">
                Weather delays are handled by tournament officials and stop organizers. Matches may be rescheduled, 
                and the tournament schedule may be adjusted as needed to accommodate weather conditions.
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
            Now that you understand the format, join the most exciting pickleball tournament experience.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/clubs"
              className="btn btn-secondary text-lg py-4 px-8"
            >
              Register Now!
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
