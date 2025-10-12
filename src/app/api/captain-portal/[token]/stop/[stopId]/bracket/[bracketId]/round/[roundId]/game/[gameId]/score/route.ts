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

    const reportedTeamAScore = isTeamA ? myScore : opponentScore;
    const reportedTeamBScore = isTeamA ? opponentScore : myScore;

    const opponentReportedTeamAScore = game.teamASubmittedScore;
    const opponentReportedTeamBScore = game.teamBSubmittedScore;
    const opponentProvidedScores =
      opponentReportedTeamAScore !== null &&
      opponentReportedTeamAScore !== undefined &&
      opponentReportedTeamBScore !== null &&
      opponentReportedTeamBScore !== undefined;

    const canonicalMatch =
      opponentProvidedScores &&
      opponentReportedTeamAScore === reportedTeamAScore &&
      opponentReportedTeamBScore === reportedTeamBScore;

    const swappedMatch =
      opponentProvidedScores &&
      opponentReportedTeamAScore === reportedTeamBScore &&
      opponentReportedTeamBScore === reportedTeamAScore;

    if (canonicalMatch || swappedMatch) {
      const finalTeamAScore = reportedTeamAScore;
      const finalTeamBScore = reportedTeamBScore;

      await prisma.game.update({
        where: { id: gameId },
        data: {
          teamAScore: finalTeamAScore,
          teamBScore: finalTeamBScore,
          teamASubmittedScore: finalTeamAScore,
          teamBSubmittedScore: finalTeamBScore,
          teamAScoreSubmitted: true,
          teamBScoreSubmitted: true,
          isComplete: true,
          startedAt: game.startedAt ?? new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        confirmed: true,
        mismatch: false,
      });
    }

    if (isTeamA) {
      await prisma.game.update({
        where: { id: gameId },
        data: {
          teamASubmittedScore: reportedTeamAScore,
          teamAScoreSubmitted: true,
          teamAScore: reportedTeamAScore,
          teamBScore: reportedTeamBScore,
          teamBSubmittedScore: game.teamBSubmittedScore,
          startedAt: game.startedAt ?? new Date(),
        },
      });
    } else {
      await prisma.game.update({
        where: { id: gameId },
        data: {
          teamBSubmittedScore: reportedTeamBScore,
          teamBScoreSubmitted: true,
          teamAScore: reportedTeamAScore,
          teamBScore: reportedTeamBScore,
          teamASubmittedScore: game.teamASubmittedScore,
          startedAt: game.startedAt ?? new Date(),
        },
      });
    }

    const mySubmissionPayload = {
      teamAScore: reportedTeamAScore,
      teamBScore: reportedTeamBScore,
      perspective: isTeamA ? 'TEAM_A' : 'TEAM_B' as const,
    };

    return NextResponse.json({
      success: true,
      confirmed: false,
      mismatch: opponentProvidedScores,
      waitingForOpponent: !opponentProvidedScores,
      mySubmission: mySubmissionPayload,
      opponentSubmission: opponentProvidedScores
        ? {
            teamAScore: opponentReportedTeamAScore,
            teamBScore: opponentReportedTeamBScore,
          }
        : null,
      gameState: {
        myScore: isTeamA ? myScore : opponentScore,
        opponentScore: isTeamA ? opponentScore : myScore,
        mySubmittedScore: isTeamA ? reportedTeamAScore : game.teamASubmittedScore,
        opponentSubmittedScore: isTeamA ? game.teamBSubmittedScore : reportedTeamBScore,
      },
    });
  } catch (error) {
    console.error('Failed to submit score:', error);
    return NextResponse.json(
      { error: 'Failed to submit score' },
      { status: 500 }
    );
  }
}
