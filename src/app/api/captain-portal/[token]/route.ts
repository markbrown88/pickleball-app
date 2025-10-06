import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ token: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { token } = await params;

    // Find tournament club by access token
    const tournamentClub = await prisma.tournamentClub.findUnique({
      where: { captainAccessToken: token },
      include: {
        tournament: {
          select: {
            id: true,
            name: true
          }
        },
        club: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!tournamentClub) {
      return NextResponse.json(
        { error: 'Invalid access token' },
        { status: 404 }
      );
    }

    // Get all stops for this tournament
    const stops = await prisma.stop.findMany({
      where: {
        tournamentId: tournamentClub.tournamentId
      },
      orderBy: { startAt: 'asc' },
      select: {
        id: true,
        name: true,
        startAt: true,
        endAt: true,
        lineupDeadline: true
      }
    });

    // For each stop, determine status and lineup completion
    const now = new Date();
    const stopsWithStatus = await Promise.all(
      stops.map(async (stop) => {
        // Determine status
        const stopStart = stop.startAt ? new Date(stop.startAt) : null;
        const stopEnd = stop.endAt ? new Date(stop.endAt) : null;

        let status: 'completed' | 'upcoming' | 'current' = 'upcoming';
        if (stopEnd && now > stopEnd) {
          status = 'completed';
        } else if (stopStart && now >= stopStart && (!stopEnd || now <= stopEnd)) {
          status = 'current';
        }

        // Check lineup completion for this club in this stop
        // A stop is complete if all games for all teams in all brackets have lineups
        const teams = await prisma.team.findMany({
          where: {
            tournamentId: tournamentClub.tournamentId,
            clubId: tournamentClub.clubId
          },
          select: { id: true }
        });

        const teamIds = teams.map(t => t.id);

        // Count total games and games with lineups for this club's teams
        const totalGames = await prisma.game.count({
          where: {
            match: {
              round: {
                stopId: stop.id
              },
              OR: [
                { teamAId: { in: teamIds } },
                { teamBId: { in: teamIds } }
              ]
            }
          }
        });

        // Get all games for this club's teams and check lineups
        const games = await prisma.game.findMany({
          where: {
            match: {
              round: {
                stopId: stop.id
              },
              OR: [
                { teamAId: { in: teamIds } },
                { teamBId: { in: teamIds } }
              ]
            }
          },
          select: {
            id: true,
            teamALineup: true,
            teamBLineup: true,
            match: {
              select: {
                teamAId: true,
                teamBId: true
              }
            }
          }
        });

        // Count games with lineups for this club
        const gamesWithLineups = games.filter(game => {
          const isTeamA = teamIds.includes(game.match.teamAId || '');
          const lineup = isTeamA ? game.teamALineup : game.teamBLineup;
          return lineup && Array.isArray(lineup) && lineup.length > 0;
        }).length;

        const lineupsComplete = totalGames > 0 && totalGames === gamesWithLineups;

        return {
          id: stop.id,
          name: stop.name,
          startAt: stop.startAt,
          lineupDeadline: stop.lineupDeadline,
          status,
          lineupsComplete
        };
      })
    );

    return NextResponse.json({
      tournament: {
        id: tournamentClub.tournament.id,
        name: tournamentClub.tournament.name
      },
      club: {
        id: tournamentClub.club.id,
        name: tournamentClub.club.name
      },
      stops: stopsWithStatus
    });
  } catch (error) {
    console.error('Captain portal error:', error);
    return NextResponse.json(
      { error: 'Failed to load captain portal data' },
      { status: 500 }
    );
  }
}
