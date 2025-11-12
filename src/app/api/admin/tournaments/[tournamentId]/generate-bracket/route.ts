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
    // 
    // For 7 teams example:
    // - Round 1 (WB): W1 (4vs5), W2 (3vs6), W3 (2vs7), S1 BYE
    // - Losers Round 1: L1 (Loser W1 vs Loser W2), Loser W3 gets BYE
    // - Losers Round 2: L2 (Winner L1 vs Loser W4), L3 (Loser W3 vs Loser W5)
    // - Losers Round 3: L4 (Winner L2 vs Winner L3)
    // - Losers Final: L5 (Winner L4 vs Loser W6)
    //
    // Pattern:
    // - First loser round: Pair losers from WB Round 1 (skip BYE matches)
    //   If odd number of losers, last one gets BYE in loser bracket
    // - Subsequent rounds alternate:
    //   - Odd loser rounds: Winners from prev LB round vs Losers from WB round N
    //   - Even loser rounds: Winners from prev LB round advance (pair winners)
    
    if (loserRounds.length > 0 && winnerRounds.length > 0) {
      // First loser round: losers from first winner round
      // SKIP BYE matches - they don't produce losers
      const firstLoserRound = loserRounds[0];
      const firstWinnerRound = winnerRounds[0];
      
      // Collect non-BYE matches from first winner round
      const nonByeMatches = firstWinnerRound.matches.filter(m => !m.isBye);
      
      console.log(`[Bracket Link] First loser round: ${nonByeMatches.length} non-BYE matches from ${firstWinnerRound.matches.length} total matches`);
      
      // Pair losers from non-BYE matches into loser round matches
      // Check each loser match to see if it was already marked as BYE during generation
      let loserMatchIdx = 0;
      let winnerLoserIdx = 0;

      for (let i = 0; i < firstLoserRound.matches.length; i++) {
        const loserMatch = firstLoserRound.matches[i];
        const loserMatchId = matchIdMap.get(firstLoserRound.idx * 1000 + loserMatch.bracketPosition);

        if (!loserMatchId) continue;

        // Check if this loser match was marked as BYE during generation
        if (loserMatch.isBye) {
          // BYE match - only assign one source (the team that gets the bye)
          if (winnerLoserIdx < nonByeMatches.length) {
            const sourceMatch = nonByeMatches[winnerLoserIdx];
            const sourceMatchId = matchIdMap.get(firstWinnerRound.idx * 1000 + sourceMatch.bracketPosition);

            if (sourceMatchId) {
              await prisma.match.update({
                where: { id: loserMatchId },
                data: {
                  sourceMatchAId: sourceMatchId,
                  sourceMatchBId: null, // No opponent - BYE
                },
              });
              console.log(`[Bracket Link] Loser Match ${i} (BYE): Loser of Match ${sourceMatch.bracketPosition} gets BYE`);
            }
            winnerLoserIdx++;
          }
        } else {
          // Regular match - pair two losers
          if (winnerLoserIdx < nonByeMatches.length - 1) {
            const matchA = nonByeMatches[winnerLoserIdx];
            const matchB = nonByeMatches[winnerLoserIdx + 1];

            const sourceAMatchId = matchIdMap.get(firstWinnerRound.idx * 1000 + matchA.bracketPosition);
            const sourceBMatchId = matchIdMap.get(firstWinnerRound.idx * 1000 + matchB.bracketPosition);

            if (sourceAMatchId && sourceBMatchId) {
              await prisma.match.update({
                where: { id: loserMatchId },
                data: {
                  sourceMatchAId: sourceAMatchId,
                  sourceMatchBId: sourceBMatchId,
                },
              });
              console.log(`[Bracket Link] Loser Match ${i}: Loser of Match ${matchA.bracketPosition} vs Loser of Match ${matchB.bracketPosition}`);
            }
            winnerLoserIdx += 2;
          }
        }
      }

      // Subsequent loser rounds: alternate pattern
      for (let loserRoundIdx = 1; loserRoundIdx < loserRounds.length; loserRoundIdx++) {
        const loserRound = loserRounds[loserRoundIdx];
        const prevLoserRound = loserRounds[loserRoundIdx - 1];
        
        // Determine which winner round this corresponds to
        // Loser rounds alternate: odd rounds (1, 3, 5...) are "drop" rounds (winners vs new losers)
        // Even rounds (2, 4, 6...) are "advance" rounds (winners advance)
        const isDropRound = loserRoundIdx % 2 === 1;
        const winnerRoundIdx = Math.floor((loserRoundIdx + 1) / 2);

        if (isDropRound && winnerRoundIdx < winnerRounds.length) {
          // Drop round: winners from previous loser round vs losers from winner bracket
          // Example: L2 = Winner L1 vs Loser W4, L3 = Loser W3 (BYE) vs Loser W5
          // Special case: Last loser round gets loser from winner bracket FINAL
          const winnerRound = winnerRounds[winnerRoundIdx];
          const isLastLoserRound = loserRoundIdx === loserRounds.length - 1;
          const isLastWinnerRound = winnerRoundIdx === winnerRounds.length - 1;

          console.log(`[Bracket Link] Loser Round ${loserRoundIdx} (Drop Round): Pairing winners from LB Round ${loserRoundIdx - 1} with losers from WB Round ${winnerRoundIdx}${isLastLoserRound ? ' (FINAL)' : ''}`);

          // Special handling: Last winner round should ONLY drop to last loser round
          // For intermediate loser rounds, they just get winners from previous loser round advancing
          const shouldSkipWinnerDrops = isLastWinnerRound && !isLastLoserRound;
          if (shouldSkipWinnerDrops) {
            console.log(`[Bracket Link]   NOTE: Skipping WB drops (last WB round reserved for LB final) - only advancing LB winners`);
          }

          // We need to pair:
          // 1. Winners from previous loser round (including BYE winners)
          // 2. Losers from current winner round (excluding BYE matches) - UNLESS it's the last WB round and not the last LB round

          // Get all matches from previous loser round (to preserve BYE positions)
          const prevLoserMatches = prevLoserRound.matches;
          // Get non-BYE matches from winner round (losers that drop)
          const winnerLosers = shouldSkipWinnerDrops ? [] : winnerRound.matches.filter(m => !m.isBye);
          
          let winnerLoserIdx = 0;

          // Iterate through loser round matches and pair them
          // CROSS the pairings to prevent immediate rematches:
          // Match at position 0 gets loser from LAST winner match
          // Match at position 1 gets loser from FIRST winner match, etc.
          for (let i = 0; i < loserRound.matches.length; i++) {
            const loserMatch = loserRound.matches[i];
            const loserMatchId = matchIdMap.get(loserRound.idx * 1000 + loserMatch.bracketPosition);

            // Get corresponding match from previous loser round
            const prevMatch = prevLoserMatches[i];
            const prevMatchId = prevMatch ? matchIdMap.get(prevLoserRound.idx * 1000 + prevMatch.bracketPosition) : null;

            // Get loser from winner bracket (if available)
            let winnerLoserMatchId = null;
            if (winnerLosers.length > 0 && winnerLoserIdx < winnerLosers.length) {
              // CROSS: Get loser from winner bracket in reverse order to prevent rematches
              const crossedIdx = (winnerLosers.length - 1) - (i % winnerLosers.length);
              const winnerLoser = winnerLosers[crossedIdx];
              winnerLoserMatchId = matchIdMap.get(winnerRound.idx * 1000 + winnerLoser.bracketPosition);
              winnerLoserIdx++;
            }

            if (loserMatchId) {
              await prisma.match.update({
                where: { id: loserMatchId },
                data: {
                  sourceMatchAId: prevMatchId || null, // Winner from previous loser round (or BYE)
                  sourceMatchBId: winnerLoserMatchId || null, // Loser from winner bracket (if available)
                },
              });

              if (prevMatchId && winnerLoserMatchId) {
                console.log(`[Bracket Link] Loser Match ${i}: Winner of LB Match ${prevMatch.bracketPosition}${prevMatch.isBye ? ' (BYE)' : ''} vs Loser of WB Match ${winnerLosers[winnerLoserIdx-1].bracketPosition} (crossed)`);
              } else if (prevMatchId) {
                console.log(`[Bracket Link] Loser Match ${i}: Winner of LB Match ${prevMatch.bracketPosition}${prevMatch.isBye ? ' (BYE)' : ''} advances (no WB opponent)`);
              }
            }
          }
          
          // Special handling for last loser round: if there's only one match and it needs the loser from WB final
          if (isLastLoserRound && loserRound.matches.length === 1 && winnerLoserIdx === 0) {
            // This is the loser bracket final - it should get the loser from winner bracket final
            const loserFinalMatch = loserRound.matches[0];
            const loserFinalMatchId = matchIdMap.get(loserRound.idx * 1000 + loserFinalMatch.bracketPosition);
            const prevMatch = prevLoserMatches[0];
            const prevMatchId = prevMatch ? matchIdMap.get(prevLoserRound.idx * 1000 + prevMatch.bracketPosition) : null;
            const winnerFinalMatch = winnerRound.matches[0];
            const winnerFinalMatchId = matchIdMap.get(winnerRound.idx * 1000 + winnerFinalMatch.bracketPosition);
            
            if (prevMatchId && winnerFinalMatchId && loserFinalMatchId) {
              await prisma.match.update({
                where: { id: loserFinalMatchId },
                data: {
                  sourceMatchAId: prevMatchId, // Winner from previous loser round
                  sourceMatchBId: winnerFinalMatchId, // Loser from winner bracket final
                },
              });
              console.log(`[Bracket Link] LB Final: Winner of LB Match ${prevMatch.bracketPosition} vs Loser of WB Final`);
            }
          } else if (isLastLoserRound && loserRound.matches.length === 1) {
            // Last loser round already has sourceMatchAId from the loop above
            // But we need to ensure sourceMatchBId is set to the loser from WB final
            const loserFinalMatch = loserRound.matches[0];
            const loserFinalMatchId = matchIdMap.get(loserRound.idx * 1000 + loserFinalMatch.bracketPosition);
            const winnerFinalMatch = winnerRound.matches[0];
            const winnerFinalMatchId = matchIdMap.get(winnerRound.idx * 1000 + winnerFinalMatch.bracketPosition);
            
            // Check current state
            const currentMatch = await prisma.match.findUnique({
              where: { id: loserFinalMatchId },
              select: { sourceMatchAId: true, sourceMatchBId: true },
            });
            
            if (currentMatch && currentMatch.sourceMatchAId && !currentMatch.sourceMatchBId && winnerFinalMatchId) {
              // Add loser from winner bracket final
              await prisma.match.update({
                where: { id: loserFinalMatchId },
                data: {
                  sourceMatchBId: winnerFinalMatchId, // Loser from winner bracket final
                },
              });
              console.log(`[Bracket Link] LB Final: Added Loser of WB Final as sourceMatchBId`);
            }
          }
        } else {
          // Advance round: winners from previous loser round advance (pair winners)
          // Example: L4 = Winner L2 vs Winner L3
          console.log(`[Bracket Link] Loser Round ${loserRoundIdx} (Advance Round): Pairing winners from LB Round ${loserRoundIdx - 1}`);
          
          const prevLoserWinners = prevLoserRound.matches.filter(m => !m.isBye);

          for (let matchIdx = 0; matchIdx < loserRound.matches.length; matchIdx++) {
            const sourceAIdx = matchIdx * 2;
            const sourceBIdx = matchIdx * 2 + 1;

            // Handle case where there's only one winner from previous round (e.g., L3->L4)
            if (sourceAIdx < prevLoserWinners.length) {
              const loserMatch = loserRound.matches[matchIdx];
              const sourceA = prevLoserWinners[sourceAIdx];
              const sourceB = sourceBIdx < prevLoserWinners.length ? prevLoserWinners[sourceBIdx] : null;

              const sourceAMatchId = matchIdMap.get(prevLoserRound.idx * 1000 + sourceA.bracketPosition);
              const sourceBMatchId = sourceB ? matchIdMap.get(prevLoserRound.idx * 1000 + sourceB.bracketPosition) : null;
              const loserMatchId = matchIdMap.get(loserRound.idx * 1000 + loserMatch.bracketPosition);

              if (sourceAMatchId && loserMatchId) {
                await prisma.match.update({
                  where: { id: loserMatchId },
                  data: {
                    sourceMatchAId: sourceAMatchId,
                    sourceMatchBId: sourceBMatchId, // Will be null if only one source
                  },
                });
                console.log(`[Bracket Link] Loser Match ${matchIdx}: Winner of LB Match ${sourceA.bracketPosition}${sourceB ? ` vs Winner of LB Match ${sourceB.bracketPosition}` : ' (advances)'}`);
              }
            }
          }

          // Special handling: If this is the LAST loser round (loser bracket final),
          // it needs the loser from the winner bracket final as sourceMatchBId
          const isLastLoserRound = loserRoundIdx === loserRounds.length - 1;
          if (isLastLoserRound && loserRound.matches.length === 1) {
            const loserFinalMatch = loserRound.matches[0];
            const loserFinalMatchId = matchIdMap.get(loserRound.idx * 1000 + loserFinalMatch.bracketPosition);

            // Get the winner bracket final
            const winnerFinalRound = winnerRounds[winnerRounds.length - 1];
            const winnerFinalMatch = winnerFinalRound.matches[0];
            const winnerFinalMatchId = matchIdMap.get(winnerFinalRound.idx * 1000 + winnerFinalMatch.bracketPosition);

            if (loserFinalMatchId && winnerFinalMatchId) {
              // Update to set the winner bracket final as sourceMatchBId
              const currentMatch = await prisma.match.findUnique({
                where: { id: loserFinalMatchId },
                select: { sourceMatchAId: true, sourceMatchBId: true },
              });

              if (currentMatch && !currentMatch.sourceMatchBId) {
                await prisma.match.update({
                  where: { id: loserFinalMatchId },
                  data: {
                    sourceMatchBId: winnerFinalMatchId, // Loser from winner bracket final
                  },
                });
                console.log(`[Bracket Link] LB Final (Advance Round): Added Loser of WB Final as sourceMatchBId`);
              }
            }
          }
        }
      }
    }

    // Link finals: winner bracket final winner and loser bracket final winner
    // True double elimination has 2 finals rounds (bracket reset)
    if (finalsRounds.length > 0 && winnerRounds.length > 0 && loserRounds.length > 0) {
      // Sort finals rounds by depth (higher depth first = Finals 1 before Finals 2)
      const sortedFinalsRounds = [...finalsRounds].sort((a, b) => b.depth - a.depth);
      const finals1Round = sortedFinalsRounds[0]; // depth 1
      const finals2Round = sortedFinalsRounds[1]; // depth 0 (may not exist for old brackets)

      const winnerFinalRound = winnerRounds[winnerRounds.length - 1];
      const loserFinalRound = loserRounds[loserRounds.length - 1];

      // Link Finals 1: WB champion vs LB champion
      if (finals1Round.matches.length > 0 && winnerFinalRound.matches.length > 0 && loserFinalRound.matches.length > 0) {
        const finals1Match = finals1Round.matches[0];
        const winnerFinalMatch = winnerFinalRound.matches[0];
        const loserFinalMatch = loserFinalRound.matches[0];

        const winnerFinalMatchId = matchIdMap.get(winnerFinalRound.idx * 1000 + winnerFinalMatch.bracketPosition);
        const loserFinalMatchId = matchIdMap.get(loserFinalRound.idx * 1000 + loserFinalMatch.bracketPosition);
        const finals1MatchId = matchIdMap.get(finals1Round.idx * 1000 + finals1Match.bracketPosition);

        if (winnerFinalMatchId && loserFinalMatchId && finals1MatchId) {
          await prisma.match.update({
            where: { id: finals1MatchId },
            data: {
              sourceMatchAId: winnerFinalMatchId, // Winner bracket champion
              sourceMatchBId: loserFinalMatchId, // Loser bracket champion
            },
          });
          console.log(`[Bracket Link] Finals 1: Winner of WB Final vs Winner of LB Final`);
        }
      }

      // Link Finals 2: Bracket reset (both teams from Finals 1)
      if (finals2Round && finals2Round.matches.length > 0 && finals1Round.matches.length > 0) {
        const finals1Match = finals1Round.matches[0];
        const finals2Match = finals2Round.matches[0];

        const finals1MatchId = matchIdMap.get(finals1Round.idx * 1000 + finals1Match.bracketPosition);
        const finals2MatchId = matchIdMap.get(finals2Round.idx * 1000 + finals2Match.bracketPosition);

        if (finals1MatchId && finals2MatchId) {
          await prisma.match.update({
            where: { id: finals2MatchId },
            data: {
              sourceMatchAId: finals1MatchId, // Both teams come from Finals 1
              sourceMatchBId: null, // No second source
            },
          });
          console.log(`[Bracket Link] Finals 2: Bracket reset from Finals 1`);
        }
      }
    }

    // AUTO-COMPLETE BYE MATCHES: After all matches are created and linked,
    // auto-complete any BYE matches that have a team assigned and advance winners
    console.log('[Bracket Generation] Auto-completing BYE matches...');
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
      console.log(`[Bracket Generation] Auto-completing BYE match ${byeMatch.id} (${byeMatch.round?.bracketType} bracket)...`);

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
        console.log(`[Bracket Generation]   → Advanced to ${child.round?.bracketType} match ${child.id} as Team A`);
      }

      for (const child of targetChildrenB) {
        await prisma.match.update({
          where: { id: child.id },
          data: { teamBId: byeMatch.teamAId },
        });
        console.log(`[Bracket Generation]   → Advanced to ${child.round?.bracketType} match ${child.id} as Team B`);
      }

      console.log(`[Bracket Generation] ✓ BYE match ${byeMatch.id} completed, winner: ${byeMatch.teamAId}`);
    }

    console.log(`[Bracket Generation] Auto-completed ${byeMatches.length} BYE matches`);

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
