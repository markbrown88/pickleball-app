'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import { useAdminUser } from '../admin/AdminContext';
import { fortyYearsAgoISO } from '../(player)/shared/useProfileData';

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
  const admin = useAdminUser();
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [playersPage, setPlayersPage] = useState<{ items: Player[]; total: number; take: number; skip: number; sort: string }>(
    { items: [], total: 0, take: 25, skip: 0, sort: 'lastName:asc' }
  );
  const [playerSort, setPlayerSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'lastName', dir: 'asc' });
  const [playerEditId, setPlayerEditId] = useState<Id | null>(null);
  const [playerSlideOutOpen, setPlayerSlideOutOpen] = useState(false);
  const [playerSearch, setPlayerSearch] = useState('');
  const [playerCountrySel, setPlayerCountrySel] = useState<'Canada' | 'USA' | 'Other'>('Canada');
  const [playerCountryOther, setPlayerCountryOther] = useState('');
  const [playerBirthday, setPlayerBirthday] = useState<string>('');
  const [playerForm, setPlayerForm] = useState<{
    firstName: string; lastName: string; gender: 'MALE' | 'FEMALE';
    clubId: Id | '';
    dupr: string;
    city: string; region: string; country: string;
    phone: string; email: string;
  }>({ firstName: '', lastName: '', gender: 'MALE', clubId: '', dupr: '', city: '', region: '', country: 'Canada', phone: '', email: '' });

  const [playersClubFilter, setPlayersClubFilter] = useState<string>('');
  const [clubsAll, setClubsAll] = useState<Club[]>([]);

  const playerSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playersRequestRef = useRef(0);
  const playersListConfigRef = useRef({ take: playersPage.take, sort: `${playerSort.col}:${playerSort.dir}`, clubId: playersClubFilter });

  const loadPlayersPage = useCallback(async (take: number, skip: number, sort: string, clubId: string, searchTerm: string = playerSearch) => {
    const requestId = playersRequestRef.current + 1;
    playersRequestRef.current = requestId;
    try {
      const term = searchTerm.trim();
      const query = `/api/admin/players?take=${take}&skip=${skip}&sort=${encodeURIComponent(sort)}${clubId ? `&clubId=${encodeURIComponent(clubId)}` : ''}${term ? `&search=${encodeURIComponent(term)}` : ''}`;
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
  }, [playerSearch]);

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
        await Promise.all([
          loadPlayersPage(playersPage.take, playersPage.skip, `${playerSort.col}:${playerSort.dir}`, playersClubFilter, playerSearch),
          reloadClubs(),
        ]);
      } catch (e) {
        setErr((e as Error).message);
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

  const openSlideOutPlayer = useCallback(() => {
    setPlayerSlideOutOpen(true);
    setPlayerEditId(null);
    setPlayerCountrySel('Canada');
    setPlayerCountryOther('');
    setPlayerForm({ firstName: '', lastName: '', gender: 'MALE', clubId: '', dupr: '', city: '', region: '', country: 'Canada', phone: '', email: '' });
    setPlayerBirthday('');
  }, []);

  const openSlideOutEditPlayer = useCallback((p: Player) => {
    setPlayerSlideOutOpen(true);
    setPlayerEditId(p.id);
    const country = (p.country || 'Canada').trim();
    if (country === 'Canada' || country === 'USA') {
      setPlayerCountrySel(country as 'Canada' | 'USA');
      setPlayerCountryOther('');
    } else {
      setPlayerCountrySel('Other');
      setPlayerCountryOther(country);
    }
    const birth = [p.birthdayYear, p.birthdayMonth, p.birthdayDay];
    if (birth.every(v => typeof v === 'number' && v)) {
      const [y, m, d] = birth as number[];
      const mm = String(m).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      setPlayerBirthday(`${y}-${mm}-${dd}`);
    } else {
      setPlayerBirthday('');
    }
    setPlayerForm({
      firstName: (p.firstName || '').trim(),
      lastName: (p.lastName || '').trim(),
      gender: p.gender || 'MALE',
      clubId: p.clubId ?? '',
      dupr: p.dupr != null ? String(p.dupr) : '',
      city: (p.city || '').trim(),
      region: (p.region || '').trim(),
      country: country,
      phone: (p.phone || '').trim(),
      email: (p.email || '').trim(),
    });
  }, []);

  const savePlayer = useCallback(async () => {
    try {
      setErr(null);
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
      await loadPlayersPage(playersPage.take, playersPage.skip, `${playerSort.col}:${playerSort.dir}`, playersClubFilter, playerSearch);
      setPlayerSlideOutOpen(false);
      setPlayerEditId(null);
      setInfo('Player saved');
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [playerCountrySel, playerCountryOther, playerForm, playerBirthday, playerEditId, loadPlayersPage, playersPage.take, playersPage.skip, playerSort, playersClubFilter, playerSearch]);

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

  const filteredClubs = useMemo(() => clubsAll, [clubsAll]);

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Players</h1>
          <p className="text-muted">Manage player profiles and search across clubs.</p>
        </div>
        {admin.isAppAdmin && (
          <button className="btn btn-primary" onClick={openSlideOutPlayer}>Add Player</button>
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
              {(playersPage.items?.length ?? 0) === 0 && (
                <tr><td colSpan={11} className="py-8 text-center text-muted">No players yet.</td></tr>
              )}
              {(playersPage.items ?? []).map((p) => (
                <tr key={p.id}>
                  <td className="py-2 pr-4 text-muted">{p.firstName ?? '—'}</td>
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
                        onClick={() => openSlideOutEditPlayer(p)}
                        title="Edit"
                        className="text-secondary hover:text-secondary-hover p-1"
                      >
                        ✎
                      </button>
                      {admin.isAppAdmin && (
                        <button
                          aria-label="Delete player"
                          onClick={() => removePlayer(p.id)}
                          title="Delete"
                          className="text-error hover:text-error-hover p-1"
                        >
                          <TrashIcon />
                        </button>
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

      {playerSlideOutOpen && (
        <PlayerSlideOut
          title={playerEditId ? 'Edit Player' : 'Add Player'}
          form={playerForm}
          setForm={setPlayerForm}
          countrySel={playerCountrySel}
          setCountrySel={setPlayerCountrySel}
          countryOther={playerCountryOther}
          setCountryOther={setPlayerCountryOther}
          birthday={playerBirthday}
          setBirthday={setPlayerBirthday}
          clubs={filteredClubs}
          onSave={savePlayer}
          onCancel={() => setPlayerSlideOutOpen(false)}
        />
      )}
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

function PlayerSlideOut({
  title,
  form,
  setForm,
  countrySel,
  setCountrySel,
  countryOther,
  setCountryOther,
  birthday,
  setBirthday,
  clubs,
  onSave,
  onCancel,
}: {
  title: string;
  form: {
    firstName: string; lastName: string; gender: 'MALE' | 'FEMALE'; clubId: Id | ''; dupr: string;
    city: string; region: string; country: string; phone: string; email: string;
  };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
  countrySel: 'Canada' | 'USA' | 'Other';
  setCountrySel: React.Dispatch<React.SetStateAction<'Canada' | 'USA' | 'Other'>>;
  countryOther: string;
  setCountryOther: React.Dispatch<React.SetStateAction<string>>;
  birthday: string;
  setBirthday: React.Dispatch<React.SetStateAction<string>>;
  clubs: Club[];
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="absolute right-0 top-1/2 h-5/6 w-full max-w-4xl -translate-y-1/2 bg-surface-1 border-l border-subtle shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-subtle">
          <h3 className="text-lg font-semibold text-primary">{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>✕</button>
        </div>
        <div className="p-6 overflow-y-auto h-full pb-20">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <LabeledInput label="First Name" value={form.firstName} onChange={(v) => setForm((prev) => ({ ...prev, firstName: v }))} />
              <LabeledInput label="Last Name" value={form.lastName} onChange={(v) => setForm((prev) => ({ ...prev, lastName: v }))} />
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">Gender</label>
                <select className="input" value={form.gender} onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value as 'MALE' | 'FEMALE' }))}>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">Birthday</label>
                <input
                  className="input"
                  type="date"
                  value={birthday}
                  onFocus={(e) => { if (!e.currentTarget.value) e.currentTarget.value = fortyYearsAgoISO(); }}
                  onChange={(e) => setBirthday(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">Primary Club</label>
                <select className="input" value={form.clubId} onChange={(e) => setForm((prev) => ({ ...prev, clubId: e.target.value as Id }))}>
                  <option value="">Select Club…</option>
                  {clubs.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.city ? ` (${c.city})` : ''}</option>
                  ))}
                </select>
              </div>
              <LabeledInput label="DUPR Rating" type="number" value={form.dupr} onChange={(v) => setForm((prev) => ({ ...prev, dupr: v }))} />
            </div>
            <div className="space-y-4">
              <LabeledInput label="City" value={form.city} onChange={(v) => setForm((prev) => ({ ...prev, city: v }))} />
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">Country</label>
                <select className="input" value={countrySel} onChange={(e) => setCountrySel(e.target.value as 'Canada' | 'USA' | 'Other')}>
                  <option value="Canada">Canada</option>
                  <option value="USA">USA</option>
                  <option value="Other">Other</option>
                </select>
                {countrySel === 'Other' && (
                  <input
                    className="input mt-2"
                    placeholder="Country"
                    value={countryOther}
                    onChange={(e) => {
                      setCountryOther(e.target.value);
                      setForm((prev) => ({ ...prev, country: e.target.value }));
                    }}
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">{countrySel === 'Canada' ? 'Province' : countrySel === 'USA' ? 'State' : 'Region/Province/State'}</label>
                {countrySel === 'Canada' ? (
                  <select className="input" value={form.region} onChange={(e) => setForm((prev) => ({ ...prev, region: e.target.value }))}>
                    <option value="">Select Province…</option>
                    {CA_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                ) : countrySel === 'USA' ? (
                  <select className="input" value={form.region} onChange={(e) => setForm((prev) => ({ ...prev, region: e.target.value }))}>
                    <option value="">Select State…</option>
                    {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <input className="input" placeholder="Region/Province/State" value={form.region} onChange={(e) => setForm((prev) => ({ ...prev, region: e.target.value }))} />
                )}
              </div>
              <LabeledInput label="Phone" value={form.phone} onChange={(v) => setForm((prev) => ({ ...prev, phone: v }))} />
              <LabeledInput label="Email" value={form.email} onChange={(v) => setForm((prev) => ({ ...prev, email: v }))} />
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-subtle bg-surface-1">
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" onClick={onSave}>Save Player</button>
            <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LabeledInput({ label, type = 'text', value, onChange }: { label: string; type?: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-secondary mb-1">{label}</label>
      <input className="input" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

