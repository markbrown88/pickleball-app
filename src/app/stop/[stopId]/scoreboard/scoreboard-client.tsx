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
    <div className="min-h-screen bg-app">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">{data.tournament.name} — {data.name}</h1>
          <p className="text-muted">Live tournament results and standings</p>
        </div>
        
        {data.rounds.map((r:any) => (
          <div key={r.id} className="card">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-primary">Round {r.idx + 1}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {r.matches.map((match:any) => (
                <div key={match.id} className="card bg-surface-2">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-primary font-medium">{match.teamA?.name ?? '—'} vs {match.teamB?.name ?? '—'}</span>
                    {match.games.reduce((acc:number,game:any)=>acc+(game.teamAScore??0) - (game.teamBScore??0),0) > 0 && (
                      <span className="chip chip-success text-xs">Live</span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {match.games.map((game:any)=>(
                      <div key={game.id} className="flex justify-between items-center py-1 border-b border-subtle last:border-b-0">
                        <span className="text-muted text-sm">{game.slot}</span>
                        <span className="text-secondary font-medium tabular">{game.teamAScore ?? 0} – {game.teamBScore ?? 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
