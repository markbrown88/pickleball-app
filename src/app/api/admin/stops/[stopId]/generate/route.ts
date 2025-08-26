export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { generateRoundRobin } from '@/lib/roundRobin';

type Params = { stopId: string };

export async function POST(_req: Request, ctx: { params: Promise<Params> }) {
  try {
    const { stopId } = await ctx.params;
    const prisma = getPrisma();

    const teamLinks = await prisma.stopTeam.findMany({ where: { stopId } });
    if (teamLinks.length < 2) {
      return NextResponse.json({ error: 'need at least 2 teams' }, { status: 400 });
    }

    const teamIds = teamLinks.map(l => l.teamId);
    const rr = generateRoundRobin(teamIds);

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < rr.length; i++) {
        const round = await tx.round.create({ data: { stopId, idx: i + 1 } });

        for (const g of rr[i].games) {
          const game = await tx.game.create({
            data: {
              roundId: round.id,
              teamAId: g.isBye ? null : g.a ?? null,
              teamBId: g.isBye ? null : g.b ?? null,
              isBye: g.isBye,
            },
          });

          if (!g.isBye) {
            await tx.match.createMany({
              data: [
                { gameId: game.id, slot: 'MENS_DOUBLES' },
                { gameId: game.id, slot: 'WOMENS_DOUBLES' },
                { gameId: game.id, slot: 'MIXED_1' },
                { gameId: game.id, slot: 'MIXED_2' },
              ],
              skipDuplicates: true,
            });
          }
        }
      }
    });

    return NextResponse.json({ ok: true, rounds: rr.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
