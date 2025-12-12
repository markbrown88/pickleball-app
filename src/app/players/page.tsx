'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { useAdminUser } from '../admin/AdminContext';
import { formatPhoneForDisplay } from '@/lib/phone';

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
  clerkUserId?: string | null;
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
  const searchParams = useSearchParams();
  const admin = useAdminUser();
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize from URL parameters
  const [playersPage, setPlayersPage] = useState<{ items: Player[]; total: number; take: number; skip: number; sort: string }>(
    { items: [], total: 0, take: 25, skip: 0, sort: searchParams.get('sort') || 'lastName:asc' }
  );

  const initialSort = searchParams.get('sort') || 'lastName:asc';
  const [sortCol, sortDir] = initialSort.split(':');
  const [playerSort, setPlayerSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({
    col: sortCol || 'lastName',
    dir: (sortDir === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc'
  });
  const [playerSearch, setPlayerSearch] = useState(searchParams.get('search') || '');

  const [playersClubFilter, setPlayersClubFilter] = useState<string>(searchParams.get('clubId') || '');
  const [registrationStatusFilter, setRegistrationStatusFilter] = useState<string>(searchParams.get('regStatus') || '');
  const [showDisabledPlayers, setShowDisabledPlayers] = useState(searchParams.get('showDisabled') === 'true');
  const [wildcardFilter, setWildcardFilter] = useState<string>(searchParams.get('wildcard') || '');
  const [captainFilter, setCaptainFilter] = useState<string>(searchParams.get('captain') || '');
  const [clubsAll, setClubsAll] = useState<Club[]>([]);

  const playerSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playersRequestRef = useRef(0);
  const playersListConfigRef = useRef({ take: playersPage.take, sort: `${playerSort.col}:${playerSort.dir}`, clubId: playersClubFilter, registrationStatus: registrationStatusFilter, wildcard: wildcardFilter, captain: captainFilter });

  // Helper to update URL with current filters
  const updateURL = useCallback((params: Record<string, string>) => {
    const newParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) newParams.set(key, value);
    });
    const queryString = newParams.toString();
    router.replace(`/players${queryString ? `?${queryString}` : ''}`, { scroll: false });
  }, [router]);

  // Helper to build query string with current filter state for navigation
  const buildFilterQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (playerSearch) params.set('search', playerSearch);
    if (playersClubFilter) params.set('clubId', playersClubFilter);
    if (registrationStatusFilter) params.set('regStatus', registrationStatusFilter);
    if (showDisabledPlayers) params.set('showDisabled', 'true');
    if (wildcardFilter) params.set('wildcard', wildcardFilter);
    if (captainFilter) params.set('captain', captainFilter);
    const sort = `${playerSort.col}:${playerSort.dir}`;
    if (sort !== 'lastName:asc') params.set('sort', sort);
    const queryString = params.toString();
    return queryString ? `?${queryString}` : '';
  }, [playerSearch, playersClubFilter, registrationStatusFilter, showDisabledPlayers, wildcardFilter, captainFilter, playerSort]);

  const loadPlayersPage = useCallback(async (take: number, skip: number, sort: string, clubId: string, searchTerm: string = playerSearch, showDisabled: boolean = showDisabledPlayers, regStatus: string = registrationStatusFilter, wildcard: string = wildcardFilter, captain: string = captainFilter) => {
    const requestId = playersRequestRef.current + 1;
    playersRequestRef.current = requestId;
    try {
      const term = searchTerm.trim();
      const query = `/api/admin/players?take=${take}&skip=${skip}&sort=${encodeURIComponent(sort)}${clubId ? `&clubId=${encodeURIComponent(clubId)}` : ''}${term ? `&search=${encodeURIComponent(term)}` : ''}${showDisabled ? '&showDisabled=true' : ''}${regStatus ? `&registrationStatus=${encodeURIComponent(regStatus)}` : ''}${wildcard ? `&interestedInWildcard=${encodeURIComponent(wildcard)}` : ''}${captain ? `&interestedInCaptain=${encodeURIComponent(captain)}` : ''}`;
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
  }, [playerSearch, showDisabledPlayers, registrationStatusFilter, wildcardFilter, captainFilter]);

  const reloadClubs = useCallback(async () => {
    const data = await api<Club[]>('/api/admin/clubs?sort=name:asc');
    setClubsAll(data);
  }, []);

  useEffect(() => {
    playersListConfigRef.current = { take: playersPage.take, sort: `${playerSort.col}:${playerSort.dir}`, clubId: playersClubFilter, registrationStatus: registrationStatusFilter, wildcard: wildcardFilter, captain: captainFilter };
  }, [playersPage.take, playerSort.col, playerSort.dir, playersClubFilter, registrationStatusFilter, wildcardFilter, captainFilter]);

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
    const cfg = playersListConfigRef.current;
    if (!term) {
      void loadPlayersPage(cfg.take, 0, cfg.sort, cfg.clubId, '');
      updateURL({
        sort: cfg.sort,
        clubId: cfg.clubId,
        regStatus: cfg.registrationStatus,
        showDisabled: showDisabledPlayers ? 'true' : ''
      });
      return;
    }
    playerSearchDebounceRef.current = setTimeout(() => {
      void loadPlayersPage(cfg.take, 0, cfg.sort, cfg.clubId, term);
      updateURL({
        search: term,
        sort: cfg.sort,
        clubId: cfg.clubId,
        regStatus: cfg.registrationStatus,
        showDisabled: showDisabledPlayers ? 'true' : ''
      });
    }, 300);
  }, [loadPlayersPage, showDisabledPlayers, updateURL]);

  const clearPlayerSearch = useCallback(() => {
    setPlayerSearch('');
    if (playerSearchDebounceRef.current) {
      clearTimeout(playerSearchDebounceRef.current);
      playerSearchDebounceRef.current = null;
    }
    const cfg = playersListConfigRef.current;
    void loadPlayersPage(cfg.take, 0, cfg.sort, cfg.clubId, '');
    updateURL({
      sort: cfg.sort,
      clubId: cfg.clubId,
      regStatus: cfg.registrationStatus,
      showDisabled: showDisabledPlayers ? 'true' : ''
    });
  }, [loadPlayersPage, showDisabledPlayers, updateURL]);

  const clickSortPlayers = useCallback((col: string) => {
    const dir = (playerSort.col === col && playerSort.dir === 'asc') ? 'desc' : 'asc';
    setPlayerSort({ col, dir });
    void loadPlayersPage(playersPage.take, 0, `${col}:${dir}`, playersClubFilter, playerSearch);
    updateURL({
      search: playerSearch,
      sort: `${col}:${dir}`,
      clubId: playersClubFilter,
      regStatus: registrationStatusFilter,
      showDisabled: showDisabledPlayers ? 'true' : ''
    });
  }, [loadPlayersPage, playerSort, playersPage.take, playersClubFilter, playerSearch, registrationStatusFilter, showDisabledPlayers, updateURL]);

  const changePlayersClubFilter = useCallback((clubId: string) => {
    setPlayersClubFilter(clubId);
    void loadPlayersPage(playersPage.take, 0, `${playerSort.col}:${playerSort.dir}`, clubId, playerSearch);
    updateURL({
      search: playerSearch,
      sort: `${playerSort.col}:${playerSort.dir}`,
      clubId,
      regStatus: registrationStatusFilter,
      showDisabled: showDisabledPlayers ? 'true' : ''
    });
  }, [loadPlayersPage, playersPage.take, playerSort.col, playerSort.dir, playerSearch, registrationStatusFilter, showDisabledPlayers, updateURL]);

  const changeRegistrationStatusFilter = useCallback((status: string) => {
    setRegistrationStatusFilter(status);
    void loadPlayersPage(playersPage.take, 0, `${playerSort.col}:${playerSort.dir}`, playersClubFilter, playerSearch, showDisabledPlayers, status);
    updateURL({
      search: playerSearch,
      sort: `${playerSort.col}:${playerSort.dir}`,
      clubId: playersClubFilter,
      regStatus: status,
      showDisabled: showDisabledPlayers ? 'true' : ''
    });
  }, [loadPlayersPage, playersPage.take, playerSort.col, playerSort.dir, playersClubFilter, playerSearch, showDisabledPlayers, updateURL]);

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
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Players</h1>
          <p className="text-muted">
            {admin.isAppAdmin
              ? 'Manage player profiles and search across clubs.'
              : 'Manage player profiles for your club.'}
          </p>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
          <div className="text-left md:text-right">
            <div className="text-2xl font-semibold text-primary">{playersPage.total}</div>
            <div className="text-sm text-muted">Total Players</div>
          </div>
          {(admin.isAppAdmin || admin.isTournamentAdmin) && (
            <button className="btn btn-primary whitespace-nowrap" onClick={() => router.push(`/players/new${buildFilterQueryString()}`)}>
              Add Player
            </button>
          )}
        </div>
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
        <div className="flex flex-wrap items-center gap-3">
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
            <label className="text-sm text-muted">Registration Status</label>
            <select
              className="input"
              value={registrationStatusFilter}
              onChange={(e) => changeRegistrationStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="registered">Registered</option>
              <option value="profile">Profile Only</option>
            </select>
          </div>
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
                  className="w-5 h-5"
                  checked={showDisabledPlayers}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setShowDisabledPlayers(checked);
                    void loadPlayersPage(
                      playersPage.take,
                      0,
                      `${playerSort.col}:${playerSort.dir}`,
                      playersClubFilter,
                      playerSearch,
                      checked
                    );
                    updateURL({
                      search: playerSearch,
                      sort: `${playerSort.col}:${playerSort.dir}`,
                      clubId: playersClubFilter,
                      regStatus: registrationStatusFilter,
                      showDisabled: checked ? 'true' : '',
                      wildcard: wildcardFilter,
                      captain: captainFilter
                    });
                  }}
                />
                <span className="text-muted">Show disabled players</span>
              </label>
            </div>
          )}
          {admin.isAppAdmin && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted">Wildcard Interest</label>
              <select
                className="input"
                value={wildcardFilter}
                onChange={(e) => {
                  const value = e.target.value;
                  setWildcardFilter(value);
                  void loadPlayersPage(
                    playersPage.take,
                    0,
                    `${playerSort.col}:${playerSort.dir}`,
                    playersClubFilter,
                    playerSearch,
                    showDisabledPlayers,
                    registrationStatusFilter,
                    value,
                    captainFilter
                  );
                  updateURL({
                    search: playerSearch,
                    sort: `${playerSort.col}:${playerSort.dir}`,
                    clubId: playersClubFilter,
                    regStatus: registrationStatusFilter,
                    showDisabled: showDisabledPlayers ? 'true' : '',
                    wildcard: value,
                    captain: captainFilter
                  });
                }}
              >
                <option value="">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          )}
          {admin.isAppAdmin && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted">Captain Interest</label>
              <select
                className="input"
                value={captainFilter}
                onChange={(e) => {
                  const value = e.target.value;
                  setCaptainFilter(value);
                  void loadPlayersPage(
                    playersPage.take,
                    0,
                    `${playerSort.col}:${playerSort.dir}`,
                    playersClubFilter,
                    playerSearch,
                    showDisabledPlayers,
                    registrationStatusFilter,
                    wildcardFilter,
                    value
                  );
                  updateURL({
                    search: playerSearch,
                    sort: `${playerSort.col}:${playerSort.dir}`,
                    clubId: playersClubFilter,
                    regStatus: registrationStatusFilter,
                    showDisabled: showDisabledPlayers ? 'true' : '',
                    wildcard: wildcardFilter,
                    captain: value
                  });
                }}
              >
                <option value="">All</option>
                <option value="YES">Yes</option>
                <option value="NO">No</option>
                <option value="MAYBE">Maybe</option>
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        {/* Mobile cards */}
        <div className="md:hidden space-y-4">
          {loading && (playersPage.items?.length ?? 0) === 0 && (
            <div className="text-center text-muted py-6">Loading players...</div>
          )}
          {!loading && (playersPage.items?.length ?? 0) === 0 && (
            <div className="text-center text-muted py-6">No players yet.</div>
          )}
          {(playersPage.items ?? []).map((p) => (
            <div
              key={p.id}
              className={`rounded-lg border border-border-subtle p-4 space-y-4 ${p.disabled ? 'opacity-60' : ''}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-base font-semibold text-primary">
                    {[p.firstName, p.lastName].filter(Boolean).join(' ') || 'Unnamed Player'}
                  </p>
                  <p className="text-xs text-muted">
                    {p.gender === 'FEMALE' ? 'Female' : 'Male'}
                    {p.age ? ` • ${p.age} yrs` : ''}
                  </p>
                </div>
                <span
                  className={`chip text-[10px] px-2 py-0.5 ${
                    p.clerkUserId ? 'chip-success' : 'chip-muted'
                  }`}
                >
                  {p.clerkUserId ? 'Registered' : 'Profile Only'}
                </span>
              </div>

              <div className="space-y-2 text-sm text-secondary">
                <div className="flex justify-between">
                  <span className="text-muted">Club</span>
                  <span className="font-medium text-primary">{p.club?.name ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">City</span>
                  <span className="font-medium text-primary">{p.city ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Phone</span>
                  <span className="font-medium text-primary">{formatPhoneForDisplay(p.phone) || '—'}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  className="btn btn-secondary flex-1"
                  onClick={() => router.push(`/players/${p.id}/edit${buildFilterQueryString()}`)}
                >
                  Edit
                </button>
                {admin.isAppAdmin && (
                  <>
                    <button
                      className="btn btn-ghost flex-1"
                      onClick={() => togglePlayerDisabled(p)}
                    >
                      {p.disabled ? 'Enable' : 'Disable'}
                    </button>
                    <button
                      className="btn btn-ghost flex-1 text-error"
                      onClick={() => removePlayer(p.id)}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <SortableTh label="First Name" onClick={() => clickSortPlayers('firstName')} active={playerSort.col === 'firstName'} dir={playerSort.dir} />
                <SortableTh label="Last Name" onClick={() => clickSortPlayers('lastName')} active={playerSort.col === 'lastName'} dir={playerSort.dir} />
                <SortableTh label="Sex" onClick={() => clickSortPlayers('gender')} active={playerSort.col === 'gender'} dir={playerSort.dir} />
                <SortableTh label="Primary Club" onClick={() => clickSortPlayers('clubName')} active={playerSort.col === 'clubName'} dir={playerSort.dir} className="hidden sm:table-cell" />
                <SortableTh label="Age" onClick={() => clickSortPlayers('age')} active={playerSort.col === 'age'} dir={playerSort.dir} />
                <SortableTh label="City" onClick={() => clickSortPlayers('city')} active={playerSort.col === 'city'} dir={playerSort.dir} className="hidden sm:table-cell" />
                <SortableTh label="Phone" onClick={() => clickSortPlayers('phone')} active={playerSort.col === 'phone'} dir={playerSort.dir} className="hidden sm:table-cell" />
                <th className="hidden sm:table-cell py-2 pr-4 select-none">
                  <span className="text-primary font-medium">Status</span>
                </th>
                <th className="py-2 pr-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (playersPage.items?.length ?? 0) === 0 && (
                <tr><td colSpan={9} className="py-8 text-center text-muted">Loading players...</td></tr>
              )}
              {!loading && (playersPage.items?.length ?? 0) === 0 && (
                <tr><td colSpan={9} className="py-8 text-center text-muted">No players yet.</td></tr>
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
                  <td className="hidden sm:table-cell py-2 pr-4 text-muted">{p.club?.name ?? '—'}</td>
                  <td className="py-2 pr-4 text-muted tabular">{p.age ?? '—'}</td>
                  <td className="hidden sm:table-cell py-2 pr-4 text-muted">{p.city ?? '—'}</td>
                  <td className="hidden sm:table-cell py-2 pr-4 text-muted">
                    {formatPhoneForDisplay(p.phone) || '—'}
                  </td>
                  <td className="hidden sm:table-cell py-2 pr-4">
                    {p.clerkUserId ? (
                      <span className="chip chip-success text-[10px] px-2 py-0.5">Registered</span>
                    ) : (
                      <span className="chip chip-muted text-[10px] px-2 py-0.5">Profile Only</span>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-right align-middle">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        aria-label="Edit player"
                        onClick={() => router.push(`/players/${p.id}/edit${buildFilterQueryString()}`)}
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

      {Math.ceil(playersPage.total / playersPage.take) > 1 && (
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
      )}
    </section>
  );
}

function SortableTh({ label, onClick, active, dir, className = '' }: { label: string; onClick: () => void; active: boolean; dir: 'asc' | 'desc'; className?: string }) {
  return (
    <th className={`py-2 pr-4 select-none ${className}`}>
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

