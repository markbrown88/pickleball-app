'use client';
import { useState } from 'react';

export default function TeamEditor({ inviteId, team }: any) {
  const [name, setName] = useState(team.name);
  const [saving, setSaving] = useState(false);

  async function saveBasics() {
    setSaving(true);
    await fetch(`/api/captain/team/${team.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, clubId: team.clubId }),
    });
    setSaving(false);
  }

  return (
    <div className="rounded-xl border p-4 space-y-4">
      <div className="space-y-2">
        <label className="font-medium">Team name</label>
        <input className="w-full rounded border p-2" value={name} onChange={e=>setName(e.target.value)} />
      </div>

      {/* TODO: club selector component bound to /api/admin/clubs */}

      <button onClick={saveBasics} disabled={saving} className="rounded-lg px-4 py-2 border">
        {saving ? 'Saving…' : 'Save'}
      </button>

      <RosterEditor team={team} />
    </div>
  );
}

function RosterEditor({ team }: any) {
  const [term, setTerm] = useState('');
  const [busy, setBusy] = useState(false);

  async function addPlayer(playerId: string) {
    setBusy(true);
    const res = await fetch(`/api/captain/team/${team.id}/roster`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    });
    setBusy(false);
    if (!res.ok) alert((await res.json()).error || 'Failed to add');
    else location.reload();
  }

  async function removePlayer(playerId: string) {
    setBusy(true);
    await fetch(`/api/captain/team/${team.id}/roster/${playerId}`, { method: 'DELETE' });
    setBusy(false);
    location.reload();
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-medium">Roster (max 8)</h2>
      <ul className="list-disc pl-5">
        {team.playerLinks.map((pl: any) => (
          <li key={pl.playerId} className="flex items-center justify-between">
            <span>{pl.player.firstName} {pl.player.lastName}</span>
            <button onClick={() => removePlayer(pl.playerId)} className="text-sm underline">Remove</button>
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <input value={term} onChange={e=>setTerm(e.target.value)} placeholder="Search players…" className="rounded border p-2 flex-1" />
        <button disabled={busy || term.length < 3} onClick={async ()=>{
          const r = await fetch(`/api/admin/players/search?term=${encodeURIComponent(term)}&tournamentId=${team.tournamentId}`);
          const { items } = await r.json();
          const p = items?.[0];
          if (!p) return alert('No results');
          addPlayer(p.id);
        }} className="rounded-lg px-3 py-2 border">Add first match</button>
      </div>
    </div>
  );
}
