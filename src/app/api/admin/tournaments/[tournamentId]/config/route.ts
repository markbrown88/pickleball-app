// src/app/api/admin/tournaments/[tournamentId]/config/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import type { TournamentType } from '@prisma/client';

type Ctx = { params: Promise<{ tournamentId: string }> };

type Payload = {
  name?: string;
  type?: string; // UI label, e.g. "Team Format"
  clubs?: string[]; // participating clubIds
  levels?: Array<{ id?: string; name: string; idx?: number }>;
  captains?: Array<{ clubId: string; levelId: string; playerId: string }>;
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

// Normalize "YYYY-MM-DD" safely to a Date at UTC midnight.
// If a full ISO string is sent, we pass it through (and validate).
function normalizeDateInput(d?: string | null): Date | null {
  if (!d) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0));
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

// Utility: safe equality for nullable date fields
function sameDate(a: Date | null, b: Date | null) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.getTime() === b.getTime();
}

// ---------- GET ----------
/**
 * GET /api/admin/tournaments/:tournamentId/config
 * Response:
 * {
 *   id, name, type,                 // type is a human label
 *   clubs: string[],                // participating clubIds
 *   levels: [{ id, name, idx }],
 *   captains: [{ clubId, levelId, playerId }],
 *   stops: [{ id, name, clubId, startAt, endAt }]
 * }
 */
export async function GET(_req: Request, ctx: Ctx) {
  try {
    const prisma = getPrisma();
    const { tournamentId } = await ctx.params;

    const t = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, name: true, type: true },
    });
    if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Fetch related data explicitly (no reliance on relation field names)
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
        select: { clubId: true, levelId: true, playerId: true },
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
      captains,
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
/**
 * PUT /api/admin/tournaments/:tournamentId/config
 * Body:
 * {
 *   name,                 // string
 *   type,                 // one of the labels mapped above
 *   clubs: string[],      // participating clubIds
 *   levels: [{ id?, name, idx? }],
 *   captains: [{ clubId, levelId, playerId }],
 *   stops: [{ id?, name, clubId?, startAt?, endAt? }]
 * }
 *
 * Rules enforced:
 * - If `type` is not provided, it remains unchanged; if provided and invalid, 400.
 * - Syncs TournamentClub to exactly match provided `clubs` (adds/removes).
 * - Levels are upserted (by id if present, else by (tournamentId, name) uniqueness); missing ones are deleted.
 * - Captains validated so the same playerId is used with at most one clubId within the same tournament.
 * - Stops are created/updated (no deletions here). Also protected against duplicate inserts
 *   by checking for an identical Stop (same tournamentId, name, clubId, startAt, endAt) before creating.
 */
export async function PUT(req: Request, ctx: Ctx) {
  const prisma = getPrisma();
  const { tournamentId } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as Payload;

  try {
    // Ensure tournament exists
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
      const enumVal = TYPE_LABEL_TO_ENUM[body.type.trim()] ?? null;
      if (!enumVal) return NextResponse.json({ error: 'Invalid tournament type' }, { status: 400 });
      updates.type = enumVal;
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(updates).length) {
        await tx.tournament.update({ where: { id: tournamentId }, data: updates });
      }

      // ---- Clubs pivot sync ----
      if (Array.isArray(body.clubs)) {
        const incoming = [...new Set(body.clubs.map(String))];

        // validate clubs exist
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
            // Try find by (tournamentId, name)
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

      // ---- Captains validation + replace-all insert ----
      if (Array.isArray(body.captains)) {
        // A player may captain only one club within this tournament
        const seen = new Map<string, string>(); // playerId -> clubId
        for (const c of body.captains) {
          const playerId = String(c.playerId);
          const clubId = String(c.clubId);
          const prev = seen.get(playerId);
          if (prev && prev !== clubId) {
            throw new Error('A player can captain only one club within a tournament.');
          }
          seen.set(playerId, clubId);
        }

        // If clubs also provided, ensure captains’ clubs are in that set
        if (Array.isArray(body.clubs)) {
          const clubSet = new Set(body.clubs.map(String));
          const bad = body.captains.filter(c => !clubSet.has(String(c.clubId)));
          if (bad.length) throw new Error('Captain assigned to a club that is not in participating clubs.');
        }

        // Validate level IDs belong to this tournament
        const levelIds = [...new Set(body.captains.map(c => String(c.levelId)))];
        if (levelIds.length) {
          const found = await tx.tournamentLevel.findMany({
            where: { id: { in: levelIds }, tournamentId },
            select: { id: true },
          });
          const foundSet = new Set(found.map(x => x.id));
          const missing = levelIds.filter(id => !foundSet.has(id));
          if (missing.length) throw new Error(`Unknown level ids: ${missing.join(', ')}`);
        }

        // Replace-all approach keeps logic simple and deterministic
        await tx.tournamentCaptain.deleteMany({ where: { tournamentId } });
        if (body.captains.length) {
          await tx.tournamentCaptain.createMany({
            data: body.captains.map(c => ({
              tournamentId,
              clubId: String(c.clubId),
              levelId: String(c.levelId),
              playerId: String(c.playerId),
            })),
            skipDuplicates: true,
          });
        }
      }

      // ---- Stops upsert (create/update only; no deletes) ----
      // Also guard against *duplicate creation* when the same stop payload is sent multiple times.
      if (Array.isArray(body.stops)) {
        for (const s of body.stops) {
          const name = (s.name || '').trim();
          if (!name) continue;

          const startAt = normalizeDateInput(s.startAt ?? null);
          const endAt = normalizeDateInput(s.endAt ?? null);
          const clubId = s.clubId ?? null;

          if (s.id) {
            // Ensure the stop belongs to this tournament before updating
            const target = await tx.stop.findUnique({
              where: { id: s.id },
              select: { id: true, tournamentId: true },
            });
            if (!target || target.tournamentId !== tournamentId) {
              throw new Error('Stop not found for this tournament.');
            }
            // Update if anything changed
            await tx.stop.update({
              where: { id: s.id },
              data: {
                name,
                clubId,
                startAt: startAt ?? null,
                endAt: endAt ?? null,
              },
            });
          } else {
            // DE-DUPE: If an identical stop already exists (same name/clubId/startAt/endAt), skip creating a new row.
            const existing = await tx.stop.findFirst({
              where: {
                tournamentId,
                name,
                clubId: clubId,          // null-safe comparison is fine in Prisma
                startAt: startAt ?? null,
                endAt: endAt ?? null,
              },
              select: { id: true },
            });

            if (existing) {
              // nothing to do; we already have this exact stop
              continue;
            }

            // It's legit new — create it.
            await tx.stop.create({
              data: {
                name,
                tournamentId,
                clubId,
                startAt: startAt ?? null,
                endAt: endAt ?? null,
              },
            });
          }
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
