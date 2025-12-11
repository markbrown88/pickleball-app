'use client';

import { useState } from 'react';
import { TournamentDetailsTab } from './tabs/TournamentDetailsTab';
import { RegistrationSettingsTab, type EditorRowWithRegistration } from './tabs/RegistrationSettingsTab';
import { StopsLocationsTab } from './tabs/StopsLocationsTab';
import { ClubsCaptainsTab } from './tabs/ClubsCaptainsTab';
import { BracketsTab } from './tabs/BracketsTab';
import { AccessManagersTab } from './tabs/AccessManagersTab';
import { AdvancedConfigTab } from './tabs/AdvancedConfigTab';
import { requiresClubs, showsStops, showsBrackets, isTeamTournament } from '@/lib/tournamentTypeConfig';

type Id = string;

export type TournamentTypeLabel =
  | 'Club Round-Robin'
  | 'Club Double Elimination'
  | 'Single Elimination'
  | 'Double Elimination'
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
  // Global club search for chip-based UI
  globalClubQuery: string;
  globalClubOptions: Array<{ id: string; label: string }>;
  editingClubIdx: number | null;
  // Registration Settings
  registrationStatus: 'OPEN' | 'INVITE_ONLY' | 'CLOSED';
  registrationType: 'FREE' | 'PAID';
  registrationCost: string;
  pricingModel: 'TOURNAMENT_WIDE' | 'PER_STOP' | 'PER_BRACKET' | 'PER_STOP_PER_BRACKET';
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

type Tab = 'details' | 'registration' | 'stops' | 'clubs' | 'brackets' | 'access' | 'advanced';

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

  // Use centralized tournament type configuration
  const tournamentRequiresClubs = requiresClubs(editor.type);
  const tournamentShowsStops = showsStops(editor.type);
  const tournamentShowsBrackets = showsBrackets(editor.type);
  const tournamentIsTeam = isTeamTournament(editor.type);

  // Dynamic label based on whether captains are enabled
  const clubsTabLabel = editor.hasCaptains ? 'Clubs & Captains' : 'Clubs';

  // Check if advanced config tab should be shown
  const editorWithReg = editor as EditorRowWithRegistration;
  const showAdvancedConfig =
    editorWithReg.registrationType === 'PAID' &&
    editorWithReg.pricingModel !== 'TOURNAMENT_WIDE';

  const tabs = [
    { id: 'details' as const, label: 'Tournament Details' },
    { id: 'registration' as const, label: 'Registration Settings' },
    { id: 'advanced' as const, label: 'Advanced Configuration', hidden: !showAdvancedConfig },
    { id: 'stops' as const, label: 'Location(s) & Dates', hidden: !tournamentShowsStops },
    { id: 'clubs' as const, label: clubsTabLabel, hidden: !tournamentRequiresClubs },
    { id: 'brackets' as const, label: 'Brackets', hidden: !tournamentShowsBrackets || !editor.hasBrackets },
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

        {activeTab === 'advanced' && (
          <AdvancedConfigTab
            tournamentId={tournamentId}
            pricingModel={editorWithReg.pricingModel}
            isTeamTournament={tournamentIsTeam}
          />
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
