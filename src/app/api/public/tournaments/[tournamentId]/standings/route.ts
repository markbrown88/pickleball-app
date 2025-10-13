// src/app/api/public/tournaments/[tournamentId]/standings/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCached, cacheKeys, CACHE_TTL } from '@/lib/cache';

type Params = { tournamentId: string };

export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  try {
    const { tournamentId } = await ctx.params;
    console.log('Public API: Fetching standings for tournament:', tournamentId);
    
    // Cache standings data (5 minute TTL for public viewing)
    const standings = await getCached(
      cacheKeys.tournamentStandings(tournamentId),
      async () => {
        // Query the materialized view for tournament standings
        const rawStandings = await prisma.$queryRaw`
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

        console.log('Public API: Standings query result:', rawStandings);
        
        // Convert BigInt values to regular numbers for JSON serialization
        return (rawStandings as any[]).map((standing: any) => ({
          team_id: standing.team_id,
          team_name: standing.team_name,
          clubId: standing.clubId,
          tournamentId: standing.tournamentId,
          matches_played: Number(standing.matches_played),
          wins: Number(standing.wins),
          losses: Number(standing.losses),
          points: Number(standing.points)
        }));
      },
      CACHE_TTL.STANDINGS // 5 minutes
    );
    
    return NextResponse.json(standings);
  } catch (error) {
    console.error('Public API: Error fetching tournament standings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tournament standings' },
      { status: 500 }
    );
  }
}
