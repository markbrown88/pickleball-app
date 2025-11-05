'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { useAdminUser } from '../admin/AdminContext';

const CA_PROVINCES = ['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'] as const;
const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME',
  'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA',
  'RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
] as const;

type Id = string;

type Club = {
  id: Id; name: string;
  city?: string | null;
};

type Player = {
  id: Id;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  gender: 'MALE' | 'FEMALE';
  clubId?: Id | null;
  club?: Club | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  dupr?: number | null;
  age?: number | null;
  birthdayYear?: number | null;
  birthdayMonth?: number | null;
  birthdayDay?: number | null;
  disabled?: boolean;
  disabledAt?: Date | null;
};

type PlayersResponse = { items: Player[]; total: number } | Player[];

function extractError(body: unknown, status: number): string {
  if (typeof body === 'string') return body;
  if (body && typeof body === 'object' && 'error' in body && typeof (body as { error?: unknown }).error === 'string') {
    return (body as { error: string }).error;
  }
  return `HTTP ${status}`;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    throw new Error(extractError(body, res.status));
  }
  return body as T;
}

function normalizePlayersResponse(value: PlayersResponse | undefined): { items: Player[]; total: number } {
  if (!value) return { items: [], total: 0 };
  if (Array.isArray(value)) return { items: value, total: value.length };
  const items = Array.isArray(value.items) ? value.items : [];
  const total = typeof value.total === 'number' ? value.total : items.length;
  return { items, total };
}

