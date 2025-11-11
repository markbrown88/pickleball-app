// src/app/api/tournaments/[tournamentId]/standings/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = { tournamentId: string };

export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  try {
    const { tournamentId } = await ctx.params;
    console.log('API: Fetching standings for tournament:', tournamentId);
    
    // Query the materialized view for tournament standings
    const standings = await prisma.$queryRaw`
      SELECT 
        team_id,
        team_name,
        "clubId",
        "tournamentId",
        matches_played,
        wins,
        losses,
        points
      FROM tournament_standings 
      WHERE "tournamentId" = ${tournamentId}
      ORDER BY points DESC, team_name ASC
    `;

    console.log('API: Standings query result:', standings);
    
    // Convert BigInt values to regular numbers for JSON serialization
    const serializedStandings = (standings as any[]).map((standing: any) => ({
      team_id: standing.team_id,
      team_name: standing.team_name,
      clubId: standing.clubId,
      tournamentId: standing.tournamentId,
      matches_played: Number(standing.matches_played),
      wins: Number(standing.wins),
      losses: Number(standing.losses),
      points: Number(standing.points)
    }));

    // SPECIAL CASE: Pickleplex Belleville gets 0 points for "KLYNG CUP - pickleplex" tournament
    // This is a one-time exception for this specific tournament only
    const KLYNG_CUP_PICKLEPLEX_ID = 'cmh7qeb1t0000ju04udwe7w8w';
    const PICKLEPLEX_BELLEVILLE_CLUB_ID = 'cmfwjxyqn0001rdxtr8v9fmdj';

    const adjustedStandings = serializedStandings.map((standing: any) => {
      // If this is the Klyng Cup Pickleplex tournament and the team is from Pickleplex Belleville
      if (
        standing.tournamentId === KLYNG_CUP_PICKLEPLEX_ID &&
        standing.clubId === PICKLEPLEX_BELLEVILLE_CLUB_ID
      ) {
        // Set their points to 0 for standings display
        return {
          ...standing,
          points: 0,
          wins: 0,
          losses: standing.matches_played
        };
      }
      return standing;
    });

    // Re-sort after adjustment to put Belleville at the bottom
    adjustedStandings.sort((a: any, b: any) => {
      if (b.points !== a.points) return b.points - a.points;
      return a.team_name.localeCompare(b.team_name);
    });

    return NextResponse.json(adjustedStandings);
  } catch (error) {
    console.error('API: Error fetching tournament standings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tournament standings' },
      { status: 500 }
    );
  }
}
