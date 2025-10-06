import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

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
    const { token, gameId } = await params;
    const { myScore, opponentScore } = await request.json();

    // Validate token
    const tournamentClub = await prisma.tournamentClub.findUnique({
      where: { captainAccessToken: token },
      select: { tournamentId: true, clubId: true }
    });

    if (!tournamentClub) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
    }

    // Get the game with match and round details
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

    // Determine if this club is Team A or Team B
    const isTeamA = game.match.teamA?.clubId === tournamentClub.clubId;
    const isTeamB = game.match.teamB?.clubId === tournamentClub.clubId;

    if (!isTeamA && !isTeamB) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Validate scores
    if (typeof myScore !== 'number' || typeof opponentScore !== 'number') {
      return NextResponse.json({ error: 'Invalid score format' }, { status: 400 });
    }

    if (myScore < 0 || opponentScore < 0) {
      return NextResponse.json({ error: 'Scores cannot be negative' }, { status: 400 });
    }

    // Build the update based on which team is submitting
    // Team A perspective: teamAScore = myScore, teamBScore = opponentScore
    // Team B perspective: teamBScore = myScore, teamAScore = opponentScore
    const updateData = isTeamA
      ? {
          teamASubmittedScore: myScore,
          teamBSubmittedScore: opponentScore,
          teamAScoreSubmitted: true
        }
      : {
          teamBSubmittedScore: myScore,
          teamASubmittedScore: opponentScore,
          teamBScoreSubmitted: true
        };

    // Update the game with the submitted score
    const updatedGame = await prisma.game.update({
      where: { id: gameId },
      data: updateData
    });

    // Check if both teams have submitted
    const teamASubmitted = isTeamA ? true : updatedGame.teamAScoreSubmitted;
    const teamBSubmitted = isTeamB ? true : updatedGame.teamBScoreSubmitted;

    if (teamASubmitted && teamBSubmitted) {
      // Both teams have submitted - check if scores match
      const scoresMatch =
        updatedGame.teamASubmittedScore === updatedGame.teamBSubmittedScore &&
        updatedGame.teamBSubmittedScore === updatedGame.teamASubmittedScore;

      if (scoresMatch) {
        // Scores match! Lock them in and mark game as complete
        await prisma.game.update({
          where: { id: gameId },
          data: {
            teamAScore: updatedGame.teamASubmittedScore,
            teamBScore: updatedGame.teamBSubmittedScore,
            isComplete: true
          }
        });

        return NextResponse.json({
          success: true,
          confirmed: true,
          mismatch: false
        });
      } else {
        // Scores don't match - return mismatch status
        const opponentSubmission = isTeamA
          ? {
              myScore: updatedGame.teamBSubmittedScore,
              opponentScore: updatedGame.teamASubmittedScore
            }
          : {
              myScore: updatedGame.teamASubmittedScore,
              opponentScore: updatedGame.teamBSubmittedScore
            };

        return NextResponse.json({
          success: true,
          confirmed: false,
          mismatch: true,
          opponentSubmission
        });
      }
    }

    // Only one team has submitted
    return NextResponse.json({
      success: true,
      confirmed: false,
      mismatch: false
    });
  } catch (error) {
    console.error('Failed to submit score:', error);
    return NextResponse.json(
      { error: 'Failed to submit score' },
      { status: 500 }
    );
  }
}
