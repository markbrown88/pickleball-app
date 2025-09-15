import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

    // Get all rounds for this stop with retry logic
    const rounds = await retryDatabaseOperation(() => 
      prisma.round.findMany({
        where: { stopId },
        select: { id: true }
      })
    );

    const roundIds = rounds.map(round => round.id);

    // Get all lineups for all rounds in this stop with retry logic
    const lineups = await retryDatabaseOperation(() => 
      prisma.lineup.findMany({
        where: {
          roundId: { in: roundIds }
        },
        include: {
          team: {
            select: {
              id: true,
              name: true
            }
          },
          entries: {
            include: {
              player1: {
                select: {
                  id: true,
                  name: true,
                  gender: true
                }
              },
              player2: {
                select: {
                  id: true,
                  name: true,
                  gender: true
                }
              }
            }
          }
        }
      })
    );

    // Group lineups by match and team
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
        lineup.entries.forEach(entry => {
          players.push({
            id: entry.player1.id,
            name: entry.player1.name,
            gender: entry.player1.gender
          });
          players.push({
            id: entry.player2.id,
            name: entry.player2.name,
            gender: entry.player2.gender
          });
        });
        
        // Take only the first 4 players to avoid duplicates
        groupedLineups[match.id][lineup.teamId] = players.slice(0, 4);
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
                  player2Id: players[i + 1].id
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