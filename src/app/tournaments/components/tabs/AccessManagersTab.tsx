'use client';

import { useRef } from 'react';
import type { EditorRow, CaptainPick } from '../TournamentEditor';

type AccessManagersTabProps = {
  editor: EditorRow;
  setEditor: (editor: EditorRow) => void;
  searchPlayers: (term: string) => Promise<Array<{ id: string; label: string }>>;
  userProfile: { isAppAdmin: boolean } | null;
};

export function AccessManagersTab({ editor, setEditor, searchPlayers, userProfile }: AccessManagersTabProps) {
  const searchTimers = useRef<Record<string, number>>({});

  const setTournamentEventMgrQuery = (query: string) => {
    setEditor({
      ...editor,
      tournamentEventManagerQuery: query,
      tournamentEventManagerOptions: [],
    });

    const key = 'tournament-event-mgr';
    if (searchTimers.current[key]) clearTimeout(searchTimers.current[key]);

    if (query.trim().length >= 3) {
      searchTimers.current[key] = window.setTimeout(async () => {
        const opts = await searchPlayers(query.trim());
        setEditor({
          ...editor,
          tournamentEventManagerOptions: opts,
        });
      }, 300);
    }
  };

  const chooseTournamentEventMgr = (pick: { id: string; label: string }) => {
    setEditor({
      ...editor,
      tournamentEventManager: pick,
      tournamentEventManagerQuery: '',
      tournamentEventManagerOptions: [],
    });
  };

  const removeTournamentEventMgr = () => {
    setEditor({
      ...editor,
      tournamentEventManager: null,
      tournamentEventManagerQuery: '',
      tournamentEventManagerOptions: [],
    });
  };

  const setTournamentAdminQuery = (query: string) => {
    setEditor({
      ...editor,
      tournamentAdminQuery: query,
      tournamentAdminOptions: [],
    });

    const key = 'tournament-admin';
    if (searchTimers.current[key]) clearTimeout(searchTimers.current[key]);

    if (query.trim().length >= 3) {
      searchTimers.current[key] = window.setTimeout(async () => {
        const opts = await searchPlayers(query.trim());
        // Filter to only show app admins (if we have that info)
        setEditor({
          ...editor,
          tournamentAdminOptions: opts,
        });
      }, 300);
    }
  };

  const chooseTournamentAdmin = (pick: { id: string; label: string }) => {
    setEditor({
      ...editor,
      tournamentAdmin: pick,
      tournamentAdminQuery: '',
      tournamentAdminOptions: [],
    });
  };

  const removeTournamentAdmin = () => {
    setEditor({
      ...editor,
      tournamentAdmin: null,
      tournamentAdminQuery: '',
      tournamentAdminOptions: [],
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold text-primary mb-2">Access & Permissions</h3>
        <p className="text-sm text-muted">
          Assign tournament-level managers and admins who can oversee this tournament
        </p>
      </div>

      <div className="space-y-6">
        {/* Tournament Event Manager */}
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-secondary mb-1">Tournament Event Manager</h4>
            <p className="text-xs text-muted">
              Can manage lineups and scores for all stops (unless overridden at stop level)
            </p>
          </div>

          {editor.tournamentEventManager ? (
            <div className="flex items-center gap-2">
              <span className="chip chip-info">{editor.tournamentEventManager.label}</span>
              <button
                className="text-error hover:text-error-hover text-sm"
                onClick={removeTournamentEventMgr}
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                className="input w-full"
                value={editor.tournamentEventManagerQuery || ''}
                onChange={(e) => setTournamentEventMgrQuery(e.target.value)}
                placeholder="Type 3+ characters to search players..."
              />
              {editor.tournamentEventManagerOptions && editor.tournamentEventManagerOptions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 border border-subtle rounded bg-surface-1 max-h-48 overflow-auto shadow-lg">
                  {editor.tournamentEventManagerOptions.map((opt) => (
                    <button
                      key={opt.id}
                      className="block w-full text-left px-3 py-2 hover:bg-surface-2 text-sm"
                      onClick={() => chooseTournamentEventMgr(opt)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tournament Admin */}
        {userProfile?.isAppAdmin && (
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold text-secondary mb-1">Tournament Admin</h4>
              <p className="text-xs text-muted">
                Can edit tournament settings, manage clubs, and configure all aspects of this tournament
              </p>
            </div>

            {editor.tournamentAdmin ? (
              <div className="flex items-center gap-2">
                <span className="chip chip-warning">{editor.tournamentAdmin.label}</span>
                <button
                  className="text-error hover:text-error-hover text-sm"
                  onClick={removeTournamentAdmin}
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  className="input w-full"
                  value={editor.tournamentAdminQuery || ''}
                  onChange={(e) => setTournamentAdminQuery(e.target.value)}
                  placeholder="Type 3+ characters to search app admins..."
                />
                {editor.tournamentAdminOptions && editor.tournamentAdminOptions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 border border-subtle rounded bg-surface-1 max-h-48 overflow-auto shadow-lg">
                    {editor.tournamentAdminOptions.map((opt) => (
                      <button
                        key={opt.id}
                        className="block w-full text-left px-3 py-2 hover:bg-surface-2 text-sm"
                        onClick={() => chooseTournamentAdmin(opt)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Permissions Summary */}
      <div className="bg-surface-2 border border-border-subtle rounded p-4">
        <h4 className="font-semibold text-secondary mb-3 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Permissions Summary
        </h4>
        <div className="space-y-3 text-sm">
          <div>
            <div className="font-medium text-secondary mb-1">Event Managers</div>
            <ul className="text-muted space-y-1 ml-4">
              <li>• Can view tournament schedule and matches</li>
              <li>• Can set lineups for matches</li>
              <li>• Can enter and update game scores</li>
              <li>• Cannot modify tournament settings or clubs</li>
            </ul>
          </div>
          <div>
            <div className="font-medium text-secondary mb-1">Tournament Admins</div>
            <ul className="text-muted space-y-1 ml-4">
              <li>• Full access to edit tournament configuration</li>
              <li>• Can manage clubs, captains, and brackets</li>
              <li>• Can assign event managers</li>
              <li>• Can view and edit all tournament data</li>
            </ul>
          </div>
          <div>
            <div className="font-medium text-secondary mb-1">App Admins</div>
            <ul className="text-muted space-y-1 ml-4">
              <li>• Can assign tournament admins (App Admins only)</li>
              <li>• Full system access to all tournaments</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
