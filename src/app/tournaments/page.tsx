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

  // NEW: Tournament-level Event Manager
  tournamentEventManager: CaptainPick;
  tournamentEventManagerQuery: string;
  tournamentEventManagerOptions: Array<{ id: string; label: string }>;

  // NEW: Tournament Admin
  tournamentAdmin: CaptainPick;
  tournamentAdminQuery: string;
  tournamentAdminOptions: Array<{ id: string; label: string }>;
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
type TournamentTypeLabel =
  | 'Team Format'
  | 'Single Elimination'
  | 'Double Elimination'
  | 'Round Robin'
  | 'Pool Play'
  | 'Ladder Tournament';

const LABEL_TO_TYPE: Record<TournamentTypeLabel, string> = {
  'Team Format': 'TEAM_FORMAT',
  'Single Elimination': 'SINGLE_ELIMINATION',
  'Double Elimination': 'DOUBLE_ELIMINATION',
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

  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [expanded, setExpanded] = useState<Record<Id, boolean>>({});
  

  // active tab

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

            tournamentEventManager: cfg.eventManager?.id ? { id: cfg.eventManager.id, label: cfg.eventManager.name || '' } : null,
            tournamentEventManagerQuery: '',
            tournamentEventManagerOptions: [],

            tournamentAdmin: cfg.tournamentAdmin?.id ? { id: cfg.tournamentAdmin.id, label: cfg.tournamentAdmin.name || '' } : null,
            tournamentAdminQuery: '',
            tournamentAdminOptions: [],
          }
        };
      });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  function toggleExpand(tId: Id) {
    setExpanded((prev: Record<Id, boolean>) => {
      const opening = !prev[tId];
      if (opening && !editorById[tId]) {
        hydrateEditorFromConfig(tId);
      }
      return { ...prev, [tId]: opening };
    });
  }

  async function deleteTournament(tId: Id) {
    try {
      if (!confirm('Delete this tournament?')) return;
      await api(`/api/admin/tournaments/${tId}`, { method: 'DELETE' });
      const ts = await api<TournamentRow[]>('/api/admin/tournaments');
      setTournaments(ts);
      setInfo('Tournament deleted');
    } catch (e) { setErr((e as Error).message); }
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
  useAppToolbar(null);

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Tournaments</h1>
        <p className="text-muted">
          Configure tournament stops, rosters, and scheduling.
        </p>
        </div>

        {err && (
        <div role="status" aria-live="assertive" aria-atomic="true" className="error-message">
            {err}
          </div>
        )}

        {info && (
        <div role="status" aria-live="polite" aria-atomic="true" className="success-message">
            {info}
          </div>
        )}

        <TournamentsBlock
          tournaments={tournaments}
          expanded={expanded}
          toggleExpand={toggleExpand}
          clubsAll={clubsAll}
          onDeleteTournament={deleteTournament}
          editorById={editorById}
          setEditorById={setEditorById}
          searchPlayers={searchPlayers}
          allChosenCaptainIdsAcrossClubs={allChosenCaptainIdsAcrossClubs}
          afterSaved={async () => {
            const ts = await api<TournamentRow[]>('/api/admin/tournaments');
            setTournaments(ts);
          }}
          userProfile={userProfile}
        />

      {/* Team roster tools moved to /admin/rosters */}
        </section>
  );
}

