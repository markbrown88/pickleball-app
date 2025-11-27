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

    // Get all matches for this stop with their lineups and games
    const matches = await prisma.match.findMany({
      where: {
        round: { stopId }
      },
      include: {
        teamA: { select: { id: true } },
        teamB: { select: { id: true } },
        games: { select: { bracketId: true } },
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

    const formatPlayer = (p: any) => p ? {
      id: p.id,
      name: p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim(),
      gender: p.gender,
    } : undefined;

    const formatLineup = (lineupData: any) => {
      const lineup = new Array(4).fill(undefined);

      const mensDoubles = lineupData.entries.find((e: any) => e.slot === 'MENS_DOUBLES');
      const womensDoubles = lineupData.entries.find((e: any) => e.slot === 'WOMENS_DOUBLES');

      if (mensDoubles) {
        if (mensDoubles.player1) lineup[0] = formatPlayer(mensDoubles.player1);
        if (mensDoubles.player2) lineup[1] = formatPlayer(mensDoubles.player2);
      }

      if (womensDoubles) {
        if (womensDoubles.player1) lineup[2] = formatPlayer(womensDoubles.player1);
        if (womensDoubles.player2) lineup[3] = formatPlayer(womensDoubles.player2);
      }

      return lineup;
    };

    // Process lineups for each match
    for (const match of matches) {
      if (!match.teamA || !match.teamB) continue;

      // Check if this match has bracket-aware games
      const bracketIds = [...new Set(match.games.map(g => g.bracketId).filter(Boolean))];
      const hasBrackets = bracketIds.length > 0;

      if (hasBrackets) {
        // For bracket-aware matches, group lineups by bracketId
        // Find ALL lineups for this round with matching bracketIds (not just match.teamA/teamB)
        for (const bracketId of bracketIds) {
          const bracketLineups = match.round.lineups.filter(l => l.bracketId === bracketId);

          if (bracketLineups.length > 0) {
            if (!groupedLineups[bracketId!]) {
              groupedLineups[bracketId!] = {};
            }

            // Add all lineups for this bracket
            for (const lineupData of bracketLineups) {
              groupedLineups[bracketId!][lineupData.teamId] = formatLineup(lineupData);
            }
          }
        }
      } else {
        // For non-bracket matches, use matchId as key (backwards compatibility)
        const teamALineupData = match.round.lineups.find(l =>
          l.teamId === match.teamA!.id && !l.bracketId
        );
        const teamBLineupData = match.round.lineups.find(l =>
          l.teamId === match.teamB!.id && !l.bracketId
        );

        if (teamALineupData || teamBLineupData) {
          if (!groupedLineups[match.id]) {
            groupedLineups[match.id] = {};
          }

          if (teamALineupData) {
            groupedLineups[match.id][match.teamA.id] = formatLineup(teamALineupData);
          }
          if (teamBLineupData) {
            groupedLineups[match.id][match.teamB.id] = formatLineup(teamBLineupData);
          }
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
    const { lineups, bracketId } = await request.json();

    // Get all matches for this stop with their rounds and games
    const matches = await prisma.match.findMany({
      where: {
        round: { stopId }
      },
      include: {
        round: true,
        teamA: { select: { id: true } },
        teamB: { select: { id: true } },
        games: { select: { bracketId: true } }
      }
    });

    // Process all lineup saves in a single transaction
    await prisma.$transaction(async (tx) => {
      for (const [key, teams] of Object.entries(lineups)) {
        // Key can be either matchId (for regular tournaments) or bracketId (for DE Clubs)
        const teamMap = teams as Record<string, any[]>;

        // Determine if this is bracket-aware by checking if key matches a bracketId
        const isBracketAware = bracketId || matches.some(m => m.games.some(g => g.bracketId === key));

        let match;
        let currentBracketId: string | null = null;

        if (isBracketAware) {
          // For bracket-aware lineups, find a match that has games with this bracketId
          currentBracketId = key;
          match = matches.find(m => m.games.some(g => g.bracketId === key));
        } else {
          // For regular lineups, use matchId
          match = matches.find(m => m.id === key);
        }

        if (!match) continue;

        // For bracket-aware lineups, process each team in the teamMap directly
        // (don't rely on match.teamA/teamB as they may be from a different bracket)
        if (isBracketAware) {
          console.log(`[Lineup Save] Bracket-aware save for bracketId: ${currentBracketId}, matchId: ${match.id}`);
          console.log(`[Lineup Save] Teams in teamMap:`, Object.keys(teamMap));

          for (const [teamId, lineup] of Object.entries(teamMap)) {
            if (!Array.isArray(lineup) || lineup.length < 4) {
              console.log(`[Lineup Save] Skipping teamId ${teamId} - invalid lineup length: ${Array.isArray(lineup) ? lineup.length : 'not array'}`);
              continue;
            }

            console.log(`[Lineup Save] Saving lineup for teamId: ${teamId}, bracketId: ${currentBracketId}, roundId: ${match.roundId}`);
            console.log(`[Lineup Save] Players:`, lineup.map((p: any) => p?.name || p?.id));

            // Delete existing lineup for this team/round/bracket combination
            await tx.lineup.deleteMany({
              where: {
                roundId: match.roundId,
                teamId: teamId,
                bracketId: currentBracketId
              }
            });

            // Create new lineup
            const newLineup = await tx.lineup.create({
              data: {
                roundId: match.roundId,
                teamId: teamId,
                bracketId: currentBracketId,
                stopId: stopId
              }
            });

            console.log(`[Lineup Save] Created lineup record with id: ${newLineup.id}`);

            // Create lineup entries
            const entries = mapLineupToEntries(lineup);
            await tx.lineupEntry.createMany({
              data: entries.map((entry) => ({
                lineupId: newLineup.id,
                slot: entry.slot as GameSlot,
                player1Id: entry.player1Id!,
                player2Id: entry.player2Id!,
              })),
            });

            console.log(`[Lineup Save] Created ${entries.length} lineup entries`);
          }

          await evaluateMatchTiebreaker(tx, match.id);
          continue; // Skip the non-bracket-aware processing below
        }

        // Non-bracket-aware processing (original logic)
        if (!match.teamA || !match.teamB) continue;

        // Get the team lineups from the teamMap
        const teamAId = match.teamA.id;
        const teamBId = match.teamB.id;
        const teamA = teamMap[teamAId] as any[] | undefined;
        const teamB = teamMap[teamBId] as any[] | undefined;

        if (!Array.isArray(teamA) && !Array.isArray(teamB)) {
          continue;
        }

        // Process Team A lineup
        if (Array.isArray(teamA) && teamA.length >= 4) {
          // Delete existing lineup for this team/round/bracket combination
          await tx.lineup.deleteMany({
            where: {
              roundId: match.roundId,
              teamId: teamAId,
              bracketId: currentBracketId
            }
          });

          // Create new lineup
          const lineupA = await tx.lineup.create({
            data: {
              roundId: match.roundId,
              teamId: teamAId,
              bracketId: currentBracketId,
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
          // Delete existing lineup for this team/round/bracket combination
          await tx.lineup.deleteMany({
            where: {
              roundId: match.roundId,
              teamId: teamBId,
              bracketId: currentBracketId
            }
          });

          // Create new lineup
          const lineupB = await tx.lineup.create({
            data: {
              roundId: match.roundId,
              teamId: teamBId,
              bracketId: currentBracketId,
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