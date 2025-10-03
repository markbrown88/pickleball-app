// src/app/admin/games/[gameId]/page.tsx
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPrisma } from '@/lib/prisma';
import ScoreEditor from '@/app/admin/games/[gameId]/ScoreEditor';

type PageProps = { params: Promise<{ gameId: string }> };

export default async function GameAdminPage({ params }: PageProps) {
  const { gameId } = await params;
  const prisma = getPrisma();

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      match: {
        include: {
          teamA: { select: { id: true, name: true } },
          teamB: { select: { id: true, name: true } },
          games: {
            orderBy: { slot: 'asc' },
            select: { id: true, slot: true, teamAScore: true, teamBScore: true }
          },
          round: {
            select: {
              id: true,
              idx: true,
              stop: { select: { id: true, name: true, tournamentId: true } }
            }
          }
        }
      }
    }
  });

  if (!game) {
    notFound();
  }

  const teamAName = game.match.teamA?.name ?? '—';
  const teamBName = game.match.teamB?.name ?? '—';

  return (
    <main className="min-h-screen bg-app">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-primary">Edit Scores</h1>
            <p className="text-muted mt-1">
              Round {game.match.round?.idx != null ? game.match.round.idx + 1 : '—'} • {game.match.round?.stop?.name ?? '—'}
            </p>
          </div>
          <Link href="/admin" className="btn btn-ghost">Admin Home</Link>
        </div>

        {game.match.isBye ? (
          <div className="card bg-status-warning/10 border-status-warning">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-status-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-status-warning">This is a BYE game — no matches to score.</span>
            </div>
          </div>
        ) : (
          <ScoreEditor
            gameId={game.id}
            teamAName={teamAName}
            teamBName={teamBName}
            matches={game.match.games
              .filter(m => m.slot !== null)
              .map(m => ({
                id: m.id,
                slot: m.slot!,
                teamAScore: m.teamAScore,
                teamBScore: m.teamBScore,
              }))}
          />
        )}
      </div>
    </main>
  );
}