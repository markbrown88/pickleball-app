// src/app/api/admin/players/[playerId]/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

function computeAge(y?: number | null, m?: number | null, d?: number | null): number | null {
  if (!y || !m || !d) return null;
  try {
    const today = new Date();
    let age = today.getFullYear() - y;
    const mm = (m as number) - 1;
    if (today.getMonth() < mm || (today.getMonth() === mm && today.getDate() < (d as number))) age -= 1;
    return age;
  } catch { return null; }
}

function normalizePhone(input?: string | null): { ok: boolean; formatted?: string; error?: string } {
  if (!input) return { ok: true, formatted: undefined };
  const digits = String(input).replace(/\D/g, '');
  let n = digits;
  if (n.length === 11 && n.startsWith('1')) n = n.slice(1);
  if (n.length !== 10) return { ok: false, error: 'Phone must have 10 digits (US/CA)' };
  return { ok: true, formatted: `(${n.slice(0,3)}) ${n.slice(3,6)}-${n.slice(6)}` };
}

function validEmail(input?: string | null): boolean {
  if (!input) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
}

function parseBirthdayStr(s?: string | null): { y: number|null, m: number|null, d: number|null } {
  if (!s) return { y: null, m: null, d: null };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return { y: null, m: null, d: null };
  const y = Number(m[1]); const mo = Number(m[2]); const da = Number(m[3]);
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || da < 1 || da > 31) return { y: null, m: null, d: null };
  return { y, m: mo, d: da };
}

// Collapse internal whitespace and trim ends
const squeeze = (s: string) => s.replace(/\s+/g, ' ').trim();

/** PUT /api/admin/players/:playerId */
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ playerId: string }> }
) {
  try {
    const prisma = getPrisma();
    const { playerId } = await ctx.params;
    if (!playerId) return NextResponse.json({ error: 'playerId required' }, { status: 400 });

    const body = await req.json();

    const firstName = squeeze(String(body.firstName || ''));
    const lastName  = squeeze(String(body.lastName  || ''));
    const gender    = body.gender === 'FEMALE' ? 'FEMALE' : 'MALE';
    const clubId    = String(body.clubId || '').trim();

    if (!firstName || !lastName || !clubId) {
      return NextResponse.json({ error: 'firstName, lastName, and clubId are required' }, { status: 400 });
    }

    // Parse birthday
    let { y, m, d } = parseBirthdayStr(body.birthday);
    if (!y && (body.birthdayYear || body.birthdayMonth || body.birthdayDay)) {
      const by = body.birthdayYear ? Number(body.birthdayYear) : null;
      const bm = body.birthdayMonth ? Number(body.birthdayMonth) : null;
      const bd = body.birthdayDay ? Number(body.birthdayDay) : null;
      if (by && bm && bd) { y = by; m = bm; d = bd; }
    }

    // Email + phone validation
    const email: string | null = body.email ? squeeze(String(body.email)) : null;
    if (!validEmail(email ?? undefined)) return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });

    const phoneRaw: string | null = body.phone ? String(body.phone).trim() : null;
    const phoneCheck = normalizePhone(phoneRaw);
    if (!phoneCheck.ok) return NextResponse.json({ error: phoneCheck.error }, { status: 400 });
    const phone = phoneCheck.formatted ?? null;

    // Safer DUPR parse
    const duprNum = Number(body.dupr);
    const dupr = Number.isFinite(duprNum) ? duprNum : null;

    const city     = body.city ? squeeze(String(body.city)) : null;
    const region   = body.region ? squeeze(String(body.region)) : null;
    const country  = body.country ? squeeze(String(body.country)) : 'Canada';
    const fullName = squeeze(`${firstName} ${lastName}`);

    // Ensure club exists
    const club = await prisma.club.findUnique({ where: { id: clubId }, select: { id: true } });
    if (!club) return NextResponse.json({ error: 'club not found' }, { status: 404 });

    const updated = await prisma.player.update({
      where: { id: playerId },
      data: {
        firstName, lastName, gender, clubId,
        name: fullName,
        city,
        region,
        country,
        phone,
        email,
        dupr,
        birthdayYear: y, birthdayMonth: m, birthdayDay: d,
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
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ playerId: string }> }
) {
  try {
    const prisma = getPrisma();
    const { playerId } = await ctx.params;
    if (!playerId) return NextResponse.json({ error: 'playerId required' }, { status: 400 });

    // 404 if not found
    const found = await prisma.player.findUnique({ where: { id: playerId }, select: { id: true } });
    if (!found) return new NextResponse(null, { status: 204 }); // already gone / idempotent

    await prisma.$transaction(async (tx) => {
      // If the player is a captain of any team, drop captainId to NULL
      await tx.team.updateMany({
        where: { captainId: playerId },
        data: { captainId: null },
      });

      // Remove per-stop roster links
      await tx.stopTeamPlayer.deleteMany({ where: { playerId } });

      // Remove lineup entries where this player appears
      await tx.lineupEntry.deleteMany({ where: { player1Id: playerId } });
      await tx.lineupEntry.deleteMany({ where: { player2Id: playerId } });

      // Remove tournament admin links and captain invites (in case ON DELETE isn't cascading)
      await tx.tournamentAdmin.deleteMany({ where: { playerId } });
      await tx.captainInvite.deleteMany({ where: { captainId: playerId } });

      // Remove team memberships
      await tx.teamPlayer.deleteMany({ where: { playerId } });

      // Finally, remove the player
      await tx.player.delete({ where: { id: playerId } });
    });

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
