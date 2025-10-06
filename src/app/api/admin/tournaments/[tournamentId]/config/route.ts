export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { TournamentType } from '@prisma/client';
import { generateCaptainToken } from '@/lib/captainToken';

type CtxPromise = { params: Promise<{ tournamentId: string }> };

type Payload = {
  name?: string;
  type?: string; // label or enum
  clubs?: string[];
  levels?: Array<{ id?: string; name: string; idx?: number }>;
  captainsSimple?: Array<{ clubId: string; playerId: string }>;
  hasCaptains?: boolean;
  stops?: Array<{
    id?: string;
    name: string;
    clubId?: string | null;
    startAt?: string | null;
    endAt?: string | null;
    eventManagerId?: string | null; // ✅ per-stop only
  }>;
  maxTeamSize?: number | null;
};

const TYPE_LABEL_TO_ENUM: Record<string, TournamentType> = {
  'Team Format': 'TEAM_FORMAT',
  'Single Elimination': 'SINGLE_ELIMINATION',
  'Double Elimination': 'DOUBLE_ELIMINATION',
  'Round Robin': 'ROUND_ROBIN',
  'Pool Play': 'POOL_PLAY',
  'Ladder Tournament': 'LADDER_TOURNAMENT',
};

const ENUM_TO_TYPE_LABEL: Record<TournamentType, string> = {
  TEAM_FORMAT: 'Team Format',
  SINGLE_ELIMINATION: 'Single Elimination',
  DOUBLE_ELIMINATION: 'Double Elimination',
  ROUND_ROBIN: 'Round Robin',
  POOL_PLAY: 'Pool Play',
  LADDER_TOURNAMENT: 'Ladder Tournament',
};

function normalizeTournamentType(input?: string | null): TournamentType | null {
  if (!input) return null;
  const label = TYPE_LABEL_TO_ENUM[input];
  if (label) return label;
  const canon = input.toUpperCase().replace(/\s+/g, '_') as TournamentType;
  return (Object.values(TYPE_LABEL_TO_ENUM) as TournamentType[]).includes(canon) ? canon : null;
}

function normalizeDateInput(d?: string | null): Date | null {
  if (!d) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 0, 0, 0));
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

function playerLabel(p?: { firstName?: string | null; lastName?: string | null; name?: string | null }) {
  const fn = (p?.firstName ?? '').trim();
  const ln = (p?.lastName ?? '').trim();
  return [fn, ln].filter(Boolean).join(' ') || (p?.name ?? 'Unknown');
}

// ---------- GET ----------
export async function GET(_req: Request, ctx: CtxPromise) {
  // Use singleton prisma instance
  const { tournamentId } = await ctx.params;

  const t = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, name: true, type: true, maxTeamSize: true },
  });

  if (!t) {
    const also = await prisma.tournament.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, name: true },
    });
    return NextResponse.json(
      {
        error: 'Not found',
        requestedId: tournamentId,
        available: also.map(a => ({ id: a.id, name: a.name })),
      },
      { status: 404 }
    );
  }

  const [clubLinks, brackets, stops, teams] = await Promise.all([
    prisma.tournamentClub.findMany({
      where: { tournamentId },
      include: {
        club: {
          select: {
            id: true,
            name: true,
            city: true,
            region: true,
          },
        },
      },
    }),
    prisma.tournamentBracket.findMany({
      where: { tournamentId },
      orderBy: { idx: 'asc' },
      select: { id: true, name: true, idx: true },
    }),
    prisma.stop.findMany({
      where: { tournamentId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, name: true, clubId: true, startAt: true, endAt: true,
        eventManagerId: true,
        eventManager: { select: { id: true, firstName: true, lastName: true, name: true } },
      },
    }),
    prisma.team.findMany({
      where: { tournamentId },
      select: {
        id: true,
        clubId: true,
        captainId: true,
        captain: { select: { firstName: true, lastName: true, name: true } },
      },
    }),
  ]);

  // First captain per club (legacy derivation)
  const byClubCaptain: Array<{ clubId: string; playerId: string; playerName: string }> = [];
  const seenClub = new Set<string>();
  for (const tm of teams) {
    if (!tm.clubId || !tm.captainId) continue;
    if (seenClub.has(tm.clubId)) continue;
    seenClub.add(tm.clubId);
    byClubCaptain.push({
      clubId: tm.clubId,
      playerId: tm.captainId,
      playerName: playerLabel(tm.captain ?? undefined),
    });
  }

  // Hide implicit DEFAULT from UI so the Brackets toggle doesn't auto-check.
  const visibleBrackets = brackets.filter((b) => b.name.toUpperCase() !== 'DEFAULT');

  return NextResponse.json({
    id: t.id,
    name: t.name,
    type: ENUM_TO_TYPE_LABEL[t.type] ?? 'Team Format',
    maxTeamSize: t.maxTeamSize ?? null,
    hasCaptains: byClubCaptain.length > 0,
    clubs: clubLinks.map((c) => ({
      clubId: c.clubId,
      club: c.club
        ? {
            id: c.club.id,
            name: c.club.name,
            city: c.club.city,
            region: c.club.region,
          }
        : null,
    })),
    levels: visibleBrackets.map((b) => ({ id: b.id, name: b.name, idx: b.idx })),
    captains: [],
    captainsSimple: byClubCaptain.map((c) => ({
      clubId: c.clubId,
      playerId: c.playerId,
      playerName: c.playerName,
    })),
    // ✅ Per-stop managers only
    stops: stops.map((s) => ({
      id: s.id,
      name: s.name,
      clubId: s.clubId ?? null,
      startAt: s.startAt ? s.startAt.toISOString() : null,
      endAt: s.endAt ? s.endAt.toISOString() : null,
      eventManager: s.eventManagerId
        ? { id: s.eventManagerId, name: playerLabel(s.eventManager ?? undefined) }
        : null,
    })),
  });
}

