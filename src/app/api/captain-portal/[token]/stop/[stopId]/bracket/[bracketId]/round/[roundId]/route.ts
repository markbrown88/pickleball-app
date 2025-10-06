import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type Params = {
  params: Promise<{
    token: string;
    stopId: string;
    bracketId: string;
    roundId: string;
  }>;
};

export async function GET(request: Request, { params }: Params) {
  try {
    const { token, stopId, bracketId, roundId } = await params;

    // Validate token and get club
    const tournamentClub = await prisma.tournamentClub.findUnique({
      where: { captainAccessToken: token },
      select: { tournamentId: true, clubId: true }
    });

    if (!tournamentClub) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
    }

    // Get the team for this club in this bracket
    const team = await prisma.team.findFirst({
      where: {
        tournamentId: tournamentClub.tournamentId,
        clubId: tournamentClub.clubId,
        bracketId: bracketId
      },
      include: {
        tournament: { select: { name: true } },
        club: { select: { name: true } },
        bracket: { select: { name: true } }
      }
    });

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Get the round with matches
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        matches: {
          where: {
            OR: [{ teamAId: team.id }, { teamBId: team.id }]
          },
          include: {
            teamA: { select: { id: true, name: true } },
            teamB: { select: { id: true, name: true } },
            games: {
              select: {
                id: true,
                slot: true,
                teamALineup: true,
                teamBLineup: true,
                teamAScore: true,
                teamBScore: true,
                teamASubmittedScore: true,
                teamBSubmittedScore: true,
                teamAScoreSubmitted: true,
                teamBScoreSubmitted: true,
                isComplete: true,
                startedAt: true
              }
            }
          }
        },
        stop: {
          select: {
            id: true,
            name: true,
            lineupDeadline: true
          }
        }
      }
    });

    if (!round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    // Get stop roster (players available for lineup selection)
    const stopTeamPlayers = await prisma.stopTeamPlayer.findMany({
      where: {
        stopId: stopId,
        teamId: team.id
      },
      include: {
        player: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            gender: true
          }
        }
      }
    });

    const roster = stopTeamPlayers.map(stp => ({
      id: stp.player.id,
      name: stp.player.name || `${stp.player.firstName || ''} ${stp.player.lastName || ''}`.trim(),
      gender: stp.player.gender
    }));

    // Enrich lineups with player names
    const enrichLineup = (lineup: any) => {
      if (!lineup || !Array.isArray(lineup)) return [];
      const players: any[] = [];
      lineup.forEach((entry: any) => {
        if (entry.player1Id) {
          const player = roster.find(p => p.id === entry.player1Id);
          if (player) players.push(player);
        }
        if (entry.player2Id) {
          const player = roster.find(p => p.id === entry.player2Id);
          if (player) players.push(player);
        }
      });
      return players;
    };

    // Process matches
    const match = round.matches[0]; // Should only be one match per round for this team
    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    const isTeamA = match.teamAId === team.id;
    const opponentTeam = isTeamA ? match.teamB : match.teamA;

    // Check if deadline has passed
    const now = new Date();
    const deadline = round.stop.lineupDeadline ? new Date(round.stop.lineupDeadline) : null;
    const deadlinePassed = deadline ? now > deadline : false;

    // Enrich games with player info
    const enrichedGames = match.games.map(game => ({
      id: game.id,
      slot: game.slot,
      myLineup: enrichLineup(isTeamA ? game.teamALineup : game.teamBLineup),
      opponentLineup: deadlinePassed ? enrichLineup(isTeamA ? game.teamBLineup : game.teamALineup) : null,
      myScore: isTeamA ? game.teamAScore : game.teamBScore,
      opponentScore: isTeamA ? game.teamBScore : game.teamAScore,
      mySubmittedScore: isTeamA ? game.teamASubmittedScore : game.teamBSubmittedScore,
      opponentSubmittedScore: isTeamA ? game.teamBSubmittedScore : game.teamASubmittedScore,
      myScoreSubmitted: isTeamA ? game.teamAScoreSubmitted : game.teamBScoreSubmitted,
      opponentScoreSubmitted: isTeamA ? game.teamBScoreSubmitted : game.teamAScoreSubmitted,
      isComplete: game.isComplete,
      startedAt: game.startedAt
    }));

    return NextResponse.json({
      tournament: {
        name: team.tournament.name
      },
      bracket: {
        name: team.bracket?.name || 'Main'
      },
      stop: {
        name: round.stop.name
      },
      round: {
        id: round.id,
        name: round.name,
        idx: round.idx
      },
      myTeam: {
        id: team.id,
        name: team.name || team.club?.name || 'Your Team'
      },
      match: {
        id: match.id,
        opponentTeam: {
          id: opponentTeam?.id,
          name: opponentTeam?.name
        }
      },
      games: enrichedGames,
      roster,
      deadlinePassed,
      isTeamA
    });
  } catch (error) {
    console.error('Captain portal round error:', error);
    return NextResponse.json(
      { error: 'Failed to load round data' },
      { status: 500 }
    );
  }
}
