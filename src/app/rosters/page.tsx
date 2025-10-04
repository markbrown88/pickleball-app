'use client';

import { useEffect, useMemo, useState } from 'react';

import { useAdminUser } from '../admin/AdminContext';
import { fetchWithActAs } from '@/lib/fetchWithActAs';

type RosterTournament = {
  id: string;
  name: string;
  role: 'APP_ADMIN' | 'TOURNAMENT_ADMIN' | 'CAPTAIN';
};

type PlayerLite = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  gender: 'MALE' | 'FEMALE';
  dupr: number | null;
  age: number | null;
};

type StopData = {
  stopId: string;
  stopName: string;
  locationName: string | null;
  startAt: string | null;
  endAt: string | null;
};

type BracketRoster = {
  teamId: string;
  bracketName: string | null;
  roster: PlayerLite[];
  stops: Array<{
    stopId: string;
    stopRoster: PlayerLite[];
  }>;
};

type ClubRoster = {
  clubId: string;
  clubName: string;
  brackets: BracketRoster[];
};

type TournamentRosterPayload = {
  tournamentId: string;
  tournamentName: string;
  maxTeamSize: number | null;
  stops: StopData[];
  clubs: ClubRoster[];
};

function extractError(body: unknown, status: number): string {
  if (typeof body === 'string') return body;
  if (body && typeof body === 'object' && 'error' in body && typeof (body as { error?: unknown }).error === 'string') {
    return (body as { error: string }).error;
  }
  return `HTTP ${status}`;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithActAs(url, init);
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    throw new Error(extractError(body, res.status));
  }
  return body as T;
}

function fmtDateDisplay(iso?: string | null) {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '—';
  const month = dt.toLocaleDateString('en-US', { month: 'short' });
  const day = dt.getDate();
  const year = dt.getFullYear();
  return `${month} ${day}, ${year}`;
}

function between(start?: string | null, end?: string | null) {
  if (!start && !end) return '—';
  if (start && end) return `${fmtDateDisplay(start)} – ${fmtDateDisplay(end)}`;
  return fmtDateDisplay(start || end);
}

function labelPL(p: PlayerLite) {
  const parts = [p.firstName, p.lastName].map((s) => (s ?? '').trim()).filter(Boolean);
  return parts.join(' ') || p.name || 'Unknown';
}

