import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const squeeze = (s: string) => s.replace(/\s+/g, ' ').trim();

function validEmail(input?: string | null): boolean {
  if (!input) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
}

function normalizePhone(input?: string | null): { ok: boolean; formatted?: string; error?: string } {
  if (!input) return { ok: true, formatted: undefined };
  const digits = String(input).replace(/\D/g, '');
  let n = digits;
  if (n.length === 11 && n.startsWith('1')) n = n.slice(1);
  if (n.length !== 10) return { ok: false, error: 'Phone must have 10 digits (US/CA)' };
  return { ok: true, formatted: `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}` };
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

export async function GET(req: NextRequest) {
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

    // Check if user is Tournament Admin or App Admin
    const isTournamentAdmin =
      currentPlayer.tournamentAdminLinks.length > 0 ||
      currentPlayer.TournamentEventManager.length > 0;

    if (!currentPlayer.isAppAdmin && !isTournamentAdmin) {
      return NextResponse.json({ error: 'Access denied. Admin access required.' }, { status: 403 });
    }

    const url = new URL(req.url);
    const take = parseInt(url.searchParams.get('take') || '25');
    const skip = parseInt(url.searchParams.get('skip') || '0');
    const sort = url.searchParams.get('sort') || 'lastName:asc';
    const search = url.searchParams.get('search') || '';
    const showDisabled = url.searchParams.get('showDisabled') === 'true';
    let clubId = url.searchParams.get('clubId') || '';

    // Tournament Admins can only see players from their own club
    if (!currentPlayer.isAppAdmin && isTournamentAdmin) {
      clubId = currentPlayer.clubId;
    }

    // Parse sort parameter and handle computed fields
    const [sortField, sortOrder] = sort.split(':');
    let orderBy: any = {};
    
    // Map computed fields to actual database fields
    if (sortField === 'clubName') {
      orderBy = { club: { name: sortOrder } };
    } else if (sortField === 'age') {
      // For age, sort by birthdayYear (descending for age)
      orderBy = { birthdayYear: sortOrder === 'asc' ? 'desc' : 'asc' };
    } else if (sortField === 'clubId') {
      orderBy = { clubId: sortOrder };
    } else {
      orderBy = { [sortField]: sortOrder };
    }

    // Build where clause for search and club filter
    const where: any = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (clubId) {
      where.clubId = clubId;
    }

    // Filter disabled players by default unless showDisabled is true
    if (!showDisabled) {
      where.disabled = false;
    }

    const [players, total] = await Promise.all([
      prisma.player.findMany({
        where,
        select: {
          id: true,
          clerkUserId: true,
          firstName: true,
          lastName: true,
          name: true,
          gender: true,
          email: true,
          phone: true,
          city: true,
          region: true,
          country: true,
          dupr: true,
          birthdayYear: true,
          birthdayMonth: true,
          birthdayDay: true,
          isAppAdmin: true,
          disabled: true,
          disabledAt: true,
          createdAt: true,
          club: {
            select: {
              id: true,
              name: true,
              city: true
            }
          }
        },
        orderBy,
        take,
        skip
      }),
      prisma.player.count({ where })
    ]);

    // Add computed fields for admin page
    const playersWithComputedFields = players.map(player => {
      // Calculate age from birthday
      let age = null;
      if (player.birthdayYear) {
        const currentYear = new Date().getFullYear();
        age = currentYear - player.birthdayYear;
      }

      return {
        ...player,
        age,
        clubName: player.club?.name || null
      };
    });

    return NextResponse.json({
      items: playersWithComputedFields,
      total,
      hasMore: skip + take < total
    });

  } catch (error) {
    console.error('Error fetching players:', error);
    return NextResponse.json(
      { error: 'Failed to fetch players' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
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

    // Check if user is Tournament Admin or App Admin
    const isTournamentAdmin =
      currentPlayer.tournamentAdminLinks.length > 0 ||
      currentPlayer.TournamentEventManager.length > 0;

    if (!currentPlayer.isAppAdmin && !isTournamentAdmin) {
      return NextResponse.json({ error: 'Access denied. Admin access required.' }, { status: 403 });
    }

    const body = await req.json();

    // Toggle App Admin role when playerId/isAppAdmin payload is provided
    // Only App Admins can toggle App Admin role
    if (body && typeof body.playerId === 'string' && typeof body.isAppAdmin === 'boolean') {
      if (!currentPlayer.isAppAdmin) {
        return NextResponse.json({ error: 'Access denied. App Admin required to toggle admin roles.' }, { status: 403 });
      }
      const updatedPlayer = await prisma.player.update({
        where: { id: body.playerId },
        data: { isAppAdmin: body.isAppAdmin },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          isAppAdmin: true
        }
      });
      return NextResponse.json(updatedPlayer);
    }

    // Otherwise, treat as create-player payload
    const firstName = squeeze(String(body?.firstName ?? ''));
    const lastName = squeeze(String(body?.lastName ?? ''));
    const gender = body?.gender === 'FEMALE' ? 'FEMALE' : body?.gender === 'MALE' ? 'MALE' : null;
    let clubId = typeof body?.clubId === 'string' ? body.clubId.trim() : '';

    // Tournament Admins can only create players in their own club
    if (!currentPlayer.isAppAdmin && isTournamentAdmin) {
      clubId = currentPlayer.clubId;
    }

    if (!firstName || !lastName || !gender || !clubId) {
      return NextResponse.json(
        { error: 'firstName, lastName, gender, and clubId are required' },
        { status: 400 }
      );
    }

    const email: string | null = body?.email ? squeeze(String(body.email)) : null;
    if (!validEmail(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const phoneRaw: string | null = body?.phone ? String(body.phone).trim() : null;
    const phoneCheck = normalizePhone(phoneRaw);
    if (!phoneCheck.ok) {
      return NextResponse.json({ error: phoneCheck.error }, { status: 400 });
    }

    const { y, m, d } = parseBirthdayStr(body?.birthday);

    const dupr = typeof body?.dupr === 'number' && Number.isFinite(body.dupr)
      ? body.dupr
      : body?.dupr
        ? Number(body.dupr)
        : null;

    const club = await prisma.club.findUnique({ where: { id: clubId }, select: { id: true } });
    if (!club) {
      return NextResponse.json({ error: 'club not found' }, { status: 404 });
    }

    try {
      const created = await prisma.player.create({
        data: {
          firstName,
          lastName,
          name: squeeze(`${firstName} ${lastName}`),
          gender,
          clubId,
          email,
          phone: phoneCheck.formatted ?? null,
          city: body?.city ? squeeze(String(body.city)) : null,
          region: body?.region ? squeeze(String(body.region)) : null,
          country: body?.country ? squeeze(String(body.country)) : 'Canada',
          dupr: dupr && Number.isFinite(dupr) ? Number(dupr) : null,
          birthdayYear: y,
          birthdayMonth: m,
          birthdayDay: d,
        },
        include: { club: true }
      });

      const age = y && m && d ? (() => {
        const today = new Date();
        let age = today.getFullYear() - y;
        const mm = m - 1;
        if (today.getMonth() < mm || (today.getMonth() === mm && today.getDate() < d)) age -= 1;
        return age;
      })() : null;

      return NextResponse.json({ ...created, age }, { status: 201 });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        return NextResponse.json({ error: 'A player with that email already exists' }, { status: 409 });
      }
      throw error;
    }

  } catch (error) {
    console.error('Error saving player:', error);
    return NextResponse.json(
      { error: 'Failed to save player' },
      { status: 500 }
    );
  }
}
