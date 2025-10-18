import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { LINEUP_SLOT_ORDER, mapLineupToEntries, normalizeSlot } from '@/lib/lineupSlots';
import type { GameSlot } from '@prisma/client';
import { evaluateMatchTiebreaker } from '@/lib/matchTiebreaker';

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

      const formatPlayer = (p: any) => p ? {
        id: p.id,
        name: p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim(),
        gender: p.gender,
      } : undefined;

      // Process Team A lineup
      if (teamALineupData) {
        const lineup = new Array(4).fill(undefined);
        for (const entry of teamALineupData.entries) {
          const p1 = entry.player1;
          const p2 = entry.player2;
          if (entry.slot === 'MENS_DOUBLES') {
            if (p1) lineup[0] = formatPlayer(p1);
            if (p2) lineup[1] = formatPlayer(p2);
          } else if (entry.slot === 'WOMENS_DOUBLES') {
            if (p1) lineup[2] = formatPlayer(p1);
            if (p2) lineup[3] = formatPlayer(p2);
          } else if (entry.slot === 'MIXED_1') {
            if (p1) lineup[p1.gender === 'MALE' ? 0 : 2] = formatPlayer(p1);
            if (p2) lineup[p2.gender === 'MALE' ? 0 : 2] = formatPlayer(p2);
          } else if (entry.slot === 'MIXED_2') {
            if (p1) lineup[p1.gender === 'MALE' ? 1 : 3] = formatPlayer(p1);
            if (p2) lineup[p2.gender === 'MALE' ? 1 : 3] = formatPlayer(p2);
          }
        }
        teamALineup.push(...lineup);
      }

      // Process Team B lineup
      if (teamBLineupData) {
        const lineup = new Array(4).fill(undefined);
        for (const entry of teamBLineupData.entries) {
          const p1 = entry.player1;
          const p2 = entry.player2;
          if (entry.slot === 'MENS_DOUBLES') {
            if (p1) lineup[0] = formatPlayer(p1);
            if (p2) lineup[1] = formatPlayer(p2);
          } else if (entry.slot === 'WOMENS_DOUBLES') {
            if (p1) lineup[2] = formatPlayer(p1);
            if (p2) lineup[3] = formatPlayer(p2);
          } else if (entry.slot === 'MIXED_1') {
            if (p1) lineup[p1.gender === 'MALE' ? 0 : 2] = formatPlayer(p1);
            if (p2) lineup[p2.gender === 'MALE' ? 0 : 2] = formatPlayer(p2);
          } else if (entry.slot === 'MIXED_2') {
            if (p1) lineup[p1.gender === 'MALE' ? 1 : 3] = formatPlayer(p1);
            if (p2) lineup[p2.gender === 'MALE' ? 1 : 3] = formatPlayer(p2);
          }
        }
        teamBLineup.push(...lineup);
      }

      // Add lineup data if at least one team has a complete lineup
      if (teamALineup.length > 0 || teamBLineup.length > 0) {
        if (!groupedLineups[match.id]) {
          groupedLineups[match.id] = {};
        }

        if (teamALineup.length > 0) {
          groupedLineups[match.id][match.teamA.id] = teamALineup;
        }
        if (teamBLineup.length > 0) {
          groupedLineups[match.id][match.teamB.id] = teamBLineup;
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

        const teamMap = teams as Record<string, any[]>;
        const teamA = teamMap[match.teamA.id] as any[] | undefined;
        const teamB = teamMap[match.teamB.id] as any[] | undefined;

        if (!Array.isArray(teamA) && !Array.isArray(teamB)) {
          continue;
        }

        // Process Team A lineup
        if (Array.isArray(teamA) && teamA.length >= 4) {
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
          const entries = mapLineupToEntries(teamA);
          await tx.lineupEntry.createMany({
            data: entries.map((entry) => ({
              lineupId: lineupA.id,
              slot: entry.slot as GameSlot,
              player1Id: entry.player1Id!,
              player2Id: entry.player2Id!,
            })),
          });
        }

        // Process Team B lineup
        if (Array.isArray(teamB) && teamB.length >= 4) {
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
          const entries = mapLineupToEntries(teamB);
          await tx.lineupEntry.createMany({
            data: entries.map((entry) => ({
              lineupId: lineupB.id,
              slot: entry.slot as GameSlot,
              player1Id: entry.player1Id!,
              player2Id: entry.player2Id!,
            })),
          });
        }

        await evaluateMatchTiebreaker(tx, match.id);
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