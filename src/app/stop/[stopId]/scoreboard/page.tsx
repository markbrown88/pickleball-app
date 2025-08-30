import Scoreboard from './scoreboard-client';
import { prisma } from '@/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: { stopId: string }}) {
  const stop = await prisma.stop.findUnique({
    where: { id: params.stopId },
    include: {
      tournament: true,
      rounds: {
        orderBy: { idx: 'asc' },
        include: {
          matches: {
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
  if (!stop) return <div className="p-6">Stop not found.</div>;
  return <Scoreboard initial={stop} />;
}
