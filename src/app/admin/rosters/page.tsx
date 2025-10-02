'use client';

import { useEffect, useMemo, useState } from 'react';

import { useAdminUser } from '../AdminContext';

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
  const res = await fetch(url, init);
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
    <section className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Rosters</h1>
          <p className="text-muted">{headline}</p>
        </div>
        {tournaments.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="roster-tournament" className="text-sm text-muted">
              Tournament
            </label>
            <select
              id="roster-tournament"
              className="input"
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
        <div className="error-message" role="status" aria-live="assertive">
          {err}
        </div>
      )}

      {info && (
        <div className="success-message" role="status" aria-live="polite">
          {info}
        </div>
      )}

      {listLoading && (
        <div className="card p-6 text-center text-muted">Loading tournaments…</div>
      )}

      {!listLoading && tournaments.length === 0 && (
        <div className="card p-6 text-muted">
          No tournaments available. You will see roster controls here when you are assigned as an App
          Admin, Tournament Admin, or Captain.
        </div>
      )}

      {selected && rosterLoading && (
        <div className="card p-6 text-muted">Loading roster for {selected.name}…</div>
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
      <div className="card p-6 text-muted">
        No clubs are linked to this tournament yet. Add clubs from the Tournaments page before managing
        rosters.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card p-4">
        <div className="flex flex-col gap-2">
          <div className="text-lg font-semibold text-secondary">{roster.tournamentName}</div>
          <div className="text-sm text-muted">
            <span className="inline-block mr-4">
              Stops: {roster.stops.length || '0'}
            </span>
            <span className="inline-block">
              Roster cap per bracket:{' '}
              <strong>{roster.maxTeamSize ?? '— (no cap set)'}</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="card divide-y border border-subtle">
        {roster.clubs.map((club) => (
          <div key={club.clubId}>
            <button
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-surface-2"
              onClick={() => toggleClub(club.clubId)}
            >
              <span className="font-medium text-secondary">{club.clubName}</span>
              <span className="text-sm text-muted">{openClubIds.has(club.clubId) ? '▾' : '▸'}</span>
            </button>
            {openClubIds.has(club.clubId) && (
              <div className="bg-surface-1 border-t border-subtle px-4 py-4">
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
          <div key={stop.stopId} className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-medium text-secondary">
                {stop.stopName && hasMultipleStops ? (
                  <>
                    {stop.stopName}
                    <span className="text-muted"> • {stop.locationName ?? '—'} • {between(stop.startAt, stop.endAt)}</span>
                  </>
                ) : (
                  <span className="text-muted">
                    {stop.locationName ?? '—'} • {between(stop.startAt, stop.endAt)}
                  </span>
                )}
              </div>
              {previousStop && (
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={copyFromPrevious}
                >
                  Copy from previous stop
                </button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {club.brackets.map((bracket) => {
                const list = rosters[stop.stopId]?.[bracket.teamId] ?? [];
                const excludeAcrossStop = Object.values(rosters[stop.stopId] ?? {})
                  .flat()
                  .map((p) => p.id);

                return (
                  <BracketRosterEditor
                    key={`${stop.stopId}:${bracket.teamId}`}
                    title={`${bracket.bracketName ?? 'Roster'} (${list.length}${
                      maxTeamSize ? ` / ≤${maxTeamSize}` : ''
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

      <div className="pt-2">
        <button
          className="btn btn-primary"
          type="button"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save All'}
        </button>
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
    <div className="border rounded-lg bg-white p-4 space-y-3 shadow-sm">
      <div className="font-medium text-secondary">{title}</div>

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
          <ul className="absolute z-10 mt-1 w-full bg-surface-1 border border-subtle rounded shadow">
            {options.map((player) => (
              <li
                key={player.id}
                className="px-3 py-2 text-sm hover:bg-surface-2 cursor-pointer"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  addPlayer(player);
                  setTerm('');
                  setOptions([]);
                  setOpen(false);
                }}
              >
                {labelPL(player)}{' '}
                <span className="text-muted">
                  • {player.gender} • {player.dupr ?? '—'} • {player.age ?? '—'}
                </span>
              </li>
            ))}
            {loading && (
              <li className="px-3 py-2 text-sm text-muted">Searching…</li>
            )}
          </ul>
        )}
      </div>

      <ul className="space-y-1">
        {list.map((player) => (
          <li key={player.id} className="flex items-center justify-between text-sm">
            <span>
              {labelPL(player)}{' '}
              <span className="text-muted">
                • {player.gender} • {player.dupr ?? '—'} • {player.age ?? '—'}
              </span>
            </span>
            <button
              type="button"
              className="text-muted hover:text-error"
              onClick={() => removePlayer(player.id)}
            >
              Remove
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="text-sm text-muted">No players assigned yet.</li>}
      </ul>
    </div>
  );
}

