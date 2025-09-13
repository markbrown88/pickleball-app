'use client';
import { useEffect, useState } from 'react';

export default function Scoreboard({ initial }: any) {
  const [data, setData] = useState(initial);

  useEffect(() => {
    // Use polling for real-time updates
    const id = setInterval(async ()=>{
      const res = await fetch(`/api/public/stops/${initial.id}/scoreboard`, { cache: 'no-store' });
      setData(await res.json());
    }, 5000);
    return () => clearInterval(id);
  }, [initial.id]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">{data.tournament.name} — {data.name}</h1>
      {data.rounds.map((r:any) => (
        <div key={r.id} className="rounded-xl border p-4 space-y-2">
          <h2 className="font-medium">Round {r.idx + 1}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {r.matches.map((match:any) => (
              <div key={match.id} className="rounded-lg border p-3">
                <div className="flex justify-between">
                  <span>{match.teamA?.name ?? '—'} vs {match.teamB?.name ?? '—'}</span>
                  <span className="opacity-70">{match.games.reduce((acc:number,game:any)=>acc+(game.teamAScore??0) - (game.teamBScore??0),0) > 0 ? '• Live' : ''}</span>
                </div>
                <ul className="mt-2 text-sm">
                  {match.games.map((game:any)=>(
                    <li key={game.id} className="flex justify-between">
                      <span>{game.slot}</span>
                      <span>{game.teamAScore ?? 0} – {game.teamBScore ?? 0}</span>
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
