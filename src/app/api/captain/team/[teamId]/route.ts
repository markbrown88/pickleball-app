// src/app/api/captain/team/[teamId]/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ teamId: string }> };

async function safeJson<T>(req: NextRequest): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    const txt = await req.text();
    if (!txt) return { ok: true, value: {} as T };
    return { ok: true, value: JSON.parse(txt) as T };
  } catch {
    return { ok: false, error: 'Invalid JSON body' };
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const prisma = getPrisma();
  const { teamId } = await ctx.params;

  const parsed = await safeJson<{ name?: string; clubId?: string }>(req);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const data: { name?: string; clubId?: string } = {};
  if (typeof parsed.value.name === 'string') data.name = parsed.value.name.trim();
  if (typeof parsed.value.clubId === 'string') data.clubId = parsed.value.clubId.trim();

  if (!data.name && !data.clubId) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  await prisma.team.update({ where: { id: teamId }, data });
  return NextResponse.json({ ok: true });
}
