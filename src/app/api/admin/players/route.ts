import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatPhoneForDisplay, formatPhoneForStorage } from '@/lib/phone';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const squeeze = (s: string) => s.replace(/\s+/g, ' ').trim();

function validEmail(input?: string | null): boolean {
  if (!input) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
}

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

import { requireAuth } from '@/lib/auth';

// ... existing code ...

export async function GET(req: NextRequest) {
  try {
    // 1. Centralized Auth & Act As Support
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;

    const { player: effectivePlayer } = authResult;

    // Fetch full details needed for this route
    const currentPlayer = await prisma.player.findUnique({
      where: { id: effectivePlayer.id },
      select: {
        id: true,
        isAppAdmin: true,
        clubId: true,
        tournamentAdminLinks: { select: { tournamentId: true }, take: 1 },
        TournamentEventManager: { select: { tournamentId: true }, take: 1 }
      }
    });

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
    const registrationStatus = url.searchParams.get('registrationStatus') || ''; // 'registered' or 'profile'
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

    // Filter by registration status
    if (registrationStatus === 'registered') {
      where.clerkUserId = { not: null };
    } else if (registrationStatus === 'profile') {
      where.clerkUserId = null;
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
          duprDoubles: true,
          duprSingles: true,
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
      // Calculate age from birthday (use stored age if available, otherwise calculate)
      const age = player.birthdayYear && player.birthdayMonth && player.birthdayDay
        ? computeAge(player.birthdayYear, player.birthdayMonth, player.birthdayDay)
        : null;

      return {
        ...player,
        phone: formatPhoneForDisplay(player.phone),
        age,
        clubName: player.club?.name || null,
        // Map duprDoubles to dupr for backward compatibility (will be removed later)
        dupr: player.duprDoubles ?? null,
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
    // 1. Centralized Auth & Act As Support
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;

    const { player: effectivePlayer } = authResult;

    // Fetch full details needed for this route
    const currentPlayer = await prisma.player.findUnique({
      where: { id: effectivePlayer.id },
      select: {
        id: true,
        isAppAdmin: true,
        clubId: true,
        tournamentAdminLinks: { select: { tournamentId: true }, take: 1 },
        TournamentEventManager: { select: { tournamentId: true }, take: 1 }
      }
    });

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

    let phone: string | null = null;
    if (body?.phone !== undefined) {
      try {
        phone = body.phone ? formatPhoneForStorage(body.phone, { strict: true }) : null;
      } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 400 });
      }
    }

    const { y, m, d } = parseBirthdayStr(body?.birthday);

    // Construct birthday Date from year/month/day if provided
    let birthdayDate: Date | null = null;
    if (y && m && d) {
      // Use UTC to avoid timezone issues
      birthdayDate = new Date(Date.UTC(y, m - 1, d));
    }

    const club = await prisma.club.findUnique({ where: { id: clubId }, select: { id: true } });
    if (!club) {
      return NextResponse.json({ error: 'club not found' }, { status: 404 });
    }

    try {
      // Calculate age if birthday is provided
      const calculatedAge = y && m && d ? computeAge(y, m, d) : null;

      const created = await prisma.player.create({
        data: {
          firstName,
          lastName,
          name: squeeze(`${firstName} ${lastName}`),
          gender,
          clubId,
          email,
          phone,
          city: body?.city ? squeeze(String(body.city)) : null,
          region: body?.region ? squeeze(String(body.region)) : null,
          country: body?.country ? squeeze(String(body.country)) : 'Canada',
          birthdayYear: y,
          birthdayMonth: m,
          birthdayDay: d,
          birthday: birthdayDate, // Also set the Date field for consistency
          age: calculatedAge, // Store calculated age
        },
        include: { club: true }
      });

      return NextResponse.json({ ...created, age: calculatedAge }, { status: 201 });
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
