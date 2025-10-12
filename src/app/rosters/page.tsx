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
    <section className="min-h-screen bg-app p-6 space-y-6 max-w-7xl mx-auto">
      <header className="card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary">Tournament Rosters</h1>
            <p className="text-sm text-muted mt-1">{headline}</p>
          </div>
          {tournaments.length > 1 && (
            <div className="flex items-center gap-3">
              <label htmlFor="roster-tournament" className="text-sm font-semibold text-secondary label-caps">
                Tournament:
              </label>
              <select
                id="roster-tournament"
                className="input min-w-[280px]"
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
        </div>
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
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-border-subtle">
          <div>
            <h2 className="text-xl font-bold text-primary">{roster.tournamentName}</h2>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <span className="chip chip-info text-[10px] px-2 py-0.5">{roster.stops.length || '0'} Stops</span>
              <span className="text-xs text-muted">
                Roster Cap: <span className="font-semibold text-secondary">{roster.maxTeamSize ?? 'No limit'}</span>
              </span>
              <span className="text-xs text-muted">
                <span className="font-semibold text-secondary">{roster.clubs.length}</span> {roster.clubs.length === 1 ? 'Club' : 'Clubs'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {roster.clubs.map((club) => (
          <div key={club.clubId} className="border-2 border-border-medium rounded-lg overflow-hidden bg-surface-1">
            <button
              className="w-full px-6 py-4 flex items-center justify-between text-left bg-surface-2 hover:bg-surface-1 transition-colors"
              onClick={() => toggleClub(club.clubId)}
            >
              <div className="flex items-center gap-3">
                <div className={`transform transition-transform text-secondary ${openClubIds.has(club.clubId) ? 'rotate-90' : ''}`}>
                  ▶
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-primary">{club.clubName}</h3>
                  <p className="text-xs text-muted mt-0.5">{club.brackets.length} {club.brackets.length === 1 ? 'bracket' : 'brackets'}</p>
                </div>
              </div>
            </button>
            {openClubIds.has(club.clubId) && (
              <div className="bg-app border-t border-border-subtle px-6 py-6">
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
  const [selectedStopId, setSelectedStopId] = useState<string>('');
  const [expandedStops, setExpandedStops] = useState<Set<string>>(new Set());

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

    // Auto-select first stop or expand all if single stop
    if (stops.length > 0) {
      if (hasMultipleStops) {
        setSelectedStopId(stops[0].stopId);
      } else {
        setExpandedStops(new Set([stops[0].stopId]));
      }
    }
  }, [stops, club.brackets, hasMultipleStops]);

  const setStopTeamRoster = (stopId: string, teamId: string, next: PlayerLite[]) => {
    setRosters((prev) => ({
      ...prev,
      [stopId]: {
        ...(prev[stopId] ?? {}),
        [teamId]: next,
      },
    }));
  };

  const toggleStop = (stopId: string) => {
    setExpandedStops((prev) => {
      const next = new Set(prev);
      if (next.has(stopId)) {
        next.delete(stopId);
      } else {
        next.add(stopId);
      }
      return next;
    });
  };

  const getRosterCompletion = (stopId: string) => {
    const stopRoster = rosters[stopId] || {};
    const totalSlots = club.brackets.length * (maxTeamSize || 0);
    if (totalSlots === 0) return { filled: 0, total: 0, percentage: 0 };

    let filled = 0;
    for (const bracket of club.brackets) {
      const list = stopRoster[bracket.teamId] || [];
      filled += list.length;
    }

    return {
      filled,
      total: totalSlots,
      percentage: Math.round((filled / totalSlots) * 100),
    };
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      for (const stop of stops) {
        for (const bracket of club.brackets) {
          const list = rosters[stop.stopId]?.[bracket.teamId] ?? [];
          const response = await fetch(
            `/api/admin/teams/${bracket.teamId}/stops/${stop.stopId}/roster`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                playerIds: list.map((p) => p.id),
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

  // Render function for stop content
  const renderStopContent = (stop: StopData, idx: number) => {
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

    const completion = getRosterCompletion(stop.stopId);

    return (
      <div className="space-y-4">
        {/* Stop Info Header */}
        <div className="flex items-center justify-between p-4 bg-surface-2 rounded-lg border border-border-subtle">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-info/20">
              <span className="text-lg">📍</span>
            </div>
            <div>
              <div className="font-semibold text-base text-primary">
                {stop.locationName ?? 'Location TBD'}
              </div>
              <div className="text-sm text-muted">
                {between(stop.startAt, stop.endAt)}
              </div>
            </div>
            {maxTeamSize && maxTeamSize > 0 && (
              <div className="flex items-center gap-2">
                <div className="text-xs text-muted">
                  <span className="font-semibold text-secondary">{completion.filled}</span> / {completion.total} players
                </div>
                <div className="w-24 h-2 bg-surface-1 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      completion.percentage >= 100 ? 'bg-success' :
                      completion.percentage >= 50 ? 'bg-warning' :
                      'bg-info'
                    }`}
                    style={{ width: `${Math.min(completion.percentage, 100)}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-muted">{completion.percentage}%</span>
              </div>
            )}
          </div>
          {previousStop && (
            <button
              className="btn btn-secondary text-sm"
              type="button"
              onClick={copyFromPrevious}
            >
              Copy from {previousStop.stopName || 'previous'}
            </button>
          )}
        </div>

        {/* Bracket Rosters Grid */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {club.brackets.map((bracket) => {
            const list = rosters[stop.stopId]?.[bracket.teamId] ?? [];
            // Exclude players from other teams within THIS stop only
            // (players can play for different teams at different stops)
            const excludeWithinStop = Object.entries(rosters[stop.stopId] ?? {})
              .filter(([teamId]) => teamId !== bracket.teamId)
              .flatMap(([, players]) => players)
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
                excludeIdsAcrossStop={excludeWithinStop}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Use tabs for multiple stops, accordion for single stop */}
      {hasMultipleStops ? (
        <div>
          {/* Tab Navigation */}
          <div className="border-b border-border-subtle mb-6">
            <nav className="flex gap-1 -mb-px" aria-label="Stop tabs">
              {stops.map((stop) => {
                const completion = getRosterCompletion(stop.stopId);
                const isActive = selectedStopId === stop.stopId;

                return (
                  <button
                    key={stop.stopId}
                    onClick={() => setSelectedStopId(stop.stopId)}
                    className={`tab-button ${isActive ? 'active' : ''}`}
                  >
                    <span>{stop.stopName || 'Stop'}</span>
                    {maxTeamSize && maxTeamSize > 0 && (
                      <span className={`chip text-[10px] px-2 py-0.5 ml-2 ${
                        completion.percentage >= 100 ? 'chip-success' :
                        completion.percentage >= 50 ? 'chip-warning' :
                        'chip-info'
                      }`}>
                        {completion.filled}/{completion.total}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Active Stop Content */}
          {stops.map((stop, idx) =>
            stop.stopId === selectedStopId ? (
              <div key={stop.stopId}>
                {renderStopContent(stop, idx)}
              </div>
            ) : null
          )}
        </div>
      ) : (
        /* Accordion for single stop or simple list */
        stops.map((stop, idx) => (
          <div key={stop.stopId}>
            {renderStopContent(stop, idx)}
          </div>
        ))
      )}

      <div className="pt-6 flex items-center gap-3 border-t-2 border-border-medium">
        <button
          className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
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
            'Save All Rosters'
          )}
        </button>
        {saving && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <div className="loading-spinner w-4 h-4" />
            <span>Updating all stop rosters…</span>
          </div>
        )}
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
    <div className="card border-2 border-border-medium">
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <h4 className="text-sm font-semibold text-primary label-caps">{title}</h4>
      </div>

      <div className="relative mt-4">
        <input
          className="input w-full"
          placeholder="🔍 Search players (min 3 chars)"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onFocus={() => { if (options.length) setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
        />
        {open && options.length > 0 && (
          <ul className="absolute z-10 mt-2 w-full bg-surface-1 border-2 border-secondary rounded-lg shadow-xl overflow-hidden">
            {options.map((player) => (
              <li
                key={player.id}
                className="px-4 py-3 text-sm hover:bg-surface-2 cursor-pointer transition-colors border-b border-border-subtle last:border-0"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  addPlayer(player);
                  setTerm('');
                  setOptions([]);
                  setOpen(false);
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-secondary">{labelPL(player)}</span>
                  <div className="flex items-center gap-2">
                    <span className={`chip text-[10px] px-2 py-0.5 ${
                      player.gender === 'MALE' ? 'chip-info' : 'chip-accent'
                    }`}>
                      {player.gender === 'MALE' ? 'M' : 'F'}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-muted mt-1 flex items-center gap-3">
                  <span>DUPR: {player.dupr ?? 'N/A'}</span>
                  <span>Age: {player.age ?? 'N/A'}</span>
                </div>
              </li>
            ))}
            {loading && (
              <li className="px-4 py-3 text-sm text-muted flex items-center gap-2">
                <div className="loading-spinner w-4 h-4" />
                Searching…
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="space-y-3 mt-4">
        <div className="text-xs font-semibold text-muted label-caps">Current Roster</div>
        <ul className="space-y-2">
          {list.map((player) => (
            <li key={player.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-2 border border-border-subtle hover:border-border-medium transition-colors">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-secondary">{labelPL(player)}</span>
                  <span className={`chip text-[10px] px-2 py-0.5 ${
                    player.gender === 'MALE' ? 'chip-info' : 'chip-accent'
                  }`}>
                    {player.gender === 'MALE' ? 'M' : 'F'}
                  </span>
                </div>
                <div className="text-xs text-muted mt-1 flex items-center gap-3">
                  <span>DUPR: <span className="font-semibold text-secondary">{player.dupr ?? 'N/A'}</span></span>
                  <span>Age: <span className="font-semibold text-secondary">{player.age ?? 'N/A'}</span></span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost text-xs px-2 py-1 text-error hover:bg-error/10"
                onClick={() => removePlayer(player.id)}
              >
                Remove
              </button>
            </li>
          ))}
          {list.length === 0 && (
            <li className="text-sm text-muted p-4 text-center bg-surface-2/50 rounded-lg border-2 border-dashed border-border-medium italic">
              No players assigned yet. Search above to add players.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

