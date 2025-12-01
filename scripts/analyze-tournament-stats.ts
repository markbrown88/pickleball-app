import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function analyzeTournamentStats(tournamentNames: string[]) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`ANALYZING TOURNAMENTS: ${tournamentNames.join(', ')}`);
  console.log('='.repeat(80));

  // Find all tournaments
  const tournaments = await prisma.tournament.findMany({
    where: {
      OR: tournamentNames.map(name => ({
        name: {
          contains: name,
          mode: 'insensitive',
        },
      })),
    },
    include: {
      stops: {
        include: {
          rounds: {
            include: {
              matches: {
                include: {
                  games: {
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

  if (tournaments.length === 0) {
    console.log(`\n❌ No tournaments found matching: ${tournamentNames.join(', ')}`);
    return;
  }

  const tournamentIds = tournaments.map(t => t.id);

  console.log(`\n🏆 Tournaments Found:`);
  tournaments.forEach(tournament => {
    console.log(`   ${tournament.name} (${tournament.type}) - ${tournament.stops.length} stops`);
  });

  // Get all lineup entries for these tournaments
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

  console.log(`\n📊 Total Lineup Entries: ${allLineupEntries.length}`);

  // Get all games for these tournaments
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
              name: true,
            },
          },
          teamB: {
            select: {
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

  console.log(`📊 Total Games: ${allGames.length}`);
  console.log(`   Completed Games: ${allGames.filter(g => g.isComplete).length}`);

  // Build a map of lineup entries to games
  // For each game, we need to find which lineup entries participated
  const lineupEntryToGames = new Map<string, Array<{
    game: typeof allGames[0];
    won: boolean;
    team: 'A' | 'B';
    teamName: string;
  }>>();

  // For each game, find the lineup entries that participated
  for (const game of allGames) {
    if (!game.isComplete || game.teamAScore === null || game.teamBScore === null) {
      continue;
    }

    const match = game.match;
    const round = match.round;

    // Find lineup entries for this round and slot
    const relevantLineups = allLineupEntries.filter(entry => 
      entry.lineup.roundId === round.id && 
      entry.slot === game.slot
    );

    // Determine which team won
    const teamAWon = game.teamAScore > game.teamBScore;
    const teamBWon = game.teamBScore > game.teamAScore;

    // For each lineup entry, check if their team was in this match
    for (const lineupEntry of relevantLineups) {
      const lineupTeam = lineupEntry.lineup.team;
      
      // Check if this lineup's team matches teamA or teamB
      const isTeamA = match.teamAId === lineupTeam.id;
      const isTeamB = match.teamBId === lineupTeam.id;

      if (isTeamA || isTeamB) {
        const won = isTeamA ? teamAWon : teamBWon;
        const team = isTeamA ? 'A' : 'B';

        // Add to both player1 and player2
        if (!lineupEntryToGames.has(lineupEntry.player1Id)) {
          lineupEntryToGames.set(lineupEntry.player1Id, []);
        }
        if (!lineupEntryToGames.has(lineupEntry.player2Id)) {
          lineupEntryToGames.set(lineupEntry.player2Id, []);
        }

        lineupEntryToGames.get(lineupEntry.player1Id)!.push({ game, won, team, teamName: lineupTeam.name });
        lineupEntryToGames.get(lineupEntry.player2Id)!.push({ game, won, team, teamName: lineupTeam.name });
      }
    }
  }

  // Calculate individual player stats
  const playerStats = new Map<string, {
    playerId: string;
    playerName: string;
    gamesPlayed: number;
    gamesWon: number;
    gamesLost: number;
    winPercentage: number;
    bySlot: {
      MENS_DOUBLES: { played: number; won: number; lost: number };
      WOMENS_DOUBLES: { played: number; won: number; lost: number };
      MIXED_1: { played: number; won: number; lost: number };
      MIXED_2: { played: number; won: number; lost: number };
    };
    byBracket: Map<string, { played: number; won: number; lost: number }>;
    byStop: Map<string, { played: number; won: number; lost: number }>;
  }>();

  // Get all unique players
  const allPlayers = new Set<string>();
  allLineupEntries.forEach(entry => {
    allPlayers.add(entry.player1Id);
    allPlayers.add(entry.player2Id);
  });

  // Initialize stats for each player
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
      bySlot: {
        MENS_DOUBLES: { played: 0, won: 0, lost: 0 },
        WOMENS_DOUBLES: { played: 0, won: 0, lost: 0 },
        MIXED_1: { played: 0, won: 0, lost: 0 },
        MIXED_2: { played: 0, won: 0, lost: 0 },
      },
      byBracket: new Map(),
      byStop: new Map(),
    });
  }

  // Calculate stats from games
  for (const [playerId, games] of lineupEntryToGames.entries()) {
    const stats = playerStats.get(playerId);
    if (!stats) continue;

    for (const { game, won, teamName } of games) {
      // Track team
      if (teamName) {
        stats.teams.set(teamName, (stats.teams.get(teamName) || 0) + 1);
      }
      stats.gamesPlayed++;
      if (won) stats.gamesWon++;
      else stats.gamesLost++;

      // By slot
      if (game.slot && stats.bySlot[game.slot as keyof typeof stats.bySlot]) {
        stats.bySlot[game.slot as keyof typeof stats.bySlot].played++;
        if (won) stats.bySlot[game.slot as keyof typeof stats.bySlot].won++;
        else stats.bySlot[game.slot as keyof typeof stats.bySlot].lost++;
      }

      // By bracket
      const bracketName = game.bracket?.name || 'No Bracket';
      if (!stats.byBracket.has(bracketName)) {
        stats.byBracket.set(bracketName, { played: 0, won: 0, lost: 0 });
      }
      const bracketStats = stats.byBracket.get(bracketName)!;
      bracketStats.played++;
      if (won) bracketStats.won++;
      else bracketStats.lost++;

      // By stop
      const stopName = game.match.round.stop.name;
      if (!stats.byStop.has(stopName)) {
        stats.byStop.set(stopName, { played: 0, won: 0, lost: 0 });
      }
      const stopStats = stats.byStop.get(stopName)!;
      stopStats.played++;
      if (won) stopStats.won++;
      else stopStats.lost++;
    }

    stats.winPercentage = stats.gamesPlayed > 0 
      ? (stats.gamesWon / stats.gamesPlayed) * 100 
      : 0;
  }

  // Calculate pair stats
  const pairStats = new Map<string, {
    player1Id: string;
    player1Name: string;
    player2Id: string;
    player2Name: string;
    gamesPlayed: number;
    gamesWon: number;
    gamesLost: number;
    winPercentage: number;
    teams: Map<string, number>; // team name -> count of games
    bySlot: Map<string, { played: number; won: number; lost: number }>;
  }>();

  // Group lineup entries by pair
  const pairMap = new Map<string, typeof allLineupEntries[0][]>();
  for (const entry of allLineupEntries) {
    const pairKey = [entry.player1Id, entry.player2Id].sort().join('|');
    if (!pairMap.has(pairKey)) {
      pairMap.set(pairKey, []);
    }
    pairMap.get(pairKey)!.push(entry);
  }

  // Calculate pair stats
  for (const [pairKey, entries] of pairMap.entries()) {
    const [player1Id, player2Id] = pairKey.split('|');
    const entry = entries[0];
    const player1Name = entry.player1.name || `${entry.player1.firstName} ${entry.player1.lastName}` || 'Unknown';
    const player2Name = entry.player2.name || `${entry.player2.firstName} ${entry.player2.lastName}` || 'Unknown';

    const pairGames: Array<{ game: typeof allGames[0]; won: boolean; teamName: string }> = [];

    // Find games where this pair played together
    for (const game of allGames) {
      if (!game.isComplete || game.teamAScore === null || game.teamBScore === null) {
        continue;
      }

      const match = game.match;
      const round = match.round;

      // Check if this pair has a lineup entry for this round and slot
      const pairEntry = entries.find(e => 
        e.lineup.roundId === round.id && 
        e.slot === game.slot
      );

      if (pairEntry) {
        const lineupTeam = pairEntry.lineup.team;
        const isTeamA = match.teamAId === lineupTeam.id;
        const isTeamB = match.teamBId === lineupTeam.id;

        if (isTeamA || isTeamB) {
          const teamAWon = game.teamAScore > game.teamBScore;
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
    const bySlot = new Map<string, { played: number; won: number; lost: number }>();
    for (const { game, won, teamName } of pairGames) {
      // Track team
      if (teamName) {
        teams.set(teamName, (teams.get(teamName) || 0) + 1);
      }
      const slot = game.slot || 'UNKNOWN';
      if (!bySlot.has(slot)) {
        bySlot.set(slot, { played: 0, won: 0, lost: 0 });
      }
      const slotStats = bySlot.get(slot)!;
      slotStats.played++;
      if (won) slotStats.won++;
      else slotStats.lost++;
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
      bySlot,
    });
  }

  // Display results
  console.log(`\n${'='.repeat(80)}`);
  console.log('INDIVIDUAL PLAYER STATISTICS');
  console.log('='.repeat(80));

  const sortedPlayers = Array.from(playerStats.values())
    .filter(p => p.gamesPlayed > 0)
    .sort((a, b) => {
      // Sort by win percentage (desc), then games played (desc)
      if (Math.abs(a.winPercentage - b.winPercentage) > 0.01) {
        return b.winPercentage - a.winPercentage;
      }
      return b.gamesPlayed - a.gamesPlayed;
    });

  console.log(`\n📈 Top Players by Win Percentage (min 5 games):`);
  sortedPlayers
    .filter(p => p.gamesPlayed >= 5)
    .slice(0, 10)
    .forEach((player, idx) => {
      // Get most common team(s)
      const teamEntries = Array.from(player.teams.entries()).sort((a, b) => b[1] - a[1]);
      const primaryTeam = teamEntries[0]?.[0] || 'Unknown';
      const teamDisplay = teamEntries.length > 1 && teamEntries[1][1] === teamEntries[0][1]
        ? `${primaryTeam} (tied)`
        : primaryTeam;
      
      console.log(`\n${idx + 1}. ${player.playerName} - ${teamDisplay}`);
      console.log(`   Overall: ${player.gamesWon}W - ${player.gamesLost}L (${player.winPercentage.toFixed(1)}%) - ${player.gamesPlayed} games`);
      console.log(`   By Slot:`);
      Object.entries(player.bySlot).forEach(([slot, stats]) => {
        if (stats.played > 0) {
          const pct = (stats.won / stats.played) * 100;
          console.log(`     ${slot}: ${stats.won}W - ${stats.lost}L (${pct.toFixed(1)}%) - ${stats.played} games`);
        }
      });
    });

  console.log(`\n\n📊 Most Active Players (by games played):`);
  sortedPlayers
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed)
    .slice(0, 10)
    .forEach((player, idx) => {
      // Get most common team(s)
      const teamEntries = Array.from(player.teams.entries()).sort((a, b) => b[1] - a[1]);
      const primaryTeam = teamEntries[0]?.[0] || 'Unknown';
      const teamDisplay = teamEntries.length > 1 && teamEntries[1][1] === teamEntries[0][1]
        ? `${primaryTeam} (tied)`
        : primaryTeam;
      
      console.log(`${idx + 1}. ${player.playerName} - ${teamDisplay}: ${player.gamesPlayed} games (${player.winPercentage.toFixed(1)}% win rate)`);
    });

  console.log(`\n\n${'='.repeat(80)}`);
  console.log('PAIR STATISTICS');
  console.log('='.repeat(80));

  const sortedPairs = Array.from(pairStats.values())
    .filter(p => p.gamesPlayed > 0)
    .sort((a, b) => {
      if (Math.abs(a.winPercentage - b.winPercentage) > 0.01) {
        return b.winPercentage - a.winPercentage;
      }
      return b.gamesPlayed - a.gamesPlayed;
    });

  console.log(`\n👥 Top Pairs by Win Percentage (min 3 games together):`);
  sortedPairs
    .filter(p => p.gamesPlayed >= 3)
    .slice(0, 10)
    .forEach((pair, idx) => {
      // Get most common team(s)
      const teamEntries = Array.from(pair.teams.entries()).sort((a, b) => b[1] - a[1]);
      const primaryTeam = teamEntries[0]?.[0] || 'Unknown';
      const teamDisplay = teamEntries.length > 1 && teamEntries[1][1] === teamEntries[0][1]
        ? `${primaryTeam} (tied)`
        : primaryTeam;
      
      console.log(`\n${idx + 1}. ${pair.player1Name} & ${pair.player2Name} - ${teamDisplay}`);
      console.log(`   Overall: ${pair.gamesWon}W - ${pair.gamesLost}L (${pair.winPercentage.toFixed(1)}%) - ${pair.gamesPlayed} games`);
      console.log(`   By Slot:`);
      Array.from(pair.bySlot.entries()).forEach(([slot, stats]) => {
        const pct = (stats.won / stats.played) * 100;
        console.log(`     ${slot}: ${stats.won}W - ${stats.lost}L (${pct.toFixed(1)}%) - ${stats.played} games`);
      });
    });

  console.log(`\n\n👥 Most Active Pairs (by games played together):`);
  sortedPairs
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed)
    .slice(0, 10)
    .forEach((pair, idx) => {
      // Get most common team(s)
      const teamEntries = Array.from(pair.teams.entries()).sort((a, b) => b[1] - a[1]);
      const primaryTeam = teamEntries[0]?.[0] || 'Unknown';
      const teamDisplay = teamEntries.length > 1 && teamEntries[1][1] === teamEntries[0][1]
        ? `${primaryTeam} (tied)`
        : primaryTeam;
      
      console.log(`${idx + 1}. ${pair.player1Name} & ${pair.player2Name} - ${teamDisplay}: ${pair.gamesPlayed} games (${pair.winPercentage.toFixed(1)}% win rate)`);
    });

  // Summary statistics
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('SUMMARY STATISTICS');
  console.log('='.repeat(80));
  console.log(`Total Players: ${playerStats.size}`);
  console.log(`Players with Games: ${sortedPlayers.length}`);
  console.log(`Total Pairs: ${pairStats.size}`);
  console.log(`Pairs with Games: ${sortedPairs.length}`);
  console.log(`Total Games Analyzed: ${allGames.filter(g => g.isComplete).length}`);

  const avgWinPercentage = sortedPlayers.length > 0
    ? sortedPlayers.reduce((sum, p) => sum + p.winPercentage, 0) / sortedPlayers.length
    : 0;
  console.log(`Average Win Percentage: ${avgWinPercentage.toFixed(1)}%`);

  const avgGamesPerPlayer = sortedPlayers.length > 0
    ? sortedPlayers.reduce((sum, p) => sum + p.gamesPlayed, 0) / sortedPlayers.length
    : 0;
  console.log(`Average Games per Player: ${avgGamesPerPlayer.toFixed(1)}`);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: npx tsx scripts/analyze-tournament-stats.ts <tournamentName1> [tournamentName2] ...');
  console.error('Example: npx tsx scripts/analyze-tournament-stats.ts "KLYNG CUP-GRAND" "KLYNG CUP-GRAND FINALE"');
  process.exit(1);
}

analyzeTournamentStats(args)
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

