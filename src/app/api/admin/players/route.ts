export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

type SortDir = 'asc' | 'desc';

function parseBirthdayStr(s?: string | null): { y: number|null, m: number|null, d: number|null } {
  if (!s) return { y: null, m: null, d: null };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return { y: null, m: null, d: null };
  const y = Number(m[1]); const mo = Number(m[2]); const da = Number(m[3]);
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || da < 1 || da > 31) return { y: null, m: null, d: null };
  return { y, m: mo, d: da };
}

function computeAge(y?: number | null, m?: number | null, d?: number | null): number | null {
  if (!y || !m || !d) return null;
  try {
    const today = new Date();
    let age = today.getFullYear() - y;
    const mm = m - 1;
    if (today.getMonth() < mm || (today.getMonth() === mm && today.getDate() < d)) age -= 1;
    return age;
  } catch { return null; }
}

const squeeze = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * GET /api/admin/players?skip=0&sort=lastName:asc&clubId=...
 * Always returns 25 items per page to match the UI.
 */
export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
    const url = new URL(req.url);
    const skip = Math.max(0, parseInt(url.searchParams.get('skip') ?? '0', 10) || 0);
    const sortRaw = (url.searchParams.get('sort') ?? 'lastName:asc');
    const [sortColRaw, sortDirRaw] = sortRaw.split(':');
    const sortCol = (sortColRaw || 'lastName').toLowerCase();
    const sortDir: SortDir = sortDirRaw === 'desc' ? 'desc' : 'asc';
    const clubId = url.searchParams.get('clubId') || undefined;
    const flat = url.searchParams.get('flat') === '1';

    const where: any = {};
    if (clubId) where.clubId = clubId;

    // Map UI sort keys -> Prisma orderBy
    // Age is derived from y/m/d: younger first (age asc) ⇒ later birthday ⇒ desc on (y,m,d)
    // older first (age desc) ⇒ asc on (y,m,d)
    let orderBy: any = { lastName: sortDir };
    switch (sortCol) {
      case 'firstname': orderBy = { firstName: sortDir }; break;
      case 'lastname':  orderBy = { lastName: sortDir }; break;
      case 'gender':    orderBy = { gender: sortDir }; break;
      case 'dupr':      orderBy = { dupr: sortDir }; break;
      case 'city':      orderBy = { city: sortDir }; break;
      case 'region':    orderBy = { region: sortDir }; break;
      case 'country':   orderBy = { country: sortDir }; break;
      case 'phone':     orderBy = { phone: sortDir }; break;
      case 'clubname':  orderBy = { club: { name: sortDir } }; break;
      case 'age':
        orderBy = sortDir === 'asc'
          ? [{ birthdayYear: 'desc' }, { birthdayMonth: 'desc' }, { birthdayDay: 'desc' }]
          : [{ birthdayYear: 'asc'  }, { birthdayMonth: 'asc'  }, { birthdayDay: 'asc'  }];
        break;
      default:          orderBy = { lastName: sortDir };
    }

    const take = flat ? undefined : 25;

    const [total, rows] = await Promise.all([
      prisma.player.count({ where }),
      prisma.player.findMany({
        where,
        orderBy,
        skip,
        take,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          name: true,
          gender: true,
          clubId: true,
          club: { select: { id: true, name: true, city: true } },
          city: true,
          region: true,
          country: true,
          phone: true,
          email: true,
          dupr: true,
          birthdayYear: true,
          birthdayMonth: true,
          birthdayDay: true,
          age: true, // legacy snapshot if you have it
        },
      }),
    ]);

    const items = rows.map(r => ({
      id: r.id,
      firstName: r.firstName ?? null,
      lastName:  r.lastName ?? null,
      name:      r.name ?? null,
      gender:    r.gender,
      clubId:    r.clubId,
      club:      r.club ? { id: r.club.id, name: r.club.name, city: r.club.city ?? null } : null,
      city:      r.city ?? null,
      region:    r.region ?? null,
      country:   r.country ?? null,
      phone:     r.phone ?? null,
      email:     r.email ?? null,
      dupr:      r.dupr ?? null,
      age:       computeAge(r.birthdayYear, r.birthdayMonth, r.birthdayDay) ?? (r.age ?? null),
    }));

    // When flat=1, return just the array of items for the dropdown
    if (flat) {
      return NextResponse.json(items);
    }

    return NextResponse.json({ items, total });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/admin/players
 * Body: { firstName, lastName, gender, clubId, dupr?, city?, region?, country?, phone?, email?, birthday? (YYYY-MM-DD) }
 */
export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    const body = (await req.json().catch(() => ({}))) as {
      firstName?: string; lastName?: string; gender?: 'MALE'|'FEMALE';
      clubId?: string;
      dupr?: number | null;
      city?: string; region?: string; country?: string;
      phone?: string; email?: string;
      birthday?: string | null; // "YYYY-MM-DD"
    };

    const firstName = squeeze(String(body.firstName || ''));
    const lastName  = squeeze(String(body.lastName  || ''));
    const gender    = body.gender === 'FEMALE' ? 'FEMALE' : 'MALE';
    const clubId    = (body.clubId || '').trim();

    if (!firstName || !lastName) return NextResponse.json({ error: 'firstName and lastName are required' }, { status: 400 });
    if (!clubId)                  return NextResponse.json({ error: 'clubId is required' }, { status: 400 });

    const club = await prisma.club.findUnique({ where: { id: clubId }, select: { id: true } });
    if (!club) return NextResponse.json({ error: 'club not found' }, { status: 404 });

    const { y, m, d } = parseBirthdayStr(body.birthday);

    const created = await prisma.player.create({
      data: {
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        gender,
        clubId,
        dupr: typeof body.dupr === 'number' ? body.dupr : null,
        city: (body.city ?? '').trim() || null,
        region: (body.region ?? '').trim() || null,
        country: (body.country ?? '').trim() || 'Canada',
        phone: (body.phone ?? '').trim() || null,
        email: (body.email ?? '').trim() || null,
        birthdayYear: y, birthdayMonth: m, birthdayDay: d,
      },
      select: { id: true },
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
