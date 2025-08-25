'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { UserButton, SignedIn, SignedOut } from '@clerk/nextjs';

type Tournament = { id: string; name: string; createdAt: string };

export default function Home() {
  const [name, setName] = useState('');
  const [rows, setRows] = useState<Tournament[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    const r = await fetch('/api/tournaments', { cache: 'no-store' });

    // Ensure we really got JSON
    const ct = r.headers.get('content-type') ?? '';
    if (!ct.includes('application/json')) {
      const text = await r.text();
      throw new Error(`Non-JSON response (${r.status}): ${text.slice(0, 120)}...`);
    }

    const j = await r.json();

    // 💡 Guard: API might return { error: "..." } on failures
    if (!Array.isArray(j)) {
      throw new Error(`API error (${r.status}): ${JSON.stringify(j).slice(0, 120)}...`);
    }

    setRows(j);
  }

  useEffect(() => {
    void refresh().catch(e => setErr(e instanceof Error ? e.message : 'Unknown error'));
  }, []);

  async function addTournament(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      const ct = r.headers.get('content-type') ?? '';
      if (!ct.includes('application/json')) {
        const text = await r.text();
        throw new Error(`Non-JSON response (${r.status}): ${text.slice(0, 120)}...`);
      }

      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j?.error ?? `Failed (${r.status})`);

      setName('');
      await refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      setErr(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pickleball App</h1>
        <div>
          <SignedIn><UserButton afterSignOutUrl="/" /></SignedIn>
          <SignedOut><Link href="/sign-in">Sign in</Link></SignedOut>
        </div>
      </div>

      <form onSubmit={addTournament} className="mt-6 flex gap-2">
        <input
          className="border px-3 py-2 rounded w-full"
          placeholder="Tournament name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button disabled={busy || !name.trim()} className="border px-4 py-2 rounded">
          {busy ? 'Saving…' : 'Add'}
        </button>
      </form>
      {err && <p className="text-red-600 mt-2">{err}</p>}

      <h2 className="text-lg font-semibold mt-6 mb-2">Tournaments</h2>
      <ul className="space-y-2">
        {rows.map((t) => (
          <li key={t.id} className="border rounded p-3 flex items-center justify-between">
            <span>{t.name}</span>
            <span className="text-sm text-gray-500">
              {new Date(t.createdAt).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
