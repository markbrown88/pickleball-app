// src/app/api/admin/tournaments/[tournamentId]/config/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import type { TournamentType } from '@prisma/client';

type Ctx = { params: Promise<{ tournamentId: string }> };

type Payload = {
  name?: string;
  type?: string; // UI label OR enum (tolerant)
  clubs?: string[];
  levels?: Array<{ id?: string; name: string; idx?: number }>;
  captains?: Array<{ clubId: string; levelId: string; playerId: string }>;
  /** NEW: single-captain-per-club when Levels are OFF */
  captainsSimple?: Array<{ clubId: string; playerId: string }>;
  stops?: Array<{ id?: string; name: string; clubId?: string | null; startAt?: string | null; endAt?: string | null }>;
};

// ---------- helpers ----------
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

// Accept label or enum, case-insensitive. Returns null if we should “ignore”.
function normalizeTournamentType(input?: string | null): TournamentType | null {
  if (!input) return null;
  const t = input.trim();
  if (!t) return null;

  if (TYPE_LABEL_TO_ENUM[t]) return TYPE_LABEL_TO_ENUM[t];

  const lower = t.toLowerCase();
  for (const [label, en] of Object.entries(TYPE_LABEL_TO_ENUM)) {
    if (label.toLowerCase() === lower) return en;
  }

  const maybeEnum = t.toUpperCase().replace(/\s+/g, '_') as TournamentType;
  const enumSet = new Set<TournamentType>(Object.values(TYPE_LABEL_TO_ENUM));
  if (enumSet.has(maybeEnum)) return maybeEnum;

  return null;
}

// Normalize "YYYY-MM-DD" to Date (UTC midnight) or pass through ISO.
function normalizeDateInput(d?: string | null): Date | null {
  if (!d) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0));
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

// Build a nice player label
function playerLabel(p?: { firstName?: string | null; lastName?: string | null; name?: string | null }) {
  const fn = (p?.firstName ?? '').trim();
  const ln = (p?.lastName ?? '').trim();
  return [fn, ln].filter(Boolean).join(' ') || (p?.name ?? 'Unknown');
}

const DEFAULT_LEVEL_NAME = 'Default';

