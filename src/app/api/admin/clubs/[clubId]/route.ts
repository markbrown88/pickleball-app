export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

function normalizePhone(input?: string | null): { ok: boolean; formatted?: string; error?: string } {
  if (!input) return { ok: true, formatted: undefined };
  const digits = String(input).replace(/\D/g, '');
  let n = digits;
  if (n.length === 11 && n.startsWith('1')) n = n.slice(1);
  if (n.length !== 10) return { ok: false, error: 'Phone must have 10 digits (US/CA)' };
  return { ok: true, formatted: `(${n.slice(0,3)}) ${n.slice(3,6)}-${n.slice(6)}` };
}

/** PUT /api/admin/clubs/:clubId */
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ clubId: string }> }
) {
  // Use singleton prisma instance
  const { clubId } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  console.log('Club update request:', { clubId, body });
  
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
    const updateData: any = {
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

    updateData.fullName = fullName;

    const updated = await prisma.club.update({
      where: { id: clubId },
      data: updateData,
    });

    console.log('Club updated successfully:', updated);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating club:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      code: (error as any)?.code,
      meta: (error as any)?.meta
    });
    return NextResponse.json({ 
      error: 'Failed to update club', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/** DELETE /api/admin/clubs/:clubId */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ clubId: string }> }
) {
  // Use singleton prisma instance
  const { clubId } = await ctx.params;

  try {
    // Optional: 404 if not found
    const found = await prisma.club.findUnique({ where: { id: clubId }, select: { id: true } });
    if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.club.delete({ where: { id: clubId } });
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    // Clean 409 if FKs block deletion (e.g., Stop.clubId has RESTRICT)
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      return NextResponse.json(
        { error: 'Club is in use (e.g., referenced by a Stop or Team); remove references first.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: err?.message ?? 'Failed to delete club' }, { status: 500 });
  }
}
