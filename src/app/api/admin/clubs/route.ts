export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
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

    const where = search.length >= 3
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { city: { contains: search, mode: 'insensitive' as const } },
            { region: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    const clubs = await prisma.club.findMany({
      where,
      orderBy,
      take,
    });

    return NextResponse.json(clubs);
  } catch (error) {
    console.error('GET /api/admin/clubs - Error:', error);
    return NextResponse.json({ error: 'Failed to fetch clubs' }, { status: 500 });
  }
}

/** POST /api/admin/clubs */
export async function POST(req: Request) {
  // Use singleton prisma instance
  const body = await req.json().catch(() => ({}));

  const name = String(body.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const phoneRaw: string | null = body.phone ? String(body.phone).trim() : null;
  const phoneCheck = normalizePhone(phoneRaw);
  if (!phoneCheck.ok) return NextResponse.json({ error: phoneCheck.error }, { status: 400 });

  const created = await prisma.club.create({
    data: {
      name,
      address: body.address ? String(body.address).trim() : null,
      city:    body.city ? String(body.city).trim() : null,
      region:  body.region ? String(body.region).trim() : null,
      country: body.country ? String(body.country).trim() : 'Canada',
      phone:   phoneCheck.formatted ?? null,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