// ---------- GET ----------
export async function GET(_req: Request, ctx: Ctx) {
  try {
    const prisma = getPrisma();
    const { tournamentId } = await ctx.params;

    const t = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, name: true, type: true },
    });
    if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const [clubLinks, levels, captains, stops] = await Promise.all([
      prisma.tournamentClub.findMany({
        where: { tournamentId },
        select: { clubId: true },
      }),
      prisma.tournamentLevel.findMany({
        where: { tournamentId },
        select: { id: true, name: true, idx: true },
        orderBy: { idx: 'asc' },
      }),
      prisma.tournamentCaptain.findMany({
        where: { tournamentId },
        select: {
          clubId: true,
          levelId: true,
          playerId: true,
          player: { select: { firstName: true, lastName: true, name: true } },
        },
      }),
      prisma.stop.findMany({
        where: { tournamentId },
        select: { id: true, name: true, clubId: true, startAt: true, endAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return NextResponse.json({
      id: t.id,
      name: t.name,
      type: ENUM_TO_TYPE_LABEL[t.type] ?? 'Team Format',
      clubs: clubLinks.map(c => c.clubId),
      levels,
      captains: captains.map(c => ({
        clubId: c.clubId,
        levelId: c.levelId,
        playerId: c.playerId,
        playerName: playerLabel(c.player),
      })),
      stops: stops.map(s => ({
        id: s.id,
        name: s.name,
        clubId: s.clubId ?? null,
        startAt: s.startAt ? s.startAt.toISOString() : null,
        endAt: s.endAt ? s.endAt.toISOString() : null,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// ---------- PUT ----------
export async function PUT(req: Request, ctx: Ctx) {
  const prisma = getPrisma();
  const { tournamentId } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as Payload;

  try {
    const exists = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true },
    });
    if (!exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updates: Partial<{ name: string; type: TournamentType }> = {};

    if (typeof body.name === 'string') {
      const trimmed = body.name.trim();
      if (!trimmed) return NextResponse.json({ error: 'Tournament name is required' }, { status: 400 });
      updates.name = trimmed;
    }

    if (typeof body.type === 'string') {
      const enumVal = normalizeTournamentType(body.type);
      if (enumVal) updates.type = enumVal; // ignore if unrecognized
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(updates).length) {
        await tx.tournament.update({ where: { id: tournamentId }, data: updates });
      }

      // ---- Clubs pivot sync ----
      if (Array.isArray(body.clubs)) {
        const incoming = [...new Set(body.clubs.map(String))];

        if (incoming.length) {
          const found = await tx.club.findMany({ where: { id: { in: incoming } }, select: { id: true } });
          const foundIds = new Set(found.map(c => c.id));
          const missing = incoming.filter(id => !foundIds.has(id));
          if (missing.length) throw new Error(`Unknown club ids: ${missing.join(', ')}`);
        }

        const current = await tx.tournamentClub.findMany({
          where: { tournamentId },
          select: { clubId: true },
        });
        const currentSet = new Set(current.map(x => x.clubId));

        const toAdd = incoming.filter(id => !currentSet.has(id));
        const toRemove = [...currentSet].filter(id => !incoming.includes(id));

        if (toAdd.length) {
          await tx.tournamentClub.createMany({
            data: toAdd.map(clubId => ({ tournamentId, clubId })),
            skipDuplicates: true,
          });
        }
        if (toRemove.length) {
          await tx.tournamentClub.deleteMany({
            where: { tournamentId, clubId: { in: toRemove } },
          });
        }
      }

      // ---- Levels sync (upsert + delete missing) ----
      if (Array.isArray(body.levels)) {
        const incoming = body.levels
          .map(l => ({
            id: l.id?.trim() || undefined,
            name: (l.name || '').trim(),
            idx: Number.isFinite(l.idx) ? Number(l.idx) : undefined,
          }))
          .filter(l => !!l.name);

        const current = await tx.tournamentLevel.findMany({
          where: { tournamentId },
          select: { id: true, name: true },
        });
        const currentById = new Map(current.map(l => [l.id, l]));
        const keepIds = new Set<string>();

        for (let i = 0; i < incoming.length; i++) {
          const l = incoming[i];
          const idx = l.idx ?? i;

          if (l.id && currentById.has(l.id)) {
            await tx.tournamentLevel.update({
              where: { id: l.id },
              data: { name: l.name, idx },
            });
            keepIds.add(l.id);
          } else {
            const ex = await tx.tournamentLevel.findFirst({
              where: { tournamentId, name: l.name },
              select: { id: true },
            });
            if (ex) {
              await tx.tournamentLevel.update({ where: { id: ex.id }, data: { idx } });
              keepIds.add(ex.id);
            } else {
              const created = await tx.tournamentLevel.create({
                data: { tournamentId, name: l.name, idx },
                select: { id: true },
              });
              keepIds.add(created.id);
            }
          }
        }

        const toDelete = current.filter(c => !keepIds.has(c.id)).map(c => c.id);
        if (toDelete.length) {
          await tx.tournamentLevel.deleteMany({ where: { id: { in: toDelete } } });
        }
      }

      // ---- Captains: two modes ----
      const hasMultiLevelCaptains = Array.isArray(body.captains) && body.captains.length > 0;
      const hasSimpleCaptains = Array.isArray(body.captainsSimple) && body.captainsSimple.length > 0;

      // Replace-all strategy either way
      if (hasMultiLevelCaptains || hasSimpleCaptains) {
        await tx.tournamentCaptain.deleteMany({ where: { tournamentId } });
      }

      if (hasMultiLevelCaptains) {
        // Multi-level mode (existing behavior)
        const seen = new Map<string, string>(); // playerId -> clubId
        for (const c of body.captains!) {
          const playerId = String(c.playerId);
          const clubId = String(c.clubId);
          const prev = seen.get(playerId);
          if (prev && prev !== clubId) {
            throw new Error('A player can captain only one club within a tournament.');
          }
          seen.set(playerId, clubId);
        }

        // Ensure level IDs belong to this tournament
        const levelIds = [...new Set(body.captains!.map(c => String(c.levelId)))];
        if (levelIds.length) {
          const found = await tx.tournamentLevel.findMany({
            where: { id: { in: levelIds }, tournamentId },
            select: { id: true },
          });
          const foundSet = new Set(found.map(x => x.id));
          const missing = levelIds.filter(id => !foundSet.has(id));
          if (missing.length) throw new Error(`Unknown level ids: ${missing.join(', ')}`);
        }

        if (body.captains!.length) {
          await tx.tournamentCaptain.createMany({
            data: body.captains!.map(c => ({
              tournamentId,
              clubId: String(c.clubId),
              levelId: String(c.levelId),
              playerId: String(c.playerId),
            })),
            skipDuplicates: true,
          });
        }
      } else if (hasSimpleCaptains) {
        // Single-captain-per-club mode (Levels OFF)
        // Ensure there is a single default level for this tournament
        let defaultLevel = await tx.tournamentLevel.findFirst({
          where: { tournamentId, name: DEFAULT_LEVEL_NAME },
          select: { id: true },
        });
        if (!defaultLevel) {
          defaultLevel = await tx.tournamentLevel.create({
            data: { tournamentId, name: DEFAULT_LEVEL_NAME, idx: 0 },
            select: { id: true },
          });
        }

        // Validate clubs exist (if clubs payload is present, ensure captain clubs are part of it)
        if (Array.isArray(body.clubs) && body.clubs.length) {
          const clubSet = new Set(body.clubs.map(String));
          const bad = body.captainsSimple!.filter(c => !clubSet.has(String(c.clubId)));
          if (bad.length) throw new Error('Captain assigned to a club that is not in participating clubs.');
        }

        // Enforce unique player per tournament
        const seen = new Set<string>();
        for (const c of body.captainsSimple!) {
          const playerId = String(c.playerId);
          if (seen.has(playerId)) throw new Error('A player can captain only one club within a tournament.');
          seen.add(playerId);
        }

        await tx.tournamentCaptain.createMany({
          data: body.captainsSimple!.map(c => ({
            tournamentId,
            clubId: String(c.clubId),
            levelId: defaultLevel!.id,
            playerId: String(c.playerId),
          })),
          skipDuplicates: true,
        });
      }

      // ---- Stops: tolerant upsert + delete-by-diff ----
      if (Array.isArray(body.stops)) {
        const existingStops = await tx.stop.findMany({
          where: { tournamentId },
          select: { id: true, name: true, clubId: true, startAt: true, endAt: true },
        });
        const existingById = new Map(existingStops.map(s => [s.id, s]));
        const keepIds: string[] = [];

        for (const s of body.stops) {
          const name = (s.name || '').trim();
          if (!name) continue;

          const startAt = normalizeDateInput(s.startAt ?? null);
          const endAt = normalizeDateInput(s.endAt ?? null);
          const clubId = s.clubId ?? null;

          if (s.id && existingById.has(s.id)) {
            await tx.stop.update({
              where: { id: s.id },
              data: { name, clubId, startAt: startAt ?? null, endAt: endAt ?? null },
            });
            keepIds.push(s.id);
            continue;
          }

          // Avoid duplicates by (name, clubId, startAt, endAt)
          const duplicate = existingStops.find(
            ex =>
              ex.name === name &&
              ex.clubId === clubId &&
              ((ex.startAt && startAt && ex.startAt.getTime() === startAt.getTime()) || (!ex.startAt && !startAt)) &&
              ((ex.endAt && endAt && ex.endAt.getTime() === endAt.getTime()) || (!ex.endAt && !endAt))
          );
          if (duplicate) {
            keepIds.push(duplicate.id);
            continue;
          }

          const created = await tx.stop.create({
            data: { tournamentId, name, clubId, startAt: startAt ?? null, endAt: endAt ?? null },
            select: { id: true },
          });
          keepIds.push(created.id);
        }

        // Delete stops that weren't kept
        const toDelete = existingStops.map(s => s.id).filter(id => !keepIds.includes(id));
        if (toDelete.length) {
          await tx.stop.deleteMany({ where: { id: { in: toDelete } } });
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
