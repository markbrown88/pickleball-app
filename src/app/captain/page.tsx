'use client';

import { useEffect, useMemo, useState } from 'react';

type Id = string;

type PlayerLite = {
  id: Id;
  firstName?: string|null;
  lastName?: string|null;
  name?: string|null;
  gender: 'MALE'|'FEMALE';
};

type Club = {
  id: Id;
  name: string;
  city?: string|null;
};

type CaptainTeamsResponse = {
  teams: {
    id: Id;
    name: string;
    club?: Club|null;
    roster: Array<{
      id: Id;
      firstName?: string|null;
      lastName?: string|null;
      name?: string|null;
      gender: 'MALE'|'FEMALE';
      clubId?: Id|null;
    }>;
    stops: Array<{
      stopId: Id;
      stopName: string;
      startAt?: string|null;
      endAt?: string|null;
      tournamentId?: Id|null;
      tournamentName?: string|null;
      stopRoster: Array<{
        id: Id;
        firstName?: string|null;
        lastName?: string|null;
        name?: string|null;
        gender: 'MALE'|'FEMALE';
      }>;
    }>;
  }[];
};

function label(p: { firstName?: string|null; lastName?: string|null; name?: string|null }) {
  const fn = (p.firstName ?? '').trim();
  const ln = (p.lastName ?? '').trim();
  const full = [fn, ln].filter(Boolean).join(' ');
  return full || (p.name ?? 'Unknown');
}
function fmtDate(d?: string | null) {
  if (!d) return '—';
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth()+1).padStart(2,'0');
  const day = String(dt.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function between(a?: string|null, b?: string|null) {
  if (!a && !b) return '—';
  if (a && b) return `${fmtDate(a)} – ${fmtDate(b)}`;
  return fmtDate(a || b);
}

export default function CaptainPage() {
  const [err, setErr] = useState<string|null>(null);
  const [info, setInfo] = useState<string|null>(null);
  const clearMsg = () => { setErr(null); setInfo(null); };

  const [players, setPlayers] = useState<PlayerLite[]>([]);
  const [meId, setMeId] = useState<string>('');

  const [data, setData] = useState<CaptainTeamsResponse>({ teams: [] });

  useEffect(() => {
    (async () => {
      try {
        clearMsg();
        const r = await fetch('/api/admin/players?flat=1');
        const body = await r.json();
        const arr: PlayerLite[] = Array.isArray(body) ? body : (body?.items ?? []);
        setPlayers(arr);
        if (arr.length && !meId) setMeId(arr[0].id);
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!meId) return;
    (async () => {
      try {
        clearMsg();
        const d = await fetch(`/api/captain/${meId}/teams`).then(r => r.json());
        if (d?.error) throw new Error(d.error);
        setData(d);
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
  }, [meId]);

  const flattenedAssignments = useMemo(() => {
    const rows: Array<{
      tournamentName: string;
      teamName: string;
      stopName: string;
      dates: string;
      stopRoster: string[];
    }> = [];
    for (const t of data.teams ?? []) {
      for (const s of t.stops ?? []) {
        rows.push({
          tournamentName: s.tournamentName ?? '—',
          teamName: t.name,
          stopName: s.stopName,
          dates: between(s.startAt ?? null, s.endAt ?? null),
          stopRoster: (s.stopRoster ?? []).map(p => label(p)),
        });
      }
    }
    return rows;
  }, [data]);

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Captain</h1>
        <div className="text-sm">
          <span className="mr-2">Act as Player</span>
          <select className="border rounded px-2 py-1" value={meId} onChange={e => setMeId(e.target.value)}>
            {(Array.isArray(players) ? players : []).map(p => (
              <option key={p.id} value={p.id}>{label(p)} ({p.gender})</option>
            ))}
          </select>
        </div>
      </div>

      {err && <div className="border border-red-300 bg-red-50 text-red-700 p-3 rounded">{err}</div>}
      {info && <div className="border border-green-300 bg-green-50 text-green-700 p-3 rounded">{info}</div>}

      {/* My Teams (as Captain) */}
      <section className="border rounded p-4 space-y-4">
        <h2 className="text-lg font-semibold">My Teams (Captain)</h2>

        {data.teams.length === 0 && (
          <p className="text-gray-600 text-sm">You are not captain of any team yet.</p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {data.teams.map(team => (
            <div key={team.id} className="border rounded p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-medium">{team.name}</div>
                <div className="text-xs text-gray-600">{team.club?.name ? `Club: ${team.club.name}` : '—'}</div>
              </div>

              <div className="text-sm">
                <div className="text-gray-600 mb-1">Roster (max 8):</div>
                {team.roster.length === 0 ? (
                  <div className="text-gray-500">No players yet.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {team.roster.map(p => (
                      <span key={p.id} className="px-2 py-0.5 rounded-full border">
                        {label(p)}{p.gender === 'MALE' ? ' ♂' : ' ♀'}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-xs text-gray-500">
                {/* future: buttons to add/remove players; lineups per round */}
                Coming soon: manage roster & round lineups here.
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Assignments table */}
      <section className="border rounded p-4 space-y-3">
        <h2 className="text-lg font-semibold">Tournaments & Stops</h2>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Tournament</th>
                <th className="py-2 pr-4">Team</th>
                <th className="py-2 pr-4">Stop</th>
                <th className="py-2 pr-4">Dates</th>
                <th className="py-2 pr-4">Stop Roster</th>
              </tr>
            </thead>
            <tbody>
              {flattenedAssignments.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-gray-600">No assignments yet.</td></tr>
              )}
              {flattenedAssignments.map((row, i) => (
                <tr key={i} className="border-b align-top">
                  <td className="py-2 pr-4">{row.tournamentName}</td>
                  <td className="py-2 pr-4">{row.teamName}</td>
                  <td className="py-2 pr-4">{row.stopName}</td>
                  <td className="py-2 pr-4">{row.dates}</td>
                  <td className="py-2 pr-4">
                    {row.stopRoster.length === 0 ? (
                      <span className="text-gray-500">No players selected</span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {row.stopRoster.map((n, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded-full border">{n}</span>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500">
          Coming soon: edit stop rosters here (select up to 8 players from your team for each stop).
        </p>
      </section>
    </main>
  );
}
