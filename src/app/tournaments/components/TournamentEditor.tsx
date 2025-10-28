'use client';

import { useState } from 'react';
import { TournamentDetailsTab } from './tabs/TournamentDetailsTab';
import { RegistrationSettingsTab, type EditorRowWithRegistration } from './tabs/RegistrationSettingsTab';
import { RegistrationsTab } from './tabs/RegistrationsTab';
import { InvitationsTab } from './tabs/InvitationsTab';
import { StopsLocationsTab } from './tabs/StopsLocationsTab';
import { ClubsCaptainsTab } from './tabs/ClubsCaptainsTab';
import { BracketsTab } from './tabs/BracketsTab';
import { AccessManagersTab } from './tabs/AccessManagersTab';

type Id = string;

export type TournamentTypeLabel =
  | 'Team Format'
  | 'Single Elimination'
  | 'Double Elimination'
  | 'Double Elimination Clubs'
  | 'Round Robin'
  | 'Pool Play'
  | 'Ladder Tournament';

export type CaptainPick = { id: string; label: string } | null;

export type ClubWithCaptain = {
  clubId?: string;
  singleCaptain: CaptainPick;
  singleQuery: string;
  singleOptions: Array<{ id: string; label: string }>;
  club?: CaptainPick;
  clubQuery?: string;
  clubOptions?: Array<{ id: string; label: string }>;
};

export type StopEditorRow = {
  id?: Id;
  name: string;
  clubId?: Id;
  startAt?: string;
  endAt?: string;
  eventManager?: CaptainPick;
  eventManagerQuery?: string;
  eventManagerOptions?: Array<{ id: string; label: string }>;
  club?: CaptainPick;
  clubQuery?: string;
  clubOptions?: Array<{ id: string; label: string }>;
};

export type NewBracket = { id: string; name: string };

export type EditorRow = {
  name: string;
  type: TournamentTypeLabel;
  clubs: ClubWithCaptain[];
  hasMultipleStops: boolean;
  hasBrackets: boolean;
  hasCaptains: boolean;
  brackets: NewBracket[];
  stops: StopEditorRow[];
  maxTeamSize: string;
  gamesPerMatch: number; // For bracket tournaments
  gameSlots: string[]; // For bracket tournaments
  tournamentEventManager: CaptainPick;
  tournamentEventManagerQuery: string;
  tournamentEventManagerOptions: Array<{ id: string; label: string }>;
  tournamentAdmin: CaptainPick;
  tournamentAdminQuery: string;
  tournamentAdminOptions: Array<{ id: string; label: string }>;
  // Registration Settings
  registrationStatus: 'OPEN' | 'INVITE_ONLY' | 'CLOSED';
  registrationType: 'FREE' | 'PAID';
  registrationCost: string;
  maxPlayers: string;
  restrictionNotes: string[];
  isWaitlistEnabled: boolean;
};

export type Club = {
  id: Id;
  name: string;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  phone?: string | null;
};

type Tab = 'details' | 'registration' | 'registrations' | 'invitations' | 'stops' | 'clubs' | 'brackets' | 'access';

type TournamentEditorProps = {
  tournamentId: Id;
  editor: EditorRow;
  setEditor: (editor: EditorRow) => void;
  clubsAll: Club[];
  searchPlayers: (term: string) => Promise<Array<{ id: string; label: string }>>;
  onSave: (tournamentId: Id, editor: EditorRow) => Promise<void>;
  onClose: () => void;
  userProfile: { isAppAdmin: boolean } | null;
};

export function TournamentEditor({
  tournamentId,
  editor,
  setEditor,
  clubsAll,
  searchPlayers,
  onSave,
  onClose,
  userProfile,
}: TournamentEditorProps) {
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Team Format and bracket tournaments require clubs
  const requiresClubs = editor.type === 'Team Format' ||
                        editor.type === 'Double Elimination' ||
                        editor.type === 'Double Elimination Clubs' ||
                        editor.type === 'Single Elimination';

  // Dynamic label based on whether captains are enabled
  const clubsTabLabel = editor.hasCaptains ? 'Clubs & Captains' : 'Clubs';

  const tabs = [
    { id: 'details' as const, label: 'Tournament Details' },
    { id: 'registration' as const, label: 'Registration Settings' },
    { id: 'registrations' as const, label: 'Registrations' },
    { id: 'invitations' as const, label: 'Invitations' },
    { id: 'stops' as const, label: 'Location(s) & Dates' },
    { id: 'clubs' as const, label: clubsTabLabel, hidden: !requiresClubs },
    { id: 'brackets' as const, label: 'Brackets', hidden: !editor.hasBrackets },
    { id: 'access' as const, label: 'Access & Managers' },
  ].filter(tab => !tab.hidden);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await onSave(tournamentId, editor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tournament');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card space-y-0">
      {/* Header */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-primary">Edit {editor.name}</h2>
          <button
            className="text-muted hover:text-primary"
            onClick={onClose}
            aria-label="Close editor"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border-subtle">
        <nav className="flex gap-1 px-6 -mb-px overflow-x-auto" aria-label="Tournament configuration tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="px-6 py-6 min-h-[400px]">
        {error && (
          <div className="mb-4 border border-error bg-error/10 text-error p-3 rounded">
            {error}
          </div>
        )}

        {activeTab === 'details' && (
          <TournamentDetailsTab
            editor={editor}
            setEditor={setEditor}
          />
        )}

        {activeTab === 'registration' && (
          <RegistrationSettingsTab
            editor={editor as EditorRowWithRegistration}
            setEditor={setEditor as (editor: EditorRowWithRegistration) => void}
          />
        )}

        {activeTab === 'registrations' && (
          <RegistrationsTab tournamentId={tournamentId} />
        )}

        {activeTab === 'invitations' && (
          <InvitationsTab tournamentId={tournamentId} searchPlayers={searchPlayers} />
        )}

        {activeTab === 'stops' && (
          <StopsLocationsTab
            editor={editor}
            setEditor={setEditor}
            clubsAll={clubsAll}
            searchPlayers={searchPlayers}
          />
        )}

        {activeTab === 'clubs' && (
          <ClubsCaptainsTab
            editor={editor}
            setEditor={setEditor}
            clubsAll={clubsAll}
            searchPlayers={searchPlayers}
          />
        )}

        {activeTab === 'brackets' && (
          <BracketsTab
            editor={editor}
            setEditor={setEditor}
          />
        )}

        {activeTab === 'access' && (
          <AccessManagersTab
            editor={editor}
            setEditor={setEditor}
            searchPlayers={searchPlayers}
            userProfile={userProfile}
          />
        )}
      </div>

      {/* Footer Actions */}
      <div className="px-6 py-4 border-t border-border-subtle flex justify-end gap-3">
        <button
          className="btn btn-ghost"
          onClick={onClose}
          disabled={saving}
        >
          Close
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
