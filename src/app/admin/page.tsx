// src/app/admin/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

type Id = string;

/* ================= Helpers ================= */
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const ct = r.headers.get('content-type') ?? '';
  const body = ct.includes('application/json') ? await r.json() : await r.text();
  if (!r.ok) throw new Error(typeof body === 'string' ? body : (body as any)?.error || `HTTP ${r.status}`);
  return body as T;
}
function fmtDate(d?: string | null) {
  if (!d) return '—';
  const dt = new Date(d);
  const y = dt.getFullYear(); const m = String(dt.getMonth() + 1).padStart(2, '0'); const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function toDateInput(iso?: string | null) {
  if (!iso) return '';
  return iso.slice(0, 10);
}
function between(a?: string | null, b?: string | null) {
  if (!a && !b) return '—'; if (a && b) return `${fmtDate(a)} – ${fmtDate(b)}`; return fmtDate(a || b);
}
function personLabel(p: { firstName?: string | null; lastName?: string | null; name?: string | null }) {
  const fn = (p.firstName ?? '').trim();
  const ln = (p.lastName ?? '').trim();
  return [fn, ln].filter(Boolean).join(' ') || (p.name ?? 'Unknown');
}
const CA_PROVINCES = ['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'] as const;
const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME',
  'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA',
  'RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
] as const;
function fortyYearsAgoISO() {
  const t = new Date();
  t.setFullYear(t.getFullYear() - 40);
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const d = String(t.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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
  id: Id; name: string; createdAt: string;
  stats: { stopCount: number; participatingClubs: string[]; dateRange: { start: string | null; end: string | null }; };
  stops?: StopRow[];
};

/** Legacy (existing) participant draft used by current backend */
type ParticipantDraft = {
  clubId?: string;
  intermediateCaptain?: { id: string; label: string } | null;
  advancedCaptain?: { id: string; label: string } | null;
  iQuery: string; aQuery: string;
  iOptions: Array<{ id: string; label: string }>;
  aOptions: Array<{ id: string; label: string }>;
};

/** New editor shape (inline panel) */
type NewLevel = { id: string; name: string };
type CaptainPick = { id: string; label: string } | null;
type ClubWithCaptains = {
  clubId?: string;
  captains: Record<string /*levelId*/, CaptainPick>;
  queries: Record<string /*levelId*/, string>;
  options: Record<string /*levelId*/, Array<{ id: string; label: string }>>;
};

/* ================= Page ================= */
export default function AdminPage() {
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const clearMsg = () => { setErr(null); setInfo(null); };

  // active tab
  type TabKey = 'tournaments' | 'clubs' | 'players';
  const [tab, setTab] = useState<TabKey>('tournaments');

  // tournaments
  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [expanded, setExpanded] = useState<Record<Id, boolean>>({});

  // clubs
  const [clubsAll, setClubsAll] = useState<Club[]>([]);
  const [clubSort, setClubSort] = useState<{ col: keyof Club | 'name' | 'city' | 'region' | 'country' | 'phone'; dir: 'asc' | 'desc' }>({ col: 'name', dir: 'asc' });
  const [clubEditOpen, setClubEditOpen] = useState(false);
  const [clubEditId, setClubEditId] = useState<Id | null>(null);
  const [clubCountrySel, setClubCountrySel] = useState<'Canada' | 'USA' | 'Other'>('Canada');
  const [clubCountryOther, setClubCountryOther] = useState('');
  const [clubForm, setClubForm] = useState<{ name: string; address: string; city: string; region: string; phone: string; country: string }>({
    name: '', address: '', city: '', region: '', phone: '', country: 'Canada'
  });

  // players
  const [playersPage, setPlayersPage] = useState<{ items: Player[]; total: number; take: number; skip: number; sort: string }>(
    { items: [], total: 0, take: 25, skip: 0, sort: 'lastName:asc' }
  );
  const [playerSort, setPlayerSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'lastName', dir: 'asc' });
  const [playerEditOpen, setPlayerEditOpen] = useState(false);
  const [playerEditId, setPlayerEditId] = useState<Id | null>(null);
  const [playerCountrySel, setPlayerCountrySel] = useState<'Canada' | 'USA' | 'Other'>('Canada');
  const [playerCountryOther, setPlayerCountryOther] = useState('');
  const [playerBirthday, setPlayerBirthday] = useState<string>('');
  const [playerForm, setPlayerForm] = useState<{
    firstName: string; lastName: string; gender: 'MALE' | 'FEMALE';
    clubId: Id | '';
    dupr: string;
    city: string; region: string; country?: string;
    phone: string; email: string;
  }>({ firstName: '', lastName: '', gender: 'MALE', clubId: '', dupr: '', city: '', region: '', phone: '', email: '' });

  // Players filter: primary club
  const [playersClubFilter, setPlayersClubFilter] = useState<string>(''); // '' = all

  // create/edit tournament (legacy panel preserved)
  const [showCreateTournament, setShowCreateTournament] = useState(false);
  const [editTournamentId, setEditTournamentId] = useState<Id | null>(null);
  const [newTournamentName, setNewTournamentName] = useState('');
  type NewStop = { id?: Id; name: string; clubId?: Id; startAt?: string; endAt?: string };
  const [newStops, setNewStops] = useState<NewStop[]>([]);
  const [participants, setParticipants] = useState<ParticipantDraft[]>([]);

  /* ===== New fields for single editable panel ===== */
  type TournamentTypeLabel =
    | 'Team Format'
    | 'Single Elimination'
    | 'Double Elimination'
    | 'Round Robin'
    | 'Pool Play'
    | 'Ladder Tournament';

  const [editorById, setEditorById] = useState<Record<Id, {
    name: string;
    type: TournamentTypeLabel;
    clubs: ClubWithCaptains[];
    hasMultipleStops: boolean;
    hasLevels: boolean;
    hasCaptains: boolean;
    levels: NewLevel[];
    stops: NewStop[];
  }>>({});

  /* ========== initial load ========== */
  useEffect(() => {
    (async () => {
      try {
        clearMsg();
        const [ts, cs, ps] = await Promise.all([
          api<TournamentRow[]>('/api/admin/tournaments'),
          api<ClubsResponse>(`/api/admin/clubs?sort=${encodeURIComponent(`${clubSort.col}:${clubSort.dir}`)}`),
          api<PlayersResponse>(`/api/admin/players?take=25&skip=0&sort=${encodeURIComponent(`${playerSort.col}:${playerSort.dir}`)}${playersClubFilter ? `&clubId=${encodeURIComponent(playersClubFilter)}` : ''}`),
        ]);
        setTournaments(ts);
        setClubsAll(cs);
        setPlayersPage({ items: ps.items, total: ps.total, take: 25, skip: 0, sort: `${playerSort.col}:${playerSort.dir}` });
      } catch (e) { setErr((e as Error).message); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ========== players load/sort/paginate/filter ========== */
  async function loadPlayersPage(take: number, skip: number, sort: string, clubId: string) {
    const query = `/api/admin/players?take=${take}&skip=${skip}&sort=${encodeURIComponent(sort)}${clubId ? `&clubId=${encodeURIComponent(clubId)}` : ''}`;
    const resp = await api<PlayersResponse>(query);
    setPlayersPage({ items: resp.items, total: resp.total, take, skip, sort });
  }
  function clickSortPlayers(col: string) {
    const dir = (playerSort.col === col && playerSort.dir === 'asc') ? 'desc' : 'asc';
    setPlayerSort({ col, dir });
    loadPlayersPage(playersPage.take, 0, `${col}:${dir}`, playersClubFilter);
  }
  function changePlayersClubFilter(clubId: string) {
    setPlayersClubFilter(clubId);
    // reset to first page on filter change
    loadPlayersPage(playersPage.take, 0, `${playerSort.col}:${playerSort.dir}`, clubId);
  }

  /* ========== clubs load/sort ========== */
  async function reloadClubs() {
    const cs = await api<ClubsResponse>(`/api/admin/clubs?sort=${encodeURIComponent(`${clubSort.col}:${clubSort.dir}`)}`);
    setClubsAll(cs);
  }
  function clickSortClubs(col: 'name' | 'city' | 'region' | 'country' | 'phone') {
    const dir = (clubSort.col === col && clubSort.dir === 'asc') ? 'desc' : 'asc';
    setClubSort({ col, dir });
    (async () => { await reloadClubs(); })();
  }

  /* ========== tournaments expand/reload ========== */
  async function hydrateEditorFromConfig(tId: Id) {
    try {
      const cfg = await api<{
        id: string;
        name: string;
        type: TournamentTypeLabel;
        clubs: string[];
        levels: Array<{ id: string; name: string; idx: number }>;
        captains: Array<{ clubId: string; levelId: string; playerId: string }>;
        stops: Array<{ id: string; name: string; clubId?: string | null; startAt?: string | null; endAt?: string | null }>;
      }>(`/api/admin/tournaments/${tId}/config`);

      setEditorById(prev => {
        const clubRows: ClubWithCaptains[] = (cfg.clubs || []).map(clubId => {
          const captains: ClubWithCaptains['captains'] = {};
          const queries: ClubWithCaptains['queries'] = {};
          const options: ClubWithCaptains['options'] = {};
          (cfg.captains || []).forEach(c => {
            if (c.clubId === clubId) {
              const level = (cfg.levels || []).find(l => l.id === c.levelId);
              if (level) {
                captains[level.id] = { id: c.playerId, label: '' }; // will be resolved when user searches or after selection
                queries[level.id] = '';
                options[level.id] = [];
              }
            }
          });
          return { clubId, captains, queries, options };
        });

        return {
          ...prev,
          [tId]: {
            name: cfg.name,
            type: cfg.type || 'Team Format',
            hasMultipleStops: !!(cfg.stops && cfg.stops.length > 0),
            hasLevels: !!(cfg.levels && cfg.levels.length > 0),
            hasCaptains: !!(cfg.captains && cfg.captains.length > 0),
            clubs: clubRows,
            levels: (cfg.levels || []).map(l => ({ id: l.id, name: l.name })),
            stops: (cfg.stops || []).map(s => ({
              id: s.id,
              name: s.name,
              clubId: (s.clubId || undefined) as Id | undefined,
              startAt: toDateInput(s.startAt || null),
              endAt: toDateInput(s.endAt || null),
            })),
          }
        };
      });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  function toggleExpand(tId: Id) {
    setExpanded(prev => {
      const opening = !prev[tId];
      if (opening && !editorById[tId]) {
        hydrateEditorFromConfig(tId);
      }
      return { ...prev, [tId]: opening };
    });
  }

  function addNewStopRow() { setNewStops(prev => [...prev, { name: '' }]); }
  function updateNewStop(i: number, patch: Partial<NewStop>) { setNewStops(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s)); }
  function removeNewStop(i: number) { setNewStops(prev => prev.filter((_, idx) => idx !== i)); }

  async function createTournamentWithStops() {
    try {
      clearMsg();
      const name = newTournamentName.trim();
      if (!name) throw new Error('Tournament name is required');

      const participantPayload = participants
        .filter(p => p.clubId && p.intermediateCaptain?.id && p.advancedCaptain?.id)
        .map(p => ({ clubId: p.clubId!, intermediateCaptainId: p.intermediateCaptain!.id, advancedCaptainId: p.advancedCaptain!.id }));

      const t = await api<{ id: Id; name: string }>('/api/admin/tournaments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, participants: participantPayload }),
      });

      for (const s of newStops) {
        if (!s.name.trim()) continue;
        await api('/api/admin/stops', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tournamentId: t.id, name: s.name.trim(),
            clubId: s.clubId || null, startAt: s.startAt || null, endAt: s.endAt || null,
          }),
        });
      }

      const ts = await api<TournamentRow[]>('/api/admin/tournaments');
      setTournaments(ts);

      setShowCreateTournament(false);
      setEditTournamentId(null);
      setNewTournamentName('');
      setParticipants([]);
      setNewStops([]);

      setInfo(`Tournament "${t.name}" created`);
    } catch (e) { setErr((e as Error).message); }
  }

  async function openEditTournament(tId: Id) {
    try {
      clearMsg();
      setShowCreateTournament(true);
      setEditTournamentId(tId);

      const detail = await api<{
        id: string;
        name: string;
        participants: {
          clubId: string; clubName: string;
          intermediateCaptainId: string | null; intermediateCaptainName?: string | null;
          advancedCaptainId: string | null; advancedCaptainName?: string | null;
        }[];
        stops: { id: string; name: string; clubId?: string | null; startAt?: string | null; endAt?: string | null }[];
      }>(`/api/admin/tournaments/${tId}/detail`);

      setNewTournamentName(detail.name);

      setParticipants(detail.participants.map(p => ({
        clubId: p.clubId,
        intermediateCaptain: p.intermediateCaptainId ? { id: p.intermediateCaptainId, label: p.intermediateCaptainName || 'Loaded Captain' } : null,
        advancedCaptain:     p.advancedCaptainId     ? { id: p.advancedCaptainId,     label: p.advancedCaptainName     || 'Loaded Captain' } : null,
        iQuery: '',
        aQuery: '',
        iOptions: [],
        aOptions: [],
      })));

      setNewStops(detail.stops.map(s => ({
        id: s.id, name: s.name, clubId: s.clubId || undefined,
        startAt: toDateInput(s.startAt), endAt: toDateInput(s.endAt),
      })));

      setTab('tournaments');
    } catch (e) { setErr((e as Error).message); }
  }

  async function saveEditedTournament() {
    if (!editTournamentId) return;
    try {
      clearMsg();
      const name = newTournamentName.trim();
      if (!name) throw new Error('Tournament name is required');

      const participantPayload = participants
        .filter(p => p.clubId && p.intermediateCaptain?.id && p.advancedCaptain?.id)
        .map(p => ({ clubId: p.clubId!, intermediateCaptainId: p.intermediateCaptain!.id, advancedCaptainId: p.advancedCaptain!.id }));

      await api(`/api/admin/tournaments/${editTournamentId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, participants: participantPayload }),
      });

      const ts = await api<TournamentRow[]>('/api/admin/tournaments');
      setTournaments(ts);

      setShowCreateTournament(false);
      setEditTournamentId(null);
      setNewTournamentName('');
      setParticipants([]);
      setNewStops([]);

      setInfo('Tournament updated');
    } catch (e) { setErr((e as Error).message); }
  }

  async function deleteStop(tId: Id, stopId: Id) {
    try {
      if (!confirm('Delete this stop?')) return;
      await api(`/api/admin/stops/${stopId}`, { method: 'DELETE' });
    } catch (e) { setErr((e as Error).message); return; }
    // refresh lists after delete
    try {
      const [stops, ts] = await Promise.all([
        api<StopRow[]>(`/api/admin/stops?tournamentId=${tId}`),
        api<TournamentRow[]>('/api/admin/tournaments'),
      ]);
      setTournaments(prev => prev.map(t => t.id === tId ? { ...t, stops } : t));
      setTournaments(ts);
      setInfo('Stop deleted');
    } catch (e) { /* non-fatal */ }
  }

  async function quickAddStop(tId: Id, s: { name: string; clubId?: Id; startAt?: string; endAt?: string }) {
    try {
      if (!s.name.trim()) throw new Error('Stop name required');
      await api('/api/admin/stops', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: tId, ...s }),
      });
      const [stops, ts] = await Promise.all([
        api<StopRow[]>(`/api/admin/stops?tournamentId=${tId}`),
        api<TournamentRow[]>('/api/admin/tournaments'),
      ]);
      setTournaments(prev => prev.map(t => t.id === tId ? { ...t, stops } : t));
      setTournaments(ts);
      setInfo('Stop created');
    } catch (e) { setErr((e as Error).message); }
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

  /* ========== Clubs add/edit/delete (unchanged) ========== */
  function openEditClub(c?: Club) {
    setClubEditOpen(true);
    if (c) {
      setClubEditId(c.id);
      const ctry = (c.country || 'Canada') as string;
      const sel = (ctry === 'Canada' || ctry === 'USA') ? (ctry as 'Canada' | 'USA') : 'Other';
      setClubCountrySel(sel);
      setClubCountryOther(sel === 'Other' ? ctry : '');
      setClubForm({
        name: c.name || '',
        address: c.address || '',
        city: c.city || '',
        region: c.region || '',
        phone: c.phone || '',
        country: c.country || 'Canada',
      });
    } else {
      setClubEditId(null);
      setClubCountrySel('Canada'); setClubCountryOther('');
      setClubForm({ name: '', address: '', city: '', region: '', phone: '', country: 'Canada' });
    }
  }
  async function saveClub() {
    try {
      clearMsg();
      const country = clubCountrySel === 'Other' ? (clubCountryOther || '') : clubCountrySel;
      const payload = {
        name: clubForm.name.trim(),
        address: clubForm.address.trim(),
        city: clubForm.city.trim(),
        region: clubForm.region.trim(),
        phone: clubForm.phone.trim(),
        country,
      };
      if (clubEditId) {
        await api(`/api/admin/clubs/${clubEditId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } else {
        await api(`/api/admin/clubs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      await reloadClubs();
      setClubEditOpen(false);
      setInfo('Club saved');
    } catch (e) { setErr((e as Error).message); }
  }
  async function removeClub(id: Id) {
    try {
      if (!confirm('Delete this club?')) return;
      await api(`/api/admin/clubs/${id}`, { method: 'DELETE' });
    } catch (e) {
      setErr((e as Error).message);
      return;
    }
    await reloadClubs();
    setInfo('Club deleted');
  }

  /* ========== Players add/edit/delete (with Sex column + filter) ========== */
  function openEditPlayer(p?: Player) {
    setPlayerEditOpen(true);
    if (p) {
      setPlayerEditId(p.id);
      const ctry = (p.country || 'Canada') as string;
      const sel = (ctry === 'Canada' || ctry === 'USA') ? (ctry as 'Canada' | 'USA') : 'Other';
      setPlayerCountrySel(sel);
      setPlayerCountryOther(sel === 'Other' ? ctry : '');
      setPlayerBirthday('');
      setPlayerForm({
        firstName: (p.firstName || '').trim(),
        lastName: (p.lastName || '').trim(),
        gender: p.gender || 'MALE',
        clubId: (p.clubId as any) || '',
        dupr: p.dupr != null ? String(p.dupr) : '',
        city: (p.city || '').trim(),
        region: (p.region || '').trim(),
        phone: (p.phone || '').trim(),
        email: (p.email || '').trim(),
        country: p.country || 'Canada',
      });
    } else {
      setPlayerEditId(null);
      setPlayerCountrySel('Canada'); setPlayerCountryOther('');
      setPlayerBirthday('');
      setPlayerForm({ firstName: '', lastName: '', gender: 'MALE', clubId: '', dupr: '', city: '', region: '', phone: '', email: '' });
    }
  }
  async function savePlayer() {
    try {
      clearMsg();
      const country = playerCountrySel === 'Other' ? (playerCountryOther || '') : playerCountrySel;
      const payload = {
        firstName: playerForm.firstName.trim(),
        lastName: playerForm.lastName.trim(),
        gender: playerForm.gender,
        clubId: playerForm.clubId,
        dupr: playerForm.dupr ? Number(playerForm.dupr) : null,
        city: playerForm.city.trim(),
        region: playerForm.region.trim(),
        country,
        phone: playerForm.phone.trim(),
        email: playerForm.email.trim(),
        birthday: playerBirthday || null,
      };
      if (playerEditId) {
        await api(`/api/admin/players/${playerEditId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } else {
        await api('/api/admin/players', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      await loadPlayersPage(playersPage.take, playersPage.skip, `${playerSort.col}:${playerSort.dir}`, playersClubFilter);
      setPlayerEditOpen(false);
      setInfo('Player saved');
    } catch (e) { setErr((e as Error).message); }
  }
  async function removePlayer(id: Id) {
    try {
      if (!confirm('Delete this player?')) return;
      await api(`/api/admin/players/${id}`, { method: 'DELETE' });
      await loadPlayersPage(playersPage.take, playersPage.skip, `${playerSort.col}:${playerSort.dir}`, playersClubFilter);
      setInfo('Player deleted');
    } catch (e) { setErr((e as Error).message); }
  }

  /* ========== typeahead for NEW captains UI ========== */
  const allChosenCaptainIdsAcrossClubs = useMemo(() => {
    const ids = new Set<string>();
    Object.values(editorById).forEach(ed => {
      ed.clubs.forEach(crow => {
        Object.values(crow.captains).forEach(p => { if (p?.id) ids.add(p.id); });
      });
    });
    return ids;
  }, [editorById]);

  async function searchPlayers(term: string) {
    const data = await api<{ items: any[] }>(`/api/admin/players/search?term=${encodeURIComponent(term)}`);
    return (data.items || []).map((p: any) => ({ id: p.id, label: personLabel(p) }));
  }

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tournament Admin</h1>
        <nav className="flex gap-4 text-sm underline">
          <Link href="/">Home</Link>
          <Link href="/captain">Captain</Link>
          <Link href="/me">Player</Link>
        </nav>
      </div>

      {/* Tabs header */}
      <div className="border-b mb-2">
        <div className="flex gap-2">
          <TabButton active={tab==='tournaments'} onClick={()=>setTab('tournaments')}>Tournaments</TabButton>
          <TabButton active={tab==='clubs'} onClick={()=>setTab('clubs')}>Clubs</TabButton>
          <TabButton active={tab==='players'} onClick={()=>setTab('players')}>Players</TabButton>
        </div>
      </div>

      {err && <div className="border border-red-300 bg-red-50 text-red-700 p-3 rounded">{err}</div>}
      {info && <div className="border border-green-300 bg-green-50 text-green-700 p-3 rounded">{info}</div>}

      {/* ===== Tournaments ===== */}
      {tab === 'tournaments' && (
        <TournamentsBlock
          tournaments={tournaments}
          expanded={expanded}
          toggleExpand={toggleExpand}
          clubsAll={clubsAll}
          onQuickAddStop={quickAddStop}
          onDeleteStop={deleteStop}
          onReloadStops={async (tId) => {
            const fresh = await api<StopRow[]>(`/api/admin/stops?tournamentId=${tId}`);
            setTournaments(prev => prev.map(x => x.id === tId ? { ...x, stops: fresh } : x));
            const ts = await api<TournamentRow[]>('/api/admin/tournaments');
            setTournaments(ts);
          }}
          onEditTournament={openEditTournament}
          onDeleteTournament={deleteTournament}
          showCreateTournament={showCreateTournament}
          setShowCreateTournament={setShowCreateTournament}
          editTournamentId={editTournamentId}
          newTournamentName={newTournamentName}
          setNewTournamentName={setNewTournamentName}
          newStops={newStops}
          addNewStopRow={addNewStopRow}
          updateNewStop={updateNewStop}
          removeNewStop={removeNewStop}
          createTournamentWithStops={createTournamentWithStops}
          saveEditedTournament={saveEditedTournament}
          participants={participants}
          setParticipants={setParticipants}
          editorById={editorById}
          setEditorById={setEditorById}
          searchPlayers={searchPlayers}
          allChosenCaptainIdsAcrossClubs={allChosenCaptainIdsAcrossClubs}
          afterSaved={async () => {
            const ts = await api<TournamentRow[]>('/api/admin/tournaments');
            setTournaments(ts);
          }}
        />
      )}

      {/* ===== Clubs ===== */}
      {tab === 'clubs' && (
        <section className="border rounded p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Clubs</h2>
            <button className="border rounded px-3 py-1" onClick={() => openEditClub()}>Add Club</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <SortableTh label="Name" onClick={() => clickSortClubs('name')} active={clubSort.col === 'name'} dir={clubSort.dir} />
                  <SortableTh label="City" onClick={() => clickSortClubs('city')} active={clubSort.col === 'city'} dir={clubSort.dir} />
                  <SortableTh label="Province/State" onClick={() => clickSortClubs('region')} active={clubSort.col === 'region'} dir={clubSort.dir} />
                  <SortableTh label="Country" onClick={() => clickSortClubs('country')} active={clubSort.col === 'country'} dir={clubSort.dir} />
                  <SortableTh label="Phone" onClick={() => clickSortClubs('phone')} active={clubSort.col === 'phone'} dir={clubSort.dir} />
                  <th className="py-2 pr-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {clubsAll.length === 0 && <tr><td colSpan={6} className="py-4 text-gray-600">No clubs yet.</td></tr>}
                {clubsAll.map(c => (
                  <tr key={c.id} className="border-b">
                    <td className="py-2 pr-4"><button className="underline" onClick={() => openEditClub(c)}>{c.name}</button></td>
                    <td className="py-2 pr-4">{c.city ?? '—'}</td>
                    <td className="py-2 pr-4">{c.region ?? '—'}</td>
                    <td className="py-2 pr-4">{c.country ?? '—'}</td>
                    <td className="py-2 pr-4">{c.phone ?? '—'}</td>
                    <td className="py-2 pr-2 text-right align-middle">
                      <button aria-label="Delete club" onClick={() => removeClub(c.id)} title="Delete"><TrashIcon /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {clubEditOpen && (
            <div className="border rounded p-3 space-y-3">
              <h3 className="font-medium">{clubEditId ? 'Edit Club' : 'Add Club'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <input className="border rounded px-2 py-1" placeholder="Name" value={clubForm.name} onChange={e => setClubForm(f => ({ ...f, name: e.target.value }))} />
                <input className="border rounded px-2 py-1" placeholder="Address" value={clubForm.address} onChange={e => setClubForm(f => ({ ...f, address: e.target.value }))} />
                <input className="border rounded px-2 py-1" placeholder="City" value={clubForm.city} onChange={e => setClubForm(f => ({ ...f, city: e.target.value }))} />
                <select className="border rounded px-2 py-1" value={clubCountrySel} onChange={e => setClubCountrySel(e.target.value as any)}>
                  <option value="Canada">Canada</option>
                  <option value="USA">USA</option>
                  <option value="Other">Other</option>
                </select>
                {clubCountrySel === 'Other' ? (
                  <input className="border rounded px-2 py-1" placeholder="Country" value={clubCountryOther} onChange={e => setClubCountryOther(e.target.value)} />
                ) : <div />}
                {clubCountrySel === 'Canada' && (
                  <select className="border rounded px-2 py-1" value={clubForm.region} onChange={e => setClubForm(f => ({ ...f, region: e.target.value }))}>
                    <option value="">Province…</option>
                    {CA_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                )}
                {clubCountrySel === 'USA' && (
                  <select className="border rounded px-2 py-1" value={clubForm.region} onChange={e => setClubForm(f => ({ ...f, region: e.target.value }))}>
                    <option value="">State…</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
                {clubCountrySel === 'Other' && (
                  <input className="border rounded px-2 py-1" placeholder="Region/Province/State" value={clubForm.region} onChange={e => setClubForm(f => ({ ...f, region: e.target.value }))} />
                )}
                <input className="border rounded px-2 py-1" placeholder="Phone" value={clubForm.phone} onChange={e => setClubForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <button className="border rounded px-3 py-1" onClick={saveClub}>Save</button>
                <button className="border rounded px-3 py-1" onClick={() => setClubEditOpen(false)}>Cancel</button>
                {clubEditId && <button className="border rounded px-3 py-1 text-red-600" onClick={() => removeClub(clubEditId!)}><TrashIcon /></button>}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ===== Players ===== */}
      {tab === 'players' && (
        <section className="border rounded p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Players</h2>
            <button className="border rounded px-3 py-1" onClick={() => openEditPlayer()}>Add Player</button>
          </div>

          {/* Players Filters */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700">Primary Club</label>
              <select
                className="border rounded px-2 py-1"
                value={playersClubFilter}
                onChange={(e) => changePlayersClubFilter(e.target.value)}
              >
                <option value="">All Clubs</option>
                {clubsAll.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.city ? ` (${c.city})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <SortableTh label="First Name" onClick={() => clickSortPlayers('firstName')} active={playerSort.col === 'firstName'} dir={playerSort.dir} />
                  <SortableTh label="Last Name" onClick={() => clickSortPlayers('lastName')} active={playerSort.col === 'lastName'} dir={playerSort.dir} />
                  <SortableTh label="Sex" onClick={() => clickSortPlayers('gender')} active={playerSort.col === 'gender'} dir={playerSort.dir} />
                  <SortableTh label="Primary Club" onClick={() => clickSortPlayers('clubName')} active={playerSort.col === 'clubName'} dir={playerSort.dir} />
                  <SortableTh label="Age" onClick={() => clickSortPlayers('age')} active={playerSort.col === 'age'} dir={playerSort.dir} />
                  <SortableTh label="DUPR" onClick={() => clickSortPlayers('dupr')} active={playerSort.col === 'dupr'} dir={playerSort.dir} />
                  <SortableTh label="City" onClick={() => clickSortPlayers('city')} active={playerSort.col === 'city'} dir={playerSort.dir} />
                  <SortableTh label="Province/State" onClick={() => clickSortPlayers('region')} active={playerSort.col === 'region'} dir={playerSort.dir} />
                  <SortableTh label="Country" onClick={() => clickSortPlayers('country')} active={playerSort.col === 'country'} dir={playerSort.dir} />
                  <SortableTh label="Phone" onClick={() => clickSortPlayers('phone')} active={playerSort.col === 'phone'} dir={playerSort.dir} />
                  <th className="py-2 pr-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {playersPage.items.length === 0 && <tr><td colSpan={11} className="py-4 text-gray-600">No players yet.</td></tr>}
                {playersPage.items.map(p => (
                  <tr key={p.id} className="border-b">
                    <td className="py-2 pr-4">{p.firstName ?? '—'}</td>
                    <td className="py-2 pr-4"><button className="underline" onClick={() => openEditPlayer(p)}>{p.lastName ?? '—'}</button></td>
                    <td className="py-2 pr-4">{p.gender === 'FEMALE' ? 'F' : 'M'}</td>
                    <td className="py-2 pr-4">{p.club?.name ?? '—'}</td>
                    <td className="py-2 pr-4">{p.age ?? '—'}</td>
                    <td className="py-2 pr-4">{p.dupr ?? '—'}</td>
                    <td className="py-2 pr-4">{p.city ?? '—'}</td>
                    <td className="py-2 pr-4">{p.region ?? '—'}</td>
                    <td className="py-2 pr-4">{p.country ?? '—'}</td>
                    <td className="py-2 pr-4">{p.phone ?? '—'}</td>
                    <td className="py-2 pr-2 text-right align-middle"><button aria-label="Delete player" onClick={() => removePlayer(p.id)} title="Delete"><TrashIcon /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center gap-3">
            <button
              className="border rounded px-3 py-1"
              onClick={() => loadPlayersPage(playersPage.take, Math.max(0, playersPage.skip - playersPage.take), `${playerSort.col}:${playerSort.dir}`, playersClubFilter)}
              disabled={playersPage.skip <= 0}
            >
              ← Prev
            </button>
            <span className="text-sm">
              Page {Math.floor(playersPage.skip / playersPage.take) + 1} of {Math.max(1, Math.ceil(playersPage.total / playersPage.take))}
            </span>
            <button
              className="border rounded px-3 py-1"
              onClick={() => loadPlayersPage(playersPage.take, playersPage.skip + playersPage.take, `${playerSort.col}:${playerSort.dir}`, playersClubFilter)}
              disabled={playersPage.skip + playersPage.take >= playersPage.total}
            >
              Next →
            </button>
          </div>

          {/* Add/Edit Player */}
          {playerEditOpen && (
            <div className="border rounded p-3 space-y-3 mt-2">
              <h3 className="font-medium">{playerEditId ? 'Edit Player' : 'Add Player'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <input className="border rounded px-2 py-1" placeholder="First name" value={playerForm.firstName} onChange={e => setPlayerForm(f => ({ ...f, firstName: e.target.value }))} />
                <input className="border rounded px-2 py-1" placeholder="Last name" value={playerForm.lastName} onChange={e => setPlayerForm(f => ({ ...f, lastName: e.target.value }))} />
                <select className="border rounded px-2 py-1" value={playerForm.gender} onChange={e => setPlayerForm(f => ({ ...f, gender: e.target.value as any }))}>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>

                <input
                  className="border rounded px-2 py-1" type="date" value={playerBirthday}
                  onFocus={e => { if (!e.currentTarget.value) e.currentTarget.value = fortyYearsAgoISO(); }}
                  onChange={e => setPlayerBirthday(e.target.value)}
                />

                <select className="border rounded px-2 py-1" value={playerForm.clubId} onChange={e => setPlayerForm(f => ({ ...f, clubId: e.target.value as Id }))}>
                  <option value="">Primary Club…</option>
                  {clubsAll.map(c => <option key={c.id} value={c.id}>{c.name}{c.city ? ` (${c.city})` : ''}</option>)}
                </select>

                <input className="border rounded px-2 py-1" type="number" step="0.01" min="0" max="8" placeholder="DUPR" value={playerForm.dupr} onChange={e => setPlayerForm(f => ({ ...f, dupr: e.target.value }))} />

                <input className="border rounded px-2 py-1" placeholder="City" value={playerForm.city} onChange={e => setPlayerForm(f => ({ ...f, city: e.target.value }))} />

                <select className="border rounded px-2 py-1" value={playerCountrySel} onChange={e => setPlayerCountrySel(e.target.value as any)}>
                  <option value="Canada">Canada</option>
                  <option value="USA">USA</option>
                  <option value="Other">Other</option>
                </select>
                {playerCountrySel === 'Other' ? (
                  <input className="border rounded px-2 py-1" placeholder="Country" value={playerCountryOther} onChange={e => setPlayerCountryOther(e.target.value)} />
                ) : <div />}

                {playerCountrySel === 'Canada' && (
                  <select className="border rounded px-2 py-1" value={playerForm.region} onChange={e => setPlayerForm(f => ({ ...f, region: e.target.value }))}>
                    <option value="">Province…</option>
                    {CA_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                )}
                {playerCountrySel === 'USA' && (
                  <select className="border rounded px-2 py-1" value={playerForm.region} onChange={e => setPlayerForm(f => ({ ...f, region: e.target.value }))}>
                    <option value="">State…</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
                {playerCountrySel === 'Other' && (
                  <input className="border rounded px-2 py-1" placeholder="Region/Province/State" value={playerForm.region} onChange={e => setPlayerForm(f => ({ ...f, region: e.target.value }))} />
                )}

                <input className="border rounded px-2 py-1" placeholder="Phone (10 digits)" value={playerForm.phone} onChange={e => setPlayerForm(f => ({ ...f, phone: e.target.value }))} />
                <input className="border rounded px-2 py-1" type="email" placeholder="Email" value={playerForm.email} onChange={e => setPlayerForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <button className="border rounded px-3 py-1" onClick={savePlayer}>Save</button>
                <button className="border rounded px-3 py-1" onClick={() => setPlayerEditOpen(false)}>Cancel</button>
                {playerEditId && <button className="border rounded px-3 py-1 text-red-600" onClick={() => removePlayer(playerEditId!)}><TrashIcon /></button>}
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

/* ================= Subcomponents ================= */
function FragmentRow({ children }: { children: React.ReactNode }) { return <>{children}</>; }
function SortableTh({ label, onClick, active, dir }: { label: string; onClick: () => void; active: boolean; dir: 'asc'|'desc' }) {
  return (
    <th className="py-2 pr-4 select-none">
      <button className="inline-flex items-center gap-1 underline" onClick={onClick} title="Sort">
        <span>{label}</span>
        <span className="text-xs opacity-70">{active ? (dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );
}
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
function TabButton({ active, onClick, children }: { active: boolean; onClick: ()=>void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 -mb-px border-b-2 ${active ? 'border-black font-semibold' : 'border-transparent text-gray-600 hover:text-black'}`}
    >
      {children}
    </button>
  );
}

/* ================= Tournaments block: single inline editor ================= */
function TournamentsBlock(props: {
  tournaments: TournamentRow[];
  expanded: Record<Id, boolean>;
  toggleExpand: (tId: Id) => void;
  clubsAll: Club[];
  onQuickAddStop: (tId: Id, s: { name: string; clubId?: Id; startAt?: string; endAt?: string }) => void;
  onDeleteStop: (tId: Id, stopId: Id) => void;
  onReloadStops: (tId: Id) => void;
  onEditTournament: (tId: Id) => void;
  onDeleteTournament: (tId: Id) => void;

  showCreateTournament: boolean;
  setShowCreateTournament: (b: boolean) => void;
  editTournamentId: Id | null;
  newTournamentName: string;
  setNewTournamentName: (s: string) => void;
  newStops: { id?: Id; name: string; clubId?: Id; startAt?: string; endAt?: string }[];
  addNewStopRow: () => void;
  updateNewStop: (i: number, patch: Partial<{ id?: Id; name: string; clubId?: Id; startAt?: string; endAt?: string }>) => void;
  removeNewStop: (i: number) => void;
  createTournamentWithStops: () => void;
  saveEditedTournament: () => void;

  participants: ParticipantDraft[];
  setParticipants: React.Dispatch<React.SetStateAction<ParticipantDraft[]>>;

  editorById: Record<Id, {
    name: string;
    type: 'Team Format' | 'Single Elimination' | 'Double Elimination' | 'Round Robin' | 'Pool Play' | 'Ladder Tournament';
    clubs: ClubWithCaptains[];
    hasMultipleStops: boolean;
    hasLevels: boolean;
    hasCaptains: boolean;
    levels: NewLevel[];
    stops: { id?: Id; name: string; clubId?: Id; startAt?: string; endAt?: string }[];
  }>;
  setEditorById: React.Dispatch<React.SetStateAction<TournamentsBlock['props']['editorById']>>;
  searchPlayers: (term: string)=>Promise<Array<{id:string;label:string}>>;
  allChosenCaptainIdsAcrossClubs: Set<string>;
  afterSaved: () => Promise<void>;
}) {
  const {
    tournaments, expanded, toggleExpand, clubsAll,
    onDeleteTournament,
    showCreateTournament, setShowCreateTournament, editTournamentId,
    newTournamentName, setNewTournamentName,
    createTournamentWithStops, saveEditedTournament,
    editorById, setEditorById, searchPlayers, allChosenCaptainIdsAcrossClubs,
    afterSaved,
  } = props;

  // Debounce timers per (tournamentId:clubIdx:levelId)
  const searchTimers = useRef<Record<string, number>>({});
  const keyFor = (tId: Id, clubIdx: number, levelId: string) => `${tId}:${clubIdx}:${levelId}`;

  function editor(tId: Id) { return editorById[tId]; }

  function addClubRow(tId: Id) {
    setEditorById(prev => {
      const ed = prev[tId]; if (!ed) return prev;
      return {
        ...prev,
        [tId]: {
          ...ed,
          clubs: [...ed.clubs, { clubId: undefined, captains: {}, queries: {}, options: {} }],
        }
      };
    });
  }
  function removeClubRow(tId: Id, idx: number) {
    setEditorById(prev => {
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

  function addLevel(tId: Id) {
    setEditorById(prev => {
      const ed = prev[tId]; if (!ed) return prev;
      const id = (globalThis.crypto ?? window.crypto).randomUUID();
      return { ...prev, [tId]: { ...ed, levels: [...ed.levels, { id, name: '' }] } };
    });
  }
  function removeLevel(tId: Id, levelId: string) {
    setEditorById(prev => {
      const ed = prev[tId]; if (!ed) return prev;
      const nextLevels = ed.levels.filter(l => l.id !== levelId);
      const nextClubs = ed.clubs.map(crow => {
        const { [levelId]: _, ...restCapt } = crow.captains;
        const { [levelId]: __, ...restQ } = crow.queries;
        const { [levelId]: ___, ...restOpt } = crow.options;
        return { ...crow, captains: restCapt, queries: restQ, options: restOpt };
      });
      return { ...prev, [tId]: { ...ed, levels: nextLevels, clubs: nextClubs } };
    });
  }

  function setCaptainQuery(tId: Id, clubIdx: number, levelId: string, q: string) {
    setEditorById(prev => {
      const ed = prev[tId]; if (!ed) return prev;
      const rows = [...ed.clubs];
      const row = { ...rows[clubIdx] };
      row.queries = { ...row.queries, [levelId]: q };
      // clear options; they’ll be repopulated by debounce below
      row.options = { ...row.options, [levelId]: [] };
      rows[clubIdx] = row;
      return { ...prev, [tId]: { ...ed, clubs: rows } };
    });

    // debounce AJAX lookup after 300ms
    const k = keyFor(tId, clubIdx, levelId);
    if (searchTimers.current[k]) {
      clearTimeout(searchTimers.current[k]);
    }
    searchTimers.current[k] = window.setTimeout(() => {
      runCaptainSearch(tId, clubIdx, levelId);
    }, 300);
  }

  async function runCaptainSearch(tId: Id, clubIdx: number, levelId: string) {
    const ed = editor(tId); if (!ed) return;
    const q = ed.clubs[clubIdx]?.queries?.[levelId] || '';
    if (q.trim().length < 3) return;
    const opts = await searchPlayers(q.trim());
    // exclude players chosen for other clubs
    const selectedElsewhere = new Set<string>();
    ed.clubs.forEach((crow, idx) => {
      if (idx === clubIdx) return;
      Object.values(crow.captains).forEach(p => { if (p?.id) selectedElsewhere.add(p.id); });
    });
    const filtered = opts.filter(o => !selectedElsewhere.has(o.id));
    setEditorById(prev => {
      const ed2 = prev[tId]; if (!ed2) return prev;
      const rows = [...ed2.clubs];
      const row = { ...rows[clubIdx] };
      row.options = { ...row.options, [levelId]: filtered };
      rows[clubIdx] = row;
      return { ...prev, [tId]: { ...ed2, clubs: rows } };
    });
  }

  function chooseCaptain(tId: Id, clubIdx: number, levelId: string, pick: {id:string;label:string}) {
    setEditorById(prev => {
      const ed = prev[tId]; if (!ed) return prev;
      const rows = [...ed.clubs];
      const row = { ...rows[clubIdx] };
      row.captains = { ...row.captains, [levelId]: pick };
      row.queries = { ...row.queries, [levelId]: '' }; // clear input once chosen
      row.options = { ...row.options, [levelId]: [] };
      rows[clubIdx] = row;
      return { ...prev, [tId]: { ...ed, clubs: rows } };
    });
  }
  function removeCaptain(tId: Id, clubIdx: number, levelId: string) {
    setEditorById(prev => {
      const ed = prev[tId]; if (!ed) return prev;
      const rows = [...ed.clubs];
      const row = { ...rows[clubIdx] };
      const { [levelId]: _, ...rest } = row.captains;
      row.captains = rest;
      row.queries = { ...row.queries, [levelId]: '' };
      row.options = { ...row.options, [levelId]: [] };
      rows[clubIdx] = row;
      return { ...prev, [tId]: { ...ed, clubs: rows } };
    });
  }

  async function saveInline(tId: Id) {
    const ed = editor(tId);
    if (!ed) return;

    const name = (ed.name || '').trim();
    if (!name) throw new Error('Tournament name is required');

    const payload: {
      name: string;
      type: TournamentsBlock['props']['editorById'][Id]['type'];
      clubs: string[];
      levels: Array<{ id?: string; name: string; idx?: number }>;
      captains: Array<{ clubId: string; levelId: string; playerId: string }>;
      stops: Array<{ id?: string; name: string; clubId?: string | null; startAt?: string | null; endAt?: string | null }>;
    } = {
      name,
      type: ed.type,
      clubs: [],
      levels: [],
      captains: [],
      stops: [],
    };

    if ( ed.type === 'Team Format') {
      payload.clubs = Array.from(new Set(ed.clubs.map(c => c.clubId).filter(Boolean) as string[]));

      if (ed.hasLevels) {
        payload.levels = ed.levels
          .map((l, idx) => ({ id: l.id, name: (l.name || '').trim(), idx }))
          .filter(l => !!l.name);
      }

      if (ed.hasLevels && ed.hasCaptains) {
        for (const crow of ed.clubs) {
          if (!crow.clubId) continue;
          for (const lvl of ed.levels) {
            const pick = crow.captains[lvl.id];
            if (pick?.id) payload.captains.push({ clubId: crow.clubId, levelId: lvl.id, playerId: pick.id });
          }
        }
      }

      if (ed.hasMultipleStops) {
        payload.stops = ed.stops
          .filter(s => (s.name || '').trim())
          .map(s => ({
            id: s.id,
            name: s.name.trim(),
            clubId: s.clubId || null,
            startAt: s.startAt || null,
            endAt: s.endAt || null,
          }));
      }
    }

    await api(`/api/admin/tournaments/${tId}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Re-hydrate editor from server so new Stops get their IDs (prevents duplicates on next save)
    try {
      const cfg = await api<{
        id: string;
        name: string;
        type: typeof ed.type;
        clubs: string[];
        levels: Array<{ id: string; name: string; idx: number }>;
        captains: Array<{ clubId: string; levelId: string; playerId: string }>;
        stops: Array<{ id: string; name: string; clubId?: string | null; startAt?: string | null; endAt?: string | null }>;
      }>(`/api/admin/tournaments/${tId}/config`);

      setEditorById(prev => {
        const clubRows: ClubWithCaptains[] = (cfg.clubs || []).map(clubId => {
          const captains: ClubWithCaptains['captains'] = {};
          const queries: ClubWithCaptains['queries'] = {};
          const options: ClubWithCaptains['options'] = {};
          (cfg.captains || []).forEach(c => {
            if (c.clubId === clubId) {
              const level = (cfg.levels || []).find(l => l.id === c.levelId);
              if (level) {
                captains[level.id] = { id: c.playerId, label: '' };
                queries[level.id] = '';
                options[level.id] = [];
              }
            }
          });
          return { clubId, captains, queries, options };
        });

        return {
          ...prev,
          [tId]: {
            name: cfg.name,
            type: (cfg.type as any) || 'Team Format',
            hasMultipleStops: !!(cfg.stops && cfg.stops.length > 0),
            hasLevels: !!(cfg.levels && cfg.levels.length > 0),
            hasCaptains: !!(cfg.captains && cfg.captains.length > 0),
            clubs: clubRows,
            levels: (cfg.levels || []).map(l => ({ id: l.id, name: l.name })),
            stops: (cfg.stops || []).map(s => ({
              id: s.id,
              name: s.name,
              clubId: (s.clubId || undefined) as Id | undefined,
              startAt: toDateInput(s.startAt || null),
              endAt: toDateInput(s.endAt || null),
            })),
          }
        };
      });
    } catch {
      // ignore rehydrate failure; backend has saved
    }

    await afterSaved();
    toggleExpand(tId);
  }

  return (
    <section className="border rounded p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tournaments</h2>
        <button className="border rounded px-3 py-1" onClick={() => { setShowCreateTournament(true); }}>Create Tournament</button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="text-left border-b">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4"># of Stops</th>
            <th className="py-2 pr-4">Participating Clubs</th>
            <th className="py-2 pr-4">Dates</th>
            <th className="py-2 pr-2 w-24"></th>
          </tr></thead>
          <tbody>
            {tournaments.map(t => {
              const isOpen = !!expanded[t.id];
              const ed = editorById[t.id];

              return (
                <FragmentRow key={t.id}>
                  <tr className="border-b">
                    <td className="py-2 pr-4">
                      <button className="underline" onClick={() => toggleExpand(t.id)}>{t.name}</button>
                    </td>
                    <td className="py-2 pr-4">{t.stats.stopCount}</td>
                    <td className="py-2 pr-4">{t.stats.participatingClubs.length ? t.stats.participatingClubs.join(', ') : '—'}</td>
                    <td className="py-2 pr-4">{between(t.stats.dateRange.start, t.stats.dateRange.end)}</td>
                    <td className="py-2 pr-2 text-right">
                      <button aria-label="Delete tournament" onClick={() => onDeleteTournament(t.id)} title="Delete"><TrashIcon /></button>
                    </td>
                  </tr>

                  {isOpen && ed && (
                    <tr>
                      <td colSpan={5} className="bg-gray-50 p-4">
                        {/* SINGLE EDITABLE PANEL */}
                        <div className="space-y-6">
                          {/* Name + Type */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="flex items-center gap-2">
                              <label className="w-28 text-sm text-gray-700">Name</label>
                              <input
                                className="border rounded px-2 py-1 w-full"
                                value={ed.name}
                                onChange={(e) => setEditorById(prev => ({ ...prev, [t.id]: { ...ed, name: e.target.value } }))}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="w-28 text-sm text-gray-700">Type</label>
                              <select
                                className="border rounded px-2 py-1 w-full"
                                value={ed.type}
                                onChange={(e) => setEditorById(prev => ({ ...prev, [t.id]: { ...ed, type: e.target.value as typeof ed.type } }))}
                              >
                                {(['Team Format','Single Elimination','Double Elimination','Round Robin','Pool Play','Ladder Tournament'] as const).map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Flags – just under Name in the new order */}
                          <div className="flex flex-wrap items-center gap-6">
                            <label className="inline-flex items-center gap-2">
                              <input type="checkbox" checked={ed.hasLevels} onChange={e => setEditorById(prev => ({ ...prev, [t.id]: { ...ed, hasLevels: e.target.checked } }))} />
                              <span>Levels</span>
                            </label>
                            <label className="inline-flex items-center gap-2">
                              <input type="checkbox" checked={ed.hasCaptains} onChange={e => setEditorById(prev => ({ ...prev, [t.id]: { ...ed, hasCaptains: e.target.checked } }))} />
                              <span>Captains</span>
                            </label>
                            <label className="inline-flex items-center gap-2">
                              <input type="checkbox" checked={ed.hasMultipleStops} onChange={e => setEditorById(prev => ({ ...prev, [t.id]: { ...ed, hasMultipleStops: e.target.checked } }))} />
                              <span>Multiple Stops</span>
                            </label>
                          </div>

                          {/* ORDER: Levels → Stops → Participating Clubs */}
                          {/* Levels */}
                          {ed.type === 'Team Format' && ed.hasLevels && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h3 className="font-medium">Levels</h3>
                                <button className="border rounded px-3 py-1" onClick={() => addLevel(t.id)}>Add Level</button>
                              </div>
                              {ed.levels.length === 0 && <p className="text-sm text-gray-600">No levels yet.</p>}
                              {ed.levels.map(level => (
                                <div key={level.id} className="flex items-center gap-2">
                                  <input
                                    className="border rounded px-2 py-1"
                                    placeholder="Level name (e.g., Intermediate)"
                                    value={level.name}
                                    onChange={e => setEditorById(prev => {
                                      const ed2 = prev[t.id]; if (!ed2) return prev;
                                      const next = ed2.levels.map(l => l.id === level.id ? { ...l, name: e.target.value } : l);
                                      return { ...prev, [t.id]: { ...ed2, levels: next } };
                                    })}
                                  />
                                  <button className="px-2 py-1" aria-label="Remove level" title="Remove level" onClick={() => removeLevel(t.id, level.id)}>
                                    <TrashIcon />
                                  </button>
                                </div>
                              ))}
                              <p className="text-xs text-gray-500">Levels are used to build separate teams per club (e.g., Intermediate, Advanced).</p>
                            </div>
                          )}

                          {/* Stops */}
                          {ed.type === 'Team Format' && ed.hasMultipleStops && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h3 className="font-medium">Stops</h3>
                                <button className="border rounded px-3 py-1" onClick={() => setEditorById(prev => ({ ...prev, [t.id]: { ...ed, stops: [...ed.stops, { name: '' }] } }))}>Add Stop</button>
                              </div>
                              {ed.stops.length === 0 && <p className="text-sm text-gray-600">No stops added yet.</p>}
                              {ed.stops.map((s, i) => (
                                <div key={s.id ?? i} className="border rounded p-3 space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <input className="border rounded px-2 py-1" placeholder="Stop name" value={s.name}
                                      onChange={e => setEditorById(prev => {
                                        const ed2 = prev[t.id]; if (!ed2) return prev;
                                        const nextS = [...ed2.stops]; nextS[i] = { ...nextS[i], name: e.target.value };
                                        return { ...prev, [t.id]: { ...ed2, stops: nextS } };
                                      })}
                                    />
                                    <select className="border rounded px-2 py-1" value={s.clubId || ''}
                                      onChange={e => setEditorById(prev => {
                                        const ed2 = prev[t.id]; if (!ed2) return prev;
                                        const nextS = [...ed2.stops]; nextS[i] = { ...nextS[i], clubId: (e.target.value || undefined) as Id|undefined };
                                        return { ...prev, [t.id]: { ...ed2, stops: nextS } };
                                      })}
                                    >
                                      <option value="">Location (Club)…</option>
                                      {props.clubsAll.map(c => <option key={c.id} value={c.id}>{c.name}{c.city ? ` (${c.city})` : ''}</option>)}
                                    </select>
                                    <input className="border rounded px-2 py-1" type="date" value={s.startAt || ''} onChange={e => {
                                      const start = e.target.value || '';
                                      setEditorById(prev => {
                                        const ed2 = prev[t.id]; if (!ed2) return prev;
                                        const nextS = [...ed2.stops]; nextS[i] = { ...nextS[i], startAt: start, endAt: s.endAt ? s.endAt : start };
                                        return { ...prev, [t.id]: { ...ed2, stops: nextS } };
                                      });
                                    }} />
                                    <input className="border rounded px-2 py-1" type="date" value={s.endAt || ''} onChange={e => {
                                      const end = e.target.value || '';
                                      setEditorById(prev => {
                                        const ed2 = prev[t.id]; if (!ed2) return prev;
                                        const nextS = [...ed2.stops]; nextS[i] = { ...nextS[i], endAt: end };
                                        return { ...prev, [t.id]: { ...ed2, stops: nextS } };
                                      });
                                    }} />
                                    <button className="px-2 py-1" aria-label="Remove stop" title="Remove stop" onClick={() => setEditorById(prev => {
                                      const ed2 = prev[t.id]; if (!ed2) return prev;
                                      const nextS = ed2.stops.filter((_, idx) => idx !== i);
                                      return { ...prev, [t.id]: { ...ed2, stops: nextS } };
                                    })}>
                                      <TrashIcon />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Participating Clubs (with Captain selectors) */}
                          {ed.type === 'Team Format' && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h3 className="font-medium">Participating Clubs</h3>
                                <button className="border rounded px-3 py-1" onClick={() => addClubRow(t.id)}>Add Club</button>
                              </div>
                              {ed.clubs.length === 0 && <p className="text-sm text-gray-600">No clubs yet.</p>}
                              <div className="space-y-2">
                                {ed.clubs.map((row, idx) => (
                                  <div key={idx} className="border rounded p-3 space-y-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <select
                                        className="border rounded px-2 py-1"
                                        value={row.clubId || ''}
                                        onChange={e => {
                                          const clubId = e.target.value || undefined;
                                          setEditorById(prev => {
                                            const ed2 = prev[t.id]; if (!ed2) return prev;
                                            const next = [...ed2.clubs];
                                            next[idx] = { ...next[idx], clubId };
                                            return { ...prev, [t.id]: { ...ed2, clubs: next } };
                                          });
                                        }}
                                      >
                                        <option value="">Select Club…</option>
                                        {availableClubsForRow(t.id, idx).map(c => (
                                          <option key={c.id} value={c.id}>{c.name}{c.city ? ` (${c.city})` : ''}</option>
                                        ))}
                                      </select>

                                      <button className="px-2 py-1" aria-label="Remove club" title="Remove club" onClick={() => removeClubRow(t.id, idx)}>
                                        <TrashIcon />
                                      </button>
                                    </div>

                                    {/* Captain pickers inline per club & level */}
                                    {ed.hasLevels && ed.hasCaptains && row.clubId && ed.levels.length > 0 && (
                                      <div className="space-y-2">
                                        { ed.levels.map(level => {
                                          const q = row.queries[level.id] || '';
                                          const opts = row.options[level.id] || [];
                                          const pick = row.captains[level.id] || null;
                                          const label = level.name ? `${level.name} Captain` : 'Captain';
                                          return (
                                            <div key={level.id} className="flex flex-col gap-1">
                                              {/* If selected → show label + remove icon; else show input */}
                                              {pick?.id ? (
                                                <div className="flex items-center justify-between gap-2">
                                                  <div className="text-sm">
                                                    <span className="font-medium">{label}:</span>{' '}
                                                    <span>{pick.label || '(selected)'}</span>
                                                  </div>
                                                  <button
                                                    className="px-2 py-1"
                                                    aria-label={`Remove ${label.toLowerCase()}`}
                                                    title={`Remove ${label.toLowerCase()}`}
                                                    onClick={() => removeCaptain(t.id, idx, level.id)}
                                                  >
                                                    <TrashIcon />
                                                  </button>
                                                </div>
                                              ) : (
                                                <div className="flex-1">
                                                  <div className="text-xs text-gray-600 mb-1">{label}</div>
                                                  <input
                                                    className="border rounded px-2 py-1 w-full"
                                                    placeholder="Type 3+ chars to search players…"
                                                    value={q}
                                                    onChange={e => setCaptainQuery(t.id, idx, level.id, e.target.value)}
                                                  />
                                                  {!!opts.length && (
                                                    <div className="border rounded mt-1 bg-white max-h-40 overflow-auto">
                                                      {opts
                                                        .filter(o => !props.allChosenCaptainIdsAcrossClubs.has(o.id))
                                                        .map(o => (
                                                          <button
                                                            key={o.id}
                                                            className="block w-full text-left px-2 py-1 hover:bg-gray-50"
                                                            onClick={() => chooseCaptain(t.id, idx, level.id, o)}
                                                          >
                                                            {o.label}
                                                          </button>
                                                        ))}
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
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
                            <button className="border rounded px-3 py-1" onClick={() => toggleExpand(t.id)}>Close</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </FragmentRow>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legacy create/edit panel (preserved) */}
      {showCreateTournament && (
        <div className="border rounded p-3 space-y-6">
          <div className="flex items-center gap-2">
            <label className="w-36 text-sm text-gray-700">{editTournamentId ? 'Edit Tournament' : 'Tournament Name'}</label>
            <input className="border rounded px-2 py-1 flex-1" value={newTournamentName} onChange={e => setNewTournamentName(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            {!editTournamentId ? (
              <>
                <button className="border rounded px-3 py-1" onClick={createTournamentWithStops} disabled={!newTournamentName.trim()}>Save Tournament</button>
                <button className="border rounded px-3 py-1" onClick={() => { setShowCreateTournament(false); }}>Cancel</button>
              </>
            ) : (
              <>
                <button className="border rounded px-3 py-1" onClick={saveEditedTournament}>Save Changes</button>
                <button className="border rounded px-3 py-1" onClick={() => { setShowCreateTournament(false); }}>Cancel</button>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
