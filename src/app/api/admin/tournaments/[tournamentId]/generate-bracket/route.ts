/**
 * Generate Bracket API
 *
 * POST /api/admin/tournaments/[tournamentId]/generate-bracket
 *
 * Generates a complete double elimination bracket for a tournament.
 * Requires tournament teams to be seeded first.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateDoubleEliminationBracket } from '@/lib/brackets';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const { tournamentId } = await params;
    const body = await request.json();
    const {
      stopId,
      gamesPerMatch = 3,
      gameSlots = ['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_1', 'MIXED_2'],
      teams: selectedTeams = [], // Teams with seeding from UI (for DOUBLE_ELIMINATION)
      clubs: selectedClubs = [] // Clubs with seeding from UI (for DOUBLE_ELIMINATION_CLUBS)
    } = body;

    // Get tournament
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      );
    }

    if (tournament.type !== 'DOUBLE_ELIMINATION' && tournament.type !== 'DOUBLE_ELIMINATION_CLUBS') {
      return NextResponse.json(
        { error: 'Tournament must be DOUBLE_ELIMINATION or DOUBLE_ELIMINATION_CLUBS type' },
        { status: 400 }
      );
    }

    const isClubBased = tournament.type === 'DOUBLE_ELIMINATION_CLUBS';

    // For club-based tournaments, use gamesPerMatch from tournament settings
    // For team-based tournaments, use from request body or default
    const finalGamesPerMatch = isClubBased
      ? (tournament.gamesPerMatch || 3)
      : gamesPerMatch;

    const finalGameSlots = isClubBased
      ? (gameSlots) // Use default game slots for now, could be stored in tournament config later
      : gameSlots;

    let orderedTeams: any[] = [];

    if (isClubBased) {
      // For club-based tournaments, validate clubs and get their teams
      if (!selectedClubs || selectedClubs.length < 2) {
        return NextResponse.json(
          { error: 'At least 2 clubs are required to generate bracket' },
          { status: 400 }
        );
      }

      // Get all teams for the selected clubs
      const clubIds = selectedClubs.map((c: any) => c.id);
      const clubTeams = await prisma.team.findMany({
        where: {
          clubId: { in: clubIds },
          tournamentId,
        },
        orderBy: { id: 'asc' }, // Consistent ordering
      });

      if (clubTeams.length === 0) {
        return NextResponse.json(
          { error: 'No teams found for selected clubs' },
          { status: 400 }
        );
      }

      // For club-based tournaments, we create one "team" entry per club for the bracket
      // Each club's bracket teams will compete in their respective brackets
      // The "team" in the bracket represents the club as a whole
      // We'll use the first team of each club as the representative
      orderedTeams = selectedClubs.map((selectedClub: any) => {
        // Find the first team for this club
        const clubTeam = clubTeams.find(t => t.clubId === selectedClub.id);
        return {
          id: clubTeam?.id || selectedClub.id,
          clubId: selectedClub.id,
          seed: selectedClub.seed,
          name: selectedClub.name || clubTeam?.name || selectedClub.fullName || 'Club',
          tournamentId,
        };
      });
    } else {
      // For regular team tournaments, use teams from request body (already seeded)
      if (!selectedTeams || selectedTeams.length < 2) {
        return NextResponse.json(
          { error: 'At least 2 teams are required to generate bracket' },
          { status: 400 }
        );
      }

      // Verify all teams exist and fetch their details
      const teamIds = selectedTeams.map((t: any) => t.id);
      const existingTeams = await prisma.team.findMany({
        where: {
          id: { in: teamIds },
          tournamentId,
        },
      });

      if (existingTeams.length !== teamIds.length) {
        return NextResponse.json(
          { error: 'One or more teams not found' },
          { status: 400 }
        );
      }

      // Map teams to match the seeding order from the UI
      orderedTeams = selectedTeams.map((selectedTeam: any) => {
        const team = existingTeams.find(t => t.id === selectedTeam.id);
        return {
          ...team,
          seed: selectedTeam.seed,
        };
      });
    }

    // Get or create stop
    let stop = stopId
      ? await prisma.stop.findUnique({ where: { id: stopId } })
      : await prisma.stop.findFirst({ where: { tournamentId } });

    if (!stop) {
      // Create default stop
      stop = await prisma.stop.create({
        data: {
          name: 'Main Bracket',
          tournamentId,
          startAt: new Date(),
        },
      });
    }

    // Delete any existing rounds/matches/games for this stop to avoid unique constraint errors
    // This allows regenerating the bracket
    // First, find all rounds for this stop
    const existingRounds = await prisma.round.findMany({
      where: { stopId: stop.id },
      select: { id: true },
    });

    if (existingRounds.length > 0) {
      const roundIds = existingRounds.map(r => r.id);

      // Find all matches in these rounds
      const existingMatches = await prisma.match.findMany({
        where: { roundId: { in: roundIds } },
        select: { id: true },
      });

      if (existingMatches.length > 0) {
        const matchIds = existingMatches.map(m => m.id);

        // Delete games first
        await prisma.game.deleteMany({
          where: { matchId: { in: matchIds } },
        });

        // Delete matches
        await prisma.match.deleteMany({
          where: { id: { in: matchIds } },
        });
      }

      // Finally delete rounds
      await prisma.round.deleteMany({
        where: { id: { in: roundIds } },
      });
    }

    // Generate bracket structure
    const bracket = generateDoubleEliminationBracket({
      tournamentId,
      stopId: stop.id,
      teams: orderedTeams,
      gamesPerMatch: finalGamesPerMatch,
      gameSlots: finalGameSlots as any[],
    });

    // Create rounds and matches in database
    const createdRounds = [];
    const matchIdMap = new Map<string, string>(); // Map generated match ID to DB match ID
    const pendingLinkUpdates: Array<{
      dbMatchId: string;
      sourceMatchAId?: string | null;
      sourceMatchBId?: string | null;
    }> = [];

    for (const round of bracket.rounds) {
      // Create round
      const dbRound = await prisma.round.create({
        data: {
          stopId: stop.id,
          idx: round.idx,
          bracketType: round.bracketType,
          depth: round.depth,
        },
      });

      // Create matches for this round
      for (const match of round.matches) {
        const dbMatch = await prisma.match.create({
          data: {
            roundId: dbRound.id,
            teamAId: match.teamAId,
            teamBId: match.teamBId,
            seedA: match.seedA,
            seedB: match.seedB,
            bracketPosition: match.bracketPosition,
            isBye: match.isBye,
            // sourceMatchAId and sourceMatchBId will be set in second pass
          },
        });

        // Store match ID for linking using generator-issued IDs
        if (match.id) {
          matchIdMap.set(match.id, dbMatch.id);
          pendingLinkUpdates.push({
            dbMatchId: dbMatch.id,
            sourceMatchAId: match.sourceMatchAId,
            sourceMatchBId: match.sourceMatchBId,
          });
        }

        // Create games for this match (if not a bye)
        if (!match.isBye && finalGameSlots.length > 0) {
          if (isClubBased) {
            // For club-based tournaments, create games for EACH bracket × EACH slot
            // Example: 2 brackets (Advanced, Intermediate) × 4 slots (MD, WD, MX1, MX2) = 8 games
            const brackets = await prisma.tournamentBracket.findMany({
              where: { tournamentId },
              orderBy: { idx: 'asc' },
            });

            // Create games for each slot × each bracket
            for (const slot of finalGameSlots) {
              for (const bracket of brackets) {
                await prisma.game.create({
                  data: {
                    matchId: dbMatch.id,
                    slot: slot as any,
                    bracketId: bracket.id, // Makes unique with matchId+slot+bracketId
                    teamAScore: null,
                    teamBScore: null,
                    isComplete: false,
                  },
                });
              }
            }
          } else {
            // For regular team tournaments, create games normally
            // Use gamesPerMatch to limit how many slots to create
            const gamesToCreate = Math.min(finalGamesPerMatch, finalGameSlots.length);

            for (let i = 0; i < gamesToCreate; i++) {
              await prisma.game.create({
                data: {
                  matchId: dbMatch.id,
                  slot: finalGameSlots[i] as any,
                  teamAScore: null,
                  teamBScore: null,
                  isComplete: false,
                },
              });
            }
          }
        }
      }

      createdRounds.push(dbRound);
    }

    // Second pass: Link matches via sourceMatchAId/sourceMatchBId using generator output
    for (const link of pendingLinkUpdates) {
      const sourceMatchAId = link.sourceMatchAId ? matchIdMap.get(link.sourceMatchAId) ?? null : null;
      const sourceMatchBId = link.sourceMatchBId ? matchIdMap.get(link.sourceMatchBId) ?? null : null;

      if (sourceMatchAId || sourceMatchBId) {
        await prisma.match.update({
          where: { id: link.dbMatchId },
          data: {
            sourceMatchAId,
            sourceMatchBId,
          },
        });
      }
    }

    // AUTO-COMPLETE BYE MATCHES: After all matches are created and linked,
    // auto-complete any BYE matches that have a team assigned and advance winners
    const byeMatches = await prisma.match.findMany({
      where: {
        round: { stopId: stop.id },
        isBye: true,
        teamAId: { not: null },
        winnerId: null,
      },
      include: {
        round: { select: { bracketType: true, stopId: true } },
      },
    });

    for (const byeMatch of byeMatches) {

      // Set winner
      await prisma.match.update({
        where: { id: byeMatch.id },
        data: { winnerId: byeMatch.teamAId },
      });

      // Find child matches and advance winner
      const childMatchesA = await prisma.match.findMany({
        where: { sourceMatchAId: byeMatch.id },
        include: { round: { select: { bracketType: true } } },
      });

      const childMatchesB = await prisma.match.findMany({
        where: { sourceMatchBId: byeMatch.id },
        include: { round: { select: { bracketType: true } } },
      });

      // Filter by bracket type
      let targetChildrenA = childMatchesA;
      let targetChildrenB = childMatchesB;

      if (byeMatch.round?.bracketType === 'LOSER') {
        // Loser bracket BYE advances to loser bracket or finals
        targetChildrenA = childMatchesA.filter(m => m.round?.bracketType === 'LOSER' || m.round?.bracketType === 'FINALS');
        targetChildrenB = childMatchesB.filter(m => m.round?.bracketType === 'LOSER' || m.round?.bracketType === 'FINALS');
      } else {
        // Winner bracket BYE advances to winner/finals bracket
        targetChildrenA = childMatchesA.filter(m => m.round?.bracketType === 'WINNER' || m.round?.bracketType === 'FINALS');
        targetChildrenB = childMatchesB.filter(m => m.round?.bracketType === 'WINNER' || m.round?.bracketType === 'FINALS');
      }

      // Advance winner to child matches
      for (const child of targetChildrenA) {
        await prisma.match.update({
          where: { id: child.id },
          data: { teamAId: byeMatch.teamAId },
        });
      }

      for (const child of targetChildrenB) {
        await prisma.match.update({
          where: { id: child.id },
          data: { teamBId: byeMatch.teamAId },
        });
      }

    }


    // Update tournament with gamesPerMatch setting (only for team-based tournaments)
    if (!isClubBased) {
      await prisma.tournament.update({
        where: { id: tournamentId },
        data: { gamesPerMatch: finalGamesPerMatch },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Bracket generated successfully',
      stopId: stop.id,
      roundsCreated: createdRounds.length,
      totalMatches: bracket.totalMatches,
      bracketInfo: {
        teamCount: orderedTeams.length,
        roundCount: bracket.totalRounds,
      },
    });
  } catch (error) {
    console.error('Generate bracket error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate bracket',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
