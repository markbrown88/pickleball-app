import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ roundId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { roundId } = await ctx.params;
    // Use singleton prisma instance
    
    const body = await req.json();
    const { updates } = body;
    
    
    if (!Array.isArray(updates)) {
      return NextResponse.json({ error: 'Updates must be an array' }, { status: 400 });
    }
    
    // Validate round exists
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      select: { id: true, stopId: true }
    });
    
    if (!round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }
    
    // Update matches with new team assignments
    const result = await prisma.$transaction(async (tx) => {
      const updatedMatches = [];
      
      for (const update of updates) {
        const { gameId, teamAId, teamBId } = update;
        
        if (!gameId) {
          throw new Error('gameId is required for each update');
        }
        
        // Update the match with new team assignments
        const updatedMatch = await tx.match.update({
          where: { id: gameId }, // The gameId is actually the matchId in the UI
          data: {
            teamAId: teamAId || null,
            teamBId: teamBId || null,
          },
          select: {
            id: true,
            teamAId: true,
            teamBId: true,
            isBye: true,
          }
        });
        
        updatedMatches.push(updatedMatch);
      }
      
      return updatedMatches;
    });
    
    
    return NextResponse.json({
      ok: true,
      updated: result.length,
      matches: result
    });
    
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
