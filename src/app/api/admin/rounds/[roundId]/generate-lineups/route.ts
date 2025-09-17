import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GameSlot, Gender } from '@prisma/client';

type Ctx = { params: Promise<{ roundId: string }> };

interface Player {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  gender: Gender;
  dupr?: number | null;
}

interface RosterPlayer extends Player {
  // Additional roster-specific fields if needed
}

interface LineupEntry {
  slot: GameSlot;
  player1Id: string;
  player2Id: string;
}

/**
 * Generate optimal lineups for all teams in a round based on their rosters
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { roundId } = await ctx.params;
    // Use singleton prisma instance

    // Get round and stop information
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        stop: {
          select: { id: true, tournamentId: true }
        }
      }
    });

    if (!round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    // Get all matches in this round
    const matches = await prisma.match.findMany({
      where: { roundId },
      include: {
        teamA: { select: { id: true, name: true } },
        teamB: { select: { id: true, name: true } }
      }
    });

    // Collect all team IDs
    const teamIds = new Set<string>();
    matches.forEach(match => {
      if (match.teamAId) teamIds.add(match.teamAId);
      if (match.teamBId) teamIds.add(match.teamBId);
    });

    if (teamIds.size === 0) {
      return NextResponse.json({ error: 'No teams found in this round' }, { status: 400 });
    }

    // Get rosters for all teams at this stop
    const rosters = await prisma.stopTeamPlayer.findMany({
      where: { 
        stopId: round.stopId, 
        teamId: { in: Array.from(teamIds) }
      },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            gender: true,
            dupr: true
          }
        }
      },
      orderBy: [{ teamId: 'asc' }, { createdAt: 'asc' }]
    });

    // Group rosters by team
    const rosterByTeam = new Map<string, RosterPlayer[]>();
    rosters.forEach(roster => {
      if (!rosterByTeam.has(roster.teamId)) {
        rosterByTeam.set(roster.teamId, []);
      }
      rosterByTeam.get(roster.teamId)!.push(roster.player);
    });

    // Generate lineups for each team
    const generatedLineups: Array<{
      teamId: string;
      teamName: string;
      entries: LineupEntry[];
    }> = [];

    for (const [teamId, teamRoster] of rosterByTeam) {
      const team = matches.find(m => m.teamAId === teamId || m.teamBId === teamId);
      const teamName = team?.teamAId === teamId ? team.teamA?.name : team?.teamB?.name || 'Unknown Team';
      
      const lineup = generateOptimalLineup(teamRoster);
      generatedLineups.push({
        teamId,
        teamName,
        entries: lineup
      });
    }

    // Save lineups to database
    const savedLineups = [];
    for (const lineup of generatedLineups) {
      // Find the match for this team
      const match = matches.find(m => m.teamAId === lineup.teamId || m.teamBId === lineup.teamId);
      if (!match) continue;

      // Create or update lineup
      const lineupRecord = await prisma.lineup.upsert({
        where: {
          roundId_teamId: {
            roundId,
            teamId: lineup.teamId
          }
        },
        update: {},
        create: {
          roundId,
          teamId: lineup.teamId,
          stopId: round.stopId
        },
        select: { id: true }
      });

      // Clear existing entries
      await prisma.lineupEntry.deleteMany({
        where: { lineupId: lineupRecord.id }
      });

      // Create new entries
      if (lineup.entries.length > 0) {
        await prisma.lineupEntry.createMany({
          data: lineup.entries.map(entry => ({
            lineupId: lineupRecord.id,
            slot: entry.slot,
            player1Id: entry.player1Id,
            player2Id: entry.player2Id
          }))
        });
      }

      savedLineups.push({
        teamId: lineup.teamId,
        teamName: lineup.teamName,
        entries: lineup.entries
      });
    }

    return NextResponse.json({
      success: true,
      message: `Generated lineups for ${savedLineups.length} teams`,
      lineups: savedLineups
    });

  } catch (error) {
    console.error('Error generating lineups:', error);
    return NextResponse.json(
      { error: 'Failed to generate lineups' },
      { status: 500 }
    );
  }
}

/**
 * Generate an optimal lineup for a team based on their roster
 */
function generateOptimalLineup(roster: RosterPlayer[]): LineupEntry[] {
  if (roster.length < 4) {
    return []; // Need exactly 4 players (2 men, 2 women)
  }

  // Separate players by gender
  const malePlayers = roster.filter(p => p.gender === 'MALE');
  const femalePlayers = roster.filter(p => p.gender === 'FEMALE');

  if (malePlayers.length < 2 || femalePlayers.length < 2) {
    return []; // Need at least 2 men and 2 women
  }

  // Sort players by DUPR (higher is better) or by name if no DUPR
  const sortPlayers = (players: RosterPlayer[]) => {
    return [...players].sort((a, b) => {
      if (a.dupr && b.dupr) {
        return b.dupr - a.dupr; // Higher DUPR first
      }
      if (a.dupr && !b.dupr) return -1;
      if (!a.dupr && b.dupr) return 1;
      // If no DUPR, sort by name
      const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.name || '';
      const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim() || b.name || '';
      return nameA.localeCompare(nameB);
    });
  };

  const sortedMales = sortPlayers(malePlayers);
  const sortedFemales = sortPlayers(femalePlayers);

  // Select the top 2 men and top 2 women
  const man1 = sortedMales[0];
  const man2 = sortedMales[1];
  const woman1 = sortedFemales[0];
  const woman2 = sortedFemales[1];

  const entries: LineupEntry[] = [];

  // Men's Doubles: Man 1 vs Man 1, Man 2 vs Man 2 (opposing teams)
  entries.push({
    slot: 'MENS_DOUBLES',
    player1Id: man1.id,
    player2Id: man2.id
  });

  // Women's Doubles: Woman 1 vs Woman 1, Woman 2 vs Woman 2 (opposing teams)
  entries.push({
    slot: 'WOMENS_DOUBLES',
    player1Id: woman1.id,
    player2Id: woman2.id
  });

  // Mixed Doubles 1: Man 1 + Woman 1 vs Man 1 + Woman 1 (opposing teams)
  entries.push({
    slot: 'MIXED_1',
    player1Id: man1.id,
    player2Id: woman1.id
  });

  // Mixed Doubles 2: Man 2 + Woman 2 vs Man 2 + Woman 2 (opposing teams)
  entries.push({
    slot: 'MIXED_2',
    player1Id: man2.id,
    player2Id: woman2.id
  });

  // Tiebreaker - use the best remaining players
  const usedPlayers = new Set([man1.id, man2.id, woman1.id, woman2.id]);
  const availablePlayers = roster.filter(p => !usedPlayers.has(p.id));
  
  if (availablePlayers.length >= 2) {
    const sortedAvailable = sortPlayers(availablePlayers);
    entries.push({
      slot: 'TIEBREAKER',
      player1Id: sortedAvailable[0].id,
      player2Id: sortedAvailable[1].id
    });
  }

  return entries;
}
