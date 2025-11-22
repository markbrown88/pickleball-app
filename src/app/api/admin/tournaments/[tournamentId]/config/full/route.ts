export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type CtxPromise = { params: Promise<{ tournamentId: string }> };

/**
 * GET endpoint to fetch complete tournament configuration including:
 * - Basic tournament info
 * - Stops
 * - Brackets
 * - Clubs (for team tournaments)
 * - Pricing configuration (model + per-stop/bracket pricing)
 * - Game type configuration
 * - Capacity configuration
 */
export async function GET(_req: Request, ctx: CtxPromise) {
  const { tournamentId } = await ctx.params;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      name: true,
      type: true,
      pricingModel: true,
      registrationCost: true,
      registrationStatus: true,
      registrationType: true,
      maxPlayers: true,
      restrictionNotes: true,
      isWaitlistEnabled: true,
    },
  });

  if (!tournament) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  }

  const isTeamTournament = tournament.type === 'TEAM_FORMAT';

  // Query models that may not exist in schema yet - wrap in try-catch
  let stopPricing: Array<{ stopId: string; cost: number }> = [];
  let bracketPricing: Array<{ bracketId: string; cost: number }> = [];
  let gameTypeConfig: Array<{ bracketId: string; gameType: string; isEnabled: boolean; capacity: number | null }> = [];
  let capacities: Array<{ stopId: string; bracketId: string; clubId: string | null; maxCapacity: number | null; currentCount: number }> = [];

  try {
    stopPricing = await prisma.stopPricing.findMany({
      where: { tournamentId },
      select: { stopId: true, cost: true },
    });
  } catch (e) {
    // Model doesn't exist yet, use empty array
  }

  try {
    bracketPricing = await prisma.bracketPricing.findMany({
      where: { tournamentId },
      select: { bracketId: true, cost: true },
    });
  } catch (e) {
    // Model doesn't exist yet, use empty array
  }

  try {
    gameTypeConfig = await prisma.bracketGameTypeConfig.findMany({
      where: { tournamentId },
      select: {
        bracketId: true,
        gameType: true,
        isEnabled: true,
        capacity: true,
      },
    });
  } catch (e) {
    // Model doesn't exist yet, use empty array
  }

  try {
    capacities = await prisma.stopBracketCapacity.findMany({
      where: { tournamentId },
      select: {
        stopId: true,
        bracketId: true,
        clubId: true,
        maxCapacity: true,
        currentCount: true,
      },
    });
  } catch (e) {
    // Model doesn't exist yet, use empty array
  }

  const [stops, brackets, clubs] = await Promise.all([
    prisma.stop.findMany({
      where: { tournamentId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        startAt: true,
        endAt: true,
        clubId: true,
      },
    }),
    prisma.tournamentBracket.findMany({
      where: { tournamentId },
      orderBy: { idx: 'asc' },
      select: {
        id: true,
        name: true,
        idx: true,
      },
    }),
    isTeamTournament
      ? prisma.tournamentClub.findMany({
          where: { tournamentId },
          include: {
            club: {
              select: {
                id: true,
                name: true,
                city: true,
                region: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  // Get pricing model from database (now exists in schema)
  const pricingModel = tournament.pricingModel || 'TOURNAMENT_WIDE';

  return NextResponse.json({
    tournament: {
      id: tournament.id,
      name: tournament.name,
      type: tournament.type,
      pricingModel,
      registrationCost: tournament.registrationCost,
      registrationStatus: tournament.registrationStatus,
      registrationType: tournament.registrationType,
      maxPlayers: tournament.maxPlayers,
      restrictionNotes: tournament.restrictionNotes ?? [],
      isWaitlistEnabled: tournament.isWaitlistEnabled ?? true,
    },
    stops: stops.map((s) => ({
      id: s.id,
      name: s.name,
      startAt: s.startAt ? s.startAt.toISOString() : null,
      endAt: s.endAt ? s.endAt.toISOString() : null,
      clubId: s.clubId,
      registrationDeadline: null, // Field doesn't exist in schema yet
      isRegistrationClosed: false, // Field doesn't exist in schema yet
    })),
    brackets: brackets.filter((b) => b.name.toUpperCase() !== 'DEFAULT').map((b) => ({
      id: b.id,
      name: b.name,
      idx: b.idx,
    })),
    clubs: isTeamTournament
      ? clubs.map((tc) => ({
          clubId: tc.clubId,
          club: tc.club
            ? {
                id: tc.club.id,
                name: tc.club.name,
                city: tc.club.city,
                region: tc.club.region,
              }
            : null,
        }))
      : [],
    pricing: {
      model: pricingModel,
      tournamentWideCost: tournament.registrationCost,
      stopPricing,
      bracketPricing,
    },
    gameTypeConfig,
    capacities,
  });
}
