import Scoreboard from './scoreboard-client';
import { prisma } from '@/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
              games: {
                include: {
                  teamA: { include: { club: true } },
                  teamB: { include: { club: true } },
                  matches: true
                }
              }
            }
          }
        }
      }
    }
  });
  if (!stop) return <div className="min-h-screen bg-app p-6 text-primary">Stop not found.</div>;
  return <Scoreboard initial={stop} />;
}
