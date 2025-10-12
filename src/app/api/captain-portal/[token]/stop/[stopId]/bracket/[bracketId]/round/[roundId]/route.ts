import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { evaluateMatchTiebreaker } from '@/lib/matchTiebreaker';
import { playersForSlot } from '@/lib/lineupSlots';

export const dynamic = 'force-dynamic';

type Params = {
  params: Promise<{
    token: string;
    stopId: string;
    bracketId: string;
    roundId: string;
  }>;
};

type PlayerLite = {
  id: string;
  name: string;
  gender: 'MALE' | 'FEMALE';
};

export async function GET(request: Request, { params }: Params) {
  try {
    const { token, stopId, bracketId, roundId } = await params;

    // Validate token and get club
    const tournamentClub = await prisma.tournamentClub.findUnique({
      where: { captainAccessToken: token },
      select: { tournamentId: true, clubId: true }
    });

    if (!tournamentClub) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
    }

    // Get the team for this club in this bracket
    const team = await prisma.team.findFirst({
      where: {
        tournamentId: tournamentClub.tournamentId,
        clubId: tournamentClub.clubId,
        bracketId: bracketId
      },
      include: {
        tournament: { select: { name: true } },
        club: { select: { name: true } },
        bracket: { select: { name: true } }
      }
    });

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Get the round with matches and lineups
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        matches: {
          where: {
            OR: [{ teamAId: team.id }, { teamBId: team.id }]
          },
          include: {
            teamA: { select: { id: true, name: true } },
            teamB: { select: { id: true, name: true } },
            games: {
              select: {
                id: true,
                slot: true,
                teamAScore: true,
                teamBScore: true,
                teamASubmittedScore: true,
                teamBSubmittedScore: true,
                teamAScoreSubmitted: true,
                teamBScoreSubmitted: true,
                isComplete: true,
                startedAt: true
              }
            }
          }
        },
        stop: {
          select: {
            id: true,
            name: true,
            lineupDeadline: true
          }
        },
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
    });

    if (!round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    // Attempt to locate the match for this team in the specified round
    let rawMatch = round.matches[0];

    if (!rawMatch) {
      rawMatch = await prisma.match.findFirst({
        where: {
          roundId,
          OR: [{ teamAId: team.id }, { teamBId: team.id }],
        },
        select: { id: true },
      }) ?? undefined;
    }

    if (!rawMatch?.id) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    const match = await prisma.match.findUnique({
      where: { id: rawMatch.id },
      include: {
        teamA: { select: { id: true, name: true } },
        teamB: { select: { id: true, name: true } },
        games: true,
      },
    });

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    const refreshedMatch = await evaluateMatchTiebreaker(prisma, match.id) ?? match;

    const stopTeamPlayers = await prisma.stopTeamPlayer.findMany({
      where: {
        stopId: stopId,
        teamId: { in: [refreshedMatch.teamAId, refreshedMatch.teamBId].filter((id): id is string => id !== null) }
      },
      include: {
        player: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            gender: true
          }
        }
      }
    });

    // Create roster for lineup selection (only this team's players)
    const myTeamPlayers = stopTeamPlayers.filter(stp => stp.teamId === team.id);
    const roster = myTeamPlayers.map(stp => ({
      id: stp.player.id,
      name: stp.player.name || `${stp.player.firstName || ''} ${stp.player.lastName || ''}`.trim(),
      gender: stp.player.gender
    }));

    // Create full roster for display purposes (both teams' players)
    const allPlayers = stopTeamPlayers.map(stp => ({
      id: stp.player.id,
      name: stp.player.name || `${stp.player.firstName || ''} ${stp.player.lastName || ''}`.trim(),
      gender: stp.player.gender
    }));

    // Get lineups from the old system
    const myTeamLineup = round.lineups.find(l => l.teamId === team.id);
    const opponentTeamLineup = round.lineups.find(l => l.teamId === (refreshedMatch.teamAId === team.id ? refreshedMatch.teamBId : refreshedMatch.teamAId));

    const playerLookup = new Map<string, PlayerLite>();
    allPlayers.forEach(player => {
      playerLookup.set(player.id, player);
    });

    myTeamPlayers.forEach(stp => {
      if (!playerLookup.has(stp.player.id)) {
        playerLookup.set(stp.player.id, {
          id: stp.player.id,
          name: stp.player.name || `${stp.player.firstName || ''} ${stp.player.lastName || ''}`.trim(),
          gender: stp.player.gender
        });
      }
    });

    const extractCoreLineup = (lineup: { entries: any[] } | null | undefined): (PlayerLite | undefined)[] => {
      if (!lineup) return [undefined, undefined, undefined, undefined];

      const players: (PlayerLite | undefined)[] = [undefined, undefined, undefined, undefined];

      const sortedEntries = [...lineup.entries].sort((a: any, b: any) => {
        const order: Record<string, number> = {
          MENS_DOUBLES: 0,
          WOMENS_DOUBLES: 1,
          MIXED_1: 2,
          MIXED_2: 3,
        };
        return (order[a.slot] ?? 10) - (order[b.slot] ?? 10);
      });

      sortedEntries.forEach((entry: any) => {
        const addPlayer = (slotIndex: number, player: any, fallbackId?: string) => {
          const sourcePlayer = player || (fallbackId ? playerLookup.get(fallbackId) : null);
          if (!sourcePlayer) return;
          if (players[slotIndex]) return;
          players[slotIndex] = {
            id: sourcePlayer.id,
            name: sourcePlayer.name,
            gender: sourcePlayer.gender,
          };
        };

        if (entry.slot === 'MENS_DOUBLES') {
          addPlayer(0, entry.player1, entry.player1Id);
          addPlayer(1, entry.player2, entry.player2Id);
        } else if (entry.slot === 'WOMENS_DOUBLES') {
          addPlayer(2, entry.player1, entry.player1Id);
          addPlayer(3, entry.player2, entry.player2Id);
        }
      });

      return players;
    };

    const myLineupCore = extractCoreLineup(myTeamLineup);
    const opponentLineupCore = extractCoreLineup(opponentTeamLineup);

    // Enrich lineups with player names
    const enrichLineup = (lineup: any) => {
      if (!lineup) return [];
      const players: any[] = [];
      
      // Sort entries by slot to ensure correct order
      const sortedEntries = lineup.entries.sort((a: any, b: any) => {
        const slotOrder = ['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_1', 'MIXED_2'];
        return slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot);
      });

      // Extract players in order: Man1, Man2, Woman1, Woman2
      for (const entry of sortedEntries) {
        if (entry.slot === 'MENS_DOUBLES') {
          players.push({
            id: entry.player1.id,
            name: entry.player1.name || `${entry.player1.firstName || ''} ${entry.player1.lastName || ''}`.trim(),
            gender: entry.player1.gender
          });
          players.push({
            id: entry.player2.id,
            name: entry.player2.name || `${entry.player2.firstName || ''} ${entry.player2.lastName || ''}`.trim(),
            gender: entry.player2.gender
          });
        } else if (entry.slot === 'WOMENS_DOUBLES') {
          players.push({
            id: entry.player1.id,
            name: entry.player1.name || `${entry.player1.firstName || ''} ${entry.player1.lastName || ''}`.trim(),
            gender: entry.player1.gender
          });
          players.push({
            id: entry.player2.id,
            name: entry.player2.name || `${entry.player2.firstName || ''} ${entry.player2.lastName || ''}`.trim(),
            gender: entry.player2.gender
          });
        }
      }
      return players;
    };

    const isTeamA = match.teamAId === team.id;
    const opponentTeam = isTeamA ? match.teamB : match.teamA;

    // Check if deadline has passed
    const now = new Date();
    const deadline = round.stop.lineupDeadline ? new Date(round.stop.lineupDeadline) : null;
    const deadlinePassed = deadline ? now > deadline : false;

    // Enrich games with player info
    const enrichedGames = refreshedMatch.games.map(game => {
      const slot = game.slot || '';
      const [myPlayer1, myPlayer2] = myLineupCore ? playersForSlot(myLineupCore, slot) : [undefined, undefined];
      const [oppPlayer1, oppPlayer2] = opponentLineupCore ? playersForSlot(opponentLineupCore, slot) : [undefined, undefined];

      return {
        id: game.id,
        slot: game.slot,
        myLineup: [myPlayer1, myPlayer2].filter(Boolean),
        opponentLineup: [oppPlayer1, oppPlayer2].filter(Boolean),
        myScore: isTeamA ? game.teamAScore : game.teamBScore,
        opponentScore: isTeamA ? game.teamBScore : game.teamAScore,
        mySubmittedScore: isTeamA ? game.teamASubmittedScore : game.teamBSubmittedScore,
        opponentSubmittedScore: isTeamA ? game.teamBSubmittedScore : game.teamASubmittedScore,
        myScoreSubmitted: isTeamA ? game.teamAScoreSubmitted : game.teamBScoreSubmitted,
        opponentScoreSubmitted: isTeamA ? game.teamBScoreSubmitted : game.teamAScoreSubmitted,
        isComplete: game.isComplete,
        startedAt: game.startedAt
      };
    });

    return NextResponse.json({
      tournament: {
        name: team.tournament.name
      },
      bracket: {
        name: team.bracket?.name || 'Main'
      },
      stop: {
        name: round.stop.name
      },
      round: {
        id: round.id,
        name: `Round ${round.idx + 1}`,
        idx: round.idx
      },
      myTeam: {
        id: team.id,
        name: team.name || team.club?.name || 'Your Team'
      },
      match: {
        id: refreshedMatch?.id,
        opponentTeam: {
          id: opponentTeam?.id,
          name: opponentTeam?.name
        },
        tiebreakerStatus: refreshedMatch?.tiebreakerStatus ?? null,
        tiebreakerWinnerTeamId: refreshedMatch?.tiebreakerWinnerTeamId ?? null,
        totalPointsTeamA: refreshedMatch?.totalPointsTeamA ?? null,
        totalPointsTeamB: refreshedMatch?.totalPointsTeamB ?? null,
        tiebreakerDecidedAt: refreshedMatch?.tiebreakerDecidedAt ?? null,
        matchStatus: refreshedMatch?.games?.every((g: any) => g?.isComplete) ? 'completed' : refreshedMatch?.games?.some((g: any) => g?.startedAt) ? 'in_progress' : 'not_started',
        opponentLineup: opponentLineupCore ?? [],
      },
      games: enrichedGames,
      roster,
      existingLineup: myLineupCore,
      opponentLineup: opponentLineupCore,
      deadlinePassed,
      isTeamA
    });
  } catch (error) {
    console.error('Captain portal round error:', error);
    const message = error instanceof Error ? error.message : 'Failed to load round data';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { token, stopId, bracketId, roundId } = await params;
    const { lineup } = await request.json();

    // Validate token and get club
    const tournamentClub = await prisma.tournamentClub.findUnique({
      where: { captainAccessToken: token },
      select: { tournamentId: true, clubId: true }
    });

    if (!tournamentClub) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
    }

    // Get the team for this club in this bracket
    const team = await prisma.team.findFirst({
      where: {
        tournamentId: tournamentClub.tournamentId,
        clubId: tournamentClub.clubId,
        bracketId: bracketId
      }
    });

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Check if deadline has passed
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        stop: {
          select: {
            lineupDeadline: true
          }
        }
      }
    });

    if (!round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    const now = new Date();
    const deadline = round.stop.lineupDeadline ? new Date(round.stop.lineupDeadline) : null;
    if (deadline && now > deadline) {
      return NextResponse.json({ error: 'Lineup deadline has passed' }, { status: 400 });
    }

    // Validate lineup format: [Man1, Man2, Woman1, Woman2]
    if (!Array.isArray(lineup) || lineup.length !== 4) {
      return NextResponse.json({ error: 'Invalid lineup format' }, { status: 400 });
    }

    // Save lineup using the old system
    await prisma.$transaction(async (tx) => {
      // Delete existing lineup for this team in this round
      await tx.lineup.deleteMany({
        where: {
          roundId: roundId,
          teamId: team.id
        }
      });

      // Create new lineup
      const newLineup = await tx.lineup.create({
        data: {
          roundId: roundId,
          teamId: team.id,
          stopId: stopId
        }
      });

      // Create lineup entries
      await tx.lineupEntry.createMany({
        data: [
          {
            lineupId: newLineup.id,
            player1Id: lineup[0].id, // Man1
            player2Id: lineup[1].id, // Man2
            slot: 'MENS_DOUBLES'
          },
          {
            lineupId: newLineup.id,
            player1Id: lineup[2].id, // Woman1
            player2Id: lineup[3].id, // Woman2
            slot: 'WOMENS_DOUBLES'
          },
          {
            lineupId: newLineup.id,
            player1Id: lineup[0].id, // Man1
            player2Id: lineup[2].id, // Woman1
            slot: 'MIXED_1'
          },
          {
            lineupId: newLineup.id,
            player1Id: lineup[1].id, // Man2
            player2Id: lineup[3].id, // Woman2
            slot: 'MIXED_2'
          }
        ]
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Captain portal lineup save error:', error);
    return NextResponse.json(
      { error: 'Failed to save lineup' },
      { status: 500 }
    );
  }
}
