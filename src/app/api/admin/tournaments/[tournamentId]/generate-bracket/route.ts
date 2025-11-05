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

    // Second pass: Link matches via sourceMatchAId/sourceMatchBId
    // This creates the bracket progression tree
    const allRounds = bracket.rounds;
    const winnerRounds = allRounds.filter(r => r.bracketType === 'WINNER');
    const loserRounds = allRounds.filter(r => r.bracketType === 'LOSER');
    const finalsRounds = allRounds.filter(r => r.bracketType === 'FINALS');

    // Link winner bracket matches: winners advance to next winner round
    for (let roundIdx = 0; roundIdx < winnerRounds.length - 1; roundIdx++) {
      const currentRound = winnerRounds[roundIdx];
      const nextRound = winnerRounds[roundIdx + 1];

      for (let matchIdx = 0; matchIdx < nextRound.matches.length; matchIdx++) {
        const nextMatch = nextRound.matches[matchIdx];
        const sourceAIdx = matchIdx * 2;
        const sourceBIdx = matchIdx * 2 + 1;

        if (sourceAIdx < currentRound.matches.length && sourceBIdx < currentRound.matches.length) {
          const sourceA = currentRound.matches[sourceAIdx];
          const sourceB = currentRound.matches[sourceBIdx];

          const sourceAMatchId = matchIdMap.get(currentRound.idx * 1000 + sourceA.bracketPosition);
          const sourceBMatchId = matchIdMap.get(currentRound.idx * 1000 + sourceB.bracketPosition);
          const nextMatchId = matchIdMap.get(nextRound.idx * 1000 + nextMatch.bracketPosition);

          if (sourceAMatchId && sourceBMatchId && nextMatchId) {
            await prisma.match.update({
              where: { id: nextMatchId },
              data: {
                sourceMatchAId: sourceAMatchId,
                sourceMatchBId: sourceBMatchId,
              },
            });
          }
        }
      }
    }

    // Link loser bracket: losers from winner bracket drop to loser bracket
    // Double elimination loser bracket pattern:
    // - Round 0: Losers from winner bracket round 0 play each other (2 losers per match)
    // - Round 1: Winners from loser round 0 play losers from winner bracket round 1
    // - Round 2: Winners from loser round 1 play each other
    // - Round 3: Winners from loser round 2 play losers from winner bracket round 2
    // - etc.
    
    if (loserRounds.length > 0 && winnerRounds.length > 0) {
      // First loser round: losers from first winner round
      const firstLoserRound = loserRounds[0];
      const firstWinnerRound = winnerRounds[0];
      
      let loserMatchIdx = 0;
      for (let i = 0; i < firstWinnerRound.matches.length && loserMatchIdx < firstLoserRound.matches.length; i += 2) {
        const matchA = firstWinnerRound.matches[i];
        const matchB = firstWinnerRound.matches[i + 1] || null;

        const sourceAMatchId = matchIdMap.get(firstWinnerRound.idx * 1000 + matchA.bracketPosition);
        const sourceBMatchId = matchB ? matchIdMap.get(firstWinnerRound.idx * 1000 + matchB.bracketPosition) : null;
        const loserMatchId = matchIdMap.get(firstLoserRound.idx * 1000 + loserMatchIdx);

        if (sourceAMatchId && loserMatchId) {
          await prisma.match.update({
            where: { id: loserMatchId },
            data: {
              sourceMatchAId: sourceAMatchId,
              sourceMatchBId: sourceBMatchId,
            },
          });
        }
        loserMatchIdx++;
      }

      // Subsequent loser rounds: alternate pattern
      for (let loserRoundIdx = 1; loserRoundIdx < loserRounds.length; loserRoundIdx++) {
        const loserRound = loserRounds[loserRoundIdx];
        const prevLoserRound = loserRounds[loserRoundIdx - 1];
        
        // Determine which winner round this corresponds to
        // Loser rounds alternate: even rounds are "drop" rounds, odd rounds are "advance" rounds
        const isAdvanceRound = loserRoundIdx % 2 === 1;
        const winnerRoundIdx = Math.floor((loserRoundIdx + 1) / 2);

        if (isAdvanceRound && winnerRoundIdx < winnerRounds.length) {
          // Advance round: winners from previous loser round vs losers from winner bracket
          const winnerRound = winnerRounds[winnerRoundIdx];
          
          for (let matchIdx = 0; matchIdx < loserRound.matches.length && matchIdx < prevLoserRound.matches.length && matchIdx < winnerRound.matches.length; matchIdx++) {
            const loserMatch = loserRound.matches[matchIdx];
            const prevLoserMatch = prevLoserRound.matches[matchIdx];
            const winnerMatch = winnerRound.matches[matchIdx];

            const prevLoserMatchId = matchIdMap.get(prevLoserRound.idx * 1000 + prevLoserMatch.bracketPosition);
            const winnerMatchId = matchIdMap.get(winnerRound.idx * 1000 + winnerMatch.bracketPosition);
            const loserMatchId = matchIdMap.get(loserRound.idx * 1000 + loserMatch.bracketPosition);

            if (prevLoserMatchId && winnerMatchId && loserMatchId) {
              await prisma.match.update({
                where: { id: loserMatchId },
                data: {
                  sourceMatchAId: prevLoserMatchId, // Winner from previous loser round
                  sourceMatchBId: winnerMatchId, // Loser from winner bracket
                },
              });
            }
          }
        } else {
          // Drop round: winners from previous loser round advance
          for (let matchIdx = 0; matchIdx < loserRound.matches.length; matchIdx += 1) {
            const sourceAIdx = matchIdx * 2;
            const sourceBIdx = matchIdx * 2 + 1;

            if (sourceAIdx < prevLoserRound.matches.length && sourceBIdx < prevLoserRound.matches.length) {
              const loserMatch = loserRound.matches[matchIdx];
              const sourceA = prevLoserRound.matches[sourceAIdx];
              const sourceB = prevLoserRound.matches[sourceBIdx];

              const sourceAMatchId = matchIdMap.get(prevLoserRound.idx * 1000 + sourceA.bracketPosition);
              const sourceBMatchId = matchIdMap.get(prevLoserRound.idx * 1000 + sourceB.bracketPosition);
              const loserMatchId = matchIdMap.get(loserRound.idx * 1000 + loserMatch.bracketPosition);

              if (sourceAMatchId && sourceBMatchId && loserMatchId) {
                await prisma.match.update({
                  where: { id: loserMatchId },
                  data: {
                    sourceMatchAId: sourceAMatchId,
                    sourceMatchBId: sourceBMatchId,
                  },
                });
              }
            }
          }
        }
      }
    }

    // Link finals: winner bracket final winner and loser bracket final winner
    if (finalsRounds.length > 0 && winnerRounds.length > 0 && loserRounds.length > 0) {
      const finalsRound = finalsRounds[0];
      const winnerFinalRound = winnerRounds[winnerRounds.length - 1];
      const loserFinalRound = loserRounds[loserRounds.length - 1];

      if (finalsRound.matches.length > 0 && winnerFinalRound.matches.length > 0 && loserFinalRound.matches.length > 0) {
        const finalsMatch = finalsRound.matches[0];
        const winnerFinalMatch = winnerFinalRound.matches[0];
        const loserFinalMatch = loserFinalRound.matches[0];

        const winnerFinalMatchId = matchIdMap.get(winnerFinalRound.idx * 1000 + winnerFinalMatch.bracketPosition);
        const loserFinalMatchId = matchIdMap.get(loserFinalRound.idx * 1000 + loserFinalMatch.bracketPosition);
        const finalsMatchId = matchIdMap.get(finalsRound.idx * 1000 + finalsMatch.bracketPosition);

        if (winnerFinalMatchId && loserFinalMatchId && finalsMatchId) {
          await prisma.match.update({
            where: { id: finalsMatchId },
            data: {
              sourceMatchAId: winnerFinalMatchId, // Winner bracket winner
              sourceMatchBId: loserFinalMatchId, // Loser bracket winner
            },
          });
        }
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
