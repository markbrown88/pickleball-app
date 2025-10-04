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
    
    return NextResponse.json(serializedStandings);
  } catch (error) {
    console.error('API: Error fetching tournament standings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tournament standings' },
      { status: 500 }
    );
  }
}
