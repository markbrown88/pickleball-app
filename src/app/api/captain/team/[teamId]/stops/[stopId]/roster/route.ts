// src/app/api/captain/team/[teamId]/stops/[stopId]/roster/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

// Next 15: params is a Promise
type Ctx = { params: Promise<{ teamId: string; stopId: string }> };

// ---- small helpers ----
function label(p: { firstName?: string | null; lastName?: string | null; name?: string | null }) {
  const fn = (p.firstName ?? '').trim();
  const ln = (p.lastName ?? '').trim();
  const full = [fn, ln].filter(Boolean).join(' ');
  return full || (p.name ?? 'Unknown');
}
function coerceStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    const s = String(x).trim();
    if (s) out.push(s);
  }
  return Array.from(new Set(out)); // dedupe
}

// -------------------- GET --------------------
export async function GET(_: Request, ctx: Ctx) {
  const prisma = getPrisma();
  const { teamId, stopId } = await ctx.params;

  try {
    // Validate and ensure (stop,team) link
    const [team, stop] = await Promise.all([
      prisma.team.findUnique({ where: { id: teamId }, select: { id: true, tournamentId: true } }),
      prisma.stop.findUnique({ where: { id: stopId }, select: { id: true, tournamentId: true } }),
    ]);
    if (!team || !stop) return NextResponse.json({ error: 'Team or Stop not found' }, { status: 404 });
    if (team.tournamentId !== stop.tournamentId) {
      return NextResponse.json({ error: 'Stop does not belong to the same tournament as Team' }, { status: 400 });
    }

    await prisma.stopTeam.upsert({
      where: { stopId_teamId: { stopId, teamId } },
      create: { stopId, teamId },
      update: {},
    });

    const roster = await prisma.stopTeamPlayer.findMany({
      where: { stopId, teamId },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            gender: true,
            dupr: true,
            age: true,
            birthday: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const items = roster.map((r) => ({
      id: r.player.id,
      firstName: r.player.firstName,
      lastName: r.player.lastName,
      name: r.player.name ?? label(r.player),
      gender: r.player.gender,
      dupr: r.player.dupr ?? null,
      age:
        r.player.age ??
        (r.player.birthday
          ? Math.floor((Date.now() - +new Date(r.player.birthday)) / (365.25 * 24 * 3600 * 1000))
          : null),
    }));

    return NextResponse.json({ items });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to load roster', detail: err?.message ?? '' },
      { status: 500 }
    );
  }
}

// -------------------- PUT --------------------
// Body: { playerIds: string[], limit?: number }
// Replace the roster for THIS (team, stop). We *do not* write TeamPlayer here;
// DB triggers should upsert TeamPlayer on insert, and clean it up when the last StopTeamPlayer is removed.
export async function PUT(req: Request, ctx: Ctx) {
  const prisma = getPrisma();
  const { teamId, stopId } = await ctx.params;

  try {
    const body: unknown = await req.json().catch(() => ({}));
    const playerIds = coerceStringArray((body as any)?.playerIds);
    const rawLimit = (body as any)?.limit;
    const clientLimit: number | null =
      Number.isFinite(Number(rawLimit)) && Number(rawLimit) > 0 ? Number(rawLimit) : null;

    // Validate Team & Stop and match tournamentId
    const [team, stop] = await Promise.all([
      prisma.team.findUnique({
        where: { id: teamId },
        select: { id: true, tournamentId: true, tournament: { select: { id: true, maxTeamSize: true } } },
      }),
      prisma.stop.findUnique({ where: { id: stopId }, select: { id: true, tournamentId: true } }),
    ]);
    if (!team || !stop) return NextResponse.json({ error: 'Team or Stop not found' }, { status: 404 });
    if (team.tournamentId !== stop.tournamentId) {
      return NextResponse.json({ error: 'Stop does not belong to the same tournament as Team' }, { status: 400 });
    }

    const tournamentId = team.tournamentId!;
    const bracketCap = team.tournament?.maxTeamSize ?? null; // null/0 => no cap

    if (clientLimit && playerIds.length > clientLimit) {
      return NextResponse.json(
        { error: `Too many players for this stop. Client limit is ${clientLimit}.` },
        { status: 400 }
      );
    }

    // Ensure all players exist
    if (playerIds.length) {
      const found = await prisma.player.findMany({ where: { id: { in: playerIds } }, select: { id: true } });
      const foundSet = new Set(found.map((f) => f.id));
      const missing = playerIds.filter((id) => !foundSet.has(id));
      if (missing.length) {
        return NextResponse.json({ error: `Unknown player(s): ${missing.join(', ')}` }, { status: 400 });
      }
    }

    // Pre-flight exclusivity check for nicer UX (DB trigger still enforces)
    if (playerIds.length) {
      const conflicts = await prisma.teamPlayer.findMany({
        where: { tournamentId, playerId: { in: playerIds }, teamId: { not: teamId } },
        select: { playerId: true, teamId: true },
      });
      if (conflicts.length) {
        const conflictIds = conflicts.map((c) => c.playerId);
        return NextResponse.json(
          {
            error:
              `Some players are already assigned to a different team in this tournament: ${conflictIds.join(', ')}`,
            conflictPlayerIds: conflictIds,
          },
          { status: 409 }
        );
      }
    }

    // Bracket cap across ALL stops for this team (unique players)
    const allStopPlayers = await prisma.stopTeamPlayer.findMany({
      where: { teamId },
      select: { stopId: true, playerId: true },
    });
    const unique = new Set<string>();
    for (const row of allStopPlayers) {
      if (row.stopId === stopId) continue; // current stop will be replaced
      unique.add(row.playerId);
    }
    for (const pid of playerIds) unique.add(pid);

    if (bracketCap && bracketCap > 0 && unique.size > bracketCap) {
      return NextResponse.json(
        { error: `Bracket limit exceeded: ${unique.size} > ${bracketCap}`, limit: bracketCap, uniqueCount: unique.size },
        { status: 400 }
      );
    }

    // Apply: ensure StopTeam link, replace stop roster. Do NOT touch TeamPlayer here.
    await prisma.$transaction(async (tx) => {
      await tx.stopTeam.upsert({
        where: { stopId_teamId: { stopId, teamId } },
        create: { stopId, teamId },
        update: {},
      });

      await tx.stopTeamPlayer.deleteMany({ where: { stopId, teamId } });

      if (playerIds.length) {
        await tx.stopTeamPlayer.createMany({
          data: playerIds.map((playerId) => ({ stopId, teamId, playerId })),
          skipDuplicates: true,
        });
      }
    });

    // Return updated roster
    const updated = await prisma.stopTeamPlayer.findMany({
      where: { stopId, teamId },
      include: { player: true },
      orderBy: { createdAt: 'asc' },
    });

    const items = updated.map((r) => ({
      id: r.player.id,
      firstName: r.player.firstName,
      lastName: r.player.lastName,
      name: r.player.name ?? label(r.player),
      gender: r.player.gender,
      dupr: r.player.dupr ?? null,
      age:
        r.player.age ??
        (r.player.birthday
          ? Math.floor((Date.now() - +new Date(r.player.birthday)) / (365.25 * 24 * 3600 * 1000))
          : null),
    }));

    return NextResponse.json({
      ok: true,
      items,
      count: items.length,
      uniqueAcrossStops: Array.from(
        new Set(
          items
            .map((p) => p.id)
            .concat(allStopPlayers.filter((x) => x.stopId !== stopId).map((x) => x.playerId))
        )
      ).length,
      cap: bracketCap ?? null,
    });
  } catch (err: any) {
    // Friendly mapping if DB trigger/unique constraint blocked us
    const msg = String(err?.message ?? '');
    const conflictish =
      msg.includes('already rostered') ||
      msg.includes('uq_TeamPlayer_player_tournament') ||
      msg.includes('duplicate key') ||
      msg.includes('P2002');
    const status = conflictish ? 409 : 500;

    return NextResponse.json(
      { error: 'Failed to save roster', detail: msg },
      { status }
    );
  }
}

// -------------------- DELETE --------------------
// Remove a single player from this stop’s roster (query ?playerId= or body { playerId }).
// DB trigger will clean up TeamPlayer automatically if this was the last stop in the tournament.
export async function DELETE(req: Request, ctx: Ctx) {
  const prisma = getPrisma();
  const { teamId, stopId } = await ctx.params;

  try {
    const url = new URL(req.url);
    let playerId = url.searchParams.get('playerId');
    if (!playerId) {
      const body = await req.json().catch(() => ({}));
      playerId = String((body as any)?.playerId ?? '').trim() || null;
    }
    if (!playerId) return NextResponse.json({ error: 'playerId is required' }, { status: 400 });

    await prisma.stopTeamPlayer.deleteMany({ where: { stopId, teamId, playerId } });

    // idempotent
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to remove player from stop', detail: err?.message ?? '' },
      { status: 500 }
    );
  }
}
