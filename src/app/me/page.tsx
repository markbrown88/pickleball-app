'use client';

import { useEffect, useMemo, useState } from 'react';

type Id = string;
type CountrySel = 'Canada' | 'USA' | 'Other';

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
  const m = String(t.getMonth()+1).padStart(2,'0');
  const d = String(t.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
function fmtDate(d?: string | null) {
  if (!d) return '—';
  const dt = new Date(d); const y = dt.getFullYear(); const m = String(dt.getMonth()+1).padStart(2,'0'); const day = String(dt.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function between(a?: string|null, b?: string|null) {
  if (!a && !b) return '—'; if (a && b) return `${fmtDate(a)} – ${fmtDate(b)}`; return fmtDate(a || b);
}

type Club = {
  id: Id; name: string;
  address?: string|null; city?: string|null; region?: string|null; country?: string|null; phone?: string|null;
};
type PlayerLite = { id: Id; firstName?: string|null; lastName?: string|null; name?: string|null; gender: 'MALE'|'FEMALE' };

type Overview = {
  player: {
    id: Id; firstName?: string|null; lastName?: string|null; name?: string|null; gender: 'MALE'|'FEMALE';
    club?: Club|null; clubId?: Id|null; city?: string|null; region?: string|null; country?: string|null;
    phone?: string|null; email?: string|null; dupr?: number|null;
    birthdayYear?: number|null; birthdayMonth?: number|null; birthdayDay?: number|null;
    age?: number|null;
  };
  captainTeamIds: Record<string, unknown>; // will treat keys as ids
  assignments: {
    tournamentId: Id; tournamentName: string;
    stopId: Id; stopName: string; stopStartAt?: string|null; stopEndAt?: string|null;
    teamId: Id; teamName: string; teamClubName?: string|null;
  }[];
};

export default function MePage() {
  const [err, setErr] = useState<string|null>(null);
  const [info, setInfo] = useState<string|null>(null);
  const clearMsg = () => { setErr(null); setInfo(null); };

  const [players, setPlayers] = useState<PlayerLite[]>([]);
  const [meId, setMeId] = useState<string>('');

  const [overview, setOverview] = useState<Overview | null>(null);
  const [clubsAll, setClubsAll] = useState<Club[]>([]);

  // Profile edit form
  const [showEdit, setShowEdit] = useState(false);
  const [countrySel, setCountrySel] = useState<CountrySel>('Canada');
  const [countryOther, setCountryOther] = useState('');
  const [birthday, setBirthday] = useState<string>(fortyYearsAgoISO());
  const [form, setForm] = useState<{
    firstName: string; lastName: string; gender: 'MALE'|'FEMALE';
    clubId: Id | '';
    dupr: string;
    city: string; region: string;
    phone: string; email: string;
  }>({
    firstName:'', lastName:'', gender:'MALE', clubId:'', dupr:'', city:'', region:'', phone:'', email:''
  });

  const captainSet = useMemo(()=> new Set(Object.keys(overview?.captainTeamIds ?? {})), [overview]);

  function label(p: PlayerLite) {
    const fn = (p.firstName ?? '').trim();
    const ln = (p.lastName ?? '').trim();
    const full = [fn, ln].filter(Boolean).join(' ');
    return full || (p.name ?? 'Unknown');
  }

  // Initial loads
  useEffect(() => {
    (async () => {
      try {
        clearMsg();
        // players list for dropdown
        const r = await fetch('/api/admin/players?flat=1');
        const arr = await r.json();
        const playersArr: PlayerLite[] = Array.isArray(arr) ? arr : (arr?.items ?? []);
        setPlayers(playersArr);
        if (playersArr.length && !meId) setMeId(playersArr[0].id);

        // clubs for profile editing
        const rc = await fetch('/api/admin/clubs');
        const body = await rc.json();
        const clubsArr: Club[] = Array.isArray(body) ? body : (body?.items ?? []);
        setClubsAll(clubsArr);
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load overview whenever meId changes
  useEffect(() => {
    if (!meId) return;
    (async () => {
      try {
        clearMsg();
        const ov = await fetch(`/api/players/${meId}/overview`).then(r => r.json());
        if (ov?.error) throw new Error(ov.error);
        setOverview(ov);
        // seed form
        const p = ov.player;
        const ctry = (p.country || 'Canada') as string;
        const sel: CountrySel = (ctry === 'Canada' || ctry === 'USA') ? (ctry as CountrySel) : 'Other';
        setCountrySel(sel);
        setCountryOther(sel === 'Other' ? ctry : '');
        setBirthday(ymdToDateString(p.birthdayYear ?? null, p.birthdayMonth ?? null, p.birthdayDay ?? null) || fortyYearsAgoISO());
        setForm({
          firstName: p.firstName || '',
          lastName: p.lastName || '',
          gender: p.gender,
          clubId: (p.clubId as any) || '',
          dupr: p.dupr != null ? String(p.dupr) : '',
          city: p.city || '',
          region: p.region || '',
          phone: p.phone || '',
          email: p.email || '',
        });
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId]);

  function ymdToDateString(y?: number|null, m?: number|null, d?: number|null) {
    if (!y || !m || !d) return '';
    const mm = String(m).padStart(2,'0'); const dd = String(d).padStart(2,'0');
    return `${y}-${mm}-${dd}`;
  }

  async function saveProfile() {
    try {
      clearMsg();
      const country = countrySel === 'Other' ? (countryOther || '') : countrySel;
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        gender: form.gender,
        clubId: form.clubId,
        dupr: form.dupr ? Number(form.dupr) : null,
        city: form.city,
        region: form.region,
        country,
        phone: form.phone,
        email: form.email,
        birthday, // YYYY-MM-DD
      };
      const r = await fetch(`/api/admin/players/${meId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error || `HTTP ${r.status}`);
      setInfo('Profile updated');
      // refresh overview to reflect new info (age, club, etc.)
      const ov = await fetch(`/api/players/${meId}/overview`).then(x => x.json());
      setOverview(ov);
      setShowEdit(false);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Player</h1>
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

      {/* Profile */}
      <section className="border rounded p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Profile</h2>
          <button className="border rounded px-3 py-1" onClick={() => setShowEdit(s => !s)}>
            {showEdit ? 'Close' : 'Edit Profile'}
          </button>
        </div>

        {overview && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-600">Name</span><div>{label(overview.player as any)}</div></div>
            <div><span className="text-gray-600">Gender</span><div>{overview.player.gender}</div></div>
            <div><span className="text-gray-600">Primary Club</span><div>{overview.player.club?.name ?? '—'}</div></div>
            <div><span className="text-gray-600">Age</span><div>{overview.player.age ?? '—'}</div></div>
            <div><span className="text-gray-600">DUPR</span><div>{overview.player.dupr ?? '—'}</div></div>
            <div><span className="text-gray-600">City</span><div>{overview.player.city ?? '—'}</div></div>
            <div><span className="text-gray-600">Province/State</span><div>{overview.player.region ?? '—'}</div></div>
            <div><span className="text-gray-600">Country</span><div>{overview.player.country ?? '—'}</div></div>
            <div><span className="text-gray-600">Phone</span><div>{overview.player.phone ?? '—'}</div></div>
            <div><span className="text-gray-600">Email</span><div>{overview.player.email ?? '—'}</div></div>
          </div>
        )}

        {/* Edit dropdown */}
        {showEdit && (
          <div className="border rounded p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
            <input className="border rounded px-2 py-1" placeholder="First name" value={form.firstName}
              onChange={e=>setForm(f=>({...f,firstName:e.target.value}))} />
            <input className="border rounded px-2 py-1" placeholder="Last name" value={form.lastName}
              onChange={e=>setForm(f=>({...f,lastName:e.target.value}))} />
            <select className="border rounded px-2 py-1" value={form.gender} onChange={e=>setForm(f=>({...f,gender:e.target.value as any}))}>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>

            {/* Birthday date picker */}
            <input className="border rounded px-2 py-1" type="date" value={birthday} onChange={e=>setBirthday(e.target.value)} />

            {/* Club */}
            <select className="border rounded px-2 py-1" value={form.clubId} onChange={e=>setForm(f=>({...f,clubId:e.target.value as Id}))}>
              <option value="">Primary Club…</option>
              {(Array.isArray(clubsAll) ? clubsAll : []).map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.city ? ` (${c.city})` : ''}</option>
              ))}
            </select>

            <input className="border rounded px-2 py-1" type="number" step="0.01" min="0" max="8" placeholder="DUPR"
              value={form.dupr} onChange={e=>setForm(f=>({...f,dupr:e.target.value}))} />

            <input className="border rounded px-2 py-1" placeholder="City" value={form.city}
              onChange={e=>setForm(f=>({...f,city:e.target.value}))} />

            {/* Country + Region */}
            <select className="border rounded px-2 py-1" value={countrySel} onChange={e=>setCountrySel(e.target.value as CountrySel)}>
              <option value="Canada">Canada</option>
              <option value="USA">USA</option>
              <option value="Other">Other</option>
            </select>
            {countrySel === 'Other' ? (
              <input className="border rounded px-2 py-1" placeholder="Country" value={countryOther}
                onChange={e=>setCountryOther(e.target.value)} />
            ) : <div />}

            {countrySel === 'Canada' && (
              <select className="border rounded px-2 py-1" value={form.region} onChange={e=>setForm(f=>({...f,region:e.target.value}))}>
                <option value="">Province…</option>
                {CA_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
            {countrySel === 'USA' && (
              <select className="border rounded px-2 py-1" value={form.region} onChange={e=>setForm(f=>({...f,region:e.target.value}))}>
                <option value="">State…</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {countrySel === 'Other' && (
              <input className="border rounded px-2 py-1" placeholder="Region/Province/State" value={form.region}
                onChange={e=>setForm(f=>({...f,region:e.target.value}))} />
            )}

            {/* contact */}
            <input className="border rounded px-2 py-1" placeholder="Phone (10 digits)" value={form.phone}
              onChange={e=>setForm(f=>({...f,phone:e.target.value}))} />
            <input className="border rounded px-2 py-1" type="email" placeholder="Email" value={form.email}
              onChange={e=>setForm(f=>({...f,email:e.target.value}))} />

            <div className="col-span-full flex gap-2">
              <button className="border rounded px-3 py-1" onClick={saveProfile}>Save</button>
              <button className="border rounded px-3 py-1" onClick={()=>setShowEdit(false)}>Cancel</button>
            </div>
          </div>
        )}
      </section>

      {/* Assignments */}
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
                <th className="py-2 pr-4">Team Club</th>
                <th className="py-2 pr-4">Role</th>
              </tr>
            </thead>
            <tbody>
              {(overview?.assignments ?? []).length === 0 && (
                <tr><td colSpan={6} className="py-4 text-gray-600">No assignments yet.</td></tr>
              )}
              {(overview?.assignments ?? []).map((row, i) => {
                const isCaptain = captainSet.has(row.teamId);
                return (
                  <tr key={i} className="border-b">
                    <td className="py-2 pr-4">{row.tournamentName}</td>
                    <td className="py-2 pr-4">{row.teamName}</td>
                    <td className="py-2 pr-4">{row.stopName}</td>
                    <td className="py-2 pr-4">{between(row.stopStartAt ?? null, row.stopEndAt ?? null)}</td>
                    <td className="py-2 pr-4">{row.teamClubName ?? '—'}</td>
                    <td className="py-2 pr-4">
                      {isCaptain ? <span className="px-2 py-0.5 rounded-full border border-amber-400 bg-amber-50">Captain</span> : 'Player'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