export default function AdminRostersPage() {
  const adminUser = useAdminUser();

  const [tournaments, setTournaments] = useState<RosterTournament[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [roster, setRoster] = useState<TournamentRosterPayload | null>(null);

  const [listLoading, setListLoading] = useState(true);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        setListLoading(true);
        const items = await api<RosterTournament[]>('/api/admin/rosters/tournaments');
        setTournaments(items);
        if (items.length) {
          setSelectedId(items[0].id);
        }
      } catch (e) {
        setErr((e as Error).message);
        setTournaments([]);
        setSelectedId('');
      } finally {
        setListLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setRoster(null);
      return;
    }

    (async () => {
      try {
        setErr(null);
        setInfo(null);
        setRosterLoading(true);
        const data = await api<TournamentRosterPayload>(`/api/admin/rosters/${selectedId}`);
        setRoster(data);
      } catch (e) {
        setErr((e as Error).message);
        setRoster(null);
      } finally {
        setRosterLoading(false);
      }
    })();
  }, [selectedId]);

  const headline = useMemo(() => {
    if (adminUser.isAppAdmin) return 'Manage all tournament rosters';
    if (adminUser.isTournamentAdmin) return 'Manage rosters for your tournaments';
    return 'View and manage rosters for your teams';
  }, [adminUser.isAppAdmin, adminUser.isTournamentAdmin]);

  const selected = useMemo(
    () => tournaments.find((t) => t.id === selectedId) ?? null,
    [tournaments, selectedId]
  );

  return (
    <section className="min-h-screen bg-app p-6 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary">Tournament Rosters</h1>
          <p className="text-muted mt-1">{headline}</p>
        </div>
        {tournaments.length > 0 && (
          <div className="flex items-center gap-3">
            <label htmlFor="roster-tournament" className="text-sm font-medium text-secondary">
              Tournament:
            </label>
            <select
              id="roster-tournament"
              className="input min-w-[240px]"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

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

      {listLoading && (
        <div className="card p-8 flex items-center justify-center gap-3">
          <div className="loading-spinner" />
          <span className="text-muted">Loading tournaments…</span>
        </div>
      )}

      {!listLoading && tournaments.length === 0 && (
        <div className="card p-8 text-center">
          <div className="max-w-md mx-auto space-y-3">
            <div className="text-5xl">📋</div>
            <h3 className="text-lg font-semibold text-secondary">No Tournaments Available</h3>
            <p className="text-muted">
              You will see roster controls here when you are assigned as an App Admin, Tournament Admin, or Captain.
            </p>
          </div>
        </div>
      )}

      {selected && rosterLoading && (
        <div className="card p-8 flex items-center justify-center gap-3">
          <div className="loading-spinner" />
          <span className="text-muted">Loading roster for {selected.name}…</span>
        </div>
      )}

      {selected && !rosterLoading && roster && (
        <RosterDetails
          key={roster.tournamentId}
          roster={roster}
          onSaved={async () => {
            setInfo('Roster saved');
            try {
              const refreshed = await api<TournamentRosterPayload>(`/api/admin/rosters/${roster.tournamentId}`);
              setRoster(refreshed);
            } catch (e) {
              setErr((e as Error).message);
            }
          }}
          onError={(message) => setErr(message)}
        />
      )}
    </section>
  );
}

function RosterDetails({
  roster,
  onSaved,
  onError,
}: {
  roster: TournamentRosterPayload;
  onSaved: () => void | Promise<void>;
  onError: (message: string) => void;
}) {
  const [openClubIds, setOpenClubIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setOpenClubIds(new Set());
  }, [roster.tournamentId]);

  const toggleClub = (clubId: string) => {
    setOpenClubIds((prev) => {
      const next = new Set(prev);
      if (next.has(clubId)) {
        next.delete(clubId);
      } else {
        next.add(clubId);
      }
      return next;
    });
  };

  const hasMultipleStops = roster.stops.length > 1;

  if (!roster.clubs.length) {
    return (
      <div className="card p-8 text-center">
        <div className="max-w-md mx-auto space-y-3">
          <div className="text-5xl">🏢</div>
          <h3 className="text-lg font-semibold text-secondary">No Clubs Linked</h3>
          <p className="text-muted">
            No clubs are linked to this tournament yet. Add clubs from the Tournaments page before managing rosters.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-primary">{roster.tournamentName}</h2>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted">
              <span className="flex items-center gap-1">
                <span className="font-semibold">📍 Stops:</span> {roster.stops.length || '0'}
              </span>
              <span className="flex items-center gap-1">
                <span className="font-semibold">👥 Roster Cap:</span>{' '}
                {roster.maxTeamSize ?? 'No limit set'}
              </span>
              <span className="flex items-center gap-1">
                <span className="font-semibold">🏢 Clubs:</span> {roster.clubs.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {roster.clubs.map((club) => (
          <div key={club.clubId} className="card overflow-hidden">
            <button
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-surface-2 transition-colors"
              onClick={() => toggleClub(club.clubId)}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{openClubIds.has(club.clubId) ? '📂' : '📁'}</span>
                <span className="text-lg font-semibold text-primary">{club.clubName}</span>
              </div>
              <span className="text-muted text-xl">{openClubIds.has(club.clubId) ? '▾' : '▸'}</span>
            </button>
            {openClubIds.has(club.clubId) && (
              <div className="bg-surface-2/50 border-t border-subtle px-6 py-6">
                <ClubRosterEditor
                  tournamentId={roster.tournamentId}
                  stops={roster.stops}
                  club={club}
                  hasMultipleStops={hasMultipleStops}
                  maxTeamSize={roster.maxTeamSize ?? null}
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

function ClubRosterEditor({
  tournamentId,
  stops,
  club,
  hasMultipleStops,
  maxTeamSize,
  onSaved,
  onError,
}: {
  tournamentId: string;
  stops: StopData[];
  club: ClubRoster;
  hasMultipleStops: boolean;
  maxTeamSize: number | null;
  onSaved: () => void | Promise<void>;
  onError: (message: string) => void;
}) {
  const [rosters, setRosters] = useState<Record<string, Record<string, PlayerLite[]>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const seed: Record<string, Record<string, PlayerLite[]>> = {};
    for (const stop of stops) {
      seed[stop.stopId] = {};
      for (const bracket of club.brackets) {
        const stopEntry = bracket.stops.find((s) => s.stopId === stop.stopId);
        seed[stop.stopId][bracket.teamId] = (stopEntry?.stopRoster ?? []).slice();
      }
    }
    setRosters(seed);
  }, [stops, club.brackets]);

  const setStopTeamRoster = (stopId: string, teamId: string, next: PlayerLite[]) => {
    setRosters((prev) => ({
      ...prev,
      [stopId]: {
        ...(prev[stopId] ?? {}),
        [teamId]: next,
      },
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      for (const stop of stops) {
        for (const bracket of club.brackets) {
          const list = rosters[stop.stopId]?.[bracket.teamId] ?? [];
          const response = await fetch(
            `/api/captain/team/${bracket.teamId}/stops/${stop.stopId}/roster`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                playerIds: list.map((p) => p.id),
                limit: maxTeamSize ?? undefined,
              }),
            }
          );
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || payload?.error) {
            throw new Error(payload?.error || 'Failed to save roster');
          }
        }
      }
      await onSaved();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {stops.map((stop, idx) => {
        const previousStop = idx > 0 ? stops[idx - 1] : null;

        const copyFromPrevious = () => {
          if (!previousStop) return;
          const snapshot = rosters[previousStop.stopId] || {};
          const cloned: Record<string, PlayerLite[]> = {};
          for (const bracket of club.brackets) {
            cloned[bracket.teamId] = (snapshot[bracket.teamId] ?? []).slice();
          }
          setRosters((prev) => ({ ...prev, [stop.stopId]: cloned }));
        };

        return (
          <div key={stop.stopId} className="space-y-4 pb-6 border-b border-subtle last:border-0 last:pb-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">📍</span>
                <div>
                  {stop.stopName && hasMultipleStops ? (
                    <div className="font-semibold text-primary">{stop.stopName}</div>
                  ) : null}
                  <div className="text-sm text-muted">
                    {stop.locationName ?? 'Location TBD'} • {between(stop.startAt, stop.endAt)}
                  </div>
                </div>
              </div>
              {previousStop && (
                <button
                  className="btn btn-ghost text-sm"
                  type="button"
                  onClick={copyFromPrevious}
                >
                  📋 Copy from previous
                </button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {club.brackets.map((bracket) => {
                const list = rosters[stop.stopId]?.[bracket.teamId] ?? [];
                const excludeAcrossStop = Object.values(rosters[stop.stopId] ?? {})
                  .flat()
                  .map((p) => p.id);

                return (
                  <BracketRosterEditor
                    key={`${stop.stopId}:${bracket.teamId}`}
                    title={`${bracket.bracketName ?? 'Roster'} (${list.length}${
                      maxTeamSize ? ` / ${maxTeamSize}` : ''
                    })`}
                    tournamentId={tournamentId}
                    teamId={bracket.teamId}
                    list={list}
                    onChange={(next) => setStopTeamRoster(stop.stopId, bracket.teamId, next)}
                    excludeIdsAcrossStop={excludeAcrossStop}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="pt-4 flex items-center gap-3 border-t border-subtle">
        <button
          className="btn btn-primary flex items-center gap-2"
          type="button"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <>
              <div className="loading-spinner w-4 h-4" />
              Saving…
            </>
          ) : (
            <>
              <span>💾</span>
              Save All Rosters
            </>
          )}
        </button>
        {saving && <span className="text-sm text-muted">Updating all stop rosters…</span>}
      </div>
    </div>
  );
}

function BracketRosterEditor({
  title,
  tournamentId,
  teamId,
  list,
  onChange,
  excludeIdsAcrossStop,
}: {
  title: string;
  tournamentId: string;
  teamId: string;
  list: PlayerLite[];
  onChange: (players: PlayerLite[]) => void;
  excludeIdsAcrossStop: string[];
}) {
  const [term, setTerm] = useState('');
  const [options, setOptions] = useState<PlayerLite[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const addPlayer = (player: PlayerLite) => {
    if (list.some((item) => item.id === player.id)) return;
    if (excludeIdsAcrossStop.includes(player.id)) return;
    onChange([...list, player]);
  };

  const removePlayer = (playerId: string) => {
    onChange(list.filter((item) => item.id !== playerId));
  };

  useEffect(() => {
    if (term.trim().length < 3) {
      setOptions([]);
      setOpen(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ term: term.trim(), tournamentId, teamId });
        if (excludeIdsAcrossStop.length) {
          params.set('excludeIds', excludeIdsAcrossStop.join(','));
        }
        const url = `/api/admin/players/search?${params.toString()}`;
        const result = await api<{ items: PlayerLite[] }>(url);
        if (!cancelled) {
          const items = Array.isArray(result.items) ? result.items : [];
          setOptions(items.map((player) => ({ ...player })));
          setOpen(true);
        }
      } catch {
        if (!cancelled) {
          setOptions([]);
          setOpen(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [term, tournamentId, teamId, excludeIdsAcrossStop]);

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-base font-semibold text-primary">{title}</h4>
      </div>

      <div className="relative">
        <input
          className="input w-full"
          placeholder="Search players (min 3 chars)"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onFocus={() => { if (options.length) setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
        />
        {open && options.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full bg-surface-2 border border-subtle rounded-lg shadow-lg overflow-hidden">
            {options.map((player) => (
              <li
                key={player.id}
                className="px-4 py-2.5 text-sm text-secondary hover:bg-surface-1 cursor-pointer transition-colors border-b border-subtle last:border-0"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  addPlayer(player);
                  setTerm('');
                  setOptions([]);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{labelPL(player)}</span>
                <span className="text-muted ml-2">
                  • {player.gender} • DUPR: {player.dupr ?? 'N/A'} • Age: {player.age ?? 'N/A'}
                </span>
              </li>
            ))}
            {loading && (
              <li className="px-4 py-2.5 text-sm text-muted flex items-center gap-2">
                <div className="loading-spinner" />
                Searching…
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted uppercase tracking-wide">Current Roster</div>
        <ul className="space-y-2">
          {list.map((player) => (
            <li key={player.id} className="flex items-center justify-between p-2 rounded-lg bg-surface-2 hover:bg-surface-1 transition-colors">
              <span className="text-sm">
                <span className="font-medium text-secondary">{labelPL(player)}</span>
                <span className="text-muted ml-2">
                  • {player.gender} • DUPR: {player.dupr ?? 'N/A'} • Age: {player.age ?? 'N/A'}
                </span>
              </span>
              <button
                type="button"
                className="text-xs font-medium text-muted hover:text-error transition-colors px-2 py-1"
                onClick={() => removePlayer(player.id)}
              >
                Remove
              </button>
            </li>
          ))}
          {list.length === 0 && (
            <li className="text-sm text-muted p-3 text-center bg-surface-2 rounded-lg">
              No players assigned yet. Search above to add players.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

