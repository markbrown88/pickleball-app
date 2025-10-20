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
      teams: selectedTeams = [] // Teams with seeding from UI
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

    if (tournament.type !== 'DOUBLE_ELIMINATION') {
      return NextResponse.json(
        { error: 'Tournament must be DOUBLE_ELIMINATION type' },
        { status: 400 }
      );
    }

    // Use teams from request body (already seeded)
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
    const orderedTeams = selectedTeams.map((selectedTeam: any) => {
      const team = existingTeams.find(t => t.id === selectedTeam.id);
      return {
        ...team,
        seed: selectedTeam.seed,
      };
    });

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

    // Generate bracket structure
    const bracket = generateDoubleEliminationBracket({
      tournamentId,
      stopId: stop.id,
      teams: orderedTeams,
      gamesPerMatch,
      gameSlots: gameSlots as any[],
    });

    // Create rounds and matches in database
    const createdRounds = [];
    const matchIdMap = new Map<number, string>(); // Map bracket position to DB match ID

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

        // Store match ID for linking
        const key = `${round.idx}-${match.bracketPosition}`;
        matchIdMap.set(round.idx * 1000 + match.bracketPosition, dbMatch.id);

        // Create games for this match (if not a bye)
        if (!match.isBye && gamesPerMatch > 0) {
          const gamesToCreate = Math.min(gamesPerMatch, gameSlots.length);

          for (let i = 0; i < gamesToCreate; i++) {
            await prisma.game.create({
              data: {
                matchId: dbMatch.id,
                slot: gameSlots[i] as any,
                teamAScore: null,
                teamBScore: null,
                isComplete: false,
              },
            });
          }
        }
      }

      createdRounds.push(dbRound);
    }

    // TODO: Second pass to link matches via sourceMatchAId/sourceMatchBId
    // This requires implementing the full progression logic

    // Update tournament with gamesPerMatch setting
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { gamesPerMatch },
    });

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
