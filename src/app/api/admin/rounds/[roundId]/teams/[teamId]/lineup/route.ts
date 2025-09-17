import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = { roundId: string; teamId: string };

function displayName(p: { firstName?: string | null; lastName?: string | null; name?: string | null }) {
  return p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Unknown';
}

export async function GET(_req: NextRequest, ctx: { params: Promise<Params> }) {
  // Use singleton prisma instance
  try {
    const { roundId, teamId } = await ctx.params;
    
    console.log('API received:', { roundId, teamId });
    
    // Verify round exists
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      select: { id: true, stopId: true }
    });
    
    if (!round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }
    
    console.log('Round found:', round);
    
    // Get or create lineup
    const lineup = await prisma.lineup.upsert({
      where: { roundId_teamId: { roundId, teamId } },
      update: {},
      create: { roundId, teamId, stopId: round.stopId },
      select: {
        id: true,
        teamId: true
      }
    });

    // Get team info and roster separately
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true
      }
    });

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Get team roster from TeamPlayer relationship
    const teamPlayers = await prisma.teamPlayer.findMany({
      where: { teamId },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            gender: true
          }
        }
      }
    });

    // Build roster from team players
    const roster = teamPlayers.map(tp => ({
      id: tp.player.id,
      firstName: tp.player.firstName || '',
      lastName: tp.player.lastName || '',
      name: tp.player.name || displayName(tp.player),
      gender: tp.player.gender
    }));

    // Load lineup entries
    const full = await prisma.lineup.findUnique({
      where: { id: lineup.id },
      include: {
        entries: {
          include: {
            player1: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                name: true,
                gender: true
              }
            },
            player2: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                name: true,
                gender: true
              }
            }
          }
        }
      }
    });

    // Build lineup data (4 players in order: Man1, Man2, Woman1, Woman2)
    const lineupPlayers = [];
    const entries = full.entries || [];
    
    // Extract players from entries - we need to reconstruct the 4-player lineup
    // from the stored pairs: [man1, man2], [woman1, woman2], [man1, woman1], [man2, woman2]
    if (entries.length >= 4) {
      // Men's doubles: entries[0] = [man1, man2]
      // Women's doubles: entries[1] = [woman1, woman2]  
      // Mixed 1: entries[2] = [man1, woman1]
      // Mixed 2: entries[3] = [man2, woman2]
      
      const menDoubles = entries[0];
      const womenDoubles = entries[1];
      
      if (menDoubles && womenDoubles) {
        lineupPlayers.push(
          menDoubles.player1,    // Man 1
          menDoubles.player2,    // Man 2
          womenDoubles.player1,  // Woman 1
          womenDoubles.player2   // Woman 2
        );
      }
    }
    
    return NextResponse.json({
      lineup: {
        id: full?.id || lineup.id,
        teamId: team.id,
        teamName: team.name,
        roster: roster,
        players: lineupPlayers // This will be the 4 selected players
      }
    });

  } catch (error) {
    console.error('Error in lineup API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// New endpoint for saving 4-player lineups
export async function POST(req: NextRequest, ctx: { params: Promise<Params> }) {
  // Use singleton prisma instance
  try {
    const { roundId, teamId } = await ctx.params;
    const body = await req.json();
    
    const { players } = body; // Array of 4 player IDs: [man1, man2, woman1, woman2]
    
    if (!Array.isArray(players) || players.length !== 4) {
      return NextResponse.json({ error: 'Exactly 4 players required' }, { status: 400 });
    }
    
    // Verify round exists
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      select: { id: true, stopId: true }
    });
    
    if (!round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }
    
    // Verify all players exist and are on the team
    const teamPlayers = await prisma.teamPlayer.findMany({
      where: { teamId },
      select: { playerId: true }
    });
    
    const teamPlayerIds = new Set(teamPlayers.map(tp => tp.playerId));
    const invalidPlayers = players.filter(id => !teamPlayerIds.has(id));
    
    if (invalidPlayers.length > 0) {
      return NextResponse.json({ 
        error: `Players not on team: ${invalidPlayers.join(', ')}` 
      }, { status: 400 });
    }
    
    // Save lineup using transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create or update lineup
      const lineup = await tx.lineup.upsert({
        where: { roundId_teamId: { roundId, teamId } },
        update: {},
        create: { roundId, teamId, stopId: round.stopId },
        select: { id: true }
      });
      
      // Clear existing entries
      await tx.lineupEntry.deleteMany({
        where: { lineupId: lineup.id }
      });
      
      // Create new entries for the 4 players
      // We'll store them as pairs: [man1, man2], [woman1, woman2], [man1, woman1], [man2, woman2]
      const entries = [
        { player1Id: players[0], player2Id: players[1] }, // Men's doubles
        { player1Id: players[2], player2Id: players[3] }, // Women's doubles  
        { player1Id: players[0], player2Id: players[2] }, // Mixed 1
        { player1Id: players[1], player2Id: players[3] }  // Mixed 2
      ];
      
      await tx.lineupEntry.createMany({
        data: entries.map(entry => ({
          lineupId: lineup.id,
          player1Id: entry.player1Id,
          player2Id: entry.player2Id
        }))
      });
      
      return lineup;
    });
    
    return NextResponse.json({ 
      success: true, 
      lineupId: result.id,
      message: 'Lineup saved successfully' 
    });
    
  } catch (error) {
    console.error('Error saving lineup:', error);
    return NextResponse.json({ error: 'Failed to save lineup' }, { status: 500 });
  }
}