export default function PlayersPage() {
  const router = useRouter();
  const admin = useAdminUser();
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [playersPage, setPlayersPage] = useState<{ items: Player[]; total: number; take: number; skip: number; sort: string }>(
    { items: [], total: 0, take: 25, skip: 0, sort: 'lastName:asc' }
  );
  const [playerSort, setPlayerSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'lastName', dir: 'asc' });
  const [playerSearch, setPlayerSearch] = useState('');

  const [playersClubFilter, setPlayersClubFilter] = useState<string>('');
  const [showDisabledPlayers, setShowDisabledPlayers] = useState(false);
  const [clubsAll, setClubsAll] = useState<Club[]>([]);

  const playerSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playersRequestRef = useRef(0);
  const playersListConfigRef = useRef({ take: playersPage.take, sort: `${playerSort.col}:${playerSort.dir}`, clubId: playersClubFilter });

  const loadPlayersPage = useCallback(async (take: number, skip: number, sort: string, clubId: string, searchTerm: string = playerSearch, showDisabled: boolean = showDisabledPlayers) => {
    const requestId = playersRequestRef.current + 1;
    playersRequestRef.current = requestId;
    try {
      const term = searchTerm.trim();
      const query = `/api/admin/players?take=${take}&skip=${skip}&sort=${encodeURIComponent(sort)}${clubId ? `&clubId=${encodeURIComponent(clubId)}` : ''}${term ? `&search=${encodeURIComponent(term)}` : ''}${showDisabled ? '&showDisabled=true' : ''}`;
      const respRaw = await api<PlayersResponse>(query);
      const resp = normalizePlayersResponse(respRaw);
      if (requestId === playersRequestRef.current) {
        setPlayersPage({ items: resp.items, total: resp.total, take, skip, sort });
      }
    } catch (e) {
      if (requestId === playersRequestRef.current) {
        setPlayersPage({ items: [], total: 0, take, skip, sort });
        setErr((e as Error).message);
      }
    }
  }, [playerSearch, showDisabledPlayers]);

  const reloadClubs = useCallback(async () => {
    const data = await api<Club[]>('/api/admin/clubs?sort=name:asc');
    setClubsAll(data);
  }, []);

  useEffect(() => {
    playersListConfigRef.current = { take: playersPage.take, sort: `${playerSort.col}:${playerSort.dir}`, clubId: playersClubFilter };
  }, [playersPage.take, playerSort.col, playerSort.dir, playersClubFilter]);

  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        setLoading(true);
        await Promise.all([
          loadPlayersPage(playersPage.take, playersPage.skip, `${playerSort.col}:${playerSort.dir}`, playersClubFilter, playerSearch),
          reloadClubs(),
        ]);
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (playerSearchDebounceRef.current) {
        clearTimeout(playerSearchDebounceRef.current);
        playerSearchDebounceRef.current = null;
      }
    };
  }, []);

  const handlePlayerSearchInput = useCallback((value: string) => {
    setPlayerSearch(value);
    if (playerSearchDebounceRef.current) {
      clearTimeout(playerSearchDebounceRef.current);
      playerSearchDebounceRef.current = null;
    }
    const term = value.trim();
    if (!term) {
      const cfg = playersListConfigRef.current;
      void loadPlayersPage(cfg.take, 0, cfg.sort, cfg.clubId, '');
      return;
    }
    playerSearchDebounceRef.current = setTimeout(() => {
      const cfg = playersListConfigRef.current;
      void loadPlayersPage(cfg.take, 0, cfg.sort, cfg.clubId, term);
    }, 300);
  }, [loadPlayersPage]);

  const clearPlayerSearch = useCallback(() => {
    setPlayerSearch('');
    if (playerSearchDebounceRef.current) {
      clearTimeout(playerSearchDebounceRef.current);
      playerSearchDebounceRef.current = null;
    }
    const cfg = playersListConfigRef.current;
    void loadPlayersPage(cfg.take, 0, cfg.sort, cfg.clubId, '');
  }, [loadPlayersPage]);

  const submitPlayerSearch = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (playerSearchDebounceRef.current) {
      clearTimeout(playerSearchDebounceRef.current);
      playerSearchDebounceRef.current = null;
    }
    const cfg = playersListConfigRef.current;
    void loadPlayersPage(cfg.take, 0, cfg.sort, cfg.clubId, playerSearch);
  }, [loadPlayersPage, playerSearch]);

  const clickSortPlayers = useCallback((col: string) => {
    const dir = (playerSort.col === col && playerSort.dir === 'asc') ? 'desc' : 'asc';
    setPlayerSort({ col, dir });
    void loadPlayersPage(playersPage.take, 0, `${col}:${dir}`, playersClubFilter, playerSearch);
  }, [loadPlayersPage, playerSort, playersPage.take, playersClubFilter, playerSearch]);

  const changePlayersClubFilter = useCallback((clubId: string) => {
    setPlayersClubFilter(clubId);
    void loadPlayersPage(playersPage.take, 0, `${playerSort.col}:${playerSort.dir}`, clubId, playerSearch);
  }, [loadPlayersPage, playersPage.take, playerSort.col, playerSort.dir, playerSearch]);

  const removePlayer = useCallback(async (id: Id) => {
    if (!confirm('Delete this player?')) return;
    try {
      setErr(null);
      await api(`/api/admin/players/${id}`, { method: 'DELETE' });
      await loadPlayersPage(playersPage.take, playersPage.skip, `${playerSort.col}:${playerSort.dir}`, playersClubFilter, playerSearch);
      setInfo('Player deleted');
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [loadPlayersPage, playersPage.take, playersPage.skip, playerSort, playersClubFilter, playerSearch]);

  const togglePlayerDisabled = useCallback(async (player: Player) => {
    const action = player.disabled ? 'enable' : 'disable';
    if (!confirm(`Are you sure you want to ${action} this player?`)) return;
    try {
      setErr(null);
      await api(`/api/admin/players/${player.id}/toggle-disabled`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      await loadPlayersPage(playersPage.take, playersPage.skip, `${playerSort.col}:${playerSort.dir}`, playersClubFilter, playerSearch, showDisabledPlayers);
      setInfo(`Player ${action}d successfully`);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [loadPlayersPage, playersPage.take, playersPage.skip, playerSort, playersClubFilter, playerSearch, showDisabledPlayers]);

  const filteredClubs = useMemo(() => clubsAll, [clubsAll]);

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Players</h1>
          <p className="text-muted">
            {admin.isAppAdmin
              ? 'Manage player profiles and search across clubs.'
              : 'Manage player profiles for your club.'}
          </p>
        </div>
        {(admin.isAppAdmin || admin.isTournamentAdmin) && (
          <button className="btn btn-primary" onClick={() => router.push('/players/new')}>Add Player</button>
        )}
      </header>

      {err && (
        <div className="error-message" role="status" aria-live="assertive">
          {err}
        </div>
      )}
      {info && (
        <div className="success-message" role="status" aria-live="polite">
          {info}
        </div>
      )}

      <div className="card">
        <form className="flex flex-wrap items-center gap-3" onSubmit={submitPlayerSearch}>
          {admin.isAppAdmin && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted">Primary Club</label>
              <select
                className="input"
                value={playersClubFilter}
                onChange={(e) => changePlayersClubFilter(e.target.value)}
              >
                <option value="">All Clubs</option>
                {filteredClubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.city ? ` (${c.city})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted">Search</label>
            <div className="flex items-center gap-2">
              <input
                className="input"
                placeholder="Search name, email, or phone"
                value={playerSearch}
                onChange={(e) => handlePlayerSearchInput(e.target.value)}
              />
              {playerSearch && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={clearPlayerSearch}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          {admin.isAppAdmin && (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDisabledPlayers}
                  onChange={(e) => {
                    setShowDisabledPlayers(e.target.checked);
                    void loadPlayersPage(
                      playersPage.take,
                      0,
                      `${playerSort.col}:${playerSort.dir}`,
                      playersClubFilter,
                      playerSearch,
                      e.target.checked
                    );
                  }}
                  className="w-4 h-4"
                />
                <span className="text-muted">Show disabled players</span>
              </label>
            </div>
          )}
          <button type="submit" className="btn btn-secondary btn-sm">Apply</button>
        </form>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
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
              {loading && (playersPage.items?.length ?? 0) === 0 && (
                <tr><td colSpan={11} className="py-8 text-center text-muted">Loading players...</td></tr>
              )}
              {!loading && (playersPage.items?.length ?? 0) === 0 && (
                <tr><td colSpan={11} className="py-8 text-center text-muted">No players yet.</td></tr>
              )}
              {(playersPage.items ?? []).map((p) => (
                <tr key={p.id} className={p.disabled ? 'opacity-50' : ''}>
                  <td className="py-2 pr-4 text-muted">
                    <div className="flex items-center gap-2">
                      {p.firstName ?? '—'}
                      {p.disabled && (
                        <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">
                          Disabled
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-muted">{p.lastName ?? '—'}</td>
                  <td className="py-2 pr-4 text-muted">{p.gender === 'FEMALE' ? 'F' : 'M'}</td>
                  <td className="py-2 pr-4 text-muted">{p.club?.name ?? '—'}</td>
                  <td className="py-2 pr-4 text-muted tabular">{p.age ?? '—'}</td>
                  <td className="py-2 pr-4 text-muted tabular">{p.dupr ?? '—'}</td>
                  <td className="py-2 pr-4 text-muted">{p.city ?? '—'}</td>
                  <td className="py-2 pr-4 text-muted">{p.region ?? '—'}</td>
                  <td className="py-2 pr-4 text-muted">{p.country ?? '—'}</td>
                  <td className="py-2 pr-4 text-muted">{p.phone ?? '—'}</td>
                  <td className="py-2 pr-2 text-right align-middle">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        aria-label="Edit player"
                        onClick={() => router.push(`/players/${p.id}/edit`)}
                        title="Edit"
                        className="text-secondary hover:text-secondary-hover p-1"
                      >
                        ✎
                      </button>
                      {admin.isAppAdmin && (
                        <>
                          <button
                            aria-label={p.disabled ? 'Enable player' : 'Disable player'}
                            onClick={() => togglePlayerDisabled(p)}
                            title={p.disabled ? 'Enable' : 'Disable'}
                            className={p.disabled ? 'text-green-600 hover:text-green-700 p-1' : 'text-orange-600 hover:text-orange-700 p-1'}
                          >
                            {p.disabled ? '✓' : '⊘'}
                          </button>
                          <button
                            aria-label="Delete player"
                            onClick={() => removePlayer(p.id)}
                            title="Delete"
                            className="text-error hover:text-error-hover p-1"
                          >
                            <TrashIcon />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          className="btn btn-ghost"
          onClick={() => loadPlayersPage(playersPage.take, Math.max(0, playersPage.skip - playersPage.take), `${playerSort.col}:${playerSort.dir}`, playersClubFilter, playerSearch)}
          disabled={playersPage.skip <= 0}
        >
          ← Prev
        </button>
        <span className="text-sm text-muted">
          Page {Math.floor(playersPage.skip / playersPage.take) + 1} of {Math.max(1, Math.ceil(playersPage.total / playersPage.take))}
        </span>
        <button
          className="btn btn-ghost"
          onClick={() => loadPlayersPage(playersPage.take, playersPage.skip + playersPage.take, `${playerSort.col}:${playerSort.dir}`, playersClubFilter, playerSearch)}
          disabled={playersPage.skip + playersPage.take >= playersPage.total}
        >
          Next →
        </button>
      </div>
    </section>
  );
}

function SortableTh({ label, onClick, active, dir }: { label: string; onClick: () => void; active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <th className="py-2 pr-4 select-none">
      <button className="inline-flex items-center gap-1 text-primary hover:text-secondary font-medium" onClick={onClick} title="Sort">
        <span>{label}</span>
        <span className="text-xs text-muted">{active ? (dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );
}

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

