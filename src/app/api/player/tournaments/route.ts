import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEffectivePlayer, getActAsHeaderFromRequest } from '@/lib/actAs';

/**
 * GET /api/player/tournaments
 * Get tournaments where the current player has participated
 * Uses both TournamentRegistration (new system) and StopTeamPlayer (roster entries)
 */
export async function GET(req: NextRequest) {
  try {
    // Support Act As functionality
    const actAsPlayerId = getActAsHeaderFromRequest(req);
    const effectivePlayer = await getEffectivePlayer(actAsPlayerId);
    const playerId = effectivePlayer.targetPlayerId;

    // Find tournaments via registrations (new system)
    const registrations = await prisma.tournamentRegistration.findMany({
      where: {
        playerId,
        status: {
          in: ['REGISTERED', 'PENDING']
        }
      },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            type: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        registeredAt: 'desc'
      }
    });

    // Find tournaments via roster entries (StopTeamPlayer)
    const rosterEntries = await prisma.stopTeamPlayer.findMany({
      where: {
        playerId
      },
      include: {
        stop: {
          include: {
            tournament: {
              select: {
                id: true,
                name: true,
                type: true,
                createdAt: true
              }
            }
          },
          select: {
            id: true,
            name: true,
            startAt: true,
            endAt: true,
            tournament: true
          }
        },
        team: {
          select: {
            id: true,
            name: true,
            club: {
              select: {
                id: true,
                name: true,
                city: true,
                region: true
              }
            }
          }
        }
      }
    });

    // Combine tournaments from both sources
    const tournamentMap = new Map<string, any>();

    // Process registrations
    for (const reg of registrations) {
      if (!tournamentMap.has(reg.tournamentId)) {
        // Parse notes to get club and bracket info
        let clubId: string | null = null;
        let brackets: any[] = [];
        let stopIds: string[] = [];
        if (reg.notes) {
          try {
            const notes = JSON.parse(reg.notes);
            clubId = notes.clubId || null;
            brackets = notes.brackets || [];
            stopIds = notes.stopIds || [];
          } catch (e) {
            // Ignore parse errors
          }
        }

        // Get team info if available
        let teamInfo: any = null;
        if (clubId && brackets.length > 0) {
          const firstBracket = brackets[0];
          const team = await prisma.team.findFirst({
            where: {
              tournamentId: reg.tournamentId,
              clubId: clubId,
              bracketId: firstBracket.bracketId
            },
            select: {
              id: true,
              name: true,
              club: {
                select: {
                  id: true,
                  name: true,
                  city: true,
                  region: true
                }
              }
            }
          });
          if (team) {
            teamInfo = {
              id: team.id,
              name: team.name,
              club: team.club
            };
          }
        }

        // Get earliest stop date for sorting (prefer startAt, fallback to endAt)
        let sortDate = reg.registeredAt;
        if (stopIds.length > 0) {
          const stops = await prisma.stop.findMany({
            where: { id: { in: stopIds } },
            select: { startAt: true, endAt: true },
            orderBy: { startAt: 'asc' }
          });
          if (stops.length > 0 && stops[0].startAt) {
            sortDate = stops[0].startAt;
          } else if (stops.length > 0 && stops[0].endAt) {
            sortDate = stops[0].endAt;
          }
        }

        tournamentMap.set(reg.tournamentId, {
          id: reg.tournament.id,
          name: reg.tournament.name,
          type: reg.tournament.type,
          date: reg.registeredAt,
          sortDate: sortDate,
          team: teamInfo
        });
      }
    }

    // Process roster entries (may have team info even if no registration)
    for (const entry of rosterEntries) {
      const tournamentId = entry.stop.tournament.id;
      const stopDate = entry.stop.startAt || entry.stop.endAt || entry.createdAt;
      
      if (!tournamentMap.has(tournamentId)) {
        tournamentMap.set(tournamentId, {
          id: entry.stop.tournament.id,
          name: entry.stop.tournament.name,
          type: entry.stop.tournament.type,
          date: entry.createdAt,
          sortDate: stopDate,
          team: {
            id: entry.team.id,
            name: entry.team.name,
            club: entry.team.club
          }
        });
      } else {
        // Update existing entry with team info if missing
        const existing = tournamentMap.get(tournamentId);
        if (!existing.team && entry.team) {
          existing.team = {
            id: entry.team.id,
            name: entry.team.name,
            club: entry.team.club
          };
        }
        // Update sortDate if this stop is earlier (for better sorting)
        if (stopDate && (!existing.sortDate || new Date(stopDate) < new Date(existing.sortDate))) {
          existing.sortDate = stopDate;
        }
      }
    }

    // Convert map to array and sort by sortDate (current/upcoming first, then past)
    const now = new Date();
    const tournaments = Array.from(tournamentMap.values()).sort((a, b) => {
      const dateA = new Date(a.sortDate || a.date).getTime();
      const dateB = new Date(b.sortDate || b.date).getTime();
      const isAPast = dateA < now.getTime();
      const isBPast = dateB < now.getTime();
      
      // Current/upcoming tournaments first
      if (isAPast && !isBPast) return 1;
      if (!isAPast && isBPast) return -1;
      
      // Within same category, sort by date (most recent/upcoming first)
      return dateB - dateA;
    });

    return NextResponse.json({ tournaments });
  } catch (error) {
    console.error('Error fetching player tournaments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch player tournaments' },
      { status: 500 }
    );
  }
}



