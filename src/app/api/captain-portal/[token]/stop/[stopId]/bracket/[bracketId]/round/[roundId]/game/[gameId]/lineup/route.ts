import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { lineupSubmissionLimiter, getClientIp, checkRateLimit } from '@/lib/rateLimit';
import { saveLineupForRoundAndTeam } from '@/lib/lineupHelpers';

export const dynamic = 'force-dynamic';

// Zod schema for lineup validation (SEC-004)
// Lineup must be exactly 4 players: [Man1, Man2, Woman1, Woman2]
const LineupSchema = z.object({
  lineup: z.array(z.string().uuid()).length(4)
});

type Params = {
  params: Promise<{
    token: string;
    stopId: string;
    bracketId: string;
    roundId: string;
    gameId: string;
  }>;
};

export async function PUT(request: Request, { params }: Params) {
  try {
    const { token, stopId, gameId } = await params;

    // Rate limiting to prevent rapid lineup changes (SEC-002)
    const clientIp = getClientIp(request);
    const rateLimitResult = await checkRateLimit(lineupSubmissionLimiter, clientIp);

    if (rateLimitResult && !rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many lineup submissions. Please try again later.',
          retryAfter: rateLimitResult.reset
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
            'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString()
          }
        }
      );
    }

    // Parse and validate request body with Zod (SEC-004)
    const rawBody = await request.json().catch(() => ({}));
    const validation = LineupSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid lineup format',
          details: validation.error.issues.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      );
    }

    const { lineup } = validation.data;

    // Validate token
    const tournamentClub = await prisma.tournamentClub.findUnique({
      where: { captainAccessToken: token },
      select: { tournamentId: true, clubId: true }
    });

    if (!tournamentClub) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
    }

    // Get the game and check deadline
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        match: {
          include: {
            round: {
              include: {
                stop: {
                  select: { lineupDeadline: true }
                }
              }
            },
            teamA: { select: { id: true, clubId: true } },
            teamB: { select: { id: true, clubId: true } }
          }
        }
      }
    });

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Check if deadline has passed
    const deadline = game.match.round.stop.lineupDeadline;
    if (deadline && new Date() > new Date(deadline)) {
      return NextResponse.json({ error: 'Lineup deadline has passed' }, { status: 403 });
    }

    // Determine if this club is Team A or Team B
    const isTeamA = game.match.teamA?.clubId === tournamentClub.clubId;
    const isTeamB = game.match.teamB?.clubId === tournamentClub.clubId;

    if (!isTeamA && !isTeamB) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get the team ID for this club
    const teamId = isTeamA ? game.match.teamA!.id : game.match.teamB!.id;
    const roundId = game.match.round.id;

    // Validate that all player IDs belong to this team's roster
    const stopTeamPlayers = await prisma.stopTeamPlayer.findMany({
      where: {
        stopId,
        teamId,
        playerId: { in: lineup }
      },
      select: { playerId: true }
    });

    if (stopTeamPlayers.length !== 4) {
      return NextResponse.json(
        { error: 'All players must be on the team roster for this stop' },
        { status: 400 }
      );
    }

    // Save the lineup using the new Lineup/LineupEntry schema
    await saveLineupForRoundAndTeam(
      prisma,
      roundId,
      teamId,
      stopId,
      lineup.map(id => ({ id }))
    );

    return NextResponse.json({
      success: true,
      message: 'Lineup submitted successfully'
    });
  } catch (error) {
    console.error('Failed to save lineup:', error);
    return NextResponse.json(
      { error: 'Failed to save lineup' },
      { status: 500 }
    );
  }
}
