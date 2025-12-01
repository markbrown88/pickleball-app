import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function formatTournamentStats() {
  // Find tournaments
  const tournaments = await prisma.tournament.findMany({
    where: {
      OR: [
        { name: { contains: 'KLYNG CUP-GRAND', mode: 'insensitive' } },
        { name: { contains: 'KLYNG CUP - GRAND FINALE', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
    },
  });

  const tournamentIds = tournaments.map(t => t.id);

  // Get all lineup entries
  const allLineupEntries = await prisma.lineupEntry.findMany({
    where: {
      lineup: {
        round: {
          stop: {
            tournamentId: { in: tournamentIds },
          },
        },
      },
    },
    include: {
      player1: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
        },
      },
      player2: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
        },
      },
      lineup: {
        include: {
          team: {
            select: {
              id: true,
              name: true,
            },
          },
          round: {
            include: {
              stop: {
                select: {
                  name: true,
                },
              },
              matches: {
                include: {
                  games: {
                    where: {
                      OR: [
                        { slot: 'MENS_DOUBLES' },
                        { slot: 'WOMENS_DOUBLES' },
                        { slot: 'MIXED_1' },
                        { slot: 'MIXED_2' },
                      ],
                    },
                    include: {
                      bracket: {
                        select: {
                          name: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // Get all games
  const allGames = await prisma.game.findMany({
    where: {
      match: {
        round: {
          stop: {
            tournamentId: { in: tournamentIds },
          },
        },
      },
      OR: [
        { slot: 'MENS_DOUBLES' },
        { slot: 'WOMENS_DOUBLES' },
        { slot: 'MIXED_1' },
        { slot: 'MIXED_2' },
      ],
    },
    include: {
      match: {
        include: {
          round: {
            include: {
              stop: {
                select: {
                  name: true,
                },
              },
            },
          },
          teamA: {
            select: {
              id: true,
              name: true,
            },
          },
          teamB: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      bracket: {
        select: {
          name: true,
        },
      },
    },
  });

  const completedGames = allGames.filter(g => g.isComplete && g.teamAScore !== null && g.teamBScore !== null);

  // Build player stats
  const lineupEntryToGames = new Map<string, Array<{
    game: typeof allGames[0];
    won: boolean;
    teamName: string;
  }>>();

  for (const game of completedGames) {
    const match = game.match;
    const round = match.round;
    const relevantLineups = allLineupEntries.filter(entry => 
      entry.lineup.roundId === round.id && 
      entry.slot === game.slot
    );

    const teamAWon = game.teamAScore! > game.teamBScore!;
    const teamBWon = game.teamBScore! > game.teamAScore!;

    for (const lineupEntry of relevantLineups) {
      const lineupTeam = lineupEntry.lineup.team;
      const isTeamA = match.teamAId === lineupTeam.id;
      const isTeamB = match.teamBId === lineupTeam.id;

      if (isTeamA || isTeamB) {
        const won = isTeamA ? teamAWon : teamBWon;
        if (!lineupEntryToGames.has(lineupEntry.player1Id)) {
          lineupEntryToGames.set(lineupEntry.player1Id, []);
        }
        if (!lineupEntryToGames.has(lineupEntry.player2Id)) {
          lineupEntryToGames.set(lineupEntry.player2Id, []);
        }
        lineupEntryToGames.get(lineupEntry.player1Id)!.push({ game, won, teamName: lineupTeam.name });
        lineupEntryToGames.get(lineupEntry.player2Id)!.push({ game, won, teamName: lineupTeam.name });
      }
    }
  }

  const playerStats = new Map<string, {
    playerId: string;
    playerName: string;
    gamesPlayed: number;
    gamesWon: number;
    gamesLost: number;
    winPercentage: number;
    teams: Map<string, number>;
  }>();

  const allPlayers = new Set<string>();
  allLineupEntries.forEach(entry => {
    allPlayers.add(entry.player1Id);
    allPlayers.add(entry.player2Id);
  });

  for (const playerId of allPlayers) {
    const entry = allLineupEntries.find(e => e.player1Id === playerId || e.player2Id === playerId);
    const player = entry?.player1Id === playerId ? entry.player1 : entry?.player2;
    const playerName = player?.name || `${player?.firstName} ${player?.lastName}` || 'Unknown';
    playerStats.set(playerId, {
      playerId,
      playerName,
      gamesPlayed: 0,
      gamesWon: 0,
      gamesLost: 0,
      winPercentage: 0,
      teams: new Map(),
    });
  }

  for (const [playerId, games] of lineupEntryToGames.entries()) {
    const stats = playerStats.get(playerId);
    if (!stats) continue;
    for (const { game, won, teamName } of games) {
      if (teamName) {
        stats.teams.set(teamName, (stats.teams.get(teamName) || 0) + 1);
      }
      stats.gamesPlayed++;
      if (won) stats.gamesWon++;
      else stats.gamesLost++;
    }
    stats.winPercentage = stats.gamesPlayed > 0 ? (stats.gamesWon / stats.gamesPlayed) * 100 : 0;
  }

  // Build pair stats
  const pairStats = new Map<string, {
    player1Id: string;
    player1Name: string;
    player2Id: string;
    player2Name: string;
    gamesPlayed: number;
    gamesWon: number;
    gamesLost: number;
    winPercentage: number;
    teams: Map<string, number>;
  }>();

  const pairMap = new Map<string, typeof allLineupEntries[0][]>();
  for (const entry of allLineupEntries) {
    const pairKey = [entry.player1Id, entry.player2Id].sort().join('|');
    if (!pairMap.has(pairKey)) {
      pairMap.set(pairKey, []);
    }
    pairMap.get(pairKey)!.push(entry);
  }

  for (const [pairKey, entries] of pairMap.entries()) {
    const [player1Id, player2Id] = pairKey.split('|');
    const entry = entries[0];
    const player1Name = entry.player1.name || `${entry.player1.firstName} ${entry.player1.lastName}` || 'Unknown';
    const player2Name = entry.player2.name || `${entry.player2.firstName} ${entry.player2.lastName}` || 'Unknown';

    const pairGames: Array<{ game: typeof allGames[0]; won: boolean; teamName: string }> = [];

    for (const game of completedGames) {
      const match = game.match;
      const round = match.round;
      const pairEntry = entries.find(e => 
        e.lineup.roundId === round.id && 
        e.slot === game.slot
      );

      if (pairEntry) {
        const lineupTeam = pairEntry.lineup.team;
        const isTeamA = match.teamAId === lineupTeam.id;
        const isTeamB = match.teamBId === lineupTeam.id;

        if (isTeamA || isTeamB) {
          const teamAWon = game.teamAScore! > game.teamBScore!;
          const won = isTeamA ? teamAWon : !teamAWon;
          pairGames.push({ game, won, teamName: lineupTeam.name });
        }
      }
    }

    const gamesPlayed = pairGames.length;
    const gamesWon = pairGames.filter(g => g.won).length;
    const gamesLost = gamesPlayed - gamesWon;
    const winPercentage = gamesPlayed > 0 ? (gamesWon / gamesPlayed) * 100 : 0;

    const teams = new Map<string, number>();
    for (const { teamName } of pairGames) {
      if (teamName) {
        teams.set(teamName, (teams.get(teamName) || 0) + 1);
      }
    }

    pairStats.set(pairKey, {
      player1Id,
      player1Name,
      player2Id,
      player2Name,
      gamesPlayed,
      gamesWon,
      gamesLost,
      winPercentage,
      teams,
    });
  }

  // Format output
  const sortedPlayers = Array.from(playerStats.values())
    .filter(p => p.gamesPlayed > 0)
    .sort((a, b) => {
      if (Math.abs(a.winPercentage - b.winPercentage) > 0.01) {
        return b.winPercentage - a.winPercentage;
      }
      return b.gamesPlayed - a.gamesPlayed;
    });

  const sortedPairs = Array.from(pairStats.values())
    .filter(p => p.gamesPlayed > 0)
    .sort((a, b) => {
      if (Math.abs(a.winPercentage - b.winPercentage) > 0.01) {
        return b.winPercentage - a.winPercentage;
      }
      return b.gamesPlayed - a.gamesPlayed;
    });

  const getPrimaryTeam = (teams: Map<string, number>) => {
    const teamEntries = Array.from(teams.entries()).sort((a, b) => b[1] - a[1]);
    return teamEntries[0]?.[0] || 'Unknown';
  };

  console.log('Tournament Overview:\n');
  console.log(`Total Players: ${playerStats.size}`);
  console.log(`\nTotal Pairs: ${pairStats.size}`);
  console.log(`\nTotal Games: ${completedGames.length}`);
  const avgWinPct = sortedPlayers.reduce((sum, p) => sum + p.winPercentage, 0) / sortedPlayers.length;
  console.log(`\nAverage Win Percentage: ${avgWinPct.toFixed(1)}%`);
  const avgGames = sortedPlayers.reduce((sum, p) => sum + p.gamesPlayed, 0) / sortedPlayers.length;
  console.log(`\nAverage Games per Player: ${avgGames.toFixed(1)}\n`);

  console.log('Top Individual Performers (Min 5 games):\n');
  sortedPlayers
    .filter(p => p.gamesPlayed >= 5)
    .slice(0, 10)
    .forEach((player) => {
      const team = getPrimaryTeam(player.teams);
      console.log(`${player.playerName} - ${team} - ${player.gamesWon}W-${player.gamesLost}L (${player.winPercentage.toFixed(1)}%) - ${player.gamesPlayed} games`);
    });

  console.log('\nMost Active Players:\n');
  sortedPlayers
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed)
    .slice(0, 10)
    .forEach((player) => {
      const team = getPrimaryTeam(player.teams);
      console.log(`${player.playerName} - ${team} - ${player.gamesPlayed} games (${player.winPercentage.toFixed(1)}% win rate)`);
    });

  console.log('\nTop Pairs (Min 3 games):\n');
  sortedPairs
    .filter(p => p.gamesPlayed >= 3)
    .slice(0, 10)
    .forEach((pair) => {
      const team = getPrimaryTeam(pair.teams);
      console.log(`${pair.player1Name} & ${pair.player2Name} - ${team} - ${pair.gamesWon}W-${pair.gamesLost}L (${pair.winPercentage.toFixed(1)}%) - ${pair.gamesPlayed} games`);
    });

  console.log('\nMost Active Pairs:\n');
  sortedPairs
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed)
    .slice(0, 10)
    .forEach((pair) => {
      const team = getPrimaryTeam(pair.teams);
      console.log(`${pair.player1Name} & ${pair.player2Name} - ${team} - ${pair.gamesPlayed} games (${pair.winPercentage.toFixed(1)}% win rate)`);
    });
}

formatTournamentStats()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

