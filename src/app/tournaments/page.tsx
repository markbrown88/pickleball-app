// src/app/admin/page.tsx
'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  useCallback,
} from 'react';
import { formatDateUTC, formatDateRangeUTC } from '@/lib/utils';
import { useUser } from '@clerk/nextjs';

import { useAppToolbar } from '../shared/AppShell';
import type { UserProfile } from '@/types';
import { CreateTournamentModal } from './components/CreateTournamentModal';
import { TournamentsList } from './components/TournamentsList';
import { TournamentEditor } from './components/TournamentEditor';
import type { TournamentTypeLabel } from './components/TournamentEditor';

type Id = string;

/* ================= Helpers ================= */

function extractErrorMessage(body: unknown, status: number): string {
  if (typeof body === 'string') return body;
  if (body && typeof body === 'object' && 'error' in body && typeof (body as { error?: unknown }).error === 'string') {
    return (body as { error: string }).error;
  }
  return `HTTP ${status}`;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const contentType = response.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(extractErrorMessage(body, response.status));
  }
  return body as T;
}

function fmtDate(d?: string | null) {
  if (!d) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d; // already date-only
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtDateDisplay(d?: string | null) {
  return formatDateUTC(d);
}
function toDateInput(iso?: string | null) {
  if (!iso) return '';
  return iso.slice(0, 10);
}
function between(a?: string | null, b?: string | null) {
  return formatDateRangeUTC(a, b);
}
function stopTitleForDisplay(opts: {
  stopName?: string | null;
  hasMultipleStops: boolean;
}) {
  const name = (opts.stopName ?? '').trim();
  if (!opts.hasMultipleStops && name.toLowerCase() === 'main') return ''; // hide "Main" for single-stop
  return name;
}
function formatClubLabel(name?: string | null, city?: string | null, region?: string | null) {
  const base = (name ?? '').trim();
  if (!base) return '';
  const location = (city ?? '').trim() || (region ?? '').trim();
  return location ? `${base} (${location})` : base;
}
function personLabel(p: { firstName?: string | null; lastName?: string | null; name?: string | null }) {
  const fn = (p.firstName ?? '').trim();
  const ln = (p.lastName ?? '').trim();
  return [fn, ln].filter(Boolean).join(' ') || (p.name ?? 'Unknown');
}

/* ================= Slots / labels (for schedule generation & viewing) ================= */
type GameSlotLiteral = 'MENS_DOUBLES' | 'WOMENS_DOUBLES' | 'MIXED_1' | 'MIXED_2' | 'TIEBREAKER';
const SLOT_OPTIONS: Array<{ key: GameSlotLiteral; label: string }> = [
  { key: 'MENS_DOUBLES', label: "Men's Doubles" },
  { key: 'WOMENS_DOUBLES', label: "Women's Doubles" },
  { key: 'MIXED_1', label: 'Mixed 1' },
  { key: 'MIXED_2', label: 'Mixed 2' },
  { key: 'TIEBREAKER', label: 'Tiebreaker' },
];
const SLOT_LABEL: Record<GameSlotLiteral, string> = SLOT_OPTIONS.reduce((m, o) => { m[o.key] = o.label; return m; }, {} as Record<GameSlotLiteral, string>);

/* ================= Types ================= */
type Club = {
  id: Id; name: string;
  address?: string | null; city?: string | null; region?: string | null; country?: string | null; phone?: string | null;
};
type Player = {
  id: Id; firstName?: string | null; lastName?: string | null; name?: string | null; gender: 'MALE' | 'FEMALE';
  clubId?: Id | null; club?: Club | null;
  city?: string | null; region?: string | null; country?: string | null;
  phone?: string | null; email?: string | null; dupr?: number | null; age?: number | null;
};
type PlayersResponse = { items: Player[]; total: number };
type ClubsResponse = Club[];

type Team = { id: Id; name: string; club?: Club | null; captain?: { id: Id; firstName?: string | null; lastName?: string | null; name?: string | null } | null };

type StopRow = {
  id: Id; name: string; tournamentId: Id; clubId?: Id | null; club?: Club | null;
  startAt?: string | null; endAt?: string | null;
  teams?: { team: Team }[];
};

type TournamentRow = {
  id: Id;
  name: string;
  createdAt: string;
  stats: {
    stopCount: number;
    participatingClubs: string[];
    dateRange: { start: string | null; end: string | null };
  };
  stops?: StopRow[];
};

/** Legacy participant draft (preserved for the legacy panel) */
type ParticipantDraft = {
  clubId?: string;
  intermediateCaptain?: { id: string; label: string } | null;
  advancedCaptain?: { id: string; label: string } | null;
  iQuery: string; aQuery: string;
  iOptions: Array<{ id: string; label: string }>;
  aOptions: Array<{ id: string; label: string }>;
};

/** New inline editor types */
type NewBracket = { id: string; name: string };
type CaptainPick = { id: string; label: string } | null;

/** Club row for inline editor */
type ClubWithCaptain = {
  clubId?: string;
  // single-captain mode only (one per club)
  singleCaptain: CaptainPick;
  singleQuery: string;
  singleOptions: Array<{ id: string; label: string }>;
  club?: CaptainPick;
  clubQuery?: string;
  clubOptions?: Array<{ id: string; label: string }>;
};

/** Stop row (inline editor) with Event Manager typeahead */
type StopEditorRow = {
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

/** Editor state shared across components */
type EditorRow = {
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

  // NEW: Tournament-level Event Manager
  tournamentEventManager: CaptainPick;
  tournamentEventManagerQuery: string;
  tournamentEventManagerOptions: Array<{ id: string; label: string }>;

  // NEW: Tournament Admin
  tournamentAdmin: CaptainPick;
  tournamentAdminQuery: string;
  tournamentAdminOptions: Array<{ id: string; label: string }>;

  // Global club search for chip-based UI
  globalClubQuery: string;
  globalClubOptions: Array<{ id: string; label: string }>;
  editingClubIdx: number | null; // Index of club being edited via chip click

  // Registration Settings
  registrationStatus: 'OPEN' | 'INVITE_ONLY' | 'CLOSED';
  registrationType: 'FREE' | 'PAID';
  registrationCost: string;
  pricingModel: 'TOURNAMENT_WIDE' | 'PER_STOP' | 'PER_BRACKET' | 'PER_STOP_PER_BRACKET';
  maxPlayers: string;
  restrictionNotes: string[];
  isWaitlistEnabled: boolean;
};
type EditorState = Record<Id, EditorRow>;

/* ================= Players response normalizer ================= */
function normalizePlayersResponse(v: unknown): PlayersResponse {
  if (Array.isArray(v)) {
    return { items: v as Player[], total: (v as Player[]).length };
  }
  const obj = (v ?? {}) as any;
  const items: Player[] = Array.isArray(obj.items) ? obj.items : [];
  const total: number = typeof obj.total === 'number' ? obj.total : items.length;
  return { items, total };
}

/* ================= Tournament type label <-> enum ================= */
const LABEL_TO_TYPE: Record<TournamentTypeLabel, string> = {
  'Team Format': 'TEAM_FORMAT',
  'Single Elimination': 'SINGLE_ELIMINATION',
  'Double Elimination': 'DOUBLE_ELIMINATION',
  'Double Elimination Clubs': 'DOUBLE_ELIMINATION_CLUBS',
  'Round Robin': 'ROUND_ROBIN',
  'Pool Play': 'POOL_PLAY',
  'Ladder Tournament': 'LADDER_TOURNAMENT',
};

/* ================= Page ================= */
export default function AdminPage() {
  const { user } = useUser();
  useAppToolbar(null);

  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [editingTournamentId, setEditingTournamentId] = useState<Id | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // clubs
  const [clubsAll, setClubsAll] = useState<Club[]>([]);

  /* ===== Inline editor state ===== */
  const [editorById, setEditorById] = useState<EditorState>({});

  // Load user profile
  const loadUserProfile = useCallback(async () => {
    if (!user) return;

    try {
      const profile = await api<UserProfile>('/api/auth/user');
      setUserProfile(profile);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  }, [user]);



  /* ========== initial load ========== */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { tournaments: ts, clubs: cs } = await fetchInitialData({
          take: 10,
          sort: 'name',
          clubId: '',
          searchTerm: ''
        });
        setTournaments(ts);
        setClubsAll(cs);
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load user profile when component mounts
  useEffect(() => {
    if (user) {
      void loadUserProfile();
    }
  }, [user, loadUserProfile]);


  /* ========== players load/sort/paginate/filter ========== */
  /* ========== clubs load/sort ========== */
  async function reloadClubs(nextSort?: { col: 'name' | 'city' | 'region' | 'country' | 'phone'; dir: 'asc' | 'desc' }) {
    const s = nextSort ?? { col: 'name' as const, dir: 'asc' as const };
    const cs = await api<ClubsResponse>(
      `/api/admin/clubs?sort=${encodeURIComponent(`${s.col}:${s.dir}`)}`
    );
    setClubsAll(cs);
  }
  /* ========== tournaments expand/hydrate ========== */
  async function hydrateEditorFromConfig(tId: Id) {
    try {
      const cfg = await api<{
        id: string;
        name: string;
        type: string; // backend returns label
        maxTeamSize?: number | null;
        gamesPerMatch?: number | null;
        gameSlots?: string[];
        clubs: Array<
          | string
          | {
            clubId: string;
            club?: {
              id: string;
              name: string;
              city?: string | null;
              region?: string | null;
            } | null;
          }
        >;
        levels: Array<{ id: string; name: string; idx: number }>; // brackets
        captainsSimple: Array<{ clubId: string; playerId: string; playerName?: string }>;
        // NEW: tournament-level event manager
        eventManager?: { id: string; name?: string } | null;
        // NEW: tournament admin
        tournamentAdmin?: { id: string; name?: string } | null;
        // NEW: stops can carry their own event manager
        stops: Array<{ id: string; name: string; clubId?: string | null; startAt?: string | null; endAt?: string | null; eventManager?: { id: string; name?: string } | null }>;
        // NEW: registration settings (will be added to backend API)
        registrationStatus?: 'OPEN' | 'INVITE_ONLY' | 'CLOSED';
        registrationType?: 'FREE' | 'PAID';
        registrationCost?: number | null; // in cents
        pricingModel?: 'TOURNAMENT_WIDE' | 'PER_STOP' | 'PER_BRACKET' | 'PER_STOP_PER_BRACKET';
        maxPlayers?: number | null;
        restrictionNotes?: string[];
        isWaitlistEnabled?: boolean;
      }>(`/api/admin/tournaments/${tId}/config`);

      const brackets = (cfg.levels || []).map(l => ({ id: l.id, name: l.name }));

      setEditorById((prev: EditorState) => {
        const hasCaptainsFromConfig = Array.isArray(cfg.captainsSimple) && cfg.captainsSimple.length > 0;
        const clubRows: ClubWithCaptain[] = (cfg.clubs || []).map(entry => {
          const normalizedId = typeof entry === 'string'
            ? entry
            : entry?.clubId;

          if (!normalizedId) {
            return {
              clubId: undefined,
              club: null,
              clubQuery: '',
              clubOptions: [],
              singleCaptain: null,
              singleQuery: '',
              singleOptions: [],
            };
          }

          const clubMeta = typeof entry === 'string' ? null : entry?.club;
          const fallbackClub = clubsAll.find(c => c.id === normalizedId);
          const label = clubMeta
            ? formatClubLabel(clubMeta.name, clubMeta.city, clubMeta.region)
            : fallbackClub
              ? formatClubLabel(fallbackClub.name, fallbackClub.city, fallbackClub.region)
              : undefined;

          const cap = (cfg.captainsSimple || []).find(c => c.clubId === normalizedId) || null;

          return {
            clubId: normalizedId,
            club: label ? { id: normalizedId, label } : null,
            clubQuery: '',
            clubOptions: [],
            singleCaptain: cap ? { id: cap.playerId, label: cap.playerName || '' } : null,
            singleQuery: '',
            singleOptions: [],
          };
        });

        return {
          ...prev,
          [tId]: {
            name: cfg.name,
            type: (cfg.type as any) || 'Team Format',
            hasMultipleStops: (cfg.stops || []).length > 1, // heuristic
            hasBrackets: (cfg.levels || []).length > 0,
            hasCaptains: (cfg.captainsSimple || []).length > 0,
            clubs: clubRows,
            brackets,
            stops: (cfg.stops || []).map(s => {
              const club = s.clubId ? clubsAll.find(c => c.id === s.clubId) : null;
              return {
                id: s.id,
                name: s.name,
                clubId: (s.clubId || undefined) as Id | undefined,
                startAt: toDateInput(s.startAt || null),
                endAt: toDateInput(s.endAt || null),
                eventManager: s.eventManager?.id ? { id: s.eventManager.id, label: s.eventManager.name || '' } : null,
                eventManagerQuery: '',
                eventManagerOptions: [],
                club: club ? { id: club.id, label: `${club.name}${club.city ? ` (${club.city})` : ''}` } : null,
                clubQuery: '',
                clubOptions: [],
              };
            }),
            maxTeamSize: (cfg.maxTeamSize ?? null) !== null ? String(cfg.maxTeamSize) : '',
            gamesPerMatch: (cfg.gamesPerMatch ?? 3),
            gameSlots: (cfg.gameSlots ?? ['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_1', 'MIXED_2']),

            tournamentEventManager: cfg.eventManager?.id ? { id: cfg.eventManager.id, label: cfg.eventManager.name || '' } : null,
            tournamentEventManagerQuery: '',
            tournamentEventManagerOptions: [],

            tournamentAdmin: cfg.tournamentAdmin?.id ? { id: cfg.tournamentAdmin.id, label: cfg.tournamentAdmin.name || '' } : null,
            tournamentAdminQuery: '',
            tournamentAdminOptions: [],

            // Global club search for chip-based UI
            globalClubQuery: '',
            globalClubOptions: [],
            editingClubIdx: null,

            // Registration Settings - Load from API (with defaults if not yet available)
            registrationStatus: cfg.registrationStatus ?? 'CLOSED',
            registrationType: cfg.registrationType ?? 'FREE',
            registrationCost: cfg.registrationCost ? (cfg.registrationCost / 100).toFixed(2) : '',
            pricingModel: (cfg.pricingModel ?? 'TOURNAMENT_WIDE') as 'TOURNAMENT_WIDE' | 'PER_STOP' | 'PER_BRACKET' | 'PER_STOP_PER_BRACKET',
            maxPlayers: cfg.maxPlayers ? String(cfg.maxPlayers) : '',
            restrictionNotes: cfg.restrictionNotes ?? [],
            isWaitlistEnabled: cfg.isWaitlistEnabled ?? true,
          }
        };
      });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function handleCreateTournament(data: { name: string; type: TournamentTypeLabel }) {
    try {
      const typeEnum = LABEL_TO_TYPE[data.type];
      const t = await api<{ id: Id; name: string }>('/api/admin/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name, type: typeEnum }),
      });

      // Reload tournaments
      const ts = await api<TournamentRow[]>('/api/admin/tournaments');
      setTournaments(ts);

      // Load config for the new tournament
      await hydrateEditorFromConfig(t.id);

      // Open editor for new tournament
      setEditingTournamentId(t.id);
      setInfo(`Tournament "${t.name}" created successfully`);
    } catch (e) {
      throw e; // Let modal handle the error
    }
  }

  async function handleEditTournament(tId: Id) {
    // Load config if not already loaded
    if (!editorById[tId]) {
      await hydrateEditorFromConfig(tId);
    }
    setEditingTournamentId(tId);
  }

  async function handleSaveTournament(tId: Id, editor: EditorRow) {
    // Reuse existing save logic from TournamentsBlock
    const payload: any = {
      name: editor.name.trim(),
      type: LABEL_TO_TYPE[editor.type],
    };

    // Participating clubs
    payload.clubs = Array.from(new Set(editor.clubs.map(c => c.clubId).filter(Boolean) as string[]));

    // Max limit (blank => null; else positive integer)
    {
      const mtsRaw = (editor.maxTeamSize ?? '').trim();
      if (mtsRaw === '') {
        payload.maxTeamSize = null;
      } else if (/^\d+$/.test(mtsRaw) && Number(mtsRaw) > 0) {
        payload.maxTeamSize = Number(mtsRaw);
      } else {
        throw new Error((editor.hasBrackets ? 'Max bracket size' : 'Max team size') + ' must be blank or a positive integer.');
      }
    }

    // Brackets (optional, independent of captains)
    if (editor.hasBrackets) {
      payload.levels = editor.brackets
        .map((l, idx) => ({ id: l.id, name: (l.name || '').trim(), idx }))
        .filter(l => !!l.name);
    }

    // Captains: one per club
    if (editor.hasCaptains) {
      const simple: Array<{ clubId: string; playerId: string }> = [];
      for (const crow of editor.clubs) {
        if (!crow.clubId) continue;
        if (crow.singleCaptain?.id) {
          simple.push({ clubId: crow.clubId, playerId: crow.singleCaptain.id });
        }
      }
      payload.captainsSimple = simple;
    } else {
      payload.captainsSimple = [];
    }
    payload.hasCaptains = editor.hasCaptains;

    // Tournament-level Event Manager
    payload.eventManagerId = editor.tournamentEventManager?.id ?? null;

    // Tournament Admin
    payload.tournamentAdminId = editor.tournamentAdmin?.id ?? null;

    // Bracket tournament settings (for Double Elimination, Single Elimination, etc.)
    if (editor.type === 'Double Elimination' || editor.type === 'Double Elimination Clubs' || editor.type === 'Single Elimination') {
      payload.gamesPerMatch = editor.gamesPerMatch;
      payload.gameSlots = editor.gameSlots;
    }

    // Stops (+ per-stop Event Manager)
    if (editor.hasMultipleStops) {
      payload.stops = (editor.stops || [])
        .filter(s => (s.name || '').trim())
        .map(s => ({
          id: s.id,
          name: (s.name || '').trim(),
          clubId: s.clubId || null,
          startAt: s.startAt || null,
          endAt: s.endAt || null,
          eventManagerId: s.eventManager?.id ?? null,
        }));
    } else {
      // Single Details: treat as one stop named "Main"
      const s0 = editor.stops && editor.stops.length ? editor.stops[0] : { name: 'Main', clubId: undefined, startAt: '', endAt: '', eventManager: null as CaptainPick };
      payload.stops = [{
        id: s0.id,
        name: 'Main',
        clubId: s0.clubId || null,
        startAt: s0.startAt || null,
        endAt: s0.endAt || null,
        eventManagerId: s0.eventManager?.id ?? null,
      }];
    }

    // Registration Settings
    payload.registrationStatus = editor.registrationStatus;
    payload.registrationType = editor.registrationType;

    // Pricing Model - save if it exists on editor (for EditorRowWithRegistration)
    const editorWithReg = editor as any;
    if (editorWithReg.pricingModel) {
      payload.pricingModel = editorWithReg.pricingModel;
    }

    // Convert registrationCost from string (e.g., "45.00") to cents (e.g., 4500)
    if (editor.registrationType === 'PAID' && editor.registrationCost) {
      const costFloat = parseFloat(editor.registrationCost);
      if (!isNaN(costFloat)) {
        payload.registrationCost = Math.round(costFloat * 100);
      } else {
        payload.registrationCost = null;
      }
    } else {
      payload.registrationCost = null;
    }
    // Convert maxPlayers from string to number (or null if blank)
    if (editor.maxPlayers && editor.maxPlayers.trim()) {
      payload.maxPlayers = parseInt(editor.maxPlayers, 10);
    } else {
      payload.maxPlayers = null;
    }
    payload.restrictionNotes = editor.restrictionNotes;
    payload.isWaitlistEnabled = editor.isWaitlistEnabled;

    await api(`/api/admin/tournaments/${tId}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Reload tournaments list
    const ts = await api<TournamentRow[]>('/api/admin/tournaments');
    setTournaments(ts);

    // Refresh editor state
    await hydrateEditorFromConfig(tId);

    setInfo('Tournament saved successfully');
  }

  async function deleteTournament(tId: Id) {
    try {
      await api(`/api/admin/tournaments/${tId}`, { method: 'DELETE' });
      const ts = await api<TournamentRow[]>('/api/admin/tournaments');
      setTournaments(ts);
      setInfo('Tournament deleted');

      // Close editor if this tournament was being edited
      if (editingTournamentId === tId) {
        setEditingTournamentId(null);
      }
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  /* ========== Typeahead helpers shared (captains + event managers) ========== */
  const allChosenCaptainIdsAcrossClubs = useMemo(() => {
    const ids = new Set<string>();
    Object.values(editorById).forEach(ed => {
      ed.clubs.forEach(crow => {
        if (crow.singleCaptain?.id) ids.add(crow.singleCaptain.id);
      });
    });
    return ids;
  }, [editorById]);

  async function searchPlayers(term: string) {
    const data = await api<{ items: any[] }>(`/api/admin/players/search?term=${encodeURIComponent(term)}`);
    return (data.items || []).map((p: any) => ({ id: p.id, label: personLabel(p) }));
  }

  const editingTournament = editingTournamentId ? editorById[editingTournamentId] : null;

  return (
    <section className="min-h-screen bg-app py-6">
      <div className="page-container space-y-6">
        {/* Header Card */}
        <header className="card">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-primary">Tournament Setup</h1>
              <p className="text-sm text-muted mt-1">
                Create and configure tournaments, manage stops, clubs, and captains
              </p>
            </div>
            {userProfile && (
              <>
                {(userProfile.isAppAdmin || userProfile.managedClub?.status === 'SUBSCRIBED') ? (
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowCreateModal(true)}
                  >
                    + Create New Tournament
                  </button>
                ) : userProfile.managedClub ? (
                  <a
                    href={`/admin/clubs/${userProfile.managedClub.id}/subscription`}
                    className="btn btn-secondary bg-yellow-500 hover:bg-yellow-600 text-white border-none"
                  >
                    ⚡ Upgrade to Create Tournament
                  </a>
                ) : null}
              </>
            )}
          </div>
        </header>

        {/* Error/Success Messages */}
        {err && (
          <div className="card bg-error/10 border-error/30 p-4" role="status" aria-live="assertive">
            <div className="flex items-center gap-2">
              <span className="text-error font-semibold">Error:</span>
              <span className="text-error">{err}</span>
            </div>
          </div>
        )}

        {info && (
          <div className="card bg-success/10 border-success/30 p-4" role="status" aria-live="polite">
            <div className="flex items-center gap-2">
              <span className="text-success font-semibold">✓</span>
              <span className="text-success">{info}</span>
            </div>
          </div>
        )}

        {/* Tournaments List */}
        {!editingTournamentId && (
          <TournamentsList
            tournaments={tournaments}
            loading={loading}
            onEdit={handleEditTournament}
            onDelete={deleteTournament}
          />
        )}

        {/* Tournament Editor */}
        {editingTournamentId && editingTournament && (
          <TournamentEditor
            tournamentId={editingTournamentId}
            editor={editingTournament}
            setEditor={(updatedEditor) => {
              setEditorById(prev => ({
                ...prev,
                [editingTournamentId]: updatedEditor,
              }));
            }}
            clubsAll={clubsAll}
            searchPlayers={searchPlayers}
            onSave={handleSaveTournament}
            onClose={() => setEditingTournamentId(null)}
            userProfile={userProfile}
          />
        )}

        {/* Create Tournament Modal */}
        <CreateTournamentModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateTournament}
        />
      </div>
    </section>
  );
}

/* ================= Subcomponents ================= */
function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`tab-button ${active ? 'active' : ''}`}
    >
      {children}
    </button>
  );
}

/* ================= Tournaments block: single inline editor ================= */
/* NOTE: TournamentsBlock component removed - obsolete, only tabbed editor is used */

/* ================= Admin Teams Tab & helpers ================= */

type PlayerLite = {
  id: Id;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  gender: 'MALE' | 'FEMALE';
  dupr?: number | null;
  age?: number | null;
};
const labelPL = (p: PlayerLite) => personLabel(p);

type AdminTeamsHydrate = {
  tournamentId: Id;
  tournamentName: string;
  maxTeamSize: number | null; // cap per bracket (unique across all stops)
  hasCaptains: boolean;
  stops: Array<{ stopId: Id; stopName: string; locationName: string | null; startAt: string | null; endAt: string | null }>;
  clubs: Array<{
    clubId: Id;
    clubName: string;
    brackets: Array<{
      teamId: Id;
      bracketName: string | null;
      roster: PlayerLite[];
      stops: Array<{ stopId: Id; stopName: string; locationName: string | null; startAt: string | null; endAt: string | null; stopRoster: PlayerLite[] }>;
    }>;
  }>;
};

function AdminTeamsTab({ tournaments, onEligibilityChange }: { tournaments: TournamentRow[]; onEligibilityChange: (hasEligible: boolean) => void }) {
  const [activeTid, setActiveTid] = useState<Id | '">NONE<' | null>(null);
  const [dataByTid, setDataByTid] = useState<Record<Id, AdminTeamsHydrate>>({});
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // First eligible tournament without captains
  useEffect(() => {
    (async () => {
      if (!tournaments?.length) return;
      for (const t of tournaments) {
        try {
          const d = await api<AdminTeamsHydrate>(`/api/admin/tournaments/${t.id}/teams`);
          setDataByTid((prev: Record<Id, AdminTeamsHydrate>) => ({ ...prev, [t.id]: d }));
          if (!d.hasCaptains && activeTid === null) {
            setActiveTid(t.id);
            return;
          }
        } catch { /* ignore individual errors */ }
      }
      if (activeTid === null) setActiveTid('">NONE<');
    })();
  }, [tournaments, activeTid]);

  async function loadTid(tid: Id) {
    try {
      setErr(null);
      const d = await api<AdminTeamsHydrate>(`/api/admin/tournaments/${tid}/teams`);
      setDataByTid((prev: Record<Id, AdminTeamsHydrate>) => ({ ...prev, [tid]: d }));
      setActiveTid(tid);
    } catch (e) { setErr((e as Error).message); }
  }

  const eligible = useMemo(() => {
    const arr: Array<{ id: Id; name: string; hasCaptains: boolean }> = [];
    for (const t of tournaments) {
      const d = dataByTid[t.id];
      if (!d) continue;
      arr.push({ id: t.id, name: t.name, hasCaptains: !!d.hasCaptains });
    }
    return arr.filter(x => !x.hasCaptains);
  }, [tournaments, dataByTid]);

  useEffect(() => {
    onEligibilityChange(eligible.length > 0);
  }, [eligible.length, onEligibilityChange]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700">Tournament</label>
          <select
            className="border rounded px-2 py-1"
            value={typeof activeTid === 'string' ? (activeTid as string) : ''}
            onChange={(e) => loadTid(e.target.value as Id)}
          >
            {!eligible.length && <option value={'">NONE<'}>— none —</option>}
            {eligible.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      {err && <div className="border border-red-300 bg-red-50 text-red-700 p-2 rounded">{err}</div>}
      {info && <div className="border border-green-300 bg-green-50 text-green-700 p-2 rounded">{info}</div>}

      {!eligible.length && (
        <p className="text-sm text-gray-600">
          No tournaments without Captains were found. Disable Captains for a tournament in the "Tournaments" tab to manage rosters here.
        </p>
      )}

      {eligible.length > 0 && activeTid && activeTid !== '">NONE<' && dataByTid[activeTid] && (
        <AdminTeamsTournamentPanel
          hydrate={dataByTid[activeTid]}
          onSaved={() => setInfo('Saved!')}
          onError={(m) => setErr(m)}
        />
      )}
    </section>
  );
}

function AdminTeamsTournamentPanel({ hydrate, onSaved, onError }: {
  hydrate: AdminTeamsHydrate;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [openClubIds, setOpenClubIds] = useState<Set<Id>>(new Set());

  function toggleClub(id: Id) {
    setOpenClubIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-600">
        Bracket cap: <span className="font-semibold">{hydrate.maxTeamSize ?? '— (no cap set)'}</span> unique players <em>per bracket across all stops</em>.
      </div>

      <div className="divide-y border rounded">
        {hydrate.clubs.map((c) => (
          <div key={c.clubId}>
            <button
              className="w-full text-left px-3 py-2 flex items-center justify-between"
              onClick={() => toggleClub(c.clubId)}
            >
              <span className="font-medium">{c.clubName}</span>
              <span className="text-sm text-gray-500">{openClubIds.has(c.clubId) ? '▾' : '▸'}</span>
            </button>

            {openClubIds.has(c.clubId) && (
              <div className="p-3 bg-gray-50">
                <AdminClubRosterEditor
                  tournamentId={hydrate.tournamentId}
                  tournamentName={hydrate.tournamentName}
                  stops={hydrate.stops}
                  brackets={c.brackets}
                  maxTeamSize={hydrate.maxTeamSize ?? null}
                  onSaved={onSaved}
                  onError={onError}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* Per-Club editor: renders Stop blocks with Bracket roster editors */

function AdminClubRosterEditor(props: {
  tournamentId: Id;
  tournamentName: string;
  stops: Array<{ stopId: Id; stopName: string; locationName: string | null; startAt: string | null; endAt: string | null }>;
  brackets: Array<{ teamId: Id; bracketName: string | null; roster: PlayerLite[]; stops: Array<{ stopId: Id; stopRoster: PlayerLite[] }> }>;
  maxTeamSize: number | null;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const { tournamentId, stops, brackets, maxTeamSize, onSaved, onError } = props;

  // rosters[stopId][teamId] = PlayerLite[]
  const [rosters, setRosters] = useState<Record<string, Record<string, PlayerLite[]>>>({});

  useEffect(() => {
    const seed: Record<string, Record<string, PlayerLite[]>> = {};
    for (const s of stops) {
      seed[s.stopId] = {};
      for (const b of brackets) {
        const apiStop = b.stops.find(x => x.stopId === s.stopId);
        seed[s.stopId][b.teamId] = (apiStop?.stopRoster ?? []).slice();
      }
    }
    setRosters(seed);
  }, [stops, brackets]);

  function setStopTeamRoster(stopId: Id, teamId: Id, next: PlayerLite[]) {
    setRosters(prev => ({ ...prev, [stopId]: { ...(prev[stopId] ?? {}), [teamId]: next } }));
  }

  async function saveAll() {
    try {
      for (const s of stops) {
        for (const b of brackets) {
          const list = rosters[s.stopId]?.[b.teamId] ?? [];
          const res = await fetch(`/api/captain/team/${b.teamId}/stops/${s.stopId}/roster`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerIds: list.map(p => p.id), limit: maxTeamSize ?? undefined }),
          });
          const j = await res.json();
          if (!res.ok || j?.error) throw new Error(j?.error ?? 'Save failed');
        }
      }
      onSaved();
    } catch (e) {
      onError((e as Error).message);
    }
  }

  const bracketOrder = brackets
    .map(b => ({ teamId: b.teamId, name: (b.bracketName ?? 'General') }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const hasMultipleStops = stops.length > 1;

  return (
    <div className="space-y-4">

      {stops.map((s, idx) => {
        const prev = idx > 0 ? stops[idx - 1] : null;
        const copyFromPrev = () => {
          if (!prev) return;
          const snapshot = rosters[prev.stopId] || {};
          const nextForCurr: Record<string, PlayerLite[]> = {};
          for (const b of brackets) nextForCurr[b.teamId] = (snapshot[b.teamId] ?? []).slice();
          setRosters(prevAll => ({ ...prevAll, [s.stopId]: nextForCurr }));
        };

        const stopRosters = rosters[s.stopId] ?? {};
        const excludeIdsAcrossStop = Object.values(stopRosters).flat().map(p => p.id);

        return (
          <div key={s.stopId} className="border rounded p-4 space-y-4 bg-surface-1">
            <div className="flex justify-between items-center">
              <div className="font-medium">
                {(() => {
                  const title = stopTitleForDisplay({ stopName: s.stopName, hasMultipleStops });
                  return title
                    ? (<>{title}<span className="text-gray-500"> • {s.locationName ?? '—'} • {between(s.startAt, s.endAt)}</span></>)
                    : (<span className="text-gray-500">{s.locationName ?? '—'} • {between(s.startAt, s.endAt)}</span>);
                })()}
              </div>
              {prev && (
                <button className="px-2 py-1 border rounded text-sm" onClick={copyFromPrev}>
                  Copy from previous stop
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bracketOrder.map(({ teamId, name }) => {
                const list = rosters[s.stopId]?.[teamId] ?? [];
                return (
                  <AdminBracketRosterEditor
                    key={teamId}
                    title={name}
                    tournamentId={tournamentId}
                    teamId={teamId}
                    stopId={s.stopId}
                    list={list}
                    onChange={(next) => setStopTeamRoster(s.stopId, teamId, next)}
                    excludeIdsAcrossStop={excludeIdsAcrossStop}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="pt-2">
        <button className="px-3 py-1 rounded bg-blue-600 text-white" onClick={saveAll}>Save All</button>
      </div>
    </div>
  );
}

/* Per-bracket editor (typeahead + list) – same search UX as Captain */

function AdminBracketRosterEditor({
  title,
  tournamentId,
  teamId,
  stopId,
  list,
  onChange,
  excludeIdsAcrossStop,
}: {
  title: string;
  tournamentId: Id;
  teamId: Id;
  stopId: Id;
  list: PlayerLite[];
  onChange: (next: PlayerLite[]) => void;
  excludeIdsAcrossStop: string[];
}) {
  const [term, setTerm] = useState('');
  const [options, setOptions] = useState<PlayerLite[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  function add(p: PlayerLite) {
    if (list.some((x) => x.id === p.id)) return;
    if (excludeIdsAcrossStop.includes(p.id)) return;
    onChange([...list, p]);
  }
  function remove(id: string) {
    onChange(list.filter((p) => p.id !== id));
  }

  useEffect(() => {
    if (term.trim().length < 3) {
      setOptions([]); setOpen(false); return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const url = new URL('/api/admin/players/search', window.location.origin);
        url.searchParams.set('term', term.trim());
        url.searchParams.set('tournamentId', String(tournamentId));
        url.searchParams.set('teamId', String(teamId));
        url.searchParams.set('stopId', String(stopId));
        if (excludeIdsAcrossStop.length) url.searchParams.set('excludeIds', excludeIdsAcrossStop.join(','));
        const res = await fetch(url.toString());
        const j = await res.json();
        const items: PlayerLite[] = (j.items ?? j.data?.items ?? []).map((p: any) => ({
          id: p.id, firstName: p.firstName, lastName: p.lastName, name: p.name, gender: p.gender,
          dupr: (p.dupr ?? null) as number | null, age: (p.age ?? null) as number | null,
        }));
        if (!cancelled) { setOptions(items); setOpen(true); }
      } catch {
        if (!cancelled) { setOptions([]); setOpen(false); }
      } finally { if (!cancelled) setLoading(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [term, tournamentId, teamId, stopId, excludeIdsAcrossStop]);

  return (
    <div className="border rounded p-3 space-y-2 bg-white">
      <div className="font-medium">{title}</div>

      <div className="relative">
        <input
          className="w-full rounded px-2 py-2 border"
          placeholder="Type at least 3 characters to search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onFocus={() => { if (options.length) setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
        />
        {open && options.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full bg-white rounded shadow">
            {options.map((opt) => (
              <li
                key={opt.id}
                className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { add(opt); setTerm(''); setOptions([]); setOpen(false); }}
              >
                {labelPL(opt)}{' '}
                <span className="text-gray-500">• {opt.gender} • {opt.dupr ?? '—'} • {opt.age ?? '—'}</span>
              </li>
            ))}
            {loading && <li className="px-3 py-2 text-sm text-gray-500">Searching…</li>}
          </ul>
        )}
      </div>

      <ul className="space-y-1">
        {list.map((p) => (
          <li key={p.id} className="flex items-center justify-between">
            <span className="text-sm">
              {labelPL(p)} <span className="text-gray-500">• {p.gender} • {p.dupr ?? '—'} • {p.age ?? '—'}</span>
            </span>
            <button className="text-gray-500 hover:text-red-600 text-sm" title="Remove" onClick={() => remove(p.id)}>🗑️</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

type PlayerListConfig = {
  take: number;
  skip: number;
  sort: string;
  clubId: string;
  searchTerm: string;
};

async function fetchPlayers(config: PlayerListConfig): Promise<PlayersResponse> {
  const term = config.searchTerm.trim();
  const query = new URLSearchParams({
    take: String(config.take),
    skip: String(config.skip),
    sort: config.sort,
  });
  if (config.clubId) query.set('clubId', config.clubId);
  if (term) query.set('search', term);
  const result = await api<PlayersResponse | Player[]>(`/api/admin/players?${query.toString()}`);
  return normalizePlayersResponse(result);
}

async function fetchInitialData(params: {
  take: number;
  sort: string;
  clubId: string;
  searchTerm: string;
}): Promise<{ tournaments: TournamentRow[]; clubs: ClubsResponse; players: PlayersResponse }> {
  const [tournaments, clubs, players] = await Promise.all([
    api<TournamentRow[]>('/api/admin/tournaments'),
    api<ClubsResponse>('/api/admin/clubs?sort=name:asc'),
    fetchPlayers({
      take: params.take,
      skip: 0,
      sort: params.sort,
      clubId: params.clubId,
      searchTerm: params.searchTerm,
    }),
  ]);
  return { tournaments, clubs, players };
}

async function fetchClubs(sort: { col: 'name' | 'city' | 'region' | 'country' | 'phone'; dir: 'asc' | 'desc' }): Promise<ClubsResponse> {
  return api<ClubsResponse>(`/api/admin/clubs?sort=${encodeURIComponent(`${sort.col}:${sort.dir}`)}`);
}


async function searchPlayersForSelect(term: string): Promise<Array<{ id: string; label: string }>> {
  const data = await api<{ items: PlayerLite[] }>(`/api/admin/players/search?term=${encodeURIComponent(term)}`);
  return (data.items || []).map((player) => ({ id: player.id, label: personLabel(player) }));
}
