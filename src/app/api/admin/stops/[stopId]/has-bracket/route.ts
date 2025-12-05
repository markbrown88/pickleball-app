// src/app/api/admin/stops/[stopId]/has-bracket/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireStopAccess } from '@/lib/auth';

type Ctx = { params: Promise<{ stopId: string }> };

/**
 * GET /api/admin/stops/[stopId]/has-bracket
 * 
 * Lightweight endpoint to check if a stop has a bracket (rounds) without loading all schedule data.
 * Returns { hasBracket: boolean }
 */
export async function GET(req: Request, ctx: Ctx) {
  try {
    const { stopId } = await ctx.params;

    // 1. Authenticate
    const authResult = await requireAuth('tournament_admin');
    if (authResult instanceof NextResponse) return authResult;

    // 2. Authorize
    const accessCheck = await requireStopAccess(authResult, stopId);
    if (accessCheck instanceof NextResponse) return accessCheck;

    // Just count rounds - much faster than loading all data
    const roundCount = await prisma.round.count({
      where: { stopId },
    });

    return NextResponse.json({ hasBracket: roundCount > 0 });
  } catch (e) {
    console.error('Error in /api/admin/stops/[stopId]/has-bracket:', e);
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