// ---------- PUT ----------
export async function PUT(req: Request, ctx: CtxPromise) {
  // Use singleton prisma instance
  const { tournamentId } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as Payload;

  const exists = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, createdAt: true },
  });
  if (!exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updates: Partial<{ name: string; type: TournamentType; maxTeamSize: number | null }> = {};

  if (typeof body.name === 'string') {
    const nm = body.name.trim();
    if (!nm) return NextResponse.json({ error: 'Tournament name is required' }, { status: 400 });
    updates.name = nm;
  }

  if (typeof body.type === 'string') {
    const enumVal = normalizeTournamentType(body.type);
    if (enumVal) updates.type = enumVal;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'maxTeamSize')) {
    const v = (body as any).maxTeamSize;
    if (v === null || v === undefined || v === '') {
      updates.maxTeamSize = null;
    } else if (typeof v === 'number' && Number.isInteger(v) && v > 0) {
      updates.maxTeamSize = v;
    } else {
      return NextResponse.json(
        { error: 'maxTeamSize must be a positive integer or null' },
        { status: 400 }
      );
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
    if (Object.keys(updates).length) {
      await tx.tournament.update({ where: { id: tournamentId }, data: updates });
    }

    // Clubs replace-all
    if (Array.isArray(body.clubs)) {
      const incoming = [...new Set(body.clubs.map(String))];

      if (incoming.length) {
        const found = await tx.club.findMany({ where: { id: { in: incoming } }, select: { id: true } });
        const foundIds = new Set(found.map((c) => c.id));
        const missing = incoming.filter((id) => !foundIds.has(id));
        if (missing.length) throw new Error(`Unknown club ids: ${missing.join(', ')}`);
      }

      const current = await tx.tournamentClub.findMany({
        where: { tournamentId },
        select: { clubId: true },
      });
      const currentSet = new Set(current.map((x) => x.clubId));

      const toAdd = incoming.filter((id) => !currentSet.has(id));
      const toRemove = [...currentSet].filter((id) => !incoming.includes(id));

      if (toAdd.length) {
        // Generate unique tokens for each new club
        for (const clubId of toAdd) {
          let token = generateCaptainToken();
          // Ensure token is unique
          let existing = await tx.tournamentClub.findUnique({
            where: { captainAccessToken: token }
          });
          while (existing) {
            token = generateCaptainToken();
            existing = await tx.tournamentClub.findUnique({
              where: { captainAccessToken: token }
            });
          }

          await tx.tournamentClub.create({
            data: {
              tournamentId,
              clubId,
              captainAccessToken: token
            }
          });
        }
      }
      if (toRemove.length) {
        await tx.tournamentClub.deleteMany({
          where: { tournamentId, clubId: { in: toRemove } },
        });
        await tx.tournamentCaptain.deleteMany({
          where: { tournamentId, clubId: { in: toRemove } },
        });
      }
    }

    // Brackets upsert/reorder/delete (keeps implicit DEFAULT hidden if no real levels)
    let bracketsAfter = await tx.tournamentBracket.findMany({
      where: { tournamentId },
      orderBy: { idx: 'asc' },
      select: { id: true, name: true, idx: true },
    });

    if (Array.isArray(body.levels)) {
      const incoming = body.levels
        .map((l, i) => ({
          id: (l.id || '').trim() || undefined,
          name: (l.name || '').trim(),
          idx: Number.isFinite(l.idx) ? Number(l.idx) : i,
        }))
        .filter((l) => !!l.name);

      const current = bracketsAfter;
      const byId = new Map(current.map((b) => [b.id, b]));
      const byName = new Map(current.map((b) => [b.name.trim(), b]));
      const keepIds: string[] = [];
      const PROV = 1000;

      // Check for duplicate names in incoming data
      const incomingNames = new Set<string>();
      for (const item of incoming) {
        if (incomingNames.has(item.name)) {
          throw new Error(`Duplicate bracket name: "${item.name}". Each bracket must have a unique name.`);
        }
        incomingNames.add(item.name);
      }

      for (let pos = 0; pos < incoming.length; pos++) {
        const item = incoming[pos];
        const provisionalIdx = PROV + pos;

        if (item.id && byId.has(item.id)) {
          const upd = await tx.tournamentBracket.update({
            where: { id: item.id },
            data: { name: item.name, idx: provisionalIdx },
            select: { id: true },
          });
          keepIds.push(upd.id);
        } else if (byName.has(item.name)) {
          const found = byName.get(item.name)!;
          const upd = await tx.tournamentBracket.update({
            where: { id: found.id },
            data: { idx: provisionalIdx, name: item.name },
            select: { id: true },
          });
          keepIds.push(upd.id);
        } else {
          const created = await tx.tournamentBracket.create({
            data: { tournamentId, name: item.name, idx: provisionalIdx },
            select: { id: true },
          });
          keepIds.push(created.id);
        }
      }

      const toDelete = current.map((c) => c.id).filter((id) => !keepIds.includes(id));
      if (toDelete.length) {
        await tx.tournamentBracket.deleteMany({ where: { id: { in: toDelete } } });
      }

      const after = await tx.tournamentBracket.findMany({
        where: { tournamentId },
        orderBy: { idx: 'asc' },
        select: { id: true },
      });
      for (let i = 0; i < after.length; i++) {
        await tx.tournamentBracket.update({ where: { id: after[i].id }, data: { idx: i } });
      }

      bracketsAfter = await tx.tournamentBracket.findMany({
        where: { tournamentId },
        orderBy: { idx: 'asc' },
        select: { id: true, name: true, idx: true },
      });
    }

    if (bracketsAfter.length === 0) {
      const def = await tx.tournamentBracket.upsert({
        where: { tournamentId_name: { tournamentId, name: 'DEFAULT' } },
        update: {},
        create: { tournamentId, name: 'DEFAULT', idx: 0 },
      });
      bracketsAfter = [def];
    }
    const firstBracket = bracketsAfter[0] ?? null;
    const firstBracketId = firstBracket?.id ?? null;
    const firstBracketName = firstBracket?.name ?? null;

    // Stops upsert/delete (+ per-stop event manager)
    if (Array.isArray(body.stops)) {
      const existingStops = await tx.stop.findMany({
        where: { tournamentId },
        select: { id: true, name: true, clubId: true, startAt: true, endAt: true },
      });
      const existingById = new Map(existingStops.map((s) => [s.id, s]));
      const keepIds: string[] = [];

      // Validate stop-level manager ids (if provided)
      const stopMgrIds = Array.from(
        new Set(
          body.stops
            .map(s => s?.eventManagerId)
            .filter(Boolean)
            .map(String)
        )
      );
      if (stopMgrIds.length) {
        const found = await tx.player.findMany({ where: { id: { in: stopMgrIds } }, select: { id: true } });
        const foundSet = new Set(found.map((x) => x.id));
        const missing = stopMgrIds.filter((id) => !foundSet.has(id));
        if (missing.length) throw new Error(`Unknown player ids for stop event managers: ${missing.join(', ')}`);
      }

      for (const s of body.stops) {
        const name = (s.name || '').trim();
        if (!name) continue;

        const startAt = normalizeDateInput(s.startAt ?? null) ?? (exists.createdAt ?? new Date());
        const endAt = normalizeDateInput(s.endAt ?? null) ?? startAt;
        const clubId = s.clubId ?? null;
        const eventManagerId = (s.eventManagerId ?? null) || null;

        if (s.id && existingById.has(s.id)) {
          await tx.stop.update({
            where: { id: s.id },
            data: { name, clubId, startAt, endAt, eventManagerId },
          });
          keepIds.push(s.id);
          continue;
        }

        const duplicate = existingStops.find(
          (ex) =>
            ex.name === name &&
            ex.clubId === clubId &&
            ((ex.startAt && startAt && ex.startAt.getTime() === startAt.getTime()) ||
              (!ex.startAt && !startAt)) &&
            ((ex.endAt && endAt && ex.endAt.getTime() === endAt.getTime()) || (!ex.endAt && !endAt))
        );
        if (duplicate) {
          // await tx.stop.update({ where: { id: duplicate.id }, data: { eventManagerId } }); // temporarily disabled
          keepIds.push(duplicate.id);
          continue;
        }

        const created = await tx.stop.create({
          data: { tournamentId, name, clubId, startAt, endAt, eventManagerId },
          select: { id: true },
        });
        keepIds.push(created.id);
      }

      const toDelete = existingStops.map((s) => s.id).filter((id) => !keepIds.includes(id));
      if (toDelete.length) {
        await tx.stop.deleteMany({ where: { id: { in: toDelete } } });
      }
    }

    // Primary team per club + captain governance (NO roster ops)
    const captainByClub = new Map<string, string>();
    const playerUsage = new Map<string, string>();
    const incomingCaptains = Array.isArray(body.captainsSimple) ? body.captainsSimple : [];
    const hasCaptainsFlag = body.hasCaptains ?? incomingCaptains.length > 0;

    if (hasCaptainsFlag) {
      const seen = new Set<string>();
      const clubIds: string[] = [];
      const playerIds: string[] = [];
      for (const c of incomingCaptains) {
        const clubId = String(c.clubId);
        const playerId = String(c.playerId);
        if (seen.has(clubId)) throw new Error('Only one captain per club is allowed.');
        seen.add(clubId);
        if (playerUsage.has(playerId) && playerUsage.get(playerId) !== clubId) {
          throw new Error('A player can only captain one club per tournament.');
        }
        playerUsage.set(playerId, clubId);
        captainByClub.set(clubId, playerId);
        clubIds.push(clubId);
        playerIds.push(playerId);
      }
      if (clubIds.length) {
        const found = await tx.club.findMany({ where: { id: { in: clubIds } }, select: { id: true } });
        const foundSet = new Set(found.map((x) => x.id));
        const missing = clubIds.filter((id) => !foundSet.has(id));
        if (missing.length) throw new Error(`Unknown club ids: ${missing.join(', ')}`);
      }
      if (playerIds.length) {
        const found = await tx.player.findMany({ where: { id: { in: playerIds } }, select: { id: true } });
        const foundSet = new Set(found.map((x) => x.id));
        const missing = playerIds.filter((id) => !foundSet.has(id));
        if (missing.length) throw new Error(`Unknown player ids: ${missing.join(', ')}`);
      }
    }

    await tx.tournamentCaptain.deleteMany({ where: { tournamentId } });

    const tcLinks = await tx.tournamentClub.findMany({
      where: { tournamentId },
      include: { club: true },
    });

    const primaryTeamByClub = new Map<string, string>();

    for (const tc of tcLinks) {
      const clubId = tc.clubId;
      const clubName = tc.club?.name ?? 'Team';

      const existingTeams = await tx.team.findMany({
        where: { tournamentId, clubId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, bracketId: true, captainId: true, name: true },
      });

      let primary = existingTeams[0];

      if (!primary) {
        let label = clubName;
        if (firstBracketName && firstBracketName !== 'DEFAULT') {
          label = `${clubName} ${firstBracketName}`;
        }
        primary = await tx.team.create({
          data: {
            name: label,
            tournamentId,
            clubId,
            bracketId: firstBracketId,
          },
          select: { id: true, bracketId: true, captainId: true, name: true },
        });
      } else if (firstBracketId && primary.bracketId !== firstBracketId) {
        await tx.team.update({
          where: { id: primary.id },
          data: { bracketId: firstBracketId },
        });
      }

      primaryTeamByClub.set(clubId, primary.id);

      if (hasCaptainsFlag) {
        const captainId = captainByClub.get(clubId) ?? null;
        if (captainId) {
          await tx.tournamentCaptain.create({
            data: { tournamentId, clubId, playerId: captainId },
          });

          if (primary.captainId !== captainId) {
            await tx.team.updateMany({
              where: {
                tournamentId,
                captainId,
                NOT: { id: primary.id },
              },
              data: { captainId: null },
            });
            await tx.team.update({ where: { id: primary.id }, data: { captainId } });
          }
        } else if (primary.captainId) {
          await tx.team.update({ where: { id: primary.id }, data: { captainId: null } });
        }
      } else if (primary.captainId) {
        await tx.team.update({ where: { id: primary.id }, data: { captainId: null } });
      }
    }

    // Ensure StopTeam links for all primary teams across stops (handy; safe)
    const stopsAfter = await tx.stop.findMany({
      where: { tournamentId },
      select: { id: true },
    });

    if (stopsAfter.length && primaryTeamByClub.size) {
      const pairs: Array<{ stopId: string; teamId: string }> = [];
      const primaryTeamIds = Array.from(primaryTeamByClub.values());
      for (const st of stopsAfter) {
        for (const teamId of primaryTeamIds) {
          pairs.push({ stopId: st.id, teamId });
        }
      }
      await tx.stopTeam.createMany({
        data: pairs,
        skipDuplicates: true,
      });
    }
    });
  } catch (error) {
    console.error('Error updating tournament config:', error);
    const message = error instanceof Error ? error.message : 'Failed to update tournament configuration';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
