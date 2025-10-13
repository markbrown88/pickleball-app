import dynamic from 'next/dynamic';
import { prisma } from '@/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Dynamically import Scoreboard to reduce initial bundle
const Scoreboard = dynamic(() => import('./scoreboard-client'), {
  loading: () => (
    <div className="min-h-screen bg-app flex items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="loading-spinner" />
        <span className="text-muted">Loading scoreboard...</span>
      </div>
    </div>
  ),
  ssr: false
});

export default async function Page({ params }: { params: Promise<{ stopId: string }>}) {
  const { stopId } = await params;
  const stop = await prisma.stop.findUnique({
    where: { id: stopId },
    include: {
      tournament: true,
      rounds: {
        orderBy: { idx: 'asc' },
        include: {
          matches: {
            orderBy: [
              { updatedAt: 'desc' }, // Most recently completed matches first
              { id: 'asc' } // Fallback to ID for matches with same completion time
            ],
            include: {
              teamA: { include: { club: true } },
              teamB: { include: { club: true } },
              games: true
            }
          }
        }
      }
    }
  });
  if (!stop) return <div className="min-h-screen bg-app p-6 text-primary">Stop not found.</div>;
  return <Scoreboard initial={stop} />;
}
