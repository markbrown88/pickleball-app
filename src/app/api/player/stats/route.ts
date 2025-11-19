import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEffectivePlayer, getActAsHeaderFromRequest } from '@/lib/actAs';
import { GameSlot } from '@prisma/client';

type GameData = {
  id: string;
  matchId: string;
  slot: GameSlot | null;
  teamAScore: number | null;
  teamBScore: number | null;
  isComplete: boolean | null;
  isForfeit: boolean;
  isTeamA: boolean;
  createdAt: Date;
  gamesPerMatch: number | null;
  gameNumberInMatch: number;
  partnerDupr: number | null;
  opponentAvgDupr: number | null;
};

function formatLabel(p: any): string {
  const fn = (p.firstName ?? '').trim();
  const ln = (p.lastName ?? '').trim();
  return [fn, ln].filter(Boolean).join(' ') || (p.name ?? 'Unknown');
}

/**
 * GET /api/player/stats
 * Calculate comprehensive player statistics
 */
export async function GET(req: NextRequest) {
  try {
    // Support Act As functionality
    const actAsPlayerId = getActAsHeaderFromRequest(req);
    const effectivePlayer = await getEffectivePlayer(actAsPlayerId);

    // Find all lineup entries where player participated
    const lineupEntries = await prisma.lineupEntry.findMany({
      where: {
        OR: [
          { player1Id: effectivePlayer.targetPlayerId },
          { player2Id: effectivePlayer.targetPlayerId }
        ]
      },
      include: {
        lineup: {
          include: {
            team: true,
            round: {
              include: {
                stop: {
                  include: {
                    tournament: {
                      select: {
                        id: true,
                        gamesPerMatch: true
                      }
                    }
                  }
                },
                matches: {
                  include: {
                    games: {
                      orderBy: {
                        createdAt: 'asc'
                      }
                    }
                  }
                }
              }
            }
          }
        },
        player1: {
          select: {
            id: true,
            dupr: true
          }
        },
        player2: {
          select: {
            id: true,
            dupr: true
          }
        }
      }
    });

    // Collect all games and match data
    const games: GameData[] = [];
    const matchIds = new Set<string>();
    const seenGames = new Set<string>();
    const partners = new Set<string>();

    for (const entry of lineupEntries) {
      const { lineup, slot, player1, player2 } = entry;
      const { team: playerTeam, round } = lineup;
      const gamesPerMatch = round.stop.tournament.gamesPerMatch;

      // Determine partner
      const partner = player1.id === effectivePlayer.targetPlayerId ? player2 : player1;
      if (partner.id !== effectivePlayer.targetPlayerId) {
        partners.add(partner.id);
      }

      // Find matches where this team participated
      for (const match of round.matches) {
        if (match.teamAId !== playerTeam.id && match.teamBId !== playerTeam.id) {
          continue;
        }

        matchIds.add(match.id);
        const isTeamA = match.teamAId === playerTeam.id;
        const isForfeit = match.forfeitTeam !== null;

        // Find games in this match with matching slot
        const matchGames = match.games.filter(g => g.slot === slot);

        matchGames.forEach((game, index) => {
          if (seenGames.has(game.id)) return;
          seenGames.add(game.id);

          games.push({
            id: game.id,
            matchId: match.id,
            slot: game.slot,
            teamAScore: game.teamAScore,
            teamBScore: game.teamBScore,
            isComplete: game.isComplete,
            isForfeit,
            isTeamA,
            createdAt: game.createdAt,
            gamesPerMatch,
            gameNumberInMatch: index + 1,
            partnerDupr: partner.dupr,
            opponentAvgDupr: null // Will be calculated if needed
          });
        });
      }
    }

    // Calculate statistics
    const stats = calculateStats(games, matchIds, partners);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error calculating player stats:', error);
    return NextResponse.json(
      { error: 'Failed to calculate player stats' },
      { status: 500 }
    );
  }
}

