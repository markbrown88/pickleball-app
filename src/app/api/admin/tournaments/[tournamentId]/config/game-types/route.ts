export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { GameType } from '@prisma/client';

type CtxPromise = { params: Promise<{ tournamentId: string }> };

type GameTypeConfigPayload = {
  config: Array<{
    bracketId: string;
    gameType: GameType;
    isEnabled: boolean;
    capacity?: number | null;
  }>;
};

// ---------- GET ----------
export async function GET(_req: Request, ctx: CtxPromise) {
  const { tournamentId } = await ctx.params;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true },
  });

  if (!tournament) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  }

  const config = await prisma.bracketGameTypeConfig.findMany({
    where: { tournamentId },
    select: {
      bracketId: true,
      gameType: true,
      isEnabled: true,
      capacity: true,
    },
  });

  return NextResponse.json({ config });
}

// ---------- PUT ----------
export async function PUT(req: Request, ctx: CtxPromise) {
  const { tournamentId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as GameTypeConfigPayload;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true },
  });

  if (!tournament) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  }

  if (!Array.isArray(body.config)) {
    return NextResponse.json({ error: 'config must be an array' }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Validate bracket IDs
      const bracketIds = [...new Set(body.config.map((c) => c.bracketId))];
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

      // Validate game types
      const validGameTypes: GameType[] = [
        'MENS_DOUBLES',
        'WOMENS_DOUBLES',
        'MIXED_DOUBLES',
        'MIXED_DOUBLES_1',
        'MIXED_DOUBLES_2',
        'MENS_SINGLES',
        'WOMENS_SINGLES',
      ];

      for (const item of body.config) {
        if (!validGameTypes.includes(item.gameType)) {
          throw new Error(`Invalid game type: ${item.gameType}`);
        }
        if (typeof item.isEnabled !== 'boolean') {
          throw new Error('isEnabled must be a boolean');
        }
        if (
          item.capacity !== undefined &&
          item.capacity !== null &&
          (typeof item.capacity !== 'number' || !Number.isInteger(item.capacity) || item.capacity < 0)
        ) {
          throw new Error('capacity must be a non-negative integer or null');
        }
      }

      // Delete existing config and recreate
      await tx.bracketGameTypeConfig.deleteMany({ where: { tournamentId } });

      if (body.config.length > 0) {
        await tx.bracketGameTypeConfig.createMany({
          data: body.config.map((item) => ({
            tournamentId,
            bracketId: item.bracketId,
            gameType: item.gameType,
            isEnabled: item.isEnabled,
            capacity: item.capacity ?? null,
          })),
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error updating game type configuration:', error);
    const message = error instanceof Error ? error.message : 'Failed to update game type configuration';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
