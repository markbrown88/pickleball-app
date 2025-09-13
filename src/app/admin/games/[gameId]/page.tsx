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
    select: {
      id: true,
      isBye: true,
      teamA: { select: { id: true, name: true } },
      teamB: { select: { id: true, name: true } },
      matches: {
        orderBy: { slot: 'asc' },
        select: { id: true, slot: true, teamAScore: true, teamBScore: true },
      },
      round: {
        select: {
          id: true,
          idx: true,
          stop: { select: { id: true, name: true, tournamentId: true } },
        },
      },
    },
  });

  if (!game) {
    notFound();
  }

  const teamAName = game.teamA?.name ?? '—';
  const teamBName = game.teamB?.name ?? '—';

  return (
    <main className="p-6 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Edit Scores</h1>
        <div className="text-sm">
          <Link href="/admin" className="underline">Admin Home</Link>
        </div>
      </div>

      <div className="text-sm text-gray-600">
        Round {game.round?.idx != null ? game.round.idx + 1 : '—'} • {game.round?.stop?.name ?? '—'}
      </div>

      {game.isBye ? (
        <div className="border rounded p-4 bg-yellow-50">
          This is a BYE game — no matches to score.
        </div>
      ) : (
        <ScoreEditor
          gameId={game.id}
          teamAName={teamAName}
          teamBName={teamBName}
          matches={game.matches.map(m => ({
            id: m.id,
            slot: m.slot,
            teamAScore: m.teamAScore,
            teamBScore: m.teamBScore,
          }))}
        />
      )}
    </main>
  );
}
