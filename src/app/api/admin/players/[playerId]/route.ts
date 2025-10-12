// src/app/api/admin/players/[playerId]/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

function computeAge(y?: number | null, m?: number | null, d?: number | null): number | null {
  if (!y || !m || !d) return null;
  try {
    const today = new Date();
    let age = today.getFullYear() - y;
    const mm = m - 1;
    if (today.getMonth() < mm || (today.getMonth() === mm && today.getDate() < d)) age -= 1;
    return age;
  } catch {
    return null;
  }
}

function normalizePhone(input?: string | null): { ok: boolean; formatted?: string; error?: string } {
  if (!input) return { ok: true, formatted: undefined };
  const digits = String(input).replace(/\D/g, '');
  let n = digits;
  if (n.length === 11 && n.startsWith('1')) n = n.slice(1);
  if (n.length !== 10) return { ok: false, error: 'Phone must have 10 digits (US/CA)' };
  return { ok: true, formatted: `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}` };
}

function validEmail(input?: string | null): boolean {
  if (!input) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
}

function parseBirthdayStr(s?: string | null): { y: number | null; m: number | null; d: number | null } {
  if (!s) return { y: null, m: null, d: null };
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match) return { y: null, m: null, d: null };
  const y = Number(match[1]);
  const mo = Number(match[2]);
  const da = Number(match[3]);
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || da < 1 || da > 31) return { y: null, m: null, d: null };
  return { y, m: mo, d: da };
}

const squeeze = (s: string) => s.replace(/\s+/g, ' ').trim();

type Ctx = { params: Promise<{ playerId: string }> };