/* ================= Subcomponents ================= */
function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
function TabButton({ active, onClick, children }: { active: boolean; onClick: ()=>void; children: ReactNode }) {
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
type TournamentsBlockProps = {
  tournaments: TournamentRow[];
  expanded: Record<Id, boolean>;
  toggleExpand: (tId: Id) => void;
  clubsAll: Club[];
  onDeleteTournament: (tId: Id) => void;

  editorById: EditorState;
  setEditorById: React.Dispatch<React.SetStateAction<EditorState>>;
  searchPlayers: (term: string)=>Promise<Array<{id:string;label:string}>>;
  allChosenCaptainIdsAcrossClubs: Set<string>;
  afterSaved: () => Promise<void>;
  userProfile: UserProfile | null;
};

function TournamentsBlock(props: TournamentsBlockProps) {
  const {
    tournaments, expanded, toggleExpand, clubsAll,
    onDeleteTournament,
    editorById, setEditorById, searchPlayers, allChosenCaptainIdsAcrossClubs,
    afterSaved,
  } = props;

  // Debounce timers:
  // - captain single picker: `${tId}:${clubIdx}:__single`
  // - tournament event mgr:  `${tId}:__eventmgr`
  // - stop event mgr:        `${tId}:${stopIdx}:__stopmgr`
  const searchTimers = useRef<Record<string, number>>({});
  const singleKeyFor = (tId: Id, clubIdx: number) => `${tId}:${clubIdx}:__single`;
  const tMgrKeyFor = (tId: Id) => `${tId}:__eventmgr`;
  const stopMgrKeyFor = (tId: Id, stopIdx: number) => `${tId}:${stopIdx}:__stopmgr`;

  function editor(tId: Id) { return editorById[tId]; }

  /* ----- Generate Schedule modal state ----- */
  const [genOpen, setGenOpen] = useState(false);
  const [genData, setGenData] = useState<{
    stopId: Id;
    stopName: string;
    bracketId: string | 'ALL' | null;
    bracketChoices: Array<{ id: string; name: string }>;
    overwrite: boolean;
    slotMap: Record<GameSlotLiteral, boolean>;
  } | null>(null);

  function openGenerateModal(stopId: Id, stopName: string, bracketChoices: Array<{ id: string; name: string }>) {
    const slotMap = SLOT_OPTIONS.reduce((m, s) => { m[s.key] = true; return m; }, {} as Record<GameSlotLiteral, boolean>);
    setGenData({ stopId, stopName, bracketId: 'ALL', bracketChoices, overwrite: false, slotMap });
    setGenOpen(true);
  }
  async function submitGenerate() {
    if (!genData) return;
    /* legacy schedule generator intentionally left untouched */
  }

  /* ----- View Schedule modal state ----- */
  type ScheduleMatch = { id: Id; slot: GameSlotLiteral; teamAScore: number | null; teamBScore: number | null };
  type ScheduleGame = { id: Id; isBye: boolean; teamA: { id: Id; name: string } | null; teamB: { id: Id; name: string } | null; matches: ScheduleMatch[] };
  type ScheduleRound = { id: Id; idx: number; games: ScheduleGame[] };

  const [schedOpen, setSchedOpen] = useState(false);
  const [schedStop, setSchedStop] = useState<{ stopId: Id; stopName: string } | null>(null);
  const [schedRounds, setSchedRounds] = useState<ScheduleRound[]>([]);

  async function openSchedule(stopId: Id, stopName: string) {
    try {
      const rounds = await api<ScheduleRound[]>(`/api/admin/stops/${stopId}/schedule`);
      setSchedRounds(rounds ?? []);
      setSchedStop({ stopId, stopName });
      setSchedOpen(true);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  /* ----- Clubs list helpers ----- */
  function addClubRow(tId: Id) {
    setEditorById((prev: EditorState) => {
      const ed = prev[tId]; if (!ed) return prev;
      return {
        ...prev,
        [tId]: {
          ...ed,
          clubs: [...ed.clubs, {
            clubId: undefined,
            singleCaptain: null, singleQuery: '', singleOptions: [],
            club: null, clubQuery: '', clubOptions: [],
          }],
        }
      };
    });
  }
  function removeClubRow(tId: Id, idx: number) {
    setEditorById((prev: EditorState) => {
      const ed = prev[tId]; if (!ed) return prev;
      const next = [...ed.clubs];
      next.splice(idx, 1);
      return { ...prev, [tId]: { ...ed, clubs: next } };
    });
  }
  function availableClubsForRow(tId: Id, idx: number) {
    const ed = editor(tId);
    const chosen = new Set(ed?.clubs.map(c => c.clubId).filter(Boolean) as string[]);
    const current = ed?.clubs[idx]?.clubId;
    return clubsAll.filter(c => !chosen.has(c.id) || c.id === current);
  }

  /* ----- Brackets helpers ----- */
  function addBracket(tId: Id) {
    setEditorById((prev: EditorState) => {
      const ed = prev[tId]; if (!ed) return prev;
      const id = (globalThis.crypto ?? window.crypto).randomUUID();
      return { ...prev, [tId]: { ...ed, brackets: [...ed.brackets, { id, name: '' }] } };
    });
  }
  function removeBracket(tId: Id, bracketId: string) {
    setEditorById((prev: EditorState) => {
      const ed = prev[tId]; if (!ed) return prev;
      const nextBrackets = ed.brackets.filter(l => l.id !== bracketId);
      return { ...prev, [tId]: { ...ed, brackets: nextBrackets } };
    });
  }

  /* ----- Captain single picker (per club) ----- */
  function setSingleCaptainQuery(tId: Id, clubIdx: number, q: string) {
    setEditorById((prev: EditorState) => {
      const ed = prev[tId]; if (!ed) return prev;
      const rows = [...ed.clubs];
      const row = { ...rows[clubIdx] };
      row.singleQuery = q;
      row.singleOptions = [];
      rows[clubIdx] = row;
      return { ...prev, [tId]: { ...ed, clubs: rows } };
    });

    const k = singleKeyFor(tId, clubIdx);
    if (searchTimers.current[k]) clearTimeout(searchTimers.current[k]);
    searchTimers.current[k] = window.setTimeout(() => runSingleCaptainSearch(tId, clubIdx), 300);
  }

  async function runSingleCaptainSearch(tId: Id, clubIdx: number) {
    const ed = editor(tId); if (!ed) return;
    const q = ed.clubs[clubIdx]?.singleQuery || '';
    if (q.trim().length < 3) return;
    const opts = await (searchPlayers(q.trim()));
    // exclude players chosen elsewhere
    const selectedElsewhere = new Set<string>();
    ed.clubs.forEach((crow, idx) => {
      if (idx === clubIdx) return;
      if (crow.singleCaptain?.id) selectedElsewhere.add(crow.singleCaptain.id);
    });
    const filtered = opts.filter(o => !selectedElsewhere.has(o.id));
    setEditorById((prev: EditorState) => {
      const ed2 = prev[tId]; if (!ed2) return prev;
      const rows = [...ed2.clubs];
      const row = { ...rows[clubIdx] };
      row.singleOptions = filtered;
      rows[clubIdx] = row;
      return { ...prev, [tId]: { ...ed2, clubs: rows } };
    });
  }

  function chooseSingleCaptain(tId: Id, clubIdx: number, pick: { id: string; label: string }) {
    setEditorById((prev: EditorState) => {
      const ed = prev[tId]; if (!ed) return prev;
      const rows = [...ed.clubs];
      const row = { ...rows[clubIdx] };
      row.singleCaptain = pick;
      row.singleQuery = '';
      row.singleOptions = [];
      rows[clubIdx] = row;
      return { ...prev, [tId]: { ...ed, clubs: rows } };
    });
  }
  function removeSingleCaptain(tId: Id, clubIdx: number) {
    setEditorById((prev: EditorState) => {
      const ed = prev[tId]; if (!ed) return prev;
      const rows = [...ed.clubs];
      const row = { ...rows[clubIdx] };
      row.singleCaptain = null;
      row.singleQuery = '';
      row.singleOptions = [];
      rows[clubIdx] = row;
      return { ...prev, [tId]: { ...ed, clubs: rows } };
    });
  }

  /* ----- Event Manager pickers (tournament-level + per-stop) ----- */

  // Tournament-level
  function setTournamentEventMgrQuery(tId: Id, q: string) {
    setEditorById(prev => {
      const ed = prev[tId]; if (!ed) return prev;
      return { ...prev, [tId]: { ...ed, tournamentEventManagerQuery: q, tournamentEventManagerOptions: [] } };
    });
    const k = tMgrKeyFor(tId);
    if (searchTimers.current[k]) clearTimeout(searchTimers.current[k]);
    searchTimers.current[k] = window.setTimeout(() => runTournamentEventMgrSearch(tId), 300);
  }
  async function runTournamentEventMgrSearch(tId: Id) {
    const ed = editor(tId); if (!ed) return;
    const q = (ed.tournamentEventManagerQuery || '').trim();
    if (q.length < 3) return;
    const opts = await (props.searchPlayers(q));
    setEditorById(prev => {
      const e2 = prev[tId]; if (!e2) return prev;
      return { ...prev, [tId]: { ...e2, tournamentEventManagerOptions: opts } };
    });
  }
  function chooseTournamentEventMgr(tId: Id, pick: { id: string; label: string }) {
    setEditorById(prev => {
      const ed = prev[tId]; if (!ed) return prev;
      return {
        ...prev,
        [tId]: {
          ...ed,
          tournamentEventManager: pick,
          tournamentEventManagerQuery: '',
          tournamentEventManagerOptions: [],
        }
      };
    });
  }
  function removeTournamentEventMgr(tId: Id) {
    setEditorById(prev => {
      const ed = prev[tId]; if (!ed) return prev;
      return {
        ...prev,
        [tId]: { ...ed, tournamentEventManager: null, tournamentEventManagerQuery: '', tournamentEventManagerOptions: [] }
      };
    });
  }

  // Tournament Admin
  function setTournamentAdminQuery(tId: Id, q: string) {
    setEditorById(prev => {
      const ed = prev[tId]; if (!ed) return prev;
      return { ...prev, [tId]: { ...ed, tournamentAdminQuery: q, tournamentAdminOptions: [] } };
    });
    const k = `tAdmin-${tId}`;
    if (searchTimers.current[k]) clearTimeout(searchTimers.current[k]);
    searchTimers.current[k] = window.setTimeout(() => runTournamentAdminSearch(tId), 300);
  }
  async function runTournamentAdminSearch(tId: Id) {
    const ed = editor(tId); if (!ed) return;
    const q = (ed.tournamentAdminQuery || '').trim();
    if (q.length < 3) return;
    const opts = await (props.searchPlayers(q));
    setEditorById(prev => {
      const e2 = prev[tId]; if (!e2) return prev;
      return { ...prev, [tId]: { ...e2, tournamentAdminOptions: opts } };
    });
  }
  function chooseTournamentAdmin(tId: Id, pick: { id: string; label: string }) {
    setEditorById(prev => {
      const ed = prev[tId]; if (!ed) return prev;
      return {
        ...prev,
        [tId]: {
          ...ed,
          tournamentAdmin: pick,
          tournamentAdminQuery: '',
          tournamentAdminOptions: [],
        }
      };
    });
  }
  function removeTournamentAdmin(tId: Id) {
    setEditorById(prev => {
      const ed = prev[tId]; if (!ed) return prev;
      return {
        ...prev,
        [tId]: { ...ed, tournamentAdmin: null, tournamentAdminQuery: '', tournamentAdminOptions: [] }
      };
    });
  }

  // Stop-level
  function setStopEventMgrQuery(tId: Id, stopIdx: number, q: string) {
    setEditorById(prev => {
      const ed = prev[tId]; if (!ed) return prev;
      const nextStops = [...(ed.stops || [])];
      const row = { ...(nextStops[stopIdx] || { name: '' }) };
      row.eventManagerQuery = q;
      row.eventManagerOptions = [];
      nextStops[stopIdx] = row;
      return { ...prev, [tId]: { ...ed, stops: nextStops } };
    });
    const k = stopMgrKeyFor(tId, stopIdx);
    if (searchTimers.current[k]) clearTimeout(searchTimers.current[k]);
    searchTimers.current[k] = window.setTimeout(() => runStopEventMgrSearch(tId, stopIdx), 300);
  }
  async function runStopEventMgrSearch(tId: Id, stopIdx: number) {
    const ed = editor(tId); if (!ed) return;
    const q = (ed.stops?.[stopIdx]?.eventManagerQuery || '').trim();
    if (q.length < 3) return;
    const opts = await (props.searchPlayers(q));
    setEditorById(prev => {
      const ed2 = prev[tId]; if (!ed2) return prev;
      const nextStops = [...(ed2.stops || [])];
      const row = { ...(nextStops[stopIdx] || { name: '' }) };
      row.eventManagerOptions = opts;
      nextStops[stopIdx] = row;
      return { ...prev, [tId]: { ...ed2, stops: nextStops } };
    });
  }
  function chooseStopEventMgr(tId: Id, stopIdx: number, pick: { id: string; label: string }) {
    setEditorById(prev => {
      const ed = prev[tId]; if (!ed) return prev;
      const nextStops = [...(ed.stops || [])];
      const row = { ...(nextStops[stopIdx] || { name: '' }) };
      row.eventManager = pick;
      row.eventManagerQuery = '';
      row.eventManagerOptions = [];
      nextStops[stopIdx] = row;
      return { ...prev, [tId]: { ...ed, stops: nextStops } };
    });
  }
  function removeStopEventMgr(tId: Id, stopIdx: number) {
    setEditorById(prev => {
      const ed = prev[tId]; if (!ed) return prev;
      const nextStops = [...(ed.stops || [])];
      const row = { ...(nextStops[stopIdx] || { name: '' }) };
      row.eventManager = null;
      row.eventManagerQuery = '';
      row.eventManagerOptions = [];
      nextStops[stopIdx] = row;
      return { ...prev, [tId]: { ...ed, stops: nextStops } };
    });
  }

  // Club search functions for stops
  async function runStopClubSearch(tId: Id, stopIdx: number) {
    const ed = editor(tId); if (!ed) return;
    const q = (ed.stops?.[stopIdx]?.clubQuery || '').trim();
    if (q.length < 3) {
      setEditorById(prev => {
        const ed2 = prev[tId]; if (!ed2) return prev;
        const nextStops = [...(ed2.stops || [])];
        if (nextStops[stopIdx]) nextStops[stopIdx] = { ...nextStops[stopIdx], clubOptions: [] };
        return { ...prev, [tId]: { ...ed2, stops: nextStops } };
      });
      return;
    }
    const clubs = await api<ClubsResponse>(`/api/admin/clubs?sort=name:asc&q=${encodeURIComponent(q)}`);
    setEditorById(prev => {
      const ed2 = prev[tId]; if (!ed2) return prev;
      const nextStops = [...(ed2.stops || [])];
      if (nextStops[stopIdx]) nextStops[stopIdx] = { ...nextStops[stopIdx], clubOptions: clubs.map(c => ({ id: c.id, label: `${c.name}${c.city ? ` (${c.city})` : ''}` })) };
      return { ...prev, [tId]: { ...ed2, stops: nextStops } };
    });
  }
  function setStopClubQuery(tId: Id, stopIdx: number, q: string) {
    setEditorById(prev => {
      const ed = prev[tId]; if (!ed) return prev;
      const nextStops = [...(ed.stops || [])];
      if (nextStops[stopIdx]) nextStops[stopIdx] = { ...nextStops[stopIdx], clubQuery: q };
      return { ...prev, [tId]: { ...ed, stops: nextStops } };
    });
    const k = `stop-club-${tId}-${stopIdx}`;
    if (searchTimers.current[k]) clearTimeout(searchTimers.current[k]);
    searchTimers.current[k] = window.setTimeout(() => runStopClubSearch(tId, stopIdx), 300);
  }
  function chooseStopClub(tId: Id, stopIdx: number, club: CaptainPick) {
    setEditorById(prev => {
      const ed = prev[tId]; if (!ed) return prev;
      const nextStops = [...(ed.stops || [])];
      if (nextStops[stopIdx]) nextStops[stopIdx] = { ...nextStops[stopIdx], club, clubId: club?.id, clubQuery: '', clubOptions: [] };
      return { ...prev, [tId]: { ...ed, stops: nextStops } };
    });
  }
  function removeStopClub(tId: Id, stopIdx: number) {
    setEditorById(prev => {
      const ed = prev[tId]; if (!ed) return prev;
      const nextStops = [...(ed.stops || [])];
      if (nextStops[stopIdx]) nextStops[stopIdx] = { ...nextStops[stopIdx], club: null, clubId: undefined, clubQuery: '', clubOptions: [] };
      return { ...prev, [tId]: { ...ed, stops: nextStops } };
    });
  }

  // Club search functions for participating clubs
  async function runClubSearch(tId: Id, clubIdx: number) {
    const ed = editor(tId); if (!ed) return;
    const q = (ed.clubs?.[clubIdx]?.clubQuery || '').trim();
    if (q.length < 3) {
      setEditorById(prev => {
        const ed2 = prev[tId]; if (!ed2) return prev;
        const nextClubs = [...(ed2.clubs || [])];
        if (nextClubs[clubIdx]) nextClubs[clubIdx] = { ...nextClubs[clubIdx], clubOptions: [] };
        return { ...prev, [tId]: { ...ed2, clubs: nextClubs } };
      });
      return;
    }
    const clubs = await api<ClubsResponse>(`/api/admin/clubs?sort=name:asc&q=${encodeURIComponent(q)}`);
    
    // Get already selected club IDs for this tournament (excluding the current club being edited)
    const selectedClubIds = new Set(
      (ed.clubs || [])
        .map((c, idx) => idx !== clubIdx ? c.clubId : null)
        .filter(Boolean)
    );
    
    // Filter out already selected clubs
    const availableClubs = clubs.filter(c => !selectedClubIds.has(c.id));
    
    setEditorById(prev => {
      const ed2 = prev[tId]; if (!ed2) return prev;
      const nextClubs = [...(ed2.clubs || [])];
      if (nextClubs[clubIdx]) nextClubs[clubIdx] = { ...nextClubs[clubIdx], clubOptions: availableClubs.map(c => ({ id: c.id, label: `${c.name}${c.city ? ` (${c.city})` : ''}` })) };
      return { ...prev, [tId]: { ...ed2, clubs: nextClubs } };
    });
  }
  function setClubQuery(tId: Id, clubIdx: number, q: string) {
    setEditorById(prev => {
      const ed = prev[tId]; if (!ed) return prev;
      const nextClubs = [...(ed.clubs || [])];
      if (nextClubs[clubIdx]) nextClubs[clubIdx] = { ...nextClubs[clubIdx], clubQuery: q };
      return { ...prev, [tId]: { ...ed, clubs: nextClubs } };
    });
    const k = `club-${tId}-${clubIdx}`;
    if (searchTimers.current[k]) clearTimeout(searchTimers.current[k]);
    searchTimers.current[k] = window.setTimeout(() => runClubSearch(tId, clubIdx), 300);
  }
  function chooseClub(tId: Id, clubIdx: number, club: CaptainPick) {
    setEditorById(prev => {
      const ed = prev[tId]; if (!ed) return prev;
      const nextClubs = [...(ed.clubs || [])];
      if (nextClubs[clubIdx]) nextClubs[clubIdx] = {
        ...nextClubs[clubIdx],
        club,
        clubId: club?.id,
        clubQuery: '',
        clubOptions: [],
        singleCaptain: null,
        singleQuery: '',
        singleOptions: [],
      };
      return { ...prev, [tId]: { ...ed, clubs: nextClubs } };
    });
  }
  function removeClub(tId: Id, clubIdx: number) {
    setEditorById(prev => {
      const ed = prev[tId]; if (!ed) return prev;
      const nextClubs = [...(ed.clubs || [])];
      if (nextClubs[clubIdx]) nextClubs[clubIdx] = {
        ...nextClubs[clubIdx],
        club: null,
        clubId: undefined,
        clubQuery: '',
        clubOptions: [],
        singleCaptain: null,
        singleQuery: '',
        singleOptions: [],
      };
      return { ...prev, [tId]: { ...ed, clubs: nextClubs } };
    });
  }

  /* ----- Save inline to /config ----- */
  async function saveInline(tId: Id) {
    const ed = editor(tId);
    if (!ed) return;

    const name = (ed.name || '').trim();
    if (!name) throw new Error('Tournament name is required');

    const payload: {
      name: string;
      type: string; // enum
      clubs: string[];
      levels?: Array<{ id?: string; name: string; idx?: number }>; // brackets
      captainsSimple?: Array<{ clubId: string; playerId: string }>;
      hasCaptains?: boolean;
      stops?: Array<{ id?: string; name: string; clubId?: string | null; startAt?: string | null; endAt?: string | null; eventManagerId?: string | null }>;
      maxTeamSize?: number | null; // reused: team size when no brackets; bracket size when brackets enabled
      // NEW tournament-level Event Manager
      eventManagerId?: string | null;
      // NEW tournament admin
      tournamentAdminId?: string | null;
    } = {
      name,
      type: LABEL_TO_TYPE[ed.type],
      clubs: [],
    };

    // Participating clubs
    payload.clubs = Array.from(new Set(ed.clubs.map(c => c.clubId).filter(Boolean) as string[]));

    // Max limit (blank => null; else positive integer)
    {
      const mtsRaw = (ed.maxTeamSize ?? '').trim();
      if (mtsRaw === '') {
        payload.maxTeamSize = null;
      } else if (/^\d+$/.test(mtsRaw) && Number(mtsRaw) > 0) {
        payload.maxTeamSize = Number(mtsRaw);
      } else {
        throw new Error((ed.hasBrackets ? 'Max bracket size' : 'Max team size') + ' must be blank or a positive integer.');
      }
    }

    // Brackets (optional, independent of captains)
    if (ed.hasBrackets) {
      payload.levels = ed.brackets
        .map((l, idx) => ({ id: l.id, name: (l.name || '').trim(), idx }))
        .filter(l => !!l.name);
    } else {
      payload.levels = []; // explicitly clear if toggled off
    }

    // Captains: one per club
    if (ed.hasCaptains) {
      const simple: Array<{ clubId: string; playerId: string }> = [];
      for (const crow of ed.clubs) {
        if (!crow.clubId) continue;
        if (crow.singleCaptain?.id) {
          simple.push({ clubId: crow.clubId, playerId: crow.singleCaptain.id });
        }
      }
      payload.captainsSimple = simple;
    } else {
      payload.captainsSimple = [];
    }
    payload.hasCaptains = ed.hasCaptains;

    // Tournament-level Event Manager
    payload.eventManagerId = ed.tournamentEventManager?.id ?? null;

    // Tournament Admin
    payload.tournamentAdminId = ed.tournamentAdmin?.id ?? null;

    // Stops (+ per-stop Event Manager)
    if (ed.hasMultipleStops) {
      payload.stops = (ed.stops || [])
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
      const s0 = ed.stops && ed.stops.length ? ed.stops[0] : { name: 'Main', clubId: undefined, startAt: '', endAt: '', eventManager: null as CaptainPick };
      payload.stops = [{
        id: s0.id,
        name: 'Main',
        clubId: s0.clubId || null,
        startAt: s0.startAt || null,
        endAt: s0.endAt || null,
        eventManagerId: s0.eventManager?.id ?? null,
      }];
    }

    await api(`/api/admin/tournaments/${tId}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Rehydrate
    try {
      const cfg = await api<{
        id: string;
        name: string;
        type: string;
        maxTeamSize?: number | null;
        hasCaptains?: boolean;
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
        levels: Array<{ id: string; name: string; idx: number }>;
        captainsSimple: Array<{ clubId: string; playerId: string; playerName?: string }>;
        eventManager?: { id: string; name?: string } | null;
        tournamentAdmin?: { id: string; name?: string } | null;
        stops: Array<{ id: string; name: string; clubId?: string | null; startAt?: string | null; endAt?: string | null; eventManager?: { id: string; name?: string } | null }>;
      }>(`/api/admin/tournaments/${tId}/config`);

      const brackets = (cfg.levels || []).map(l => ({ id: l.id, name: l.name }));

      setEditorById((prev: EditorState) => {
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

      const hasCaptainsFromConfig = Array.isArray(cfg.captainsSimple) && cfg.captainsSimple.length > 0;

        return {
          ...prev,
          [tId]: {
            name: cfg.name,
            type: (cfg.type as any) || 'Team Format',
            hasMultipleStops: (cfg.stops || []).length > 1,
            hasBrackets: (cfg.levels || []).length > 0,
            hasCaptains: cfg.hasCaptains ?? hasCaptainsFromConfig,
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

            tournamentEventManager: cfg.eventManager?.id ? { id: cfg.eventManager.id, label: cfg.eventManager.name || '' } : null,
            tournamentEventManagerQuery: '',
            tournamentEventManagerOptions: [],

            tournamentAdmin: cfg.tournamentAdmin?.id ? { id: cfg.tournamentAdmin.id, label: cfg.tournamentAdmin.name || '' } : null,
            tournamentAdminQuery: '',
            tournamentAdminOptions: [],
          }
        };
      });
    } catch {
      // ignore rehydrate failure; backend has saved
    }

    await afterSaved();
    toggleExpand(tId);
  }

  /* ----- Stops UI helpers (inline editor) ----- */
  function addStopRow(tId: Id) {
    setEditorById((prev: EditorState) => {
      const ed = prev[tId]; if (!ed) return prev;
      return { ...prev, [tId]: { ...ed, stops: [...(ed.stops || []), { name: '', eventManager: null, eventManagerQuery: '', eventManagerOptions: [], club: null, clubQuery: '', clubOptions: [] }] } };
    });
  }
  function updateStopRow(tId: Id, i: number, patch: Partial<StopEditorRow>) {
    setEditorById((prev: EditorState) => {
      const ed = prev[tId]; if (!ed) return prev;
      const next = [...(ed.stops || [])];
      next[i] = { ...next[i], ...patch };
      return { ...prev, [tId]: { ...ed, stops: next } };
    });
  }
  function removeStopRow(tId: Id, i: number) {
    setEditorById((prev: EditorState) => {
      const ed = prev[tId]; if (!ed) return prev;
      const next = [...(ed.stops || [])];
      next.splice(i, 1);
      return { ...prev, [tId]: { ...ed, stops: next } };
    });
  }

  /* ----- Create Tournament (prompt) ----- */
  async function createNewTournamentPrompt() {
    const name = (window.prompt('Tournament name?') || '').trim();
    if (!name) return;
    try {
      const t = await api<{ id: Id; name: string }>('/api/admin/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      await afterSaved();
      alert(`Tournament "${t.name}" created`);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex justify-end">
        <button className="btn btn-primary" onClick={createNewTournamentPrompt}>Create Tournament</button>
      </div>

      {props.tournaments.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-muted">No tournaments yet.</p>
        </div>
      ) : (
        <div className="space-y-0">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 items-center py-3 px-4 text-base font-semibold text-white border-b border-subtle" style={{ backgroundColor: 'var(--brand-primary)' }}>
            <div className="col-span-3">Tournament</div>
            <div className="col-span-2 text-center">Status</div>
            <div className="col-span-1 text-center">Teams</div>
            <div className="col-span-1 text-center">Stops</div>
            <div className="col-span-3 text-center">Date</div>
            <div className="col-span-2 text-center">Actions</div>
          </div>
          
          {props.tournaments.map(t => {
            const isOpen = !!props.expanded[t.id];
            const ed = editor(t.id);

            // Calculate status based on dates
            const now = new Date();
            const startDate = t.stats.dateRange.start ? new Date(t.stats.dateRange.start) : null;
            const endDate = t.stats.dateRange.end ? new Date(t.stats.dateRange.end) : null;
            
            let status = 'Upcoming';
            if (startDate && endDate) {
              if (now < startDate) {
                status = 'Upcoming';
              } else if (now >= startDate && now <= endDate) {
                status = 'In Progress';
              } else {
                status = 'Complete';
              }
            }

            return (
              <div key={t.id} className="border-b border-subtle hover:bg-surface-1/50" style={{ backgroundColor: 'var(--surface-1)' }}>
                <div className="grid grid-cols-12 gap-4 items-center py-3 px-4">
                  <div className="col-span-3">
                    <button 
                      className="font-medium text-primary hover:text-secondary-hover hover:underline text-left"
                      onClick={() => props.toggleExpand(t.id)}
                    >
                      {t.name}
                    </button>
                  </div>
                  <div className="col-span-2 text-center">
                    <span className={`chip ${
                      status === 'Complete' ? 'chip-success' :
                      status === 'In Progress' ? 'chip-warning' :
                      status === 'Upcoming' ? 'chip-info' :
                      'chip-error'
                    }`}>
                      {status}
                      </span>
                    </div>
                  <div className="col-span-1 text-center text-muted tabular">
                    {t.stats.participatingClubs.length}
                  </div>
                  <div className="col-span-1 text-center text-muted tabular">
                    {t.stats.stopCount}
                  </div>
                  <div className="col-span-3 text-center text-muted tabular">
                    {between(t.stats.dateRange.start, t.stats.dateRange.end)}
                  </div>
                  <div className="col-span-2 flex items-center gap-2 justify-end">
                    <button 
                      className="btn btn-ghost text-sm"
                      onClick={() => props.toggleExpand(t.id)}
                    >
                      {isOpen ? 'Hide Details' : 'Edit'}
                    </button>
                    <button 
                      aria-label="Delete tournament" 
                      onClick={() => props.onDeleteTournament(t.id)} 
                      title="Delete"
                      className="text-error hover:text-error-hover p-1"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>

                {isOpen && ed && (
                  <div className="py-6 px-6 bg-surface-1/40">
                    {/* SINGLE EDITABLE PANEL */}
                        <div className="space-y-6 w-full">
                          {/* Name + Type + Max size + Checkboxes + Brackets */}
                          <div className="flex flex-wrap items-start gap-4">
                            <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-1">
                                <label className="w-10 text-sm text-secondary">Name</label>
                              <input
                                  className="input w-48"
                                value={ed.name}
                                onChange={(e) => props.setEditorById((prev: EditorState) => ({ ...prev, [t.id]: { ...ed, name: e.target.value } }))}
                              />
                            </div>
                            <div className="flex items-center gap-1">
                                <label className="w-10 text-sm text-secondary">Type</label>
                              <select
                                  className="input w-48"
                                value={ed.type}
                                onChange={(e) => props.setEditorById((prev: EditorState) => ({ ...prev, [t.id]: { ...ed, type: e.target.value as typeof ed.type } }))}
                              >
                                {(['Team Format','Single Elimination','Double Elimination','Round Robin','Pool Play','Ladder Tournament'] as const).map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <label
                                className="w-30 text-sm text-secondary"
                                title={ed.hasBrackets
                                  ? 'Max number of players allowed in each bracket. Leave blank for unlimited.'
                                  : 'Max number of players per team. Leave blank for unlimited.'}
                              >
                                {ed.hasBrackets ? 'Max bracket size' : 'Max team size'}
                              </label>
                              <input
                                className="input w-16"
                                type="number"
                                min={1}
                                max={99}
                                placeholder="(unlimited)"
                                value={ed.maxTeamSize}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '' || (/^\d{1,2}$/.test(val) && Number(val) > 0)) {
                                    props.setEditorById((prev: EditorState) => ({ ...prev, [t.id]: { ...ed, maxTeamSize: val } }));
                                  }
                                }}
                              />
                            </div>
                            {/* Checkboxes - stacked vertically */}
                            <div className="flex flex-col gap-2">
                              <label className="inline-flex items-center gap-2">
                                <input type="checkbox" checked={ed.hasBrackets} onChange={e => props.setEditorById((prev: EditorState) => ({ ...prev, [t.id]: { ...ed, hasBrackets: e.target.checked } }))} />
                                <span>Brackets</span>
                              </label>
                              <label className="inline-flex items-center gap-2">
                                <input type="checkbox" checked={ed.hasCaptains} onChange={e => props.setEditorById((prev: EditorState) => ({ ...prev, [t.id]: { ...ed, hasCaptains: e.target.checked } }))} />
                                <span>Captains</span>
                              </label>
                              <label className="inline-flex items-center gap-2">
                                <input type="checkbox" checked={ed.hasMultipleStops} onChange={e => props.setEditorById((prev: EditorState) => ({ ...prev, [t.id]: { ...ed, hasMultipleStops: e.target.checked } }))} />
                                <span>Multiple Stops</span>
                              </label>
                            </div>

                            {/* Tournament Admin - App Admins only */}
                            {props.userProfile?.isAppAdmin && (
                              <div className="flex flex-col gap-2">
                                <label className="text-sm text-secondary">Tournament Admin:</label>
                                {ed.tournamentAdmin?.id ? (
                                  <div className="flex items-center justify-between gap-2 input bg-surface-2 min-w-[220px]">
                                    <div className="text-sm">
                                      <span className="font-medium text-primary">{ed.tournamentAdmin.label || '(selected)'}</span>
                                    </div>
                                    <button
                                      className="px-2 py-1 text-error hover:text-error-hover"
                                      aria-label="Remove tournament admin"
                                      title="Remove tournament admin"
                                      onClick={() => removeTournamentAdmin(t.id)}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <div className="relative min-w-[220px]">
                                    <input
                                      className="input w-full pr-8"
                                      placeholder="Type 3+ chars to search players…"
                                      value={ed.tournamentAdminQuery || ''}
                                      onChange={e => setTournamentAdminQuery(t.id, e.target.value)}
                                    />
                                    {!!ed.tournamentAdminOptions?.length && (
                                      <div className="absolute z-10 border border-subtle rounded mt-1 bg-surface-1 max-h-40 overflow-auto w-full shadow-lg">
                                        {(ed.tournamentAdminOptions || []).map(o => (
                                          <button
                                            key={o.id}
                                            className="block w-full text-left px-2 py-1 hover:bg-surface-2 text-primary"
                                            onClick={() => chooseTournamentAdmin(t.id, o)}
                                          >
                                            {o.label}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Brackets - moved to top row */}
                            {ed.type === 'Team Format' && ed.hasBrackets && (
                              <div className="flex-1">
                                <div className="flex gap-2">
                                  <div className="flex flex-col gap-2">
                                    <label className="w-18 text-sm text-secondary">Brackets:</label>
                                    <button className="btn btn-sm btn-primary w-fit" onClick={() => addBracket(t.id)}>Add Bracket</button>
                                  </div>
                                  <div className="space-y-2">
                                    {ed.brackets.length === 0 && <p className="text-sm text-muted">No brackets yet.</p>}
                                    {ed.brackets.map(level => (
                                      <div key={level.id} className="flex items-center gap-2">
                                        <input
                                          className="input w-28"
                                          placeholder="Bracket name (e.g., Intermediate)"
                                          value={level.name}
                                          onChange={e => props.setEditorById((prev: EditorState) => {
                                            const ed2 = prev[t.id]; if (!ed2) return prev;
                                            const next = ed2.brackets.map((l: NewBracket) => l.id === level.id ? { ...l, name: e.target.value } : l);
                                            return { ...prev, [t.id]: { ...ed2, brackets: next } };
                                          })}
                                        />
                                        <button className="px-2 py-1 text-red-600" aria-label="Remove bracket" title="Remove bracket" onClick={() => removeBracket(t.id, level.id)}>
                                          ✕
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>



                          {/* Stops (Multiple) */}
                          {ed.type === 'Team Format' && ed.hasMultipleStops && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between gap-4 flex-wrap">
                                <h3 className="font-medium">Stops</h3>
                                <button className="btn btn-sm btn-primary" onClick={() => addStopRow(t.id)}>Add Stop</button>
                              </div>
                              {(ed.stops || []).length === 0 && <p className="text-sm text-muted">No stops yet.</p>}
                              {(ed.stops || []).length > 0 && (
                                <div className="overflow-x-auto">
                                  <div className="min-w-[960px] space-y-2">
                                    <div className="admin-stops-header text-sm font-medium text-secondary pr-2">
                                      <div>Name</div>
                                      <div>Location</div>
                                      <div>Start Date</div>
                                      <div>End Date</div>
                                      <div>Event Manager</div>
                                      <div></div>
                                    </div>
                                    {(ed.stops || []).map((s, idx) => (
                                      <div key={idx} className="admin-stops-grid pr-2">
                                      <input
                                        className="input w-full"
                                        placeholder="Stop name (required)"
                                        value={s.name}
                                        onChange={e => updateStopRow(t.id, idx, { name: e.target.value })}
                                      />
                                      {/* Club lookup for stops */}
                                      {s.club?.id ? (
                                        <div className="flex items-center justify-between gap-2 input bg-surface-2 w-full">
                                          <div className="text-sm">
                                            <span className="font-medium text-primary">{s.club.label || '(selected)'}</span>
                                          </div>
                                          <button
                                            className="px-2 py-0 text-error hover:text-error-hover"
                                            aria-label="Remove club"
                                            title="Remove club"
                                            onClick={() => removeStopClub(t.id, idx)}
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="relative w-full">
                                      <input
                                            className="input w-full pr-8"
                                            placeholder="Type 3+ chars to search clubs…"
                                            value={s.clubQuery || ''}
                                            onChange={e => setStopClubQuery(t.id, idx, e.target.value)}
                                          />
                                          {!!s.clubOptions?.length && (
                                            <div className="absolute z-10 border border-subtle rounded mt-1 bg-surface-1 max-h-40 overflow-auto w-full shadow-lg">
                                              {(s.clubOptions || []).map(o => (
                                                <button
                                                  key={o.id}
                                                  className="block w-full text-left px-2 py-1 hover:bg-surface-2 text-primary"
                                                  onClick={() => chooseStopClub(t.id, idx, o)}
                                                >
                                                  {o.label}
                                                </button>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      <input
                                        className="input w-full" type="date"
                                        value={s.startAt || ''}
                                        onChange={e => updateStopRow(t.id, idx, { startAt: e.target.value })}
                                      />
                                      <input
                                        className="input w-full" type="date"
                                        value={s.endAt || ''}
                                        onChange={e => updateStopRow(t.id, idx, { endAt: e.target.value })}
                                      />

                                      {/* Stop-level Event Manager */}
                                        {s.eventManager?.id ? (
                                        <div className="flex items-center justify-between gap-2 input bg-surface-2 w-full">
                                            <div className="text-sm">
                                            <span className="font-medium text-primary">{s.eventManager.label || '(selected)'}</span>
                                            </div>
                                            <button
                                            className="px-2 py-0 text-error hover:text-error-hover"
                                              aria-label="Remove event manager"
                                              title="Remove event manager"
                                              onClick={() => removeStopEventMgr(t.id, idx)}
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        ) : (
                                        <div className="relative w-full">
                                            <input
                                            className="input w-full pr-8"
                                              placeholder="Type 3+ chars to search players…"
                                              value={s.eventManagerQuery || ''}
                                              onChange={e => setStopEventMgrQuery(t.id, idx, e.target.value)}
                                            />
                                            {!!s.eventManagerOptions?.length && (
                                            <div className="absolute z-10 border border-subtle rounded mt-1 bg-surface-1 max-h-40 overflow-auto w-full shadow-lg">
                                                {(s.eventManagerOptions || []).map(o => (
                                                  <button
                                                    key={o.id}
                                                  className="block w-full text-left px-2 py-1 hover:bg-surface-2 text-primary"
                                                    onClick={() => chooseStopEventMgr(t.id, idx, o)}
                                                  >
                                                    {o.label}
                                                  </button>
                                                ))}
                                              </div>
                                            )}
                                        </div>
                                      )}
                                      <button className="px-2 py-1" aria-label="Remove stop" title="Remove stop" onClick={() => removeStopRow(t.id, idx)}>
                                        <TrashIcon />
                                      </button>
                                    </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Details (single stop) */}
                          {ed.type === 'Team Format' && !ed.hasMultipleStops && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h3 className="font-medium">Details</h3>
                              </div>

                              {/* Local fallback for single stop */}
                              {(() => {
                                const singleStops =
                                  ed.stops && ed.stops.length
                                    ? ed.stops
                                    : [{ name: 'Main', clubId: undefined as Id | undefined, startAt: '', endAt: '', eventManager: null as CaptainPick, eventManagerQuery: '', eventManagerOptions: [] }];

                                const s0 = singleStops[0];

                                return (
                                  <div className="">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <select
                                        className="border rounded px-2 py-1"
                                        value={(s0.clubId || '') as string}
                                        onChange={e =>
                                          props.setEditorById((prev: EditorState) => {
                                            const ed2 = prev[t.id]; if (!ed2) return prev;
                                            const nextS = ed2.stops && ed2.stops.length
                                              ? [...ed2.stops]
                                              : [{ name: 'Main', clubId: undefined as Id | undefined, startAt: '', endAt: '', eventManager: null, eventManagerQuery: '', eventManagerOptions: [] }];
                                            nextS[0] = { ...(nextS[0] || { name: 'Main' }), clubId: (e.target.value || undefined) as any };
                                            return { ...prev, [t.id]: { ...ed2, stops: nextS } };
                                          })
                                        }
                                      >
                                        <option value="">Location (Club)…</option>
                                        {props.clubsAll.map(c => (
                                          <option key={c.id} value={c.id}>
                                            {c.name}{c.city ? ` (${c.city})` : ''}
                                          </option>
                                        ))}
                                      </select>

                                      <input
                                        className="border rounded px-2 py-1"
                                        type="date"
                                        value={(s0.startAt || '') as string}
                                        onChange={e =>
                                          props.setEditorById((prev: EditorState) => {
                                            const ed2 = prev[t.id]; if (!ed2) return prev;
                                            const nextS = ed2.stops && ed2.stops.length
                                              ? [...ed2.stops]
                                              : [{ name: 'Main', clubId: undefined as Id | undefined, startAt: '', endAt: '', eventManager: null, eventManagerQuery: '', eventManagerOptions: [] }];
                                            nextS[0] = {
                                              ...(nextS[0] || { name: 'Main' }),
                                              startAt: e.target.value,
                                              endAt: (nextS[0]?.endAt || e.target.value),
                                            };
                                            return { ...prev, [t.id]: { ...ed2, stops: nextS } };
                                          })
                                        }
                                      />
                                      <input
                                        className="border rounded px-2 py-1"
                                        type="date"
                                        value={(s0.endAt || '') as string}
                                        onChange={e =>
                                          props.setEditorById((prev: EditorState) => {
                                            const ed2 = prev[t.id]; if (!ed2) return prev;
                                            const nextS = ed2.stops && ed2.stops.length
                                              ? [...ed2.stops]
                                              : [{ name: 'Main', clubId: undefined as Id | undefined, startAt: '', endAt: '', eventManager: null, eventManagerQuery: '', eventManagerOptions: [] }];
                                            nextS[0] = { ...(nextS[0] || { name: 'Main' }), endAt: e.target.value };
                                            return { ...prev, [t.id]: { ...ed2, stops: nextS } };
                                          })
                                        }
                                      />

                                      {/* Single-stop Event Manager */}
                                      <div className="relative min-w-[220px]">
                                        {s0.eventManager?.id ? (
                                          <div className="flex items-center justify-between gap-2 w-full input bg-surface-2">
                                            <div className="text-sm">
                                              <span className="font-medium text-primary">{s0.eventManager.label || '(selected)'}</span>
                                            </div>
                                            <button
                                              className="px-2 py-1 text-error hover:text-error-hover"
                                              aria-label="Remove event manager"
                                              title="Remove event manager"
                                              onClick={() => props.setEditorById((prev: EditorState) => {
                                                const ed2 = prev[t.id]; if (!ed2) return prev;
                                                const nextS = ed2.stops && ed2.stops.length
                                                  ? [...ed2.stops]
                                                  : [{ name: 'Main', clubId: undefined as Id | undefined, startAt: '', endAt: '', eventManager: null, eventManagerQuery: '', eventManagerOptions: [] }];
                                                nextS[0] = { ...(nextS[0] || { name: 'Main' }), eventManager: null, eventManagerQuery: '', eventManagerOptions: [] };
                                                return { ...prev, [t.id]: { ...ed2, stops: nextS } };
                                              })}
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="w-full">
                                            <input
                                              className="input w-full pr-8"
                                              placeholder="Type 3+ chars to search players…"
                                              value={(s0.eventManagerQuery || '') as string}
                                              onChange={e => {
                                                props.setEditorById((prev: EditorState) => {
                                                  const ed2 = prev[t.id]; if (!ed2) return prev;
                                                  const nextS = ed2.stops && ed2.stops.length
                                                    ? [...ed2.stops]
                                                    : [{ name: 'Main', clubId: undefined as Id | undefined, startAt: '', endAt: '', eventManager: null, eventManagerQuery: '', eventManagerOptions: [] }];
                                                  nextS[0] = { ...(nextS[0] || { name: 'Main' }), eventManagerQuery: e.target.value, eventManagerOptions: [] };
                                                  return { ...prev, [t.id]: { ...ed2, stops: nextS } };
                                                });
                                                const k = stopMgrKeyFor(t.id, 0);
                                                if (searchTimers.current[k]) clearTimeout(searchTimers.current[k]);
                                                searchTimers.current[k] = window.setTimeout(() => runStopEventMgrSearch(t.id, 0), 300);
                                              }}
                                            />
                                            {!!s0.eventManagerOptions?.length && (
                                              <div className="absolute z-10 border border-subtle rounded mt-1 bg-surface-1 max-h-40 overflow-auto w-full shadow-lg">
                                                {(s0.eventManagerOptions || []).map(o => (
                                                  <button
                                                    key={o.id}
                                                    className="block w-full text-left px-2 py-1 hover:bg-surface-2 text-primary"
                                                    onClick={() => props.setEditorById((prev: EditorState) => {
                                                      const ed2 = prev[t.id]; if (!ed2) return prev;
                                                      const nextS = ed2.stops && ed2.stops.length
                                                        ? [...ed2.stops]
                                                        : [{ name: 'Main', clubId: undefined as Id | undefined, startAt: '', endAt: '', eventManager: null, eventManagerQuery: '', eventManagerOptions: [] }];
                                                      nextS[0] = { ...(nextS[0] || { name: 'Main' }), eventManager: o, eventManagerQuery: '', eventManagerOptions: [] };
                                                      return { ...prev, [t.id]: { ...ed2, stops: nextS } };
                                                    })}
                                                  >
                                                    {o.label}
                                                  </button>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>

                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                          {ed.type === 'Team Format' && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between gap-4 flex-wrap">
                                <h3 className="font-medium text-primary">Participating Clubs</h3>
                                <button className="btn btn-sm btn-primary" onClick={() => addClubRow(t.id)}>Add Club</button>
                              </div>
                              {ed.clubs.length === 0 && <p className="text-sm text-muted">No clubs yet.</p>}
                              <div className="grid gap-4 xl:grid-cols-2">
                                {(ed.clubs || []).map((row, idx) => (
                                  <div key={idx} className="p-3 border border-subtle rounded-lg bg-surface-1 shadow-sm">
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:gap-4 gap-3">
                                      <div className="flex-1 space-y-2">
                                        <label className="block text-sm font-medium text-secondary">Club</label>
                                        {row.club?.id ? (
                                          <div className="flex items-center justify-between gap-2 input bg-surface-2">
                                            <div className="text-sm">
                                              <span className="font-medium text-primary">{row.club.label || '(selected)'}</span>
                                            </div>
                                            <button
                                              className="px-2 py-0 text-error hover:text-error-hover"
                                              aria-label="Remove club"
                                              title="Remove club"
                                              onClick={() => removeClub(t.id, idx)}
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="relative">
                                            <input
                                              className="input w-full pr-8"
                                              placeholder="Type 3+ chars to search clubs…"
                                              value={row.clubQuery || ''}
                                              onChange={e => setClubQuery(t.id, idx, e.target.value)}
                                            />
                                            {!!row.clubOptions?.length && (
                                              <div className="absolute z-10 border border-subtle rounded mt-1 bg-surface-1 max-h-40 overflow-auto w-full shadow-lg">
                                                {(row.clubOptions || []).map(o => (
                                                  <button
                                                    key={o.id}
                                                    className="block w-full text-left px-2 py-1 hover:bg-surface-2 text-primary"
                                                    onClick={() => chooseClub(t.id, idx, o)}
                                                  >
                                                    {o.label}
                                                  </button>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>

                                      {ed.hasCaptains && (
                                        <div className="flex-1 space-y-2">
                                          <label className="block text-sm font-medium text-secondary">Captain</label>
                                          {row.clubId ? (
                                            row.singleCaptain?.id ? (
                                              <div className="flex items-center justify-between gap-2 w-full input bg-surface-2">
                                                <div className="text-sm">
                                                  <span className="font-medium text-primary">{row.singleCaptain.label || '(selected)'}</span>
                                                </div>
                                                <button
                                                  className="px-2 py-0 text-error hover:text-error-hover"
                                                  aria-label="Remove captain"
                                                  title="Remove captain"
                                                  onClick={() => removeSingleCaptain(t.id, idx)}
                                                >
                                                  ✕
                                                </button>
                                              </div>
                                            ) : (
                                              <div className="relative">
                                                <input
                                                  className="input w-full pr-8"
                                                  placeholder="Type 3+ chars to search players…"
                                                  value={row.singleQuery}
                                                  onChange={e => setSingleCaptainQuery(t.id, idx, e.target.value)}
                                                />
                                                {!!row.singleOptions.length && (
                                                  <div className="absolute z-10 border border-subtle rounded mt-1 bg-surface-1 max-h-40 overflow-auto w-full shadow-lg">
                                                    {row.singleOptions
                                                      .filter(o => !allChosenCaptainIdsAcrossClubs.has(o.id))
                                                      .map(o => (
                                                        <button
                                                          key={o.id}
                                                          className="block w-full text-left px-2 py-1 hover:bg-surface-2 text-primary"
                                                          onClick={() => chooseSingleCaptain(t.id, idx, o)}
                                                        >
                                                          {o.label}
                                                        </button>
                                                      ))}
                                                  </div>
                                                )}
                                              </div>
                                            )
                                          ) : (
                                            <p className="text-sm text-muted">Select a club first.</p>
                                          )}
                                        </div>
                                      )}

                                      <div className="flex sm:self-start sm:mt-6 justify-end">
                                        <button
                                          className="px-2 py-1 text-error hover:text-error-hover"
                                          aria-label="Remove club row"
                                          title="Remove club row"
                                          onClick={() => removeClubRow(t.id, idx)}
                                        >
                                          <TrashIcon />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Footer actions → SAVE INLINE TO /config */}
                          <div className="flex items-center gap-2">
                            <button className="border rounded px-3 py-1"
                              onClick={async () => {
                                try {
                                  await saveInline(t.id);
                                } catch (e) {
                                  alert((e as Error).message);
                                }
                              }}
                            >
                              Save Changes
                            </button>
                            <button className="btn btn-ghost text-sm" onClick={() => toggleExpand(t.id)}>Close</button>
                          </div>
                        </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* (Legacy create/edit panel removed) */}

      {/* ===== Generate Schedule Modal ===== */}
      {genOpen && genData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg shadow p-4 w-full max-w-md">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Generate schedule</h3>
              <button className="text-gray-500" onClick={() => setGenOpen(false)}>✕</button>
            </div>
            <div className="text-sm text-gray-600 mb-3">
              Stop: <span className="font-medium">{genData.stopName}</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Bracket</label>
                <select
                  className="border rounded px-2 py-1 w-full"
                  value={genData.bracketId ?? 'ALL'}
                  onChange={(e) => setGenData(d => d ? { ...d, bracketId: (e.target.value === 'ALL' ? 'ALL' : e.target.value) as any } : d)}
                >
                  <option value="ALL">All brackets</option>
                  {(genData.bracketChoices || []).map(b => (
                    <option key={b.id} value={b.id}>{b.name || '(unnamed)'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Slots to seed</label>
                <div className="grid grid-cols-2 gap-2">
                  {SLOT_OPTIONS.map(opt => (
                    <label key={opt.key} className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!genData.slotMap[opt.key]}
                        onChange={(e) => setGenData(d => d ? { ...d, slotMap: { ...d.slotMap, [opt.key]: e.target.checked } } : d)}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={genData.overwrite}
                  onChange={(e) => setGenData(d => d ? { ...d, overwrite: e.target.checked } : d)}
                />
                <span>Overwrite existing schedule for this stop</span>
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-1 border rounded" onClick={() => setGenOpen(false)}>Cancel</button>
              <button className="px-3 py-1 rounded bg-blue-600 text-white" onClick={submitGenerate}>Generate</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== View Schedule Modal ===== */}
      {schedOpen && schedStop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg shadow p-4 w-full max-w-3xl max-h-[85vh] overflow-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Schedule • {schedStop.stopName}</h3>
              <button className="text-gray-500" onClick={() => setSchedOpen(false)}>✕</button>
            </div>

            {(!schedRounds || schedRounds.length === 0) && (
              <div className="text-sm text-gray-600">No rounds yet.</div>
            )}

            {schedRounds && schedRounds.length > 0 && (
              <div className="space-y-4">
                {schedRounds.sort((a,b)=>a.idx-b.idx).map((round) => (
                  <div key={round.id} className="border rounded p-3">
                    <div className="font-medium mb-2">Round {round.idx + 1}</div>
                    <div className="space-y-2">
                      {round.games?.map(g => (
                        <div key={g.id} className="border rounded p-2 bg-gray-50">
                          <div className="font-medium mb-1">
                            {g.isBye
                              ? (g.teamA ? `${g.teamA.name} — BYE` : (g.teamB ? `${g.teamB.name} — BYE` : 'BYE'))
                              : `${g.teamA?.name ?? '—'} vs ${g.teamB?.name ?? '—'}`}
                          </div>
                          {!g.isBye && (
                            <ul className="text-sm grid md:grid-cols-2 gap-1">
                              {(g.matches ?? []).map(m => (
                                <li key={m.id} className="flex items-center justify-between rounded bg-white border px-2 py-1">
                                  <span>{SLOT_LABEL[m.slot] ?? m.slot}</span>
                                  <span className="tabular-nums">
                                    {(m.teamAScore ?? '—')} : {(m.teamBScore ?? '—')}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournaments?.length]);

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
          onError={(m)=>setErr(m)}
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

        return (
          <div key={s.stopId} className="space-y-2">
            <div className="flex items-center justify-between">
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

            <div className="grid md:grid-cols-2 gap-4">
              {bracketOrder.map(({ teamId, name }) => {
                const list = rosters[s.stopId]?.[teamId] ?? [];
                const excludeAcrossThisStop = Object.values(rosters[s.stopId] ?? {}).flat().map(p => p.id);
                return (
                  <AdminBracketRosterEditor
                    key={`${s.stopId}:${teamId}`}
                    title={`${name} (${list.length}${maxTeamSize ? ` / ≤${maxTeamSize}` : ''})`}
                    tournamentId={tournamentId}
                    teamId={teamId}
                    list={list}
                    onChange={(next) => setStopTeamRoster(s.stopId, teamId, next)}
                    excludeIdsAcrossStop={excludeAcrossThisStop}
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
  list,
  onChange,
  excludeIdsAcrossStop,
}: {
  title: string;
  tournamentId: Id;
  teamId: Id;
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
  }, [term, tournamentId, teamId, excludeIdsAcrossStop]);

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
