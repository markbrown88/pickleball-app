import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { getEffectivePlayer, getActAsHeaderFromRequest } from '@/lib/actAs';

/**
 * GET /api/player/registrations
 * Get current user's tournament registrations (supports Act As)
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Support Act As functionality
    const actAsPlayerId = getActAsHeaderFromRequest(req);
    let effectivePlayer;
    
    try {
      effectivePlayer = await getEffectivePlayer(actAsPlayerId);
    } catch (actAsError) {
      console.log('Registrations API: Act As error, using real player:', actAsError);
      // If Act As fails, get the real player
      const realPlayer = await prisma.player.findUnique({
        where: { clerkUserId: userId },
        select: { id: true }
      });
      
      if (!realPlayer) {
        return NextResponse.json(
          { error: 'Player profile not found' },
          { status: 404 }
        );
      }
      
      effectivePlayer = {
        realUserId: userId,
        realPlayerId: realPlayer.id,
        isActingAs: false,
        targetPlayerId: realPlayer.id,
        isAppAdmin: false
      };
    }

    // Use the effective player ID (either real or acting as)
    const playerId = effectivePlayer.targetPlayerId;

    // Get player's tournament registrations (new registration system)
    const tournamentRegistrations = await prisma.tournamentRegistration.findMany({
      where: { playerId },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            type: true,
            registrationType: true,
            registrationCost: true,
          }
        }
      },
      orderBy: {
        registeredAt: 'desc',
      }
    });

    // Also get legacy team registrations for backwards compatibility
    const teamRegistrations = await prisma.teamPlayer.findMany({
      where: { playerId },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            bracket: {
              select: {
                name: true
              }
            }
          }
        },
        tournament: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      }
    });

    // Format new tournament registrations
    const formattedTournamentRegs = await Promise.all(tournamentRegistrations.map(async (reg) => {
      // Parse stopIds and brackets from notes
      let stopIds: string[] = [];
      let brackets: Array<{ stopId: string; bracketId: string; gameTypes?: string[] }> = [];
      if (reg.notes) {
        try {
          const notes = JSON.parse(reg.notes);
          stopIds = notes.stopIds || [];
          brackets = notes.brackets || [];
        } catch (e) {
          // Ignore parse errors
        }
      }

      // Fetch stop details
      const stops = stopIds.length > 0
        ? await prisma.stop.findMany({
            where: { id: { in: stopIds } },
            select: { id: true, name: true },
          })
        : [];

      // Fetch bracket details
      const bracketIds = brackets.map(b => b.bracketId).filter(Boolean);
      const bracketDetails = bracketIds.length > 0
        ? await prisma.tournamentBracket.findMany({
            where: { id: { in: bracketIds } },
            select: { id: true, name: true },
          })
        : [];

      // Create a map of bracket ID to name
      const bracketMap = new Map(bracketDetails.map(b => [b.id, b.name]));

      // Build stops with brackets information
      const stopsWithBrackets = stops.map(stop => {
        const stopBrackets = brackets
          .filter(b => b.stopId === stop.id)
          .map(b => ({
            bracketId: b.bracketId,
            bracketName: bracketMap.get(b.bracketId) || 'Unknown',
            gameTypes: b.gameTypes || [],
          }));
        return {
          stopId: stop.id,
          stopName: stop.name,
          brackets: stopBrackets,
        };
      });

      return {
        id: reg.id, // Registration ID
        tournamentId: reg.tournamentId,
        tournamentName: reg.tournament.name,
        tournamentType: reg.tournament.type,
        registrationType: reg.tournament.registrationType,
        status: reg.status, // REGISTERED, WITHDRAWN, REJECTED
        paymentStatus: reg.paymentStatus,
        amountPaid: reg.amountPaid, // in cents
        paymentId: reg.paymentId,
        refundId: reg.refundId,
        registeredAt: reg.registeredAt.toISOString(),
        withdrawnAt: reg.withdrawnAt?.toISOString() || null,
        stopIds: stopIds, // Array of stop IDs this registration covers
        stops: stopsWithBrackets, // Array of stops with bracket information
        teamId: '', // Not applicable for new registration system
        teamName: '', // Not applicable for new registration system
        bracket: '', // Not applicable for new registration system
      };
    }));

    // Format legacy team registrations
    const formattedTeamRegs = teamRegistrations.map(reg => ({
      tournamentId: reg.tournamentId,
      tournamentName: reg.tournament.name,
      tournamentType: reg.tournament.type,
      status: 'REGISTERED' as const,
      teamId: reg.team.id,
      teamName: reg.team.name,
      bracket: reg.team.bracket?.name || 'Unknown'
    }));

    // Combine both, prioritizing tournament registrations (new system)
    const allRegistrations = [...formattedTournamentRegs, ...formattedTeamRegs];
    
    // Remove duplicates (if both exist, keep tournament registration)
    const uniqueRegistrations = Array.from(
      new Map(allRegistrations.map(reg => [reg.tournamentId, reg])).values()
    );

    return NextResponse.json(uniqueRegistrations);
  } catch (error) {
    console.error('Error fetching player registrations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch registrations' },
      { status: 500 }
    );
  }
}

