export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
// go up 6 levels to reach `src`, then into lib
import { getPrisma } from '../../../../../../lib/prisma';
import { generateRoundRobin } from '../../../../../../lib/roundRobin';

type Params = { stopId: string };

// In Next 15, `params` is a Promise — you must await it.
export async function POST(_req: Request, ctx: { params: Promise<Params> }) {
  try {
    const { stopId } = await ctx.params;
    const prisma = getPrisma();

    // Which teams are in this stop?
    const teamLinks = await prisma.stopTeam.findMany({ where: { stopId } });
    if (teamLinks.length < 2) {
      return NextResponse.json({ error: 'need at least 2 teams' }, { status: 400 });
    }

    const teamIds = teamLinks.map(l => l.teamId);
    const rr = generateRoundRobin(teamIds); // round-robin pairs with byes

    // Create rounds, games, and default matches (no tiebreaker by default)
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
