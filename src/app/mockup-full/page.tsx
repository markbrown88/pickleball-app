'use client';

import { useState } from 'react';

/**
 * COMPREHENSIVE MOCKUP: Complete Navigation System
 *
 * This mockup demonstrates:
 * - Fixed left sidebar navigation (Tier 1)
 * - Page-specific horizontal tabs (Tier 2)
 * - All major pages and sections
 * - Role-based access controls
 *
 * Access at: http://localhost:3010/mockup-full
 */

type Page =
  | 'dashboard'
  | 'profile'
  | 'tournaments'
  | 'tournament-setup'
  | 'tournament-players'
  | 'tournament-rosters'
  | 'rosters'
  | 'manager'
  | 'clubs'
  | 'players'
  | 'app-admin';

type Role = 'player' | 'captain' | 'event-manager' | 'tournament-admin' | 'app-admin';

export default function FullMockupPage() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [role, setRole] = useState<Role>('app-admin');

  // Tournament admin sub-tabs
  const [tournamentTab, setTournamentTab] = useState<'setup' | 'players' | 'rosters'>('setup');
  const [setupSubTab, setSetupSubTab] = useState<'details' | 'structure' | 'locations' | 'permissions'>('details');
  const [playersSubTab, setPlayersSubTab] = useState<'settings' | 'registrations' | 'invitations' | 'waitlist'>('settings');

  // Manager sub-section
  const [managerView, setManagerView] = useState<'overview' | 'matches' | 'lineups'>('overview');

  // Navigation items based on role
  const getNavItems = () => {
    const items = [
      { id: 'dashboard' as Page, label: 'Dashboard', icon: '🏠', roles: ['player', 'captain', 'event-manager', 'tournament-admin', 'app-admin'] },
      { id: 'profile' as Page, label: 'Profile', icon: '👤', roles: ['player', 'captain', 'event-manager', 'tournament-admin', 'app-admin'] },
      { id: 'tournaments' as Page, label: 'Tournaments', icon: '🏆', roles: ['tournament-admin', 'app-admin'] },
      { id: 'rosters' as Page, label: 'Rosters', icon: '👥', roles: ['captain', 'tournament-admin', 'app-admin'] },
      { id: 'manager' as Page, label: 'Manage', icon: '⚙️', roles: ['captain', 'event-manager', 'tournament-admin', 'app-admin'] },
      { id: 'clubs' as Page, label: 'Clubs', icon: '🏢', roles: ['tournament-admin', 'app-admin'] },
      { id: 'players' as Page, label: 'Players', icon: '👤', roles: ['tournament-admin', 'app-admin'] },
      { id: 'app-admin' as Page, label: 'App Admin', icon: '🔧', roles: ['app-admin'] },
    ];

    return items.filter(item => item.roles.includes(role));
  };

  return (
    <div className="flex h-screen bg-surface">
      {/* LEFT SIDEBAR - Tier 1 Navigation */}
      <aside className="w-64 bg-surface-1 border-r border-border-subtle flex flex-col">
        {/* Logo/Brand */}
        <div className="p-6 border-b border-border-subtle">
          <h1 className="text-xl font-bold text-primary">Klyng Cup</h1>
          <p className="text-xs text-muted mt-1">Tournament Management</p>
        </div>

        {/* Role Selector (for demo) */}
        <div className="p-4 border-b border-border-subtle bg-surface">
          <label className="text-xs text-muted mb-2 block">VIEW AS ROLE:</label>
          <select
            className="input input-sm w-full text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            <option value="app-admin">App Admin</option>
            <option value="tournament-admin">Tournament Admin</option>
            <option value="event-manager">Event Manager</option>
            <option value="captain">Captain</option>
            <option value="player">Player</option>
          </select>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto py-4">
          {getNavItems().map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full text-left px-6 py-3 flex items-center gap-3 transition-colors ${
                currentPage === item.id ||
                (item.id === 'tournaments' && ['tournament-setup', 'tournament-players', 'tournament-rosters'].includes(currentPage))
                  ? 'bg-primary text-white'
                  : 'text-secondary hover:bg-surface-2'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
              JD
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-primary">John Doe</div>
              <div className="text-xs text-muted capitalize">{role.replace('-', ' ')}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto">
        {/* DASHBOARD PAGE */}
        {currentPage === 'dashboard' && (
          <div className="p-8">
            <div className="max-w-6xl mx-auto">
              <h1 className="text-3xl font-bold text-primary mb-6">Dashboard</h1>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* My Tournaments */}
                <div className="card p-6">
                  <h3 className="font-semibold text-lg mb-4">My Tournaments</h3>
                  <div className="space-y-3">
                    <div className="p-3 bg-surface-1 rounded">
                      <div className="font-medium">Summer Championship 2025</div>
                      <div className="text-sm text-muted">Registered • Jun 15-17</div>
                    </div>
                    <div className="p-3 bg-surface-1 rounded">
                      <div className="font-medium">Austin Open</div>
                      <div className="text-sm text-muted">Waitlist #3 • Jul 1-3</div>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="card p-6">
                  <h3 className="font-semibold text-lg mb-4">Stats</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted">Tournaments Played</span>
                      <span className="font-semibold">12</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Win Rate</span>
                      <span className="font-semibold">68%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">DUPR Rating</span>
                      <span className="font-semibold">3.5</span>
                    </div>
                  </div>
                </div>

                {/* Pending Invitations */}
                <div className="card p-6">
                  <h3 className="font-semibold text-lg mb-4">
                    Invitations
                    <span className="ml-2 chip chip-warning chip-sm">2</span>
                  </h3>
                  <div className="space-y-3">
                    <div className="p-3 bg-surface-1 rounded">
                      <div className="font-medium">Dallas Masters</div>
                      <div className="text-sm text-muted">Expires in 5 days</div>
                      <div className="flex gap-2 mt-2">
                        <button className="btn btn-success btn-sm">Accept</button>
                        <button className="btn btn-ghost btn-sm">Decline</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {role !== 'player' && (
                <div className="mt-8">
                  <h2 className="text-xl font-semibold mb-4">Admin Quick Actions</h2>
                  <div className="grid gap-4 md:grid-cols-4">
                    <button className="card p-4 hover:bg-surface-1 transition-colors">
                      <div className="text-2xl mb-2">🏆</div>
                      <div className="font-medium">Create Tournament</div>
                    </button>
                    <button className="card p-4 hover:bg-surface-1 transition-colors">
                      <div className="text-2xl mb-2">👥</div>
                      <div className="font-medium">Manage Rosters</div>
                    </button>
                    <button className="card p-4 hover:bg-surface-1 transition-colors">
                      <div className="text-2xl mb-2">⚙️</div>
                      <div className="font-medium">Event Manager</div>
                    </button>
                    <button className="card p-4 hover:bg-surface-1 transition-colors">
                      <div className="text-2xl mb-2">👤</div>
                      <div className="font-medium">Add Players</div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PROFILE PAGE */}
        {currentPage === 'profile' && (
          <div className="p-8">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-3xl font-bold text-primary mb-6">Player Profile</h1>

              <div className="card p-6">
                <div className="flex items-start gap-6 mb-6">
                  <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center text-primary text-3xl font-bold">
                    JD
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-primary">John Doe</h2>
                    <p className="text-muted">john.doe@email.com</p>
                    <button className="btn btn-ghost btn-sm mt-2">Edit Profile</button>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <h3 className="font-semibold mb-3">Personal Information</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted">Gender:</span>
                        <span>Male</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Age:</span>
                        <span>32</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Location:</span>
                        <span>Austin, TX</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Phone:</span>
                        <span>(512) 555-1234</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Ratings & Club</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted">DUPR Singles:</span>
                        <span className="font-semibold">3.5</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">DUPR Doubles:</span>
                        <span className="font-semibold">3.7</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Club:</span>
                        <span>Greenhills Pickleball</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TOURNAMENTS PAGE - List */}
        {currentPage === 'tournaments' && (
          <div className="p-8">
            <div className="max-w-7xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-primary">Tournaments</h1>
                <button className="btn btn-primary">+ Create Tournament</button>
              </div>

              <div className="card overflow-hidden">
                <table className="w-full">
                  <thead className="bg-surface-1">
                    <tr>
                      <th className="text-left p-4">Name</th>
                      <th className="text-left p-4">Type</th>
                      <th className="text-left p-4">Dates</th>
                      <th className="text-left p-4">Status</th>
                      <th className="text-left p-4">Players</th>
                      <th className="text-right p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-border-subtle hover:bg-surface-1">
                      <td className="p-4 font-medium">Summer Championship 2025</td>
                      <td className="p-4 text-muted">Team Format</td>
                      <td className="p-4 text-muted">Jun 15-17, 2025</td>
                      <td className="p-4">
                        <span className="chip chip-success">Registration Open</span>
                      </td>
                      <td className="p-4">45/64</td>
                      <td className="p-4 text-right">
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => setCurrentPage('tournament-setup')}
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                    <tr className="border-t border-border-subtle hover:bg-surface-1">
                      <td className="p-4 font-medium">Austin Open</td>
                      <td className="p-4 text-muted">Double Elimination</td>
                      <td className="p-4 text-muted">Jul 1-3, 2025</td>
                      <td className="p-4">
                        <span className="chip chip-warning">Invite Only</span>
                      </td>
                      <td className="p-4">28/32</td>
                      <td className="p-4 text-right">
                        <button className="btn btn-primary btn-sm">Manage</button>
                      </td>
                    </tr>
                    <tr className="border-t border-border-subtle hover:bg-surface-1">
                      <td className="p-4 font-medium">Dallas Masters</td>
                      <td className="p-4 text-muted">Team Format</td>
                      <td className="p-4 text-muted">Jul 15-17, 2025</td>
                      <td className="p-4">
                        <span className="chip chip-muted">Closed</span>
                      </td>
                      <td className="p-4">64/64</td>
                      <td className="p-4 text-right">
                        <button className="btn btn-primary btn-sm">Manage</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TOURNAMENT ADMIN - Setup/Players/Rosters (Tier 2 tabs) */}
        {['tournament-setup', 'tournament-players', 'tournament-rosters'].includes(currentPage) && (
          <div className="flex flex-col h-full">
            {/* Tournament Header */}
            <div className="bg-surface-1 border-b border-border-subtle p-6">
              <div className="max-w-7xl mx-auto">
                <div className="flex items-center gap-4 mb-4">
                  <button
                    onClick={() => setCurrentPage('tournaments')}
                    className="btn btn-ghost btn-sm"
                  >
                    ← Back to Tournaments
                  </button>
                </div>
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-2xl font-bold text-primary">Summer Championship 2025</h1>
                    <div className="flex gap-4 mt-2 text-sm text-muted">
                      <span>Status: Registration Open</span>
                      <span>•</span>
                      <span>45/64 Players</span>
                      <span>•</span>
                      <span>8 Clubs</span>
                      <span>•</span>
                      <span>3 Stops</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost btn-sm">View Public Page</button>
                    <button className="btn btn-ghost btn-sm">Open Event Manager</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Tier 2: Horizontal Tabs */}
            <div className="border-b border-border-subtle bg-surface">
              <div className="max-w-7xl mx-auto">
                <nav className="flex gap-1">
                  <button
                    onClick={() => setCurrentPage('tournament-setup')}
                    className={`tab-button ${currentPage === 'tournament-setup' ? 'active' : ''}`}
                  >
                    Setup
                  </button>
                  <button
                    onClick={() => setCurrentPage('tournament-players')}
                    className={`tab-button ${currentPage === 'tournament-players' ? 'active' : ''}`}
                  >
                    Players
                  </button>
                  <button
                    onClick={() => setCurrentPage('tournament-rosters')}
                    className={`tab-button ${currentPage === 'tournament-rosters' ? 'active' : ''}`}
                  >
                    Rosters
                  </button>
                </nav>
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-8">
              <div className="max-w-7xl mx-auto">
                {currentPage === 'tournament-setup' && (
                  <div>
                    {/* Sub-tabs for Setup */}
                    <div className="border-b border-border-subtle mb-6">
                      <nav className="flex gap-1 -mb-px">
                        <button
                          className={`tab-button tab-button-secondary ${setupSubTab === 'details' ? 'active' : ''}`}
                          onClick={() => setSetupSubTab('details')}
                        >
                          Details
                        </button>
                        <button
                          className={`tab-button tab-button-secondary ${setupSubTab === 'structure' ? 'active' : ''}`}
                          onClick={() => setSetupSubTab('structure')}
                        >
                          Structure
                        </button>
                        <button
                          className={`tab-button tab-button-secondary ${setupSubTab === 'locations' ? 'active' : ''}`}
                          onClick={() => setSetupSubTab('locations')}
                        >
                          Locations
                        </button>
                        <button
                          className={`tab-button tab-button-secondary ${setupSubTab === 'permissions' ? 'active' : ''}`}
                          onClick={() => setSetupSubTab('permissions')}
                        >
                          Permissions
                        </button>
                      </nav>
                    </div>

                    <div className="card p-6">
                      {setupSubTab === 'details' && (
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold">Tournament Details</h3>
                          <div>
                            <label className="label">Tournament Name</label>
                            <input type="text" className="input" value="Summer Championship 2025" readOnly />
                          </div>
                          <div>
                            <label className="label">Tournament Type</label>
                            <select className="input">
                              <option>Team Format</option>
                              <option>Single Elimination</option>
                              <option>Double Elimination</option>
                            </select>
                          </div>
                        </div>
                      )}
                      {setupSubTab === 'structure' && (
                        <div>
                          <h3 className="text-lg font-semibold mb-4">Brackets & Clubs</h3>
                          <p className="text-muted">Configure tournament brackets and participating clubs...</p>
                        </div>
                      )}
                      {setupSubTab === 'locations' && (
                        <div>
                          <h3 className="text-lg font-semibold mb-4">Stops & Locations</h3>
                          <p className="text-muted">Manage tournament stops and venues...</p>
                        </div>
                      )}
                      {setupSubTab === 'permissions' && (
                        <div>
                          <h3 className="text-lg font-semibold mb-4">Access & Permissions</h3>
                          <p className="text-muted">Assign tournament admins and event managers...</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {currentPage === 'tournament-players' && (
                  <div>
                    {/* Sub-tabs for Players */}
                    <div className="border-b border-border-subtle mb-6">
                      <nav className="flex gap-1 -mb-px">
                        <button
                          className={`tab-button tab-button-secondary ${playersSubTab === 'settings' ? 'active' : ''}`}
                          onClick={() => setPlayersSubTab('settings')}
                        >
                          Settings
                        </button>
                        <button
                          className={`tab-button tab-button-secondary ${playersSubTab === 'registrations' ? 'active' : ''}`}
                          onClick={() => setPlayersSubTab('registrations')}
                        >
                          Registrations (45)
                        </button>
                        <button
                          className={`tab-button tab-button-secondary ${playersSubTab === 'invitations' ? 'active' : ''}`}
                          onClick={() => setPlayersSubTab('invitations')}
                        >
                          Invitations (12)
                        </button>
                        <button
                          className={`tab-button tab-button-secondary ${playersSubTab === 'waitlist' ? 'active' : ''}`}
                          onClick={() => setPlayersSubTab('waitlist')}
                        >
                          Waitlist (8)
                        </button>
                      </nav>
                    </div>

                    <div className="card p-6">
                      {playersSubTab === 'settings' && (
                        <div>
                          <h3 className="text-lg font-semibold mb-4">Registration Settings</h3>
                          <p className="text-muted">Configure registration rules and capacity...</p>
                        </div>
                      )}
                      {playersSubTab === 'registrations' && (
                        <div>
                          <h3 className="text-lg font-semibold mb-4">Player Registrations</h3>
                          <p className="text-muted">Review and manage player registrations...</p>
                        </div>
                      )}
                      {playersSubTab === 'invitations' && (
                        <div>
                          <h3 className="text-lg font-semibold mb-4">Invitations</h3>
                          <p className="text-muted">Send and manage tournament invitations...</p>
                        </div>
                      )}
                      {playersSubTab === 'waitlist' && (
                        <div>
                          <h3 className="text-lg font-semibold mb-4">Waitlist</h3>
                          <p className="text-muted">Manage waitlisted players and promote them...</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {currentPage === 'tournament-rosters' && (
                  <div>
                    <div className="card p-6">
                      <h3 className="text-lg font-semibold mb-4">Team Rosters</h3>
                      <p className="text-muted">Manage team rosters by stop, club, and bracket...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ROSTERS PAGE (Standalone) */}
        {currentPage === 'rosters' && (
          <div className="p-8">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-3xl font-bold text-primary mb-6">Rosters</h1>

              {/* Filters */}
              <div className="card p-4 mb-6">
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="label">Tournament</label>
                    <select className="input">
                      <option>Summer Championship 2025</option>
                      <option>Austin Open</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Stop</label>
                    <select className="input">
                      <option>Stop 1: Austin</option>
                      <option>Stop 2: Dallas</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Club</label>
                    <select className="input" disabled={role === 'captain'}>
                      {role === 'captain' ? (
                        <option>Greenhills (Your Club)</option>
                      ) : (
                        <>
                          <option>All Clubs</option>
                          <option>Greenhills</option>
                          <option>Pickleplex</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="label">Bracket</label>
                    <select className="input">
                      <option>3.0</option>
                      <option>3.5</option>
                      <option>4.0</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Roster Table */}
              <div className="card p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">Greenhills 3.0 - Stop 1 (6/8 players)</h3>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost">Copy to Next Stop</button>
                    <button className="btn btn-primary">+ Add Player</button>
                  </div>
                </div>
                <div className="overflow-hidden rounded border border-border-subtle">
                  <table className="w-full">
                    <thead className="bg-surface-1">
                      <tr>
                        <th className="text-left p-3">Player</th>
                        <th className="text-left p-3">Email</th>
                        <th className="text-left p-3">DUPR</th>
                        <th className="text-right p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-border-subtle">
                        <td className="p-3">John Doe</td>
                        <td className="p-3 text-muted">john@email.com</td>
                        <td className="p-3">3.2</td>
                        <td className="p-3 text-right">
                          <button className="btn btn-error btn-sm">Remove</button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MANAGER PAGE */}
        {currentPage === 'manager' && (
          <div className="p-8">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-3xl font-bold text-primary mb-6">Event Manager</h1>

              {/* Tournament Selector */}
              <div className="card p-4 mb-6">
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="label">Select Tournament</label>
                    <select className="input">
                      <option>Summer Championship 2025</option>
                      <option>Austin Open</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="label">Select Stop</label>
                    <select className="input">
                      <option>Stop 1: Austin (Jun 15-16)</option>
                      <option>Stop 2: Dallas (Jun 22-23)</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="label">Select Round</label>
                    <select className="input">
                      <option>Round 1</option>
                      <option>Round 2</option>
                      <option>Finals</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Manager Views */}
              <div className="border-b border-border-subtle mb-6">
                <nav className="flex gap-1 -mb-px">
                  <button
                    className={`tab-button ${managerView === 'overview' ? 'active' : ''}`}
                    onClick={() => setManagerView('overview')}
                  >
                    Overview
                  </button>
                  <button
                    className={`tab-button ${managerView === 'matches' ? 'active' : ''}`}
                    onClick={() => setManagerView('matches')}
                  >
                    Matches
                  </button>
                  <button
                    className={`tab-button ${managerView === 'lineups' ? 'active' : ''}`}
                    onClick={() => setManagerView('lineups')}
                  >
                    Lineups
                  </button>
                </nav>
              </div>

              {/* Content */}
              <div className="card p-6">
                {managerView === 'overview' && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Round Overview</h3>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="p-4 bg-surface-1 rounded">
                        <div className="text-2xl font-bold text-primary">12</div>
                        <div className="text-sm text-muted">Total Matches</div>
                      </div>
                      <div className="p-4 bg-surface-1 rounded">
                        <div className="text-2xl font-bold text-success">8</div>
                        <div className="text-sm text-muted">Completed</div>
                      </div>
                      <div className="p-4 bg-surface-1 rounded">
                        <div className="text-2xl font-bold text-warning">4</div>
                        <div className="text-sm text-muted">In Progress</div>
                      </div>
                    </div>
                  </div>
                )}

                {managerView === 'matches' && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold">Matches</h3>
                      {role === 'captain' && (
                        <div className="chip chip-info">Showing only your team's matches</div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="p-4 bg-surface-1 rounded border border-border-subtle">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-semibold">Greenhills vs Pickleplex</div>
                            <div className="text-sm text-muted">Court 1 • 2:00 PM</div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-lg font-bold">2 - 1</div>
                            <button className="btn btn-primary btn-sm">Edit Lineup</button>
                          </div>
                        </div>
                      </div>
                      {role !== 'captain' && (
                        <div className="p-4 bg-surface-1 rounded border border-border-subtle">
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="font-semibold">Austin Club vs Dallas Elite</div>
                              <div className="text-sm text-muted">Court 2 • 2:30 PM</div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-lg font-bold">1 - 0</div>
                              <button className="btn btn-primary btn-sm">Edit Lineup</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {managerView === 'lineups' && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Lineup Editor</h3>
                    <p className="text-muted">Select players for each game slot...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CLUBS PAGE */}
        {currentPage === 'clubs' && (
          <div className="p-8">
            <div className="max-w-7xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-primary">Clubs</h1>
                <button className="btn btn-primary">+ Add Club</button>
              </div>

              <div className="card overflow-hidden">
                <table className="w-full">
                  <thead className="bg-surface-1">
                    <tr>
                      <th className="text-left p-4">Name</th>
                      <th className="text-left p-4">Location</th>
                      <th className="text-left p-4">Director</th>
                      <th className="text-left p-4">Members</th>
                      <th className="text-right p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-border-subtle hover:bg-surface-1">
                      <td className="p-4 font-medium">Greenhills Pickleball Club</td>
                      <td className="p-4 text-muted">Austin, TX</td>
                      <td className="p-4 text-muted">Sarah Johnson</td>
                      <td className="p-4">124</td>
                      <td className="p-4 text-right">
                        <button className="btn btn-ghost btn-sm">Edit</button>
                      </td>
                    </tr>
                    <tr className="border-t border-border-subtle hover:bg-surface-1">
                      <td className="p-4 font-medium">Pickleplex Austin</td>
                      <td className="p-4 text-muted">Austin, TX</td>
                      <td className="p-4 text-muted">Mike Davis</td>
                      <td className="p-4">98</td>
                      <td className="p-4 text-right">
                        <button className="btn btn-ghost btn-sm">Edit</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PLAYERS PAGE */}
        {currentPage === 'players' && (
          <div className="p-8">
            <div className="max-w-7xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-primary">Players</h1>
                <div className="flex gap-2">
                  <button className="btn btn-ghost">Import CSV</button>
                  <button className="btn btn-primary">+ Add Player</button>
                </div>
              </div>

              {/* Search & Filters */}
              <div className="card p-4 mb-6">
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-2">
                    <input
                      type="text"
                      className="input"
                      placeholder="Search by name or email..."
                    />
                  </div>
                  <div>
                    <select className="input">
                      <option value="">All Clubs</option>
                      <option>Greenhills</option>
                      <option>Pickleplex</option>
                    </select>
                  </div>
                  <div>
                    <select className="input">
                      <option value="">All Ratings</option>
                      <option>3.0 - 3.5</option>
                      <option>3.5 - 4.0</option>
                      <option>4.0+</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="card overflow-hidden">
                <table className="w-full">
                  <thead className="bg-surface-1">
                    <tr>
                      <th className="text-left p-4">Name</th>
                      <th className="text-left p-4">Email</th>
                      <th className="text-left p-4">Club</th>
                      <th className="text-left p-4">DUPR</th>
                      <th className="text-left p-4">Age</th>
                      <th className="text-right p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-border-subtle hover:bg-surface-1">
                      <td className="p-4 font-medium">John Doe</td>
                      <td className="p-4 text-muted">john@email.com</td>
                      <td className="p-4 text-muted">Greenhills</td>
                      <td className="p-4">3.5</td>
                      <td className="p-4">32</td>
                      <td className="p-4 text-right">
                        <button className="btn btn-ghost btn-sm">Edit</button>
                      </td>
                    </tr>
                    <tr className="border-t border-border-subtle hover:bg-surface-1">
                      <td className="p-4 font-medium">Jane Smith</td>
                      <td className="p-4 text-muted">jane@email.com</td>
                      <td className="p-4 text-muted">Pickleplex</td>
                      <td className="p-4">3.7</td>
                      <td className="p-4">28</td>
                      <td className="p-4 text-right">
                        <button className="btn btn-ghost btn-sm">Edit</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* APP ADMIN PAGE */}
        {currentPage === 'app-admin' && (
          <div className="p-8">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-3xl font-bold text-primary mb-6">App Administration</h1>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="card p-6">
                  <h3 className="font-semibold text-lg mb-4">System Settings</h3>
                  <div className="space-y-3">
                    <button className="w-full btn btn-ghost justify-start">
                      <span className="mr-3">⚙️</span>
                      General Settings
                    </button>
                    <button className="w-full btn btn-ghost justify-start">
                      <span className="mr-3">👥</span>
                      User Management
                    </button>
                    <button className="w-full btn btn-ghost justify-start">
                      <span className="mr-3">🔗</span>
                      Merge Players
                    </button>
                  </div>
                </div>

                <div className="card p-6">
                  <h3 className="font-semibold text-lg mb-4">Tournament Admins</h3>
                  <div className="space-y-3">
                    <div className="p-3 bg-surface-1 rounded flex justify-between items-center">
                      <div>
                        <div className="font-medium">Sarah Admin</div>
                        <div className="text-sm text-muted">3 tournaments</div>
                      </div>
                      <button className="btn btn-ghost btn-sm">Manage</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
