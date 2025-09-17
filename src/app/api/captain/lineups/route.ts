// src/app/api/captain/lineups/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { GameSlot } from '@prisma/client';

type Pair = { slot: GameSlot; player1Id: string; player2Id: string };
type PutBody = { roundId: string; teamId: string; pairs: Pair[] };

function label(p: { firstName?: string | null; lastName?: string | null; name?: string | null }) {
  const fn = (p.firstName ?? '').trim();
  const ln = (p.lastName ?? '').trim();
  const full = [fn, ln].filter(Boolean).join(' ');
  return full || (p.name ?? 'Unknown');
}

/** GET ?roundId=...&teamId=...  -> lineup with entries (or empty if none). */
export async function GET(req: Request) {
  // Use singleton prisma instance
  try {
    const url = new URL(req.url);
    const roundId = url.searchParams.get('roundId') || '';
    const teamId = url.searchParams.get('teamId') || '';

    if (!roundId || !teamId) {
      return NextResponse.json({ error: 'roundId and teamId are required' }, { status: 400 });
    }

    // Verify round & team, and that they belong to same tournament (via stop → tournamentId)
    const [round, team] = await Promise.all([
      prisma.round.findUnique({
        where: { id: roundId },
        select: { id: true, stop: { select: { id: true, tournamentId: true } } },
      }),
      prisma.team.findUnique({ where: { id: teamId }, select: { id: true, tournamentId: true } }),
    ]);
    if (!round || !team) {
      return NextResponse.json({ error: 'Round or Team not found' }, { status: 404 });
    }
    if (round.stop.tournamentId !== (team.tournamentId ?? null)) {
      return NextResponse.json({ error: 'Round and Team do not belong to the same tournament' }, { status: 400 });
    }

    // Read lineup (if any)
    const lineup = await prisma.lineup.findUnique({
      where: { roundId_teamId: { roundId, teamId } },
      include: {
        entries: {
          orderBy: { slot: 'asc' },
          include: {
            player1: { select: { id: true, firstName: true, lastName: true, name: true, gender: true } },
            player2: { select: { id: true, firstName: true, lastName: true, name: true, gender: true } },
          },
        },
      },
    });

    const resp = lineup
      ? {
          id: lineup.id,
          roundId: lineup.roundId,
          teamId: lineup.teamId,
          entries: lineup.entries.map((e) => ({
            id: e.id,
            slot: e.slot,
            player1: {
              id: e.player1.id,
              firstName: e.player1.firstName,
              lastName: e.player1.lastName,
              name: label(e.player1),
              gender: e.player1.gender,
            },
            player2: {
              id: e.player2.id,
              firstName: e.player2.firstName,
              lastName: e.player2.lastName,
              name: label(e.player2),
              gender: e.player2.gender,
            },
          })),
        }
      : {
          id: null,
          roundId,
          teamId,
          entries: [] as any[],
        };

    return NextResponse.json(resp);
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to load lineup', detail: e?.message ?? '' }, { status: 500 });
  }
}

