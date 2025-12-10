// src/app/api/admin/player-rankings/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

type PlayerStats = {
  playerId: string;
  playerName: string;
  gamesWon: number;
  gamesPlayed: number;
  pointsScored: number;
  winPct: number;
};

type PairStats = {
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  gamesWon: number;
  gamesPlayed: number;
  pointsScored: number;
  winPct: number;
};

type BracketRankings = {
  bracketId: string;
  bracketName: string;
  topPlayers: PlayerStats[];
  topPairs: PairStats[];
};

/**
 * Compare function for ranking
 * Primary: win% (higher is better)
 * Tiebreaker 1: games played (more is better - 10:5 beats 4:2)
 * Tiebreaker 2: points scored (higher is better)
 */
function compareStats(a: { winPct: number; gamesPlayed: number; pointsScored: number }, b: { winPct: number; gamesPlayed: number; pointsScored: number }): number {
  // Higher win% is better
  if (a.winPct !== b.winPct) return b.winPct - a.winPct;
  // More games played is better (shows reliability)
  if (a.gamesPlayed !== b.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
  // More points scored is better
  return b.pointsScored - a.pointsScored;
}

/**
 * GET /api/admin/player-rankings?tournamentId=xxx
 * Returns top 10 players and pairs per bracket, and overall
 */
export async function GET(req: Request) {
  // 1. Authenticate - require app admin only
  const authResult = await requireAuth('app_admin');
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(req.url);
  const tournamentId = searchParams.get('tournamentId');

  if (!tournamentId) {
    return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 });
  }

  // 2. Verify tournament exists
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, name: true },
  });

  if (!tournament) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  }

  // 3. Get all completed games for this tournament with lineup data
  const stops = await prisma.stop.findMany({
    where: { tournamentId },
    select: { id: true },
  });
  const stopIds = stops.map(s => s.id);

  // Get all rounds for these stops
  const rounds = await prisma.round.findMany({
    where: { stopId: { in: stopIds } },
    select: { id: true },
  });
  const roundIds = rounds.map(r => r.id);

  // Get all matches with their games (include team bracketId)
  const matches = await prisma.match.findMany({
    where: { roundId: { in: roundIds } },
    include: {
      games: {
        where: {
          isComplete: true,
          teamAScore: { not: null },
          teamBScore: { not: null },
        },
        select: {
          id: true,
          slot: true,
          bracketId: true,
          teamAScore: true,
          teamBScore: true,
        },
      },
      teamA: { select: { id: true, bracketId: true } },
      teamB: { select: { id: true, bracketId: true } },
      round: {
        select: {
          id: true,
          stopId: true,
        },
      },
    },
  });

  // Get all lineups for these rounds
  const lineups = await prisma.lineup.findMany({
    where: { roundId: { in: roundIds } },
    include: {
      entries: {
        include: {
          player1: { select: { id: true, firstName: true, lastName: true } },
          player2: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      team: { select: { id: true } },
    },
  });

  // Create a lookup: roundId + teamId + slot -> [player1, player2]
  const lineupLookup = new Map<string, { player1: { id: string; firstName: string | null; lastName: string | null }; player2: { id: string; firstName: string | null; lastName: string | null } }>();
  for (const lineup of lineups) {
    for (const entry of lineup.entries) {
      const key = `${lineup.roundId}:${lineup.teamId}:${entry.slot}`;
      lineupLookup.set(key, { player1: entry.player1, player2: entry.player2 });
    }
  }

  // Get all brackets for this tournament
  const brackets = await prisma.tournamentBracket.findMany({
    where: { tournamentId },
    select: { id: true, name: true },
  });

  // Stats accumulators
  // Per bracket: Map<bracketId, Map<playerId, stats>>
  const bracketPlayerStats = new Map<string, Map<string, { name: string; gamesWon: number; gamesPlayed: number; pointsScored: number }>>();
  // Per bracket: Map<bracketId, Map<pairKey, stats>>
  const bracketPairStats = new Map<string, Map<string, { player1Id: string; player2Id: string; player1Name: string; player2Name: string; gamesWon: number; gamesPlayed: number; pointsScored: number }>>();

  // Overall stats
  const overallPlayerStats = new Map<string, { name: string; gamesWon: number; gamesPlayed: number; pointsScored: number }>();
  const overallPairStats = new Map<string, { player1Id: string; player2Id: string; player1Name: string; player2Name: string; gamesWon: number; gamesPlayed: number; pointsScored: number }>();

  // Process each match and game
  for (const match of matches) {
    if (!match.teamA || !match.teamB) continue;

    for (const game of match.games) {
      if (game.teamAScore === null || game.teamBScore === null || !game.slot) continue;

      // Get bracket from game (games can have different bracketIds within the same match)
      const bracketId = game.bracketId || match.teamA.bracketId || match.teamB.bracketId || 'no-bracket';

      // Initialize bracket maps if needed
      if (!bracketPlayerStats.has(bracketId)) {
        bracketPlayerStats.set(bracketId, new Map());
      }
      if (!bracketPairStats.has(bracketId)) {
        bracketPairStats.set(bracketId, new Map());
      }

      // Get players for this game from lineups
      const teamAKey = `${match.roundId}:${match.teamA.id}:${game.slot}`;
      const teamBKey = `${match.roundId}:${match.teamB.id}:${game.slot}`;

      const teamAPlayers = lineupLookup.get(teamAKey);
      const teamBPlayers = lineupLookup.get(teamBKey);

      // Determine winner based on scores
      const teamAWon = game.teamAScore > game.teamBScore;
      const teamBWon = game.teamBScore > game.teamAScore;

      // Helper to update player stats
      const updatePlayerStats = (
        playerId: string,
        playerName: string,
        won: boolean,
        pointsScored: number,
        bracketStatsMap: Map<string, { name: string; gamesWon: number; gamesPlayed: number; pointsScored: number }>
      ) => {
        // Update bracket stats
        if (!bracketStatsMap.has(playerId)) {
          bracketStatsMap.set(playerId, { name: playerName, gamesWon: 0, gamesPlayed: 0, pointsScored: 0 });
        }
        const bracketStats = bracketStatsMap.get(playerId)!;
        bracketStats.gamesPlayed += 1;
        if (won) bracketStats.gamesWon += 1;
        bracketStats.pointsScored += pointsScored;

        // Update overall stats
        if (!overallPlayerStats.has(playerId)) {
          overallPlayerStats.set(playerId, { name: playerName, gamesWon: 0, gamesPlayed: 0, pointsScored: 0 });
        }
        const overall = overallPlayerStats.get(playerId)!;
        overall.gamesPlayed += 1;
        if (won) overall.gamesWon += 1;
        overall.pointsScored += pointsScored;
      };

      // Helper to update pair stats
      const updatePairStats = (
        p1Id: string,
        p2Id: string,
        p1Name: string,
        p2Name: string,
        won: boolean,
        pointsScored: number,
        bracketPairMap: Map<string, { player1Id: string; player2Id: string; player1Name: string; player2Name: string; gamesWon: number; gamesPlayed: number; pointsScored: number }>
      ) => {
        // Normalize pair key (sort by ID to ensure consistency)
        const [id1, id2] = p1Id < p2Id ? [p1Id, p2Id] : [p2Id, p1Id];
        const [name1, name2] = p1Id < p2Id ? [p1Name, p2Name] : [p2Name, p1Name];
        const pairKey = `${id1}:${id2}`;

        // Update bracket stats
        if (!bracketPairMap.has(pairKey)) {
          bracketPairMap.set(pairKey, { player1Id: id1, player2Id: id2, player1Name: name1, player2Name: name2, gamesWon: 0, gamesPlayed: 0, pointsScored: 0 });
        }
        const bracketStats = bracketPairMap.get(pairKey)!;
        bracketStats.gamesPlayed += 1;
        if (won) bracketStats.gamesWon += 1;
        bracketStats.pointsScored += pointsScored;

        // Update overall stats
        if (!overallPairStats.has(pairKey)) {
          overallPairStats.set(pairKey, { player1Id: id1, player2Id: id2, player1Name: name1, player2Name: name2, gamesWon: 0, gamesPlayed: 0, pointsScored: 0 });
        }
        const overall = overallPairStats.get(pairKey)!;
        overall.gamesPlayed += 1;
        if (won) overall.gamesWon += 1;
        overall.pointsScored += pointsScored;
      };

      const bracketPlayerMap = bracketPlayerStats.get(bracketId)!;
      const bracketPairMap = bracketPairStats.get(bracketId)!;

      // Process Team A players
      if (teamAPlayers) {
        const p1Name = `${teamAPlayers.player1.firstName || ''} ${teamAPlayers.player1.lastName || ''}`.trim() || 'Unknown';
        const p2Name = `${teamAPlayers.player2.firstName || ''} ${teamAPlayers.player2.lastName || ''}`.trim() || 'Unknown';

        updatePlayerStats(teamAPlayers.player1.id, p1Name, teamAWon, game.teamAScore, bracketPlayerMap);
        updatePlayerStats(teamAPlayers.player2.id, p2Name, teamAWon, game.teamAScore, bracketPlayerMap);
        updatePairStats(teamAPlayers.player1.id, teamAPlayers.player2.id, p1Name, p2Name, teamAWon, game.teamAScore, bracketPairMap);
      }

      // Process Team B players
      if (teamBPlayers) {
        const p1Name = `${teamBPlayers.player1.firstName || ''} ${teamBPlayers.player1.lastName || ''}`.trim() || 'Unknown';
        const p2Name = `${teamBPlayers.player2.firstName || ''} ${teamBPlayers.player2.lastName || ''}`.trim() || 'Unknown';

        updatePlayerStats(teamBPlayers.player1.id, p1Name, teamBWon, game.teamBScore, bracketPlayerMap);
        updatePlayerStats(teamBPlayers.player2.id, p2Name, teamBWon, game.teamBScore, bracketPlayerMap);
        updatePairStats(teamBPlayers.player1.id, teamBPlayers.player2.id, p1Name, p2Name, teamBWon, game.teamBScore, bracketPairMap);
      }
    }
  }

  // Convert maps to sorted arrays
  const formatPlayerStats = (statsMap: Map<string, { name: string; gamesWon: number; gamesPlayed: number; pointsScored: number }>): PlayerStats[] => {
    return Array.from(statsMap.entries())
      .map(([playerId, stats]) => ({
        playerId,
        playerName: stats.name,
        gamesWon: stats.gamesWon,
        gamesPlayed: stats.gamesPlayed,
        pointsScored: stats.pointsScored,
        winPct: stats.gamesPlayed > 0 ? (stats.gamesWon / stats.gamesPlayed) * 100 : 0,
      }))
      .sort(compareStats)
      .slice(0, 10);
  };

  const formatPairStats = (statsMap: Map<string, { player1Id: string; player2Id: string; player1Name: string; player2Name: string; gamesWon: number; gamesPlayed: number; pointsScored: number }>): PairStats[] => {
    return Array.from(statsMap.values())
      .map(stats => ({
        ...stats,
        winPct: stats.gamesPlayed > 0 ? (stats.gamesWon / stats.gamesPlayed) * 100 : 0,
      }))
      .sort(compareStats)
      .slice(0, 10);
  };

  // Build bracket rankings
  const bracketRankings: BracketRankings[] = [];
  for (const bracket of brackets) {
    const playerMap = bracketPlayerStats.get(bracket.id);
    const pairMap = bracketPairStats.get(bracket.id);

    bracketRankings.push({
      bracketId: bracket.id,
      bracketName: bracket.name,
      topPlayers: playerMap ? formatPlayerStats(playerMap) : [],
      topPairs: pairMap ? formatPairStats(pairMap) : [],
    });
  }

  // Sort brackets by name
  bracketRankings.sort((a, b) => a.bracketName.localeCompare(b.bracketName));

  return NextResponse.json({
    tournament: { id: tournament.id, name: tournament.name },
    overall: {
      topPlayers: formatPlayerStats(overallPlayerStats),
      topPairs: formatPairStats(overallPairStats),
    },
    brackets: bracketRankings,
  });
}