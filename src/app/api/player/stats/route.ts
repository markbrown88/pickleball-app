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

type MatchInfo = {
  matchId: string;
  playerTeamId: string;
  isTeamA: boolean;
  isForfeit: boolean;
  allGames: Array<{
    id: string;
    slot: GameSlot | null;
    teamAScore: number | null;
    teamBScore: number | null;
    isComplete: boolean | null;
  }>;
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
            duprDoubles: true,
            duprSingles: true
          }
        },
        player2: {
          select: {
            id: true,
            duprDoubles: true,
            duprSingles: true
          }
        }
      }
    });

    // Collect all games and match data
    const games: GameData[] = [];
    const matches = new Map<string, MatchInfo>();
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

        const isTeamA = match.teamAId === playerTeam.id;
        const isForfeit = match.forfeitTeam !== null;

        // Store complete match info (only once per match)
        if (!matches.has(match.id)) {
          matches.set(match.id, {
            matchId: match.id,
            playerTeamId: playerTeam.id,
            isTeamA,
            isForfeit,
            allGames: match.games.map(g => ({
              id: g.id,
              slot: g.slot,
              teamAScore: g.teamAScore,
              teamBScore: g.teamBScore,
              isComplete: g.isComplete
            }))
          });
        }

        // Find games in this match with matching slot (for player's individual stats)
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
            partnerDupr: partner.duprDoubles ?? null, // Default to doubles DUPR
            opponentAvgDupr: null // Will be calculated if needed
          });
        });
      }
    }

    // Calculate statistics
    const stats = calculateStats(games, matches, partners);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error calculating player stats:', error);
    return NextResponse.json(
      { error: 'Failed to calculate player stats' },
      { status: 500 }
    );
  }
}

function calculateStats(games: GameData[], matches: Map<string, MatchInfo>, partners: Set<string>) {
  // Filter out forfeited games for game-level and point stats
  const validGames = games.filter(g => !g.isForfeit && g.isComplete);

  // Match-level stats: Determine match winners based on team performance across all slots
  const matchResults = new Map<string, { won: boolean }>();

  matches.forEach((matchInfo, matchId) => {
    // Skip forfeited matches for now (would need forfeit logic)
    if (matchInfo.isForfeit) {
      return;
    }

    // Group all games in the match by slot
    const gamesBySlot = new Map<GameSlot, Array<typeof matchInfo.allGames[0]>>();
    matchInfo.allGames.forEach(game => {
      if (game.slot === null) return; // Skip games without a slot
      if (!gamesBySlot.has(game.slot)) {
        gamesBySlot.set(game.slot, []);
      }
      gamesBySlot.get(game.slot)!.push(game);
    });

    // For each slot, determine which team won that slot
    let slotsWonByPlayerTeam = 0;
    let slotsWonByOpponent = 0;

    gamesBySlot.forEach((slotGames, slot) => {
      // Count games won by each team in this slot
      let playerTeamGamesWon = 0;
      let opponentGamesWon = 0;

      slotGames.forEach(game => {
        if (!game.isComplete || game.teamAScore === null || game.teamBScore === null) return;

        const teamAWon = game.teamAScore > game.teamBScore;
        const teamBWon = game.teamBScore > game.teamAScore;

        if (matchInfo.isTeamA) {
          if (teamAWon) playerTeamGamesWon++;
          if (teamBWon) opponentGamesWon++;
        } else {
          if (teamBWon) playerTeamGamesWon++;
          if (teamAWon) opponentGamesWon++;
        }
      });

      // The team that won more games in this slot wins the slot
      if (playerTeamGamesWon > opponentGamesWon) {
        slotsWonByPlayerTeam++;
      } else if (opponentGamesWon > playerTeamGamesWon) {
        slotsWonByOpponent++;
      }
      // If tied, slot doesn't count for either team
    });

    // The team that won more slots wins the match
    if (slotsWonByPlayerTeam > slotsWonByOpponent) {
      matchResults.set(matchId, { won: true });
    } else if (slotsWonByOpponent > slotsWonByPlayerTeam) {
      matchResults.set(matchId, { won: false });
    }
    // If tied in slots, we don't count the match (or could implement tiebreaker logic)
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
  // For each match, attribute the match W/L to the format(s) the player participated in
  const playerSlotsPerMatch = new Map<string, Set<GameSlot>>();
  games.forEach(game => {
    if (!playerSlotsPerMatch.has(game.matchId)) {
      playerSlotsPerMatch.set(game.matchId, new Set());
    }
    if (game.slot) {
      playerSlotsPerMatch.get(game.matchId)!.add(game.slot);
    }
  });

  playerSlotsPerMatch.forEach((slots, matchId) => {
    const matchResult = matchResults.get(matchId);
    if (!matchResult) return;

    // Attribute the match result to each format the player participated in
    slots.forEach(slot => {
      const format = getFormat(slot);
      if (format) {
        if (matchResult.won) {
          formatStats[format].matchesWon++;
        } else {
          formatStats[format].matchesLost++;
        }
      }
    });
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

  if (slot === 'MENS_DOUBLES' || slot === 'WOMENS_DOUBLES') {
    return 'doubles';
  } else if (slot === 'MIXED_1' || slot === 'MIXED_2') {
    return 'mixed';
  } else if (slot === 'TIEBREAKER') {
    return null; // Tiebreakers are not categorized by format
  }

  return null;
}