function calculateStats(games: GameData[], matchIds: Set<string>, partners: Set<string>) {
  // Filter out forfeited games for game-level and point stats
  const validGames = games.filter(g => !g.isForfeit && g.isComplete);

  // Match-level stats (include forfeits for match W/L)
  const matchResults = new Map<string, { won: boolean }>();

  // Group games by match to determine match winners
  const gamesByMatch = new Map<string, GameData[]>();
  games.forEach(game => {
    if (!gamesByMatch.has(game.matchId)) {
      gamesByMatch.set(game.matchId, []);
    }
    gamesByMatch.get(game.matchId)!.push(game);
  });

  // Determine match winners
  gamesByMatch.forEach((matchGames, matchId) => {
    // For forfeited matches, check if any game shows who won
    const firstGame = matchGames[0];
    if (firstGame.isForfeit) {
      // In a forfeit, we still count the match W/L
      // The winner should have been marked somehow, but for now
      // we'll skip counting forfeit matches for match record
      // unless we can determine the winner
      return;
    }

    // Count games won by player's team
    let gamesWon = 0;
    let gamesLost = 0;

    matchGames.forEach(game => {
      if (!game.isComplete || game.teamAScore === null || game.teamBScore === null) return;

      const playerScore = game.isTeamA ? game.teamAScore : game.teamBScore;
      const opponentScore = game.isTeamA ? game.teamBScore : game.teamAScore;

      if (playerScore > opponentScore) {
        gamesWon++;
      } else if (opponentScore > playerScore) {
        gamesLost++;
      }
    });

    // Determine match winner (best of X)
    const won = gamesWon > gamesLost;
    matchResults.set(matchId, { won });
  });

  // === CORE STATS ===
  const totalMatches = matchResults.size;
  const matchesWon = Array.from(matchResults.values()).filter(r => r.won).length;
  const matchesLost = totalMatches - matchesWon;
  const matchWinPct = totalMatches > 0 ? (matchesWon / totalMatches) * 100 : 0;

  let gamesWon = 0;
  let gamesLost = 0;
  let totalPointsScored = 0;
  let totalPointsAllowed = 0;
  let closeGamesWon = 0;
  let closeGamesTotal = 0;
  let decidingGamesWon = 0;
  let decidingGamesTotal = 0;
  let victoriesMarginSum = 0;
  let defeatsMarginSum = 0;
  let victoriesCount = 0;
  let defeatsCount = 0;

  // Format-specific stats
  const formatStats = {
    singles: { matchesWon: 0, matchesLost: 0, gamesWon: 0, gamesLost: 0, pointsFor: 0, pointsAgainst: 0 },
    doubles: { matchesWon: 0, matchesLost: 0, gamesWon: 0, gamesLost: 0, pointsFor: 0, pointsAgainst: 0 },
    mixed: { matchesWon: 0, matchesLost: 0, gamesWon: 0, gamesLost: 0, pointsFor: 0, pointsAgainst: 0 }
  };

  validGames.forEach(game => {
    if (game.teamAScore === null || game.teamBScore === null) return;

    const playerScore = game.isTeamA ? game.teamAScore : game.teamBScore;
    const opponentScore = game.isTeamA ? game.teamBScore : game.teamAScore;
    const margin = Math.abs(playerScore - opponentScore);
    const won = playerScore > opponentScore;
    const isClose = margin <= 2;
    const isDeciding = game.gamesPerMatch && game.gameNumberInMatch === game.gamesPerMatch;

    // Game record
    if (won) {
      gamesWon++;
      victoriesMarginSum += margin;
      victoriesCount++;
    } else {
      gamesLost++;
      defeatsMarginSum += margin;
      defeatsCount++;
    }

    // Points
    totalPointsScored += playerScore;
    totalPointsAllowed += opponentScore;

    // Close games
    if (isClose) {
      closeGamesTotal++;
      if (won) closeGamesWon++;
    }

    // Deciding games
    if (isDeciding) {
      decidingGamesTotal++;
      if (won) decidingGamesWon++;
    }

    // Format-specific
    const format = getFormat(game.slot);
    if (format) {
      formatStats[format].gamesWon += won ? 1 : 0;
      formatStats[format].gamesLost += won ? 0 : 1;
      formatStats[format].pointsFor += playerScore;
      formatStats[format].pointsAgainst += opponentScore;
    }
  });

  // Format-specific match wins/losses
  gamesByMatch.forEach((matchGames, matchId) => {
    const matchResult = matchResults.get(matchId);
    if (!matchResult) return;

    const firstGame = matchGames[0];
    const format = getFormat(firstGame.slot);
    if (format) {
      if (matchResult.won) {
        formatStats[format].matchesWon++;
      } else {
        formatStats[format].matchesLost++;
      }
    }
  });

  const totalGames = gamesWon + gamesLost;
  const gameWinPct = totalGames > 0 ? (gamesWon / totalGames) * 100 : 0;
  const pointDifferential = totalPointsScored - totalPointsAllowed;
  const avgPointsScored = totalGames > 0 ? totalPointsScored / totalGames : 0;
  const avgPointsAllowed = totalGames > 0 ? totalPointsAllowed / totalGames : 0;
  const closeGameWinPct = closeGamesTotal > 0 ? (closeGamesWon / closeGamesTotal) * 100 : 0;
  const decidingGameWinPct = decidingGamesTotal > 0 ? (decidingGamesWon / decidingGamesTotal) * 100 : 0;
  const avgMarginVictory = victoriesCount > 0 ? victoriesMarginSum / victoriesCount : 0;
  const avgMarginDefeat = defeatsCount > 0 ? defeatsMarginSum / defeatsCount : 0;

  // === PERFORMANCE OVER TIME ===
  // Last 10 matches
  const recentMatches = Array.from(matchResults.entries())
    .slice(0, 10);
  const last10MatchesWon = recentMatches.filter(([_, r]) => r.won).length;
  const last10MatchesTotal = recentMatches.length;

  // Rolling 30-day game win %
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentGames = validGames.filter(g => g.createdAt >= thirtyDaysAgo);
  const recentGamesWon = recentGames.filter(g => {
    if (g.teamAScore === null || g.teamBScore === null) return false;
    const playerScore = g.isTeamA ? g.teamAScore : g.teamBScore;
    const opponentScore = g.isTeamA ? g.teamBScore : g.teamAScore;
    return playerScore > opponentScore;
  }).length;
  const rolling30DayWinPct = recentGames.length > 0 ? (recentGamesWon / recentGames.length) * 100 : 0;

  return {
    // Core stats
    matchRecord: {
      played: totalMatches,
      won: matchesWon,
      lost: matchesLost,
      winPct: Math.round(matchWinPct * 10) / 10
    },
    gameRecord: {
      played: totalGames,
      won: gamesWon,
      lost: gamesLost,
      winPct: Math.round(gameWinPct * 10) / 10
    },
    scoring: {
      pointsScored: totalPointsScored,
      pointsAllowed: totalPointsAllowed,
      pointDifferential,
      avgPointsScored: Math.round(avgPointsScored * 10) / 10,
      avgPointsAllowed: Math.round(avgPointsAllowed * 10) / 10
    },
    clutch: {
      closeGameWinPct: Math.round(closeGameWinPct * 10) / 10,
      closeGamesPlayed: closeGamesTotal,
      decidingGameWinPct: Math.round(decidingGameWinPct * 10) / 10,
      decidingGamesPlayed: decidingGamesTotal,
      avgMarginVictory: Math.round(avgMarginVictory * 10) / 10,
      avgMarginDefeat: Math.round(avgMarginDefeat * 10) / 10
    },
    // Format-specific
    singles: {
      matchRecord: `${formatStats.singles.matchesWon}-${formatStats.singles.matchesLost}`,
      gameRecord: `${formatStats.singles.gamesWon}-${formatStats.singles.gamesLost}`,
      gameWinPct: formatStats.singles.gamesWon + formatStats.singles.gamesLost > 0
        ? Math.round((formatStats.singles.gamesWon / (formatStats.singles.gamesWon + formatStats.singles.gamesLost)) * 1000) / 10
        : 0,
      pointDifferential: formatStats.singles.pointsFor - formatStats.singles.pointsAgainst
    },
    doubles: {
      matchRecord: `${formatStats.doubles.matchesWon}-${formatStats.doubles.matchesLost}`,
      gameRecord: `${formatStats.doubles.gamesWon}-${formatStats.doubles.gamesLost}`,
      gameWinPct: formatStats.doubles.gamesWon + formatStats.doubles.gamesLost > 0
        ? Math.round((formatStats.doubles.gamesWon / (formatStats.doubles.gamesWon + formatStats.doubles.gamesLost)) * 1000) / 10
        : 0,
      pointDifferential: formatStats.doubles.pointsFor - formatStats.doubles.pointsAgainst
    },
    mixed: {
      matchRecord: `${formatStats.mixed.matchesWon}-${formatStats.mixed.matchesLost}`,
      gameRecord: `${formatStats.mixed.gamesWon}-${formatStats.mixed.gamesLost}`,
      gameWinPct: formatStats.mixed.gamesWon + formatStats.mixed.gamesLost > 0
        ? Math.round((formatStats.mixed.gamesWon / (formatStats.mixed.gamesWon + formatStats.mixed.gamesLost)) * 1000) / 10
        : 0,
      pointDifferential: formatStats.mixed.pointsFor - formatStats.mixed.pointsAgainst
    },
    // Partner stats
    partners: {
      uniqueCount: partners.size,
      doublesWinPct: formatStats.doubles.gamesWon + formatStats.doubles.gamesLost > 0
        ? Math.round((formatStats.doubles.gamesWon / (formatStats.doubles.gamesWon + formatStats.doubles.gamesLost)) * 1000) / 10
        : 0,
      mixedWinPct: formatStats.mixed.gamesWon + formatStats.mixed.gamesLost > 0
        ? Math.round((formatStats.mixed.gamesWon / (formatStats.mixed.gamesWon + formatStats.mixed.gamesLost)) * 1000) / 10
        : 0
    },
    // Performance over time
    recent: {
      last10Matches: {
        won: last10MatchesWon,
        total: last10MatchesTotal,
        record: `${last10MatchesWon}-${last10MatchesTotal - last10MatchesWon}`
      },
      rolling30DayGameWinPct: Math.round(rolling30DayWinPct * 10) / 10
    }
  };
}

function getFormat(slot: GameSlot | null): 'singles' | 'doubles' | 'mixed' | null {
  if (!slot) return null;

  if (slot === 'SINGLES_1' || slot === 'SINGLES_2') {
    return 'singles';
  } else if (slot === 'DOUBLES_1' || slot === 'DOUBLES_2') {
    return 'doubles';
  } else if (slot === 'MIXED_1') {
    return 'mixed';
  }

  return null;
}
