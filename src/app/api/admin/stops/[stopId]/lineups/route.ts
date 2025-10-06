import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { GameSlot } from '@prisma/client';

// Retry function for database operations
async function retryDatabaseOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.log(`Database operation failed, retrying in ${delay}ms... (attempt ${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
  throw new Error('Max retries exceeded');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ stopId: string }> }
) {
  try {
    const { stopId } = await params;

    // Get all lineups for this stop from Lineup/LineupEntry tables
    const lineups = await prisma.lineup.findMany({
      where: {
        round: { stopId }
      },
      include: {
        team: { select: { id: true, name: true } },
        round: { select: { id: true } },
        entries: {
          select: {
            id: true,
            player1Id: true,
            player2Id: true,
            player1: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                gender: true
              }
            },
            player2: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                gender: true
              }
            }
          }
        }
      }
    });

    // Find matches for each lineup
    const groupedLineups: Record<string, Record<string, any[]>> = {};

    for (const lineup of lineups) {
      // Find the match for this lineup
      const match = await prisma.match.findFirst({
        where: {
          roundId: lineup.roundId,
          OR: [
            { teamAId: lineup.teamId },
            { teamBId: lineup.teamId }
          ]
        },
        select: { id: true }
      });

      if (match) {
        if (!groupedLineups[match.id]) {
          groupedLineups[match.id] = {};
        }

        // Convert entries to player array (each entry has 2 players)
        const players: any[] = [];
        lineup.entries.forEach((entry: any) => {
          players.push({
            id: entry.player1.id,
            name: entry.player1.name || `${entry.player1.firstName} ${entry.player1.lastName}`,
            gender: entry.player1.gender
          });
          players.push({
            id: entry.player2.id,
            name: entry.player2.name || `${entry.player2.firstName} ${entry.player2.lastName}`,
            gender: entry.player2.gender
          });
        });

        // Take only the first 4 players to avoid duplicates
        groupedLineups[match.id][lineup.teamId] = players.slice(0, 4);
      }
    }

    // ALSO check for lineups saved directly in Game table (from Captain Portal)
    const matches = await prisma.match.findMany({
      where: {
        round: { stopId }
      },
      include: {
        games: {
          select: {
            id: true,
            slot: true,
            teamALineup: true,
            teamBLineup: true
          }
        },
        teamA: { select: { id: true } },
        teamB: { select: { id: true } }
      }
    });

    // Get all unique player IDs from game lineups
    const allPlayerIds = new Set<string>();
    matches.forEach(match => {
      match.games.forEach(game => {
        const teamALineup = game.teamALineup as any[];
        const teamBLineup = game.teamBLineup as any[];

        if (teamALineup) {
          teamALineup.forEach((entry: any) => {
            if (entry.player1Id) allPlayerIds.add(entry.player1Id);
            if (entry.player2Id) allPlayerIds.add(entry.player2Id);
          });
        }

        if (teamBLineup) {
          teamBLineup.forEach((entry: any) => {
            if (entry.player1Id) allPlayerIds.add(entry.player1Id);
            if (entry.player2Id) allPlayerIds.add(entry.player2Id);
          });
        }
      });
    });

    // Fetch player details in batch
    const players = await prisma.player.findMany({
      where: { id: { in: Array.from(allPlayerIds) } },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        gender: true
      }
    });

    const playerMap = new Map(players.map(p => [p.id, {
      id: p.id,
      name: p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim(),
      gender: p.gender
    }]));

    // Extract lineups from games and merge with existing lineups
    for (const match of matches) {
      const teamAPlayers = new Set<string>();
      const teamBPlayers = new Set<string>();

      // Collect all unique players from all games for each team
      match.games.forEach(game => {
        const teamALineup = game.teamALineup as any[];
        const teamBLineup = game.teamBLineup as any[];

        if (teamALineup) {
          teamALineup.forEach((entry: any) => {
            if (entry.player1Id) teamAPlayers.add(entry.player1Id);
            if (entry.player2Id) teamAPlayers.add(entry.player2Id);
          });
        }

        if (teamBLineup) {
          teamBLineup.forEach((entry: any) => {
            if (entry.player1Id) teamBPlayers.add(entry.player1Id);
            if (entry.player2Id) teamBPlayers.add(entry.player2Id);
          });
        }
      });

      // Only add if we have a complete lineup (4 players)
      if (teamAPlayers.size === 4 || teamBPlayers.size === 4) {
        if (!groupedLineups[match.id]) {
          groupedLineups[match.id] = {};
        }

        if (teamAPlayers.size === 4) {
          groupedLineups[match.id][match.teamA.id] = Array.from(teamAPlayers)
            .map(id => playerMap.get(id))
            .filter(Boolean);
        }

        if (teamBPlayers.size === 4) {
          groupedLineups[match.id][match.teamB.id] = Array.from(teamBPlayers)
            .map(id => playerMap.get(id))
            .filter(Boolean);
        }
      }
    }

    return NextResponse.json(groupedLineups);
  } catch (error) {
    console.error('Error loading lineups for stop:', error);
    return NextResponse.json(
      { error: 'Failed to load lineups' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ stopId: string }> }
) {
  try {
    const { stopId } = await params;
    const { lineups } = await request.json();

    // Get all rounds for this stop
    const rounds = await prisma.round.findMany({
      where: { stopId },
      include: {
        matches: {
          select: { id: true, teamAId: true, teamBId: true }
        }
      }
    });

    // Create a map of match ID to round ID
    const matchToRound: Record<string, string> = {};
    rounds.forEach(round => {
      round.matches.forEach(match => {
        matchToRound[match.id] = round.id;
      });
    });

    // Process all lineup saves in a single transaction
    await prisma.$transaction(async (tx) => {
      for (const [matchId, teams] of Object.entries(lineups)) {
        const roundId = matchToRound[matchId];
        if (!roundId) continue;

        for (const [teamId, players] of Object.entries(teams as any)) {
          if (!Array.isArray(players) || players.length === 0) continue;

          // Upsert the lineup
          const lineup = await tx.lineup.upsert({
            where: {
              roundId_teamId: {
                roundId,
                teamId
              }
            },
            update: {},
            create: {
              roundId,
              teamId
            }
          });

          // Clear existing lineup entries
          await tx.lineupEntry.deleteMany({
            where: { lineupId: lineup.id }
          });

          // Create new lineup entries (2 players per entry)
          if (players.length > 0) {
            const entries = [];
            for (let i = 0; i < players.length; i += 2) {
              if (i + 1 < players.length) {
                entries.push({
                  lineupId: lineup.id,
                  player1Id: players[i].id,
                  player2Id: players[i + 1].id,
                  slot: (['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_1', 'MIXED_2'] as GameSlot[])[Math.floor(i / 2)]
                });
              }
            }
            
            if (entries.length > 0) {
              await tx.lineupEntry.createMany({
                data: entries
              });
            }
          }
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving lineups for stop:', error);
    return NextResponse.json(
      { error: 'Failed to save lineups' },
      { status: 500 }
    );
  }
}