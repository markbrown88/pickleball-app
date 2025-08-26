// src/app/api/admin/stops/[stopId]/generate/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

type Params = { stopId: string };

// In Next 15, ctx.params is a Promise—await it.
export async function POST(_req: Request, ctx: { params: Promise<Params> }) {
  const { stopId } = await ctx.params;
  return NextResponse.json({ ok: true, stopId });
}
