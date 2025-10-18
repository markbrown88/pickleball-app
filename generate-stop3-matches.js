const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function generateStop3Matches() {
  try {
    console.log('🏆 Generating Stop 3 matches for Klyng Cup tournament...\n');

    // Get the Klyng Cup tournament (not Pickleplex)
    const tournament = await prisma.tournament.findUnique({
      where: { id: 'cmfot1xt50000rd6a1gvw8ozn' },
      select: { id: true, name: true }
    });

    if (!tournament) {
      console.log('❌ Tournament not found');
      return;
    }

    console.log(`📊 Tournament: ${tournament.name} (${tournament.id})`);

    // Get Stop 3
    const stop = await prisma.stop.findFirst({
      where: { 
        tournamentId: tournament.id,
        name: 'Stop 3'
      },
      select: { id: true, name: true }
    });

    if (!stop) {
      console.log('❌ Stop 3 not found');
      return;
    }

    console.log(`📍 Stop: ${stop.name} (${stop.id})`);

    // Get all rounds for Stop 3
    const rounds = await prisma.round.findMany({
      where: { stopId: stop.id },
      orderBy: { idx: 'asc' },
      select: {
        id: true,
        idx: true
      }
    });

    console.log(`🔄 Found ${rounds.length} rounds`);

    // Get all lineup data for this stop upfront
    console.log('📋 Fetching lineup data...');
    const allLineups = await prisma.lineup.findMany({
      where: {
        stopId: stop.id
      },
      include: {
        team: {
          select: {
            id: true,
            name: true
          }
        },
        entries: {
          include: {
            player1: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true
              }
            },
            player2: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    console.log(`📊 Found ${allLineups.length} lineups`);

    // Create a lookup map for lineups by team and round
    const lineupMap = new Map();
    allLineups.forEach(lineup => {
      const key = `${lineup.teamId}-${lineup.roundId}`;
      lineupMap.set(key, lineup);
    });

    const result = {
      tournament: {
        id: tournament.id,
        name: tournament.name
      },
      stop: {
        id: stop.id,
        name: stop.name
      },
      rounds: []
    };

    // Process each round
    for (const round of rounds) {
      console.log(`\n📋 Processing Round ${round.idx + 1}...`);

      // Get matches for this round
      const matches = await prisma.match.findMany({
        where: { roundId: round.id },
        include: {
          teamA: {
            select: {
              id: true,
              name: true,
              club: {
                select: { name: true }
              }
            }
          },
          teamB: {
            select: {
              id: true,
              name: true,
              club: {
                select: { name: true }
              }
            }
          },
          games: {
            select: {
              id: true,
              slot: true,
              teamALineup: true,
              teamBLineup: true
            },
            orderBy: {
              slot: 'asc'
            }
          }
        }
      });

      console.log(`  Found ${matches.length} matches`);

      const roundData = {
        roundNumber: round.idx + 1,
        roundId: round.id,
        matchups: []
      };

      // Process each match
      for (const match of matches) {
        console.log(`    Processing match: ${match.teamA.name} vs ${match.teamB.name}`);

        const matchup = {
          matchId: match.id,
          teamA: {
            id: match.teamA.id,
            name: match.teamA.name,
            clubName: match.teamA.club.name
          },
          teamB: {
            id: match.teamB.id,
            name: match.teamB.name,
            clubName: match.teamB.club.name
          },
          games: []
        };

        // Get lineup data for both teams in this round
        const teamALineup = lineupMap.get(`${match.teamA.id}-${round.id}`);
        const teamBLineup = lineupMap.get(`${match.teamB.id}-${round.id}`);

        // Process each game in the match
        for (const game of match.games) {
          const gameType = getGameTypeName(game.slot);
          
          const gameData = {
            gameId: game.id,
            gameType: gameType,
            slot: game.slot,
            teamAPlayers: [],
            teamBPlayers: []
          };

          // For tiebreakers, show team names instead of player names
          if (game.slot === 'TIEBREAKER') {
            gameData.teamAPlayers = [{
              id: match.teamA.id,
              name: match.teamA.name
            }];
            gameData.teamBPlayers = [{
              id: match.teamB.id,
              name: match.teamB.name
            }];
          } else {
            // For regular games, get players from lineup data
            if (teamALineup) {
              const teamAEntries = teamALineup.entries.filter(entry => entry.slot === game.slot);
              for (const entry of teamAEntries) {
                if (entry.player1) {
                  gameData.teamAPlayers.push({
                    id: entry.player1.id,
                    name: entry.player1.name || `${entry.player1.firstName || ''} ${entry.player1.lastName || ''}`.trim()
                  });
                }
                if (entry.player2) {
                  gameData.teamAPlayers.push({
                    id: entry.player2.id,
                    name: entry.player2.name || `${entry.player2.firstName || ''} ${entry.player2.lastName || ''}`.trim()
                  });
                }
              }
            }

            if (teamBLineup) {
              const teamBEntries = teamBLineup.entries.filter(entry => entry.slot === game.slot);
              for (const entry of teamBEntries) {
                if (entry.player1) {
                  gameData.teamBPlayers.push({
                    id: entry.player1.id,
                    name: entry.player1.name || `${entry.player1.firstName || ''} ${entry.player1.lastName || ''}`.trim()
                  });
                }
                if (entry.player2) {
                  gameData.teamBPlayers.push({
                    id: entry.player2.id,
                    name: entry.player2.name || `${entry.player2.firstName || ''} ${entry.player2.lastName || ''}`.trim()
                  });
                }
              }
            }
          }

          matchup.games.push(gameData);
        }

        roundData.matchups.push(matchup);
      }

      result.rounds.push(roundData);
    }

    // Write to JSON file
    const fs = require('fs');
    const filename = 'klyng-cup-stop3-matches.json';
    fs.writeFileSync(filename, JSON.stringify(result, null, 2));
    
    console.log(`\n✅ Generated ${filename}`);
    console.log(`📊 Summary:`);
    console.log(`   - ${result.rounds.length} rounds`);
    console.log(`   - ${result.rounds.reduce((total, round) => total + round.matchups.length, 0)} total matchups`);
    console.log(`   - ${result.rounds.reduce((total, round) => total + round.matchups.reduce((matchTotal, match) => matchTotal + match.games.length, 0), 0)} total games`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

function getGameTypeName(slot) {
  switch (slot) {
    case 'MENS_DOUBLES': return "Men's Doubles";
    case 'WOMENS_DOUBLES': return "Women's Doubles";
    case 'MIXED_1': return "Mixed Doubles 1";
    case 'MIXED_2': return "Mixed Doubles 2";
    case 'TIEBREAKER': return "Tiebreaker";
    default: return slot;
  }
}

generateStop3Matches();

