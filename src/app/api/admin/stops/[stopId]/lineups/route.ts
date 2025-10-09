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

    // Initialize grouped lineups
    const groupedLineups: Record<string, Record<string, any[]>> = {};

    // Get all matches for this stop with their lineups
    const matches = await prisma.match.findMany({
      where: {
        round: { stopId }
      },
      include: {
        teamA: { select: { id: true } },
        teamB: { select: { id: true } },
        round: {
          include: {
            lineups: {
              include: {
                entries: {
                  include: {
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
            }
          }
        }
      }
    });

    // Process lineups for each match
    for (const match of matches) {
      if (!match.teamA || !match.teamB) continue;

      const teamALineup: any[] = [];
      const teamBLineup: any[] = [];

      // Find lineups for this match's teams
      const teamALineupData = match.round.lineups.find(l => l.teamId === match.teamA!.id);
      const teamBLineupData = match.round.lineups.find(l => l.teamId === match.teamB!.id);

      // Process Team A lineup
      if (teamALineupData) {
        // Sort entries by slot to ensure correct order: MENS_DOUBLES, WOMENS_DOUBLES, MIXED_1, MIXED_2
        const sortedEntries = teamALineupData.entries.sort((a, b) => {
          const slotOrder = ['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_1', 'MIXED_2'];
          return slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot);
        });

        // Extract players in order: Man1, Man2, Woman1, Woman2
        for (const entry of sortedEntries) {
          if (entry.slot === 'MENS_DOUBLES') {
            teamALineup.push({
              id: entry.player1.id,
              name: entry.player1.name || `${entry.player1.firstName || ''} ${entry.player1.lastName || ''}`.trim(),
              gender: entry.player1.gender
            });
            teamALineup.push({
              id: entry.player2.id,
              name: entry.player2.name || `${entry.player2.firstName || ''} ${entry.player2.lastName || ''}`.trim(),
              gender: entry.player2.gender
            });
          } else if (entry.slot === 'WOMENS_DOUBLES') {
            teamALineup.push({
              id: entry.player1.id,
              name: entry.player1.name || `${entry.player1.firstName || ''} ${entry.player1.lastName || ''}`.trim(),
              gender: entry.player1.gender
            });
            teamALineup.push({
              id: entry.player2.id,
              name: entry.player2.name || `${entry.player2.firstName || ''} ${entry.player2.lastName || ''}`.trim(),
              gender: entry.player2.gender
            });
          }
        }
      }

      // Process Team B lineup
      if (teamBLineupData) {
        // Sort entries by slot to ensure correct order: MENS_DOUBLES, WOMENS_DOUBLES, MIXED_1, MIXED_2
        const sortedEntries = teamBLineupData.entries.sort((a, b) => {
          const slotOrder = ['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_1', 'MIXED_2'];
          return slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot);
        });

        // Extract players in order: Man1, Man2, Woman1, Woman2
        for (const entry of sortedEntries) {
          if (entry.slot === 'MENS_DOUBLES') {
            teamBLineup.push({
              id: entry.player1.id,
              name: entry.player1.name || `${entry.player1.firstName || ''} ${entry.player1.lastName || ''}`.trim(),
              gender: entry.player1.gender
            });
            teamBLineup.push({
              id: entry.player2.id,
              name: entry.player2.name || `${entry.player2.firstName || ''} ${entry.player2.lastName || ''}`.trim(),
              gender: entry.player2.gender
            });
          } else if (entry.slot === 'WOMENS_DOUBLES') {
            teamBLineup.push({
              id: entry.player1.id,
              name: entry.player1.name || `${entry.player1.firstName || ''} ${entry.player1.lastName || ''}`.trim(),
              gender: entry.player1.gender
            });
            teamBLineup.push({
              id: entry.player2.id,
              name: entry.player2.name || `${entry.player2.firstName || ''} ${entry.player2.lastName || ''}`.trim(),
              gender: entry.player2.gender
            });
          }
        }
      }

      // Only add if we have complete lineups (4 players each)
      if (teamALineup.length === 4 && teamBLineup.length === 4) {
        if (!groupedLineups[match.id]) {
          groupedLineups[match.id] = {};
        }

        groupedLineups[match.id][match.teamA.id] = teamALineup;
        groupedLineups[match.id][match.teamB.id] = teamBLineup;
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

    // Get all matches for this stop with their rounds
    const matches = await prisma.match.findMany({
      where: {
        round: { stopId }
      },
      include: {
        round: true,
        teamA: { select: { id: true } },
        teamB: { select: { id: true } }
      }
    });

    // Process all lineup saves in a single transaction
    await prisma.$transaction(async (tx) => {
      for (const [matchId, teams] of Object.entries(lineups)) {
        const match = matches.find(m => m.id === matchId);
        if (!match || !match.teamA || !match.teamB) continue;

        const teamA = (teams as any).teamA as any[];
        const teamB = (teams as any).teamB as any[];

        if (!Array.isArray(teamA) || !Array.isArray(teamB)) continue;

        // Process Team A lineup
        if (teamA.length >= 4) {
          // Delete existing lineup for this team in this round
          await tx.lineup.deleteMany({
            where: {
              roundId: match.roundId,
              teamId: match.teamA.id
            }
          });

          // Create new lineup
          const lineupA = await tx.lineup.create({
            data: {
              roundId: match.roundId,
              teamId: match.teamA.id,
              stopId: stopId
            }
          });

          // Create lineup entries
          await tx.lineupEntry.createMany({
            data: [
              {
                lineupId: lineupA.id,
                player1Id: teamA[0].id, // Man1
                player2Id: teamA[1].id, // Man2
                slot: 'MENS_DOUBLES'
              },
              {
                lineupId: lineupA.id,
                player1Id: teamA[2].id, // Woman1
                player2Id: teamA[3].id, // Woman2
                slot: 'WOMENS_DOUBLES'
              },
              {
                lineupId: lineupA.id,
                player1Id: teamA[0].id, // Man1
                player2Id: teamA[2].id, // Woman1
                slot: 'MIXED_1'
              },
              {
                lineupId: lineupA.id,
                player1Id: teamA[1].id, // Man2
                player2Id: teamA[3].id, // Woman2
                slot: 'MIXED_2'
              }
            ]
          });
        }

        // Process Team B lineup
        if (teamB.length >= 4) {
          // Delete existing lineup for this team in this round
          await tx.lineup.deleteMany({
            where: {
              roundId: match.roundId,
              teamId: match.teamB.id
            }
          });

          // Create new lineup
          const lineupB = await tx.lineup.create({
            data: {
              roundId: match.roundId,
              teamId: match.teamB.id,
              stopId: stopId
            }
          });

          // Create lineup entries
          await tx.lineupEntry.createMany({
            data: [
              {
                lineupId: lineupB.id,
                player1Id: teamB[0].id, // Man1
                player2Id: teamB[1].id, // Man2
                slot: 'MENS_DOUBLES'
              },
              {
                lineupId: lineupB.id,
                player1Id: teamB[2].id, // Woman1
                player2Id: teamB[3].id, // Woman2
                slot: 'WOMENS_DOUBLES'
              },
              {
                lineupId: lineupB.id,
                player1Id: teamB[0].id, // Man1
                player2Id: teamB[2].id, // Woman1
                slot: 'MIXED_1'
              },
              {
                lineupId: lineupB.id,
                player1Id: teamB[1].id, // Man2
                player2Id: teamB[3].id, // Woman2
                slot: 'MIXED_2'
              }
            ]
          });
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