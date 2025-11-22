export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

function normalizePhone(input?: string | null): { ok: boolean; formatted?: string; error?: string } {
  if (!input) return { ok: true, formatted: undefined };
  const digits = String(input).replace(/\D/g, '');
  let n = digits;
  if (n.length === 11 && n.startsWith('1')) n = n.slice(1);
  if (n.length !== 10) return { ok: false, error: 'Phone must have 10 digits (US/CA)' };
  return { ok: true, formatted: `(${n.slice(0,3)}) ${n.slice(3,6)}-${n.slice(6)}` };
}

/** GET /api/admin/clubs?sort=name:asc */
export async function GET(req: Request) {
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

    // Allow all authenticated users to read clubs (for profile page club selection)
    // Only restrict write operations (POST, PUT, DELETE) to admins
    // This GET endpoint is read-only, so we allow all authenticated users

    const url = new URL(req.url);
    const sortParam = url.searchParams.get('sort'); // e.g. "name:asc"
    const search = (url.searchParams.get('q') || '').trim();
    const take = Math.min(Number(url.searchParams.get('take') || '20') || 20, 50);

    let orderBy: any = { name: 'asc' as const };
    if (sortParam) {
      const [field, dirRaw] = sortParam.split(':');
      const dir = dirRaw === 'desc' ? 'desc' : 'asc';
      if (['name', 'city', 'region', 'country'].includes(field)) {
        orderBy = { [field]: dir };
      }
    }

    let where: any = search.length >= 3
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { city: { contains: search, mode: 'insensitive' as const } },
            { region: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    // Tournament Admins can only see their own club (if they're not app admins)
    if (!currentPlayer.isAppAdmin && isTournamentAdmin && currentPlayer.clubId) {
      where.id = currentPlayer.clubId;
    }

    const clubs = await prisma.club.findMany({
      where,
      orderBy,
      take,
      include: {
        director: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    return NextResponse.json(clubs);
  } catch (error) {
    console.error('GET /api/admin/clubs - Error:', error);
    return NextResponse.json({ error: 'Failed to fetch clubs' }, { status: 500 });
  }
}

/** POST /api/admin/clubs */
export async function POST(req: Request) {
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
        isAppAdmin: true
      }
    });
  } else {
    // Normal operation - use authenticated user
    currentPlayer = await prisma.player.findUnique({
      where: { clerkUserId: userId },
      select: {
        id: true,
        isAppAdmin: true
      }
    });
  }

  if (!currentPlayer) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  // Only App Admins can create new clubs
  if (!currentPlayer.isAppAdmin) {
    return NextResponse.json({ error: 'Access denied. Only App Admins can create clubs.' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  const fullName = String(body.fullName ?? '').trim();
  if (!fullName) return NextResponse.json({ error: 'Full name is required' }, { status: 400 });

  const name = String(body.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'Nickname is required' }, { status: 400 });

  const phoneRaw: string | null = body.phone ? String(body.phone).trim() : null;
  const phoneCheck = normalizePhone(phoneRaw);
  if (!phoneCheck.ok) return NextResponse.json({ error: phoneCheck.error }, { status: 400 });

  // Validate email if provided
  const email = body.email ? String(body.email).trim() : null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }

  try {
    const createData: any = {
      name,
      address: body.address ? String(body.address).trim() : null,
      city:    body.city ? String(body.city).trim() : null,
      region:  body.region ? String(body.region).trim() : null,
      country: body.country ? String(body.country).trim() : 'Canada',
      phone:   phoneCheck.formatted ?? null,
      email: body.email ? String(body.email).trim() : null,
      description: body.description ? String(body.description).trim() : null,
      directorId: body.directorId ? String(body.directorId).trim() : null,
      logo: body.logo ? String(body.logo).trim() : null,
    };

    createData.fullName = fullName;

    const created = await prisma.club.create({
      data: createData,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Error creating club:', error);
    return NextResponse.json({ error: 'Failed to create club' }, { status: 500 });
  }
}