/** PUT -> replace-all entries for (roundId, teamId). Body: { roundId, teamId, pairs: [{slot, player1Id, player2Id}] } */
export async function PUT(req: Request) {
  // Use singleton prisma instance
  try {
    const body = (await req.json().catch(() => ({}))) as PutBody;
    const roundId = (body?.roundId ?? '').trim();
    const teamId = (body?.teamId ?? '').trim();
    const pairs: Pair[] = Array.isArray(body?.pairs) ? body.pairs : [];

    if (!roundId || !teamId) {
      return NextResponse.json({ error: 'roundId and teamId are required' }, { status: 400 });
    }

    // Basic validation on pairs
    for (const p of pairs) {
      if (!p?.slot || !p?.player1Id || !p?.player2Id) {
        return NextResponse.json({ error: 'Each pair must have slot, player1Id, and player2Id' }, { status: 400 });
      }
    }

    // Verify round & team, same tournament
    const [round, team] = await Promise.all([
      prisma.round.findUnique({
        where: { id: roundId },
        select: { id: true, stop: { select: { id: true, tournamentId: true } } },
      }),
      prisma.team.findUnique({ where: { id: teamId }, select: { id: true, tournamentId: true } }),
    ]);
    if (!round || !team) {
      return NextResponse.json({ error: 'Round or Team not found' }, { status: 404 });
    }
    const tournamentId = round.stop.tournamentId;
    if (tournamentId !== (team.tournamentId ?? null)) {
      return NextResponse.json({ error: 'Round and Team do not belong to the same tournament' }, { status: 400 });
    }

    // Validate players exist and no duplicates across slots
    const allIds = pairs.flatMap((p) => [p.player1Id, p.player2Id]);
    const dupCheck = new Set<string>();
    for (const id of allIds) {
      if (dupCheck.has(id)) {
        return NextResponse.json({ error: 'A player is used in multiple slots in this lineup' }, { status: 400 });
      }
      dupCheck.add(id);
    }

    if (allIds.length) {
      const found = await prisma.player.findMany({ where: { id: { in: allIds } }, select: { id: true } });
      const foundSet = new Set(found.map((x) => x.id));
      const missing = allIds.filter((id) => !foundSet.has(id));
      if (missing.length) {
        return NextResponse.json({ error: `Unknown player(s): ${missing.join(', ')}` }, { status: 400 });
      }
    }

    // Enforce that all players are on this stop’s roster for this team
    if (allIds.length) {
      const roster = await prisma.stopTeamPlayer.findMany({
        where: { stopId: round.stop.id, teamId },
        select: { playerId: true },
      });
      const rosterSet = new Set(roster.map((r) => r.playerId));
      const notOnRoster = [...new Set(allIds.filter((id) => !rosterSet.has(id)))];
      if (notOnRoster.length) {
        return NextResponse.json(
          { error: `Player(s) not on this stop’s roster for this team: ${notOnRoster.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Write changes transactionally
    const saved = await prisma.$transaction(async (tx) => {
      // Ensure Lineup exists (unique roundId+teamId)
      const lineup = await tx.lineup.upsert({
        where: { roundId_teamId: { roundId, teamId } },
        update: {},
        create: { roundId, teamId, stopId: round.stop.id },
        include: { entries: true },
      });

      const slotsIncoming = new Set(pairs.map((p) => p.slot));

      // Delete entries not present anymore
      if (lineup.entries.length) {
        const toDelete = lineup.entries.filter((e) => !slotsIncoming.has(e.slot)).map((e) => e.id);
        if (toDelete.length) {
          await tx.lineupEntry.deleteMany({ where: { id: { in: toDelete } } });
        }
      }

      // Upsert each slot
      for (const p of pairs) {
        await tx.lineupEntry.upsert({
          where: { lineupId_slot: { lineupId: lineup.id, slot: p.slot } },
          update: { player1Id: p.player1Id, player2Id: p.player2Id },
          create: { lineupId: lineup.id, slot: p.slot, player1Id: p.player1Id, player2Id: p.player2Id },
        });
      }

      // Return fresh lineup
      return tx.lineup.findUnique({
        where: { roundId_teamId: { roundId, teamId } },
        include: {
          entries: {
            orderBy: { slot: 'asc' },
            include: {
              player1: { select: { id: true, firstName: true, lastName: true, name: true, gender: true } },
              player2: { select: { id: true, firstName: true, lastName: true, name: true, gender: true } },
            },
          },
        },
      });
    });

    const resp = saved
      ? {
          id: saved.id,
          roundId: saved.roundId,
          teamId: saved.teamId,
          entries: saved.entries.map((e) => ({
            id: e.id,
            slot: e.slot,
            player1: {
              id: e.player1.id,
              firstName: e.player1.firstName,
              lastName: e.player1.lastName,
              name: label(e.player1),
              gender: e.player1.gender,
            },
            player2: {
              id: e.player2.id,
              firstName: e.player2.firstName,
              lastName: e.player2.lastName,
              name: label(e.player2),
              gender: e.player2.gender,
            },
          })),
        }
      : null;

    return NextResponse.json({ ok: true, lineup: resp });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to save lineup', detail: e?.message ?? '' }, { status: 500 });
  }
}
