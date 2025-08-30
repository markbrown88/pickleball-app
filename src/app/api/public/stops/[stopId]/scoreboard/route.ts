import { prisma } from '@/server/db';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { stopId: string }}) {
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
  if (!stop) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(stop, { headers: { 'Cache-Control': 'no-store' } });
}
