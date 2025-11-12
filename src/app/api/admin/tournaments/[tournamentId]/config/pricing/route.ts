export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { PricingModel } from '@prisma/client';

type CtxPromise = { params: Promise<{ tournamentId: string }> };

type PricingPayload = {
  pricingModel?: PricingModel;
  registrationCost?: number | null; // tournament-wide cost in cents
  stopPricing?: Array<{
    stopId: string;
    cost: number; // in cents
  }>;
  bracketPricing?: Array<{
    bracketId: string;
    cost: number; // in cents
  }>;
};

// ---------- GET ----------
export async function GET(_req: Request, ctx: CtxPromise) {
  const { tournamentId } = await ctx.params;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      pricingModel: true,
      registrationCost: true,
    },
  });

  if (!tournament) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  }

  const [stopPricing, bracketPricing] = await Promise.all([
    prisma.stopPricing.findMany({
      where: { tournamentId },
      select: { stopId: true, cost: true },
    }),
    prisma.bracketPricing.findMany({
      where: { tournamentId },
      select: { bracketId: true, cost: true },
    }),
  ]);

  return NextResponse.json({
    pricingModel: tournament.pricingModel,
    registrationCost: tournament.registrationCost,
    stopPricing,
    bracketPricing,
  });
}

// ---------- PUT ----------
export async function PUT(req: Request, ctx: CtxPromise) {
  const { tournamentId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as PricingPayload;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true },
  });

  if (!tournament) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Update pricing model and tournament-wide cost
      const updates: Partial<{
        pricingModel: PricingModel;
        registrationCost: number | null;
      }> = {};

      if (body.pricingModel) {
        const validModels: PricingModel[] = [
          'TOURNAMENT_WIDE',
          'PER_STOP',
          'PER_BRACKET',
          'PER_STOP_PER_BRACKET',
        ];
        if (!validModels.includes(body.pricingModel)) {
          throw new Error('Invalid pricing model');
        }
        updates.pricingModel = body.pricingModel;
      }

      if (Object.prototype.hasOwnProperty.call(body, 'registrationCost')) {
        const v = body.registrationCost;
        if (v === null || v === undefined) {
          updates.registrationCost = null;
        } else if (typeof v === 'number' && Number.isInteger(v) && v >= 0) {
          updates.registrationCost = v;
        } else {
          throw new Error('registrationCost must be a non-negative integer (in cents) or null');
        }
      }

      if (Object.keys(updates).length > 0) {
        await tx.tournament.update({
          where: { id: tournamentId },
          data: updates,
        });
      }

      // Handle stop pricing
      if (Array.isArray(body.stopPricing)) {
        // Validate stop IDs exist
        const stopIds = body.stopPricing.map((sp) => sp.stopId);
        if (stopIds.length > 0) {
          const stops = await tx.stop.findMany({
            where: { id: { in: stopIds }, tournamentId },
            select: { id: true },
          });
          const validStopIds = new Set(stops.map((s) => s.id));
          const invalidStopIds = stopIds.filter((id) => !validStopIds.has(id));
          if (invalidStopIds.length > 0) {
            throw new Error(`Invalid stop IDs: ${invalidStopIds.join(', ')}`);
          }
        }

        // Delete existing stop pricing and recreate
        await tx.stopPricing.deleteMany({ where: { tournamentId } });

        if (body.stopPricing.length > 0) {
          await tx.stopPricing.createMany({
            data: body.stopPricing.map((sp) => ({
              tournamentId,
              stopId: sp.stopId,
              cost: sp.cost,
            })),
          });
        }
      }

      // Handle bracket pricing
      if (Array.isArray(body.bracketPricing)) {
        // Validate bracket IDs exist
        const bracketIds = body.bracketPricing.map((bp) => bp.bracketId);
        if (bracketIds.length > 0) {
          const brackets = await tx.tournamentBracket.findMany({
            where: { id: { in: bracketIds }, tournamentId },
            select: { id: true },
          });
          const validBracketIds = new Set(brackets.map((b) => b.id));
          const invalidBracketIds = bracketIds.filter((id) => !validBracketIds.has(id));
          if (invalidBracketIds.length > 0) {
            throw new Error(`Invalid bracket IDs: ${invalidBracketIds.join(', ')}`);
          }
        }

        // Delete existing bracket pricing and recreate
        await tx.bracketPricing.deleteMany({ where: { tournamentId } });

        if (body.bracketPricing.length > 0) {
          await tx.bracketPricing.createMany({
            data: body.bracketPricing.map((bp) => ({
              tournamentId,
              bracketId: bp.bracketId,
              cost: bp.cost,
            })),
          });
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error updating pricing configuration:', error);
    const message = error instanceof Error ? error.message : 'Failed to update pricing configuration';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
