import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function analyzeClubStatistics() {
  console.log(`\n${'='.repeat(80)}`);
  console.log('CLUB STATISTICS ANALYSIS');
  console.log('Tournaments: KLYNG CUP-GRAND, KLYNG CUP - GRAND FINALE');
  console.log('='.repeat(80));

  // Find tournaments
  const tournaments = await prisma.tournament.findMany({
    where: {
      OR: [
        { name: { contains: 'KLYNG CUP-GRAND', mode: 'insensitive' } },
        { name: { contains: 'KLYNG CUP - GRAND FINALE', mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true },
  });

  const tournamentIds = tournaments.map(t => t.id);

  console.log(`\nTournaments found: ${tournaments.map(t => t.name).join(', ')}`);

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
          club: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      player2: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          club: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      lineup: {
        include: {
          team: {
            select: {
              id: true,
              name: true,
              club: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          round: {
            include: {
              stop: {
                select: {
                  name: true,
                  tournament: { select: { name: true } },
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
              stop: { select: { name: true, tournament: { select: { name: true } } } },
            },
          },
          teamA: {
            select: {
              id: true,
              name: true,
              club: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          teamB: {
            select: {
              id: true,
              name: true,
              club: {
                select: {
                  id: true,
                  name: true,
                },
              },
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

  console.log(`\n📊 Total Games: ${allGames.length}`);
  console.log(`   Completed Games: ${allGames.filter(g => g.isComplete && g.teamAScore !== null && g.teamBScore !== null).length}`);

  // Build map of lineup entries to games
  const lineupEntryToGames = new Map<string, Array<{
    game: typeof allGames[0];
    won: boolean;
    teamName: string;
    clubName: string;
  }>>();

  for (const game of allGames) {
    if (!game.isComplete || game.teamAScore === null || game.teamBScore === null) {
      continue;
    }

    const match = game.match;
    const round = match.round;

    const relevantLineups = allLineupEntries.filter(entry => 
      entry.lineup.roundId === round.id && 
      entry.slot === game.slot
    );

    const teamAWon = game.teamAScore > game.teamBScore;
    const teamBWon = game.teamBScore > game.teamAScore;

    for (const lineupEntry of relevantLineups) {
      const lineupTeam = lineupEntry.lineup.team;
      const isTeamA = match.teamAId === lineupTeam.id;
      const isTeamB = match.teamBId === lineupTeam.id;

      if (isTeamA || isTeamB) {
        const won = isTeamA ? teamAWon : teamBWon;
        const clubName = lineupTeam.club?.name || 'No Club';

        if (!lineupEntryToGames.has(lineupEntry.player1Id)) {
          lineupEntryToGames.set(lineupEntry.player1Id, []);
        }
        if (!lineupEntryToGames.has(lineupEntry.player2Id)) {
          lineupEntryToGames.set(lineupEntry.player2Id, []);
        }

        lineupEntryToGames.get(lineupEntry.player1Id)!.push({ 
          game, 
          won, 
          teamName: lineupTeam.name,
          clubName,
        });
        lineupEntryToGames.get(lineupEntry.player2Id)!.push({ 
          game, 
          won, 
          teamName: lineupTeam.name,
          clubName,
        });
      }
    }
  }

  // Calculate club statistics
  const clubStats = new Map<string, {
    clubName: string;
    totalGames: number;
    gamesWon: number;
    gamesLost: number;
    winPercentage: number;
    players: Map<string, {
      playerId: string;
      playerName: string;
      gamesPlayed: number;
      gamesWon: number;
      gamesLost: number;
      winPercentage: number;
    }>;
    pairs: Map<string, {
      player1Id: string;
      player1Name: string;
      player2Id: string;
      player2Name: string;
      gamesPlayed: number;
      gamesWon: number;
      gamesLost: number;
      winPercentage: number;
    }>;
    byBracket: Map<string, { played: number; won: number; lost: number }>;
  }>();

  // Process all players and their games
  for (const [playerId, games] of lineupEntryToGames.entries()) {
    for (const { game, won, clubName } of games) {
      if (!clubStats.has(clubName)) {
        clubStats.set(clubName, {
          clubName,
          totalGames: 0,
          gamesWon: 0,
          gamesLost: 0,
          winPercentage: 0,
          players: new Map(),
          pairs: new Map(),
          byBracket: new Map(),
        });
      }

      const club = clubStats.get(clubName)!;
      club.totalGames++;
      if (won) club.gamesWon++;
      else club.gamesLost++;

      // Track player stats
      const entry = allLineupEntries.find(e => 
        (e.player1Id === playerId || e.player2Id === playerId) &&
        e.lineup.roundId === game.match.round.id &&
        e.slot === game.slot
      );

      if (entry) {
        const player = entry.player1Id === playerId ? entry.player1 : entry.player2;
        const playerName = player?.name || `${player?.firstName} ${player?.lastName}` || 'Unknown';

        if (!club.players.has(playerId)) {
          club.players.set(playerId, {
            playerId,
            playerName,
            gamesPlayed: 0,
            gamesWon: 0,
            gamesLost: 0,
            winPercentage: 0,
          });
        }

        const playerStats = club.players.get(playerId)!;
        playerStats.gamesPlayed++;
        if (won) playerStats.gamesWon++;
        else playerStats.gamesLost++;

        // Track pair stats
        const partnerId = entry.player1Id === playerId ? entry.player2Id : entry.player1Id;
        const partner = entry.player1Id === playerId ? entry.player2 : entry.player1;
        const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
        const pairKey = [playerId, partnerId].sort().join('|');

        if (!club.pairs.has(pairKey)) {
          club.pairs.set(pairKey, {
            player1Id: playerId < partnerId ? playerId : partnerId,
            player1Name: playerId < partnerId ? playerName : partnerName,
            player2Id: playerId < partnerId ? partnerId : playerId,
            player2Name: playerId < partnerId ? partnerName : playerName,
            gamesPlayed: 0,
            gamesWon: 0,
            gamesLost: 0,
            winPercentage: 0,
          });
        }

        const pairStats = club.pairs.get(pairKey)!;
        pairStats.gamesPlayed++;
        if (won) pairStats.gamesWon++;
        else pairStats.gamesLost++;

        // Track by bracket
        const bracketName = game.bracket?.name || 'No Bracket';
        if (!club.byBracket.has(bracketName)) {
          club.byBracket.set(bracketName, { played: 0, won: 0, lost: 0 });
        }
        const bracketStats = club.byBracket.get(bracketName)!;
        bracketStats.played++;
        if (won) bracketStats.won++;
        else bracketStats.lost++;
      }
    }
  }

  // Calculate win percentages
  for (const club of clubStats.values()) {
    club.winPercentage = club.totalGames > 0 
      ? (club.gamesWon / club.totalGames) * 100 
      : 0;

    for (const player of club.players.values()) {
      player.winPercentage = player.gamesPlayed > 0
        ? (player.gamesWon / player.gamesPlayed) * 100
        : 0;
    }

    for (const pair of club.pairs.values()) {
      pair.winPercentage = pair.gamesPlayed > 0
        ? (pair.gamesWon / pair.gamesPlayed) * 100
        : 0;
    }
  }

  // Sort clubs by win percentage
  const sortedClubs = Array.from(clubStats.values())
    .filter(c => c.totalGames > 0)
    .sort((a, b) => {
      // First by win percentage
      if (Math.abs(a.winPercentage - b.winPercentage) > 0.1) {
        return b.winPercentage - a.winPercentage;
      }
      // Then by total games
      return b.totalGames - a.totalGames;
    });

  console.log(`\n${'='.repeat(80)}`);
  console.log('CLUB PERFORMANCE RANKINGS');
  console.log('='.repeat(80));

  sortedClubs.forEach((club, idx) => {
    console.log(`\n${idx + 1}. ${club.clubName}`);
    console.log(`   Overall: ${club.gamesWon}W - ${club.gamesLost}L (${club.winPercentage.toFixed(1)}%) - ${club.totalGames} games`);
    console.log(`   Players: ${club.players.size} unique players`);
    console.log(`   Pairs: ${club.pairs.size} unique pairs`);
    
    if (club.byBracket.size > 0) {
      console.log(`   By Bracket:`);
      const bracketEntries = Array.from(club.byBracket.entries())
        .sort((a, b) => b[1].played - a[1].played);
      bracketEntries.forEach(([bracketName, stats]) => {
        const winPct = stats.played > 0 ? (stats.won / stats.played) * 100 : 0;
        console.log(`     ${bracketName}: ${stats.won}W - ${stats.lost}L (${winPct.toFixed(1)}%) - ${stats.played} games`);
      });
    }
  });

  console.log(`\n${'='.repeat(80)}`);
  console.log('TOP 3 PLAYERS BY CLUB');
  console.log('='.repeat(80));

  for (const club of sortedClubs) {
    const sortedPlayers = Array.from(club.players.values())
      .filter(p => p.gamesPlayed >= 5)
      .sort((a, b) => {
        // First sort by win percentage
        if (Math.abs(a.winPercentage - b.winPercentage) > 0.1) {
          return b.winPercentage - a.winPercentage;
        }
        // Then by games played (more games = better if win % is similar)
        return b.gamesPlayed - a.gamesPlayed;
      })
      .slice(0, 3);

    if (sortedPlayers.length > 0) {
      console.log(`\n${club.clubName}:`);
      sortedPlayers.forEach((player, idx) => {
        console.log(`  ${idx + 1}. ${player.playerName}: ${player.gamesWon}W - ${player.gamesLost}L (${player.winPercentage.toFixed(1)}%) - ${player.gamesPlayed} games`);
      });
    } else {
      console.log(`\n${club.clubName}:`);
      console.log(`  (No players with 5+ games)`);
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('TOP PAIRS BY CLUB');
  console.log('='.repeat(80));

  for (const club of sortedClubs) {
    const sortedPairs = Array.from(club.pairs.values())
      .filter(p => p.gamesPlayed >= 3)
      .sort((a, b) => {
        // First sort by win percentage
        if (Math.abs(a.winPercentage - b.winPercentage) > 0.1) {
          return b.winPercentage - a.winPercentage;
        }
        // Then by games played (more games = better if win % is similar)
        return b.gamesPlayed - a.gamesPlayed;
      })
      .slice(0, 5); // Top 5 pairs per club

    if (sortedPairs.length > 0) {
      console.log(`\n${club.clubName}:`);
      sortedPairs.forEach((pair, idx) => {
        console.log(`  ${idx + 1}. ${pair.player1Name} & ${pair.player2Name}: ${pair.gamesWon}W - ${pair.gamesLost}L (${pair.winPercentage.toFixed(1)}%) - ${pair.gamesPlayed} games`);
      });
    } else {
      console.log(`\n${club.clubName}:`);
      console.log(`  (No pairs with 3+ games)`);
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Clubs: ${sortedClubs.length}`);
  console.log(`Total Players: ${Array.from(clubStats.values()).reduce((sum, c) => sum + c.players.size, 0)}`);
  console.log(`Total Pairs: ${Array.from(clubStats.values()).reduce((sum, c) => sum + c.pairs.size, 0)}`);
  console.log(`Total Games: ${allGames.filter(g => g.isComplete && g.teamAScore !== null && g.teamBScore !== null).length}`);
}

analyzeClubStatistics()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

