'use client';

import { useState } from 'react';

/**
 * MOCKUP PAGE: New Tournament Admin Structure
 *
 * This is a visual mockup to demonstrate the proposed 3-tab navigation structure
 * for the tournament admin panel.
 *
 * Access at: http://localhost:3010/mockup
 */

export default function MockupPage() {
  const [activeMainTab, setActiveMainTab] = useState<'setup' | 'players' | 'rosters'>('setup');
  const [activeSetupTab, setActiveSetupTab] = useState<'details' | 'structure' | 'locations' | 'permissions'>('details');
  const [activePlayersTab, setActivePlayersTab] = useState<'settings' | 'registrations' | 'invitations' | 'waitlist'>('settings');
  const [activeRostersView, setActiveRostersView] = useState('');
  const [selectedStop, setSelectedStop] = useState('stop1');
  const [selectedClub, setSelectedClub] = useState('all');
  const [selectedBracket, setSelectedBracket] = useState('3.0');
  const [viewMode, setViewMode] = useState<'admin' | 'captain'>('admin');

  return (
    <div className="min-h-screen bg-surface p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">Tournament Admin Structure Mockup</h1>
            <p className="text-muted mt-2">Proposed 3-tab navigation with role-based access</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('admin')}
              className={`btn ${viewMode === 'admin' ? 'btn-primary' : 'btn-ghost'}`}
            >
              View as Admin
            </button>
            <button
              onClick={() => setViewMode('captain')}
              className={`btn ${viewMode === 'captain' ? 'btn-primary' : 'btn-ghost'}`}
            >
              View as Captain
            </button>
          </div>
        </div>

        {/* Tournament Header */}
        <div className="card p-4 bg-surface-1">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Summer 2025 Championship</h2>
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        {/* Main Tabs */}
        <div className="border-b border-border-subtle mb-6">
          <nav className="flex gap-1 -mb-px">
            <button
              className={`tab-button ${activeMainTab === 'setup' ? 'active' : ''}`}
              onClick={() => setActiveMainTab('setup')}
            >
              Setup
            </button>
            <button
              className={`tab-button ${activeMainTab === 'players' ? 'active' : ''}`}
              onClick={() => setActiveMainTab('players')}
            >
              Players
            </button>
            <button
              className={`tab-button ${activeMainTab === 'rosters' ? 'active' : ''}`}
              onClick={() => setActiveMainTab('rosters')}
            >
              Rosters {viewMode === 'captain' && <span className="text-xs ml-1">(Your Club Only)</span>}
            </button>
          </nav>
        </div>

        {/* SETUP TAB */}
        {activeMainTab === 'setup' && (
          <div>
            {/* Sub-tabs */}
            <div className="border-b border-border-subtle mb-6">
              <nav className="flex gap-1 -mb-px">
                <button
                  className={`tab-button tab-button-secondary ${activeSetupTab === 'details' ? 'active' : ''}`}
                  onClick={() => setActiveSetupTab('details')}
                >
                  Details
                </button>
                <button
                  className={`tab-button tab-button-secondary ${activeSetupTab === 'structure' ? 'active' : ''}`}
                  onClick={() => setActiveSetupTab('structure')}
                >
                  Structure
                </button>
                <button
                  className={`tab-button tab-button-secondary ${activeSetupTab === 'locations' ? 'active' : ''}`}
                  onClick={() => setActiveSetupTab('locations')}
                >
                  Locations
                </button>
                <button
                  className={`tab-button tab-button-secondary ${activeSetupTab === 'permissions' ? 'active' : ''}`}
                  onClick={() => setActiveSetupTab('permissions')}
                >
                  Permissions
                </button>
              </nav>
            </div>

            {/* Setup Content */}
            <div className="card p-6">
              {activeSetupTab === 'details' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold mb-4">Tournament Details</h3>
                  <div>
                    <label className="label">Tournament Name</label>
                    <input type="text" className="input" value="Summer 2025 Championship" readOnly />
                  </div>
                  <div>
                    <label className="label">Tournament Type</label>
                    <select className="input">
                      <option>Team Format</option>
                      <option>Single Elimination</option>
                      <option>Double Elimination</option>
                      <option>Double Elimination Clubs</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Max Team Size</label>
                    <input type="number" className="input" value="8" readOnly />
                  </div>
                  <p className="text-sm text-muted mt-4">
                    Configure basic tournament information, type, and settings.
                  </p>
                </div>
              )}

              {activeSetupTab === 'structure' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold mb-4">Tournament Structure</h3>
                  <div className="space-y-3">
                    <div className="p-4 bg-surface-1 rounded border border-border-subtle">
                      <h4 className="font-medium">Brackets</h4>
                      <div className="mt-2 space-y-2">
                        <div className="flex justify-between items-center p-2 bg-surface rounded">
                          <span>3.0 Bracket (Max 8 players)</span>
                          <button className="btn btn-ghost btn-sm">Edit</button>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-surface rounded">
                          <span>3.5 Bracket (Max 10 players)</span>
                          <button className="btn btn-ghost btn-sm">Edit</button>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-surface rounded">
                          <span>4.0 Bracket (Max 8 players)</span>
                          <button className="btn btn-ghost btn-sm">Edit</button>
                        </div>
                      </div>
                      <button className="btn btn-primary btn-sm mt-3">+ Add Bracket</button>
                    </div>

                    <div className="p-4 bg-surface-1 rounded border border-border-subtle">
                      <h4 className="font-medium">Clubs</h4>
                      <div className="mt-2 space-y-2">
                        <div className="flex justify-between items-center p-2 bg-surface rounded">
                          <span>Greenhills Pickleball Club</span>
                          <button className="btn btn-ghost btn-sm">Remove</button>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-surface rounded">
                          <span>Pickleplex Austin</span>
                          <button className="btn btn-ghost btn-sm">Remove</button>
                        </div>
                      </div>
                      <button className="btn btn-primary btn-sm mt-3">+ Add Club</button>
                    </div>
                  </div>
                  <p className="text-sm text-muted mt-4">
                    Configure brackets and clubs participating in the tournament.
                  </p>
                </div>
              )}

              {activeSetupTab === 'locations' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold mb-4">Locations & Schedule</h3>
                  <div className="space-y-3">
                    <div className="p-4 bg-surface-1 rounded border border-border-subtle">
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <h4 className="font-medium">Stop 1: Austin</h4>
                          <p className="text-sm text-muted">June 15-16, 2025</p>
                        </div>
                        <button className="btn btn-ghost btn-sm">Edit</button>
                      </div>
                      <div className="text-sm">
                        <p><strong>Venue:</strong> Greenhills Pickleball Club</p>
                        <p><strong>Event Manager:</strong> John Doe</p>
                      </div>
                    </div>

                    <div className="p-4 bg-surface-1 rounded border border-border-subtle">
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <h4 className="font-medium">Stop 2: Dallas</h4>
                          <p className="text-sm text-muted">June 22-23, 2025</p>
                        </div>
                        <button className="btn btn-ghost btn-sm">Edit</button>
                      </div>
                      <div className="text-sm">
                        <p><strong>Venue:</strong> Pickleplex Dallas</p>
                        <p><strong>Event Manager:</strong> Jane Smith</p>
                      </div>
                    </div>
                  </div>
                  <button className="btn btn-primary btn-sm">+ Add Stop</button>
                  <p className="text-sm text-muted mt-4">
                    Configure tournament stops/venues and assign event managers per stop.
                  </p>
                </div>
              )}

              {activeSetupTab === 'permissions' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold mb-4">Permissions & Access</h3>

                  <div>
                    <h4 className="font-medium mb-2">Tournament Admin</h4>
                    <p className="text-sm text-muted mb-3">App Admin only can assign</p>
                    <div className="p-3 bg-surface-1 rounded">
                      <span>John Admin (john@admin.com)</span>
                      {viewMode === 'admin' && (
                        <button className="btn btn-ghost btn-sm ml-2">Remove</button>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Event Managers</h4>
                    <div className="space-y-2">
                      <div className="p-3 bg-surface-1 rounded flex justify-between">
                        <div>
                          <span className="font-medium">Tournament-Wide</span>
                          <p className="text-sm text-muted">Can manage all stops</p>
                        </div>
                        <div>
                          <span>Jane Manager (jane@event.com)</span>
                          <button className="btn btn-ghost btn-sm ml-2">Remove</button>
                        </div>
                      </div>
                      <div className="p-3 bg-surface-1 rounded flex justify-between">
                        <div>
                          <span className="font-medium">Stop 1 Only</span>
                          <p className="text-sm text-muted">Austin stop</p>
                        </div>
                        <div>
                          <span>Mike Local (mike@local.com)</span>
                          <button className="btn btn-ghost btn-sm ml-2">Remove</button>
                        </div>
                      </div>
                    </div>
                    <button className="btn btn-primary btn-sm mt-2">+ Assign Event Manager</button>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Captain Portal Links</h4>
                    <p className="text-sm text-muted mb-3">Share these links with team captains</p>
                    <div className="space-y-2">
                      <div className="p-3 bg-surface-1 rounded">
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-medium">Greenhills Pickleball Club</span>
                            <p className="text-sm text-muted">Captain: Sarah Johnson (sarah@gh.com)</p>
                          </div>
                          <div className="flex gap-2">
                            <button className="btn btn-ghost btn-sm">Copy Link</button>
                            <button className="btn btn-ghost btn-sm">Email Captain</button>
                            <button className="btn btn-error btn-sm">Revoke</button>
                          </div>
                        </div>
                        <div className="mt-2 p-2 bg-surface rounded font-mono text-xs">
                          https://yourapp.com/captain/ABC12
                        </div>
                      </div>

                      <div className="p-3 bg-surface-1 rounded">
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-medium">Pickleplex Austin</span>
                            <p className="text-sm text-muted">Captain: Tom Davis (tom@pp.com)</p>
                          </div>
                          <div className="flex gap-2">
                            <button className="btn btn-ghost btn-sm">Copy Link</button>
                            <button className="btn btn-ghost btn-sm">Email Captain</button>
                            <button className="btn btn-error btn-sm">Revoke</button>
                          </div>
                        </div>
                        <div className="mt-2 p-2 bg-surface rounded font-mono text-xs">
                          https://yourapp.com/captain/XYZ34
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PLAYERS TAB */}
        {activeMainTab === 'players' && (
          <div>
            {/* Sub-tabs */}
            <div className="border-b border-border-subtle mb-6">
              <nav className="flex gap-1 -mb-px">
                <button
                  className={`tab-button tab-button-secondary ${activePlayersTab === 'settings' ? 'active' : ''}`}
                  onClick={() => setActivePlayersTab('settings')}
                >
                  Settings
                </button>
                <button
                  className={`tab-button tab-button-secondary ${activePlayersTab === 'registrations' ? 'active' : ''}`}
                  onClick={() => setActivePlayersTab('registrations')}
                >
                  Registrations (45)
                </button>
                <button
                  className={`tab-button tab-button-secondary ${activePlayersTab === 'invitations' ? 'active' : ''}`}
                  onClick={() => setActivePlayersTab('invitations')}
                >
                  Invitations (12)
                </button>
                <button
                  className={`tab-button tab-button-secondary ${activePlayersTab === 'waitlist' ? 'active' : ''}`}
                  onClick={() => setActivePlayersTab('waitlist')}
                >
                  Waitlist (8)
                </button>
              </nav>
            </div>

            {/* Players Content */}
            <div className="card p-6">
              {activePlayersTab === 'settings' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold mb-4">Registration Settings</h3>
                  <div>
                    <label className="label">Registration Status</label>
                    <select className="input">
                      <option>OPEN</option>
                      <option>INVITE_ONLY</option>
                      <option>CLOSED</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Registration Type</label>
                    <select className="input">
                      <option>FREE</option>
                      <option>PAID</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Cost (if paid)</label>
                    <input type="text" className="input" placeholder="$50.00" />
                  </div>
                  <div>
                    <label className="label">Max Players</label>
                    <input type="number" className="input" value="64" />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="waitlist" checked readOnly />
                    <label htmlFor="waitlist">Enable Waitlist</label>
                  </div>
                </div>
              )}

              {activePlayersTab === 'registrations' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Registrations</h3>
                    <button className="btn btn-primary">+ Manual Register Player</button>
                  </div>

                  <div className="overflow-hidden rounded border border-border-subtle">
                    <table className="w-full">
                      <thead className="bg-surface-1">
                        <tr>
                          <th className="text-left p-3 text-sm font-medium">Player</th>
                          <th className="text-left p-3 text-sm font-medium">Club</th>
                          <th className="text-left p-3 text-sm font-medium">Bracket</th>
                          <th className="text-left p-3 text-sm font-medium">Stop(s)</th>
                          <th className="text-left p-3 text-sm font-medium">Status</th>
                          <th className="text-right p-3 text-sm font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-border-subtle">
                          <td className="p-3">
                            <div className="font-medium">John Doe</div>
                            <div className="text-sm text-muted">john@email.com</div>
                          </td>
                          <td className="p-3">Greenhills</td>
                          <td className="p-3">3.0</td>
                          <td className="p-3">Stop 1, Stop 2</td>
                          <td className="p-3">
                            <span className="chip chip-success">REGISTERED</span>
                          </td>
                          <td className="p-3 text-right">
                            <button className="btn btn-error btn-sm">Reject</button>
                          </td>
                        </tr>
                        <tr className="border-t border-border-subtle">
                          <td className="p-3">
                            <div className="font-medium">Jane Smith</div>
                            <div className="text-sm text-muted">jane@email.com</div>
                          </td>
                          <td className="p-3">Pickleplex</td>
                          <td className="p-3">3.5</td>
                          <td className="p-3">All Stops</td>
                          <td className="p-3">
                            <span className="chip chip-warning">PENDING</span>
                          </td>
                          <td className="p-3 text-right">
                            <button className="btn btn-success btn-sm mr-2">Accept</button>
                            <button className="btn btn-ghost btn-sm mr-2">Move</button>
                            <button className="btn btn-error btn-sm">Reject</button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-sm text-muted mt-4">
                    Review player registrations and accept, reject, or move to different clubs/brackets.
                  </p>
                </div>
              )}

              {activePlayersTab === 'invitations' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Invitations</h3>
                    <button className="btn btn-primary">+ Send Invitation</button>
                  </div>

                  <div className="space-y-2">
                    <div className="p-4 bg-surface-1 rounded border border-border-subtle">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-medium">Mike Johnson</span>
                          <p className="text-sm text-muted">mike@email.com • Expires in 5 days</p>
                        </div>
                        <div>
                          <span className="chip chip-warning mr-2">PENDING</span>
                          <button className="btn btn-ghost btn-sm">Resend</button>
                          <button className="btn btn-error btn-sm ml-2">Cancel</button>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-surface-1 rounded border border-border-subtle">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-medium">Sarah Williams</span>
                          <p className="text-sm text-muted">sarah@email.com • Accepted 2 days ago</p>
                        </div>
                        <div>
                          <span className="chip chip-success">ACCEPTED</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8">
                    <h4 className="font-medium mb-3">Invite Requests (3)</h4>
                    <div className="space-y-2">
                      <div className="p-4 bg-surface-1 rounded border border-border-subtle">
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-medium">Tom Davis</span>
                            <p className="text-sm text-muted">tom@email.com • Requested 1 day ago</p>
                            <p className="text-xs text-muted mt-1">Note: "I played in last year's tournament"</p>
                          </div>
                          <div>
                            <button className="btn btn-success btn-sm mr-2">Approve</button>
                            <button className="btn btn-error btn-sm">Reject</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activePlayersTab === 'waitlist' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold mb-4">Waitlist</h3>

                  <div className="overflow-hidden rounded border border-border-subtle">
                    <table className="w-full">
                      <thead className="bg-surface-1">
                        <tr>
                          <th className="text-left p-3 text-sm font-medium">Position</th>
                          <th className="text-left p-3 text-sm font-medium">Player</th>
                          <th className="text-left p-3 text-sm font-medium">Club</th>
                          <th className="text-left p-3 text-sm font-medium">Bracket</th>
                          <th className="text-left p-3 text-sm font-medium">Joined</th>
                          <th className="text-right p-3 text-sm font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-border-subtle">
                          <td className="p-3 font-semibold">#1</td>
                          <td className="p-3">
                            <div className="font-medium">Alex Brown</div>
                            <div className="text-sm text-muted">alex@email.com</div>
                          </td>
                          <td className="p-3">Greenhills</td>
                          <td className="p-3">3.0</td>
                          <td className="p-3">2 days ago</td>
                          <td className="p-3 text-right">
                            <button className="btn btn-primary btn-sm">Promote</button>
                          </td>
                        </tr>
                        <tr className="border-t border-border-subtle">
                          <td className="p-3 font-semibold">#2</td>
                          <td className="p-3">
                            <div className="font-medium">Lisa Chen</div>
                            <div className="text-sm text-muted">lisa@email.com</div>
                          </td>
                          <td className="p-3">Pickleplex</td>
                          <td className="p-3">3.5</td>
                          <td className="p-3">3 days ago</td>
                          <td className="p-3 text-right">
                            <button className="btn btn-primary btn-sm">Promote</button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ROSTERS TAB */}
        {activeMainTab === 'rosters' && (
          <div>
            {/* Filters */}
            <div className="card p-4 mb-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Stop</label>
                  <select
                    className="input"
                    value={selectedStop}
                    onChange={(e) => setSelectedStop(e.target.value)}
                  >
                    <option value="stop1">Stop 1: Austin (Jun 15-16)</option>
                    <option value="stop2">Stop 2: Dallas (Jun 22-23)</option>
                    <option value="stop3">Stop 3: Houston (Jun 29-30)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Club</label>
                  <select
                    className="input"
                    value={selectedClub}
                    onChange={(e) => setSelectedClub(e.target.value)}
                    disabled={viewMode === 'captain'}
                  >
                    {viewMode === 'admin' && <option value="all">All Clubs</option>}
                    <option value="greenhills">Greenhills Pickleball Club</option>
                    <option value="pickleplex">Pickleplex Austin</option>
                  </select>
                  {viewMode === 'captain' && (
                    <p className="text-xs text-muted mt-1">Captains can only view their club</p>
                  )}
                </div>
                <div>
                  <label className="label">Bracket</label>
                  <select
                    className="input"
                    value={selectedBracket}
                    onChange={(e) => setSelectedBracket(e.target.value)}
                  >
                    <option value="3.0">3.0 Bracket</option>
                    <option value="3.5">3.5 Bracket</option>
                    <option value="4.0">4.0 Bracket</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Roster Table */}
            <div className="card p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-semibold">
                    {selectedClub === 'all' ? 'All Clubs' : selectedClub === 'greenhills' ? 'Greenhills' : 'Pickleplex'} - {selectedBracket} - {selectedStop === 'stop1' ? 'Stop 1' : selectedStop === 'stop2' ? 'Stop 2' : 'Stop 3'}
                  </h3>
                  <p className="text-sm text-muted">6/8 players</p>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-ghost">Copy to Next Stop</button>
                  <button className="btn btn-ghost">Export CSV</button>
                  <button className="btn btn-primary">+ Add Player</button>
                </div>
              </div>

              <div className="overflow-hidden rounded border border-border-subtle">
                <table className="w-full">
                  <thead className="bg-surface-1">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium">Player</th>
                      <th className="text-left p-3 text-sm font-medium">Email</th>
                      <th className="text-left p-3 text-sm font-medium">DUPR</th>
                      <th className="text-left p-3 text-sm font-medium">Added</th>
                      <th className="text-right p-3 text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-border-subtle">
                      <td className="p-3 font-medium">John Doe</td>
                      <td className="p-3 text-muted">john@email.com</td>
                      <td className="p-3">3.2</td>
                      <td className="p-3 text-sm text-muted">May 1, 2025</td>
                      <td className="p-3 text-right">
                        <button className="btn btn-error btn-sm">Remove</button>
                      </td>
                    </tr>
                    <tr className="border-t border-border-subtle">
                      <td className="p-3 font-medium">Jane Smith</td>
                      <td className="p-3 text-muted">jane@email.com</td>
                      <td className="p-3">3.0</td>
                      <td className="p-3 text-sm text-muted">May 2, 2025</td>
                      <td className="p-3 text-right">
                        <button className="btn btn-error btn-sm">Remove</button>
                      </td>
                    </tr>
                    <tr className="border-t border-border-subtle">
                      <td className="p-3 font-medium">Mike Johnson</td>
                      <td className="p-3 text-muted">mike@email.com</td>
                      <td className="p-3">3.1</td>
                      <td className="p-3 text-sm text-muted">May 3, 2025</td>
                      <td className="p-3 text-right">
                        <button className="btn btn-error btn-sm">Remove</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-6 p-4 bg-info/10 border border-info/20 rounded">
                <p className="text-sm text-info font-medium mb-2">Roster Rules:</p>
                <ul className="text-sm text-info space-y-1">
                  <li>• Players can only be on ONE team per stop (across all clubs)</li>
                  <li>• Maximum {selectedBracket === '3.0' ? '8' : selectedBracket === '3.5' ? '10' : '8'} players per {selectedBracket} team</li>
                  <li>• Players can be on different teams in different stops</li>
                  <li>• Use "Copy to Next Stop" to quickly duplicate rosters</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="max-w-7xl mx-auto mt-8">
        <div className="card p-6 bg-surface-1">
          <h3 className="font-semibold mb-4">Navigation Notes:</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Setup Tab</h4>
              <ul className="space-y-1 text-muted">
                <li>• Configure tournament once during creation</li>
                <li>• Details: Name, type, configuration</li>
                <li>• Structure: Brackets and clubs</li>
                <li>• Locations: Stops and event managers</li>
                <li>• Permissions: Admins, managers, captain portal links</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Players Tab</h4>
              <ul className="space-y-1 text-muted">
                <li>• Manage ongoing player registrations</li>
                <li>• Settings: Registration rules and capacity</li>
                <li>• Registrations: Accept, reject, or move players</li>
                <li>• Invitations: Send invites and approve requests</li>
                <li>• Waitlist: Promote players when spots open</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Rosters Tab</h4>
              <ul className="space-y-1 text-muted">
                <li>• Club-based tournaments only</li>
                <li>• View rosters by Stop/Club/Bracket</li>
                <li>• Captains: Filtered to their club automatically</li>
                <li>• Admins: Can view and edit all clubs</li>
                <li>• Copy rosters between stops to save time</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Role Access</h4>
              <ul className="space-y-1 text-muted">
                <li>• App Admin: Full access to all tabs</li>
                <li>• Tournament Admin: Full access to assigned tournaments</li>
                <li>• Captain: Rosters tab only (own club)</li>
                <li>• Event Manager: Access via /manager page</li>
                <li>• Player: No admin panel access</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
