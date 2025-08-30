'use client';
import { useEffect, useState } from 'react';

export default function Scoreboard({ initial }: any) {
  const [data, setData] = useState(initial);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      const id = setInterval(async ()=>{
        const res = await fetch(`/api/public/stops/${initial.id}/scoreboard`, { cache: 'no-store' });
        setData(await res.json());
      }, 5000);
      return () => clearInterval(id);
    }
    // Optional: supabase realtime subscription for "Game" table changes
    // Lazy-import Supabase only in the browser when keys are present
    import('@supabase/supabase-js').then(({ createClient }) => {
      const supabase = createClient(url, key);
      const channel = supabase
        .channel('scoreboard')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'Game' }, async () => {
          const res = await fetch(`/api/public/stops/${initial.id}/scoreboard`, { cache: 'no-store' });
          setData(await res.json());
        }).subscribe();
      return () => { supabase.removeChannel(channel); };
    });
  }, [initial.id]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">{data.tournament.name} — {data.name}</h1>
      {data.rounds.map((r:any) => (
        <div key={r.id} className="rounded-xl border p-4 space-y-2">
          <h2 className="font-medium">{r.name}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {r.matches.map((m:any) => (
              <div key={m.id} className="rounded-lg border p-3">
                <div className="flex justify-between">
                  <span>{m.teamA?.club?.name ?? '—'} vs {m.teamB?.club?.name ?? '—'}</span>
                  <span className="opacity-70">{m.games.reduce((acc:number,g:any)=>acc+(g.teamAScore??0) - (g.teamBScore??0),0) > 0 ? '• Live' : ''}</span>
                </div>
                <ul className="mt-2 text-sm">
                  {m.games.map((g:any)=>(
                    <li key={g.id} className="flex justify-between">
                      <span>{g.slot}</span>
                      <span>{g.teamAScore ?? 0} – {g.teamBScore ?? 0}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