/** PUT /api/admin/players/:playerId */
export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check for act-as-player-id cookie
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const actAsPlayerId = cookieStore.get('act-as-player-id')?.value;

    let currentPlayer;
    if (actAsPlayerId) {
      // Acting as another player - fetch that player's record
      currentPlayer = await prisma.player.findUnique({
        where: { id: actAsPlayerId },
        select: {
          id: true,
          isAppAdmin: true,
          clubId: true,
          tournamentAdminLinks: { select: { tournamentId: true }, take: 1 },
          TournamentEventManager: { select: { tournamentId: true }, take: 1 }
        }
      });
    } else {
      // Normal operation - use authenticated user
      currentPlayer = await prisma.player.findUnique({
        where: { clerkUserId: userId },
        select: {
          id: true,
          isAppAdmin: true,
          clubId: true,
          tournamentAdminLinks: { select: { tournamentId: true }, take: 1 },
          TournamentEventManager: { select: { tournamentId: true }, take: 1 }
        }
      });
    }

    if (!currentPlayer) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const isTournamentAdmin =
      currentPlayer.tournamentAdminLinks.length > 0 ||
      currentPlayer.TournamentEventManager.length > 0;

    if (!currentPlayer.isAppAdmin && !isTournamentAdmin) {
      return NextResponse.json({ error: 'Access denied. Admin access required.' }, { status: 403 });
    }

    const { playerId } = await ctx.params;
    if (!playerId) return NextResponse.json({ error: 'playerId required' }, { status: 400 });

    // Check if player being edited belongs to the admin's club (for Tournament Admins)
    const playerToEdit = await prisma.player.findUnique({
      where: { id: playerId },
      select: { clubId: true }
    });

    if (!playerToEdit) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    if (!currentPlayer.isAppAdmin && isTournamentAdmin && playerToEdit.clubId !== currentPlayer.clubId) {
      return NextResponse.json({ error: 'Access denied. You can only edit players from your club.' }, { status: 403 });
    }

    const body = await req.json();

    const firstName = squeeze(String(body.firstName || ''));
    const lastName = squeeze(String(body.lastName || ''));
    const gender = body.gender === 'FEMALE' ? 'FEMALE' : 'MALE';
    let clubId = String(body.clubId || '').trim();

    // Tournament Admins cannot change the clubId - it must stay their club
    if (!currentPlayer.isAppAdmin && isTournamentAdmin) {
      clubId = currentPlayer.clubId;
    }

    if (!firstName || !lastName || !clubId) {
      return NextResponse.json({ error: 'firstName, lastName, and clubId are required' }, { status: 400 });
    }

    // Parse birthday from "YYYY-MM-DD" (preferred by your UI)
    let { y, m, d } = parseBirthdayStr(body.birthday);
    // Legacy compatibility if UI ever sends discrete fields
    if (!y && (body.birthdayYear || body.birthdayMonth || body.birthdayDay)) {
      const by = body.birthdayYear ? Number(body.birthdayYear) : null;
      const bm = body.birthdayMonth ? Number(body.birthdayMonth) : null;
      const bd = body.birthdayDay ? Number(body.birthdayDay) : null;
      if (by && bm && bd) {
        y = by;
        m = bm;
        d = bd;
      }
    }

    // Email + phone validation/format
    const email: string | null = body.email ? squeeze(String(body.email)) : null;
    if (!validEmail(email ?? undefined)) return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });

    const phoneRaw: string | null = body.phone ? String(body.phone).trim() : null;
    const phoneCheck = normalizePhone(phoneRaw);
    if (!phoneCheck.ok) return NextResponse.json({ error: phoneCheck.error }, { status: 400 });
    const phone = phoneCheck.formatted ?? null;

    const city = body.city ? squeeze(String(body.city)) : null;
    const region = body.region ? squeeze(String(body.region)) : null;
    const country = body.country ? squeeze(String(body.country)) : 'Canada';
    const fullName = squeeze(`${firstName} ${lastName}`);

    // Ensure club exists
    const club = await prisma.club.findUnique({ where: { id: clubId }, select: { id: true } });
    if (!club) return NextResponse.json({ error: 'club not found' }, { status: 404 });

    const updated = await prisma.player.update({
      where: { id: playerId },
      data: {
        firstName,
        lastName,
        gender,
        clubId,
        name: fullName,
        city,
        region,
        country,
        phone,
        email,
        dupr: typeof body.dupr === 'number' && Number.isFinite(body.dupr) ? body.dupr : null,
        birthdayYear: y,
        birthdayMonth: m,
        birthdayDay: d,
      },
      include: { club: true },
    });

    const withAge = { ...updated, age: computeAge(y, m, d) };
    return NextResponse.json(withAge);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** DELETE /api/admin/players/:playerId */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check for act-as-player-id cookie
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const actAsPlayerId = cookieStore.get('act-as-player-id')?.value;

    let currentPlayer;
    if (actAsPlayerId) {
      // Acting as another player - fetch that player's record
      currentPlayer = await prisma.player.findUnique({
        where: { id: actAsPlayerId },
        select: {
          id: true,
          isAppAdmin: true,
          clubId: true,
          tournamentAdminLinks: { select: { tournamentId: true }, take: 1 },
          TournamentEventManager: { select: { tournamentId: true }, take: 1 }
        }
      });
    } else {
      // Normal operation - use authenticated user
      currentPlayer = await prisma.player.findUnique({
        where: { clerkUserId: userId },
        select: {
          id: true,
          isAppAdmin: true,
          clubId: true,
          tournamentAdminLinks: { select: { tournamentId: true }, take: 1 },
          TournamentEventManager: { select: { tournamentId: true }, take: 1 }
        }
      });
    }

    if (!currentPlayer) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const isTournamentAdmin =
      currentPlayer.tournamentAdminLinks.length > 0 ||
      currentPlayer.TournamentEventManager.length > 0;

    if (!currentPlayer.isAppAdmin && !isTournamentAdmin) {
      return NextResponse.json({ error: 'Access denied. Admin access required.' }, { status: 403 });
    }

    const { playerId } = await ctx.params;
    if (!playerId) return NextResponse.json({ error: 'playerId required' }, { status: 400 });

    // 404 if not found (but DELETE is idempotent; 204 if already gone)
    const found = await prisma.player.findUnique({ where: { id: playerId }, select: { id: true, clubId: true } });
    if (!found) return new NextResponse(null, { status: 204 });

    // Tournament Admins can only delete players from their own club
    if (!currentPlayer.isAppAdmin && isTournamentAdmin && found.clubId !== currentPlayer.clubId) {
      return NextResponse.json({ error: 'Access denied. You can only delete players from your club.' }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.team.updateMany({ where: { captainId: playerId }, data: { captainId: null } });
      await tx.stopTeamPlayer.deleteMany({ where: { playerId } });
      await tx.lineupEntry.deleteMany({ where: { player1Id: playerId } });
      await tx.lineupEntry.deleteMany({ where: { player2Id: playerId } });
      await tx.tournamentAdmin.deleteMany({ where: { playerId } });
      await tx.captainInvite.deleteMany({ where: { captainId: playerId } });
      await tx.teamPlayer.deleteMany({ where: { playerId } });
      await tx.player.delete({ where: { id: playerId } });
    });

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
