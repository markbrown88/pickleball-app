import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEffectivePlayer, getActAsHeaderFromRequest } from '@/lib/actAs';

/**
 * GET /api/player/games
 * Get games where the current player has participated
 */
export async function GET(req: NextRequest) {
  try {
    // Support Act As functionality
    const actAsPlayerId = getActAsHeaderFromRequest(req);
    const effectivePlayer = await getEffectivePlayer(actAsPlayerId);

    // TODO: Reimplement player game lookup using Lineup/LineupEntry tables
    // The old JSON-based lineup fields (teamALineup/teamBLineup) no longer exist
    // This requires joining through LineupEntry to find games where the player participated
    // For now, return empty list

    return NextResponse.json({
      games: [],
      message: 'Player games temporarily unavailable during schema migration'
    });
  } catch (error) {
    console.error('Error fetching player games:', error);
    return NextResponse.json(
      { error: 'Failed to fetch player games' },
      { status: 500 }
    );
  }
}
