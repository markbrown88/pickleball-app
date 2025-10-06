import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ token: string; stopId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { token, stopId } = await params;

    // Validate token and get club
    const tournamentClub = await prisma.tournamentClub.findUnique({
      where: { captainAccessToken: token },
      select: {
        tournamentId: true,
        clubId: true
      }
    });

    if (!tournamentClub) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
    }

    // Get stop details with tournament info
    const stop = await prisma.stop.findUnique({
      where: { id: stopId },
      select: {
        id: true,
        name: true,
        lineupDeadline: true,
        startAt: true,
        endAt: true,
        tournamentId: true,
        tournament: {
          select: {
            name: true
          }
        },
        club: {
          select: {
            name: true
          }
        }
      }
    });

    if (!stop || stop.tournamentId !== tournamentClub.tournamentId) {
      return NextResponse.json({ error: 'Stop not found' }, { status: 404 });
    }

    // Get club info
    const club = await prisma.club.findUnique({
      where: { id: tournamentClub.clubId },
      select: { name: true }
    });

    // Get all brackets (tournament levels) and this club's teams
    const brackets = await prisma.tournamentBracket.findMany({
      where: {
        tournamentId: tournamentClub.tournamentId
      },
      orderBy: { idx: 'asc' },
      select: {
        id: true,
        name: true
      }
    });

    // Get this club's teams for each bracket
    const teams = await prisma.team.findMany({
      where: {
        tournamentId: tournamentClub.tournamentId,
        clubId: tournamentClub.clubId
      },
      select: {
        id: true,
        name: true,
        bracketId: true
      }
    });

    // Map brackets to teams
    const bracketsWithTeams = brackets.map(bracket => {
      const team = teams.find(t => t.bracketId === bracket.id);
      return {
        id: bracket.id,
        name: bracket.name,
        teamId: team?.id || '',
        teamName: team?.name || `${tournamentClub.clubId} - ${bracket.name}`
      };
    }).filter(b => b.teamId); // Only show brackets where club has a team

    return NextResponse.json({
      tournament: {
        name: stop.tournament.name
      },
      club: {
        name: club?.name || 'Your Club'
      },
      stop: {
        id: stop.id,
        name: stop.name,
        lineupDeadline: stop.lineupDeadline
      },
      brackets: bracketsWithTeams
    });
  } catch (error) {
    console.error('Stop details error:', error);
    return NextResponse.json(
      { error: 'Failed to load stop details' },
      { status: 500 }
    );
  }
}
