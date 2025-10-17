const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function exportStop3Data() {
  try {
    console.log('🏓 Exporting Stop 3 data for Klyng Cup...\n');

    // Find the main Klyng Cup tournament
    const tournament = await prisma.tournament.findFirst({
      where: {
        name: {
          equals: 'Klyng Cup',
          mode: 'insensitive'
        }
      }
    });

    if (!tournament) {
      console.log('❌ Klyng Cup tournament not found');
      return;
    }

    console.log(`📍 Tournament: ${tournament.name}`);
    console.log(`🆔 Tournament ID: ${tournament.id}\n`);

    // Find Stop 3
    const stop3 = await prisma.stop.findFirst({
      where: {
        tournamentId: tournament.id,
        name: {
          contains: '3',
          mode: 'insensitive'
        }
      },
      include: {
        rounds: {
          include: {
            matches: {
              include: {
                teamA: {
                  include: {
                    club: {
                      select: {
                        name: true
                      }
                    },
                    bracket: {
                      select: {
                        name: true
                      }
                    }
                  }
                },
                teamB: {
                  include: {
                    club: {
                      select: {
                        name: true
                      }
                    },
                    bracket: {
                      select: {
                        name: true
                      }
                    }
                  }
                },
                games: true
              }
            }
          }
        }
      }
    });

    if (!stop3) {
      console.log('❌ Stop 3 not found');
      return;
    }

    console.log(`📍 Stop: ${stop3.name}`);
    console.log(`🆔 Stop ID: ${stop3.id}`);
    console.log(`📅 Dates: ${stop3.startAt} to ${stop3.endAt}\n`);

    // Process the data
    const stopData = {
      tournament: {
        id: tournament.id,
        name: tournament.name
      },
      stop: {
        id: stop3.id,
        name: stop3.name,
        startAt: stop3.startAt,
        endAt: stop3.endAt
      },
      rounds: stop3.rounds.map(round => ({
        id: round.id,
        name: round.name,
        idx: round.idx,
        matches: round.matches.map(match => ({
          id: match.id,
          isBye: match.isBye,
          forfeitTeam: match.forfeitTeam,
          tiebreakerStatus: match.tiebreakerStatus,
          tiebreakerWinnerTeamId: match.tiebreakerWinnerTeamId,
          totalPointsTeamA: match.totalPointsTeamA,
          totalPointsTeamB: match.totalPointsTeamB,
          teamA: match.teamA ? {
            id: match.teamA.id,
            name: match.teamA.name,
            club: {
              id: match.teamA.club.id,
              name: match.teamA.club.name
            },
            bracket: {
              id: match.teamA.bracket.id,
              name: match.teamA.bracket.name
            }
          } : null,
          teamB: match.teamB ? {
            id: match.teamB.id,
            name: match.teamB.name,
            club: {
              id: match.teamB.club.id,
              name: match.teamB.club.name
            },
            bracket: {
              id: match.teamB.bracket.id,
              name: match.teamB.bracket.name
            }
          } : null,
          games: match.games.map(game => ({
            id: game.id,
            slot: game.slot,
            teamAScore: game.teamAScore,
            teamBScore: game.teamBScore,
            teamALineup: game.teamALineup,
            teamBLineup: game.teamBLineup,
            lineupConfirmed: game.lineupConfirmed,
            courtNumber: game.courtNumber,
            isComplete: game.isComplete,
            startedAt: game.startedAt,
            endedAt: game.endedAt,
            teamAScoreSubmitted: game.teamAScoreSubmitted,
            teamBScoreSubmitted: game.teamBScoreSubmitted,
            teamASubmittedScore: game.teamASubmittedScore,
            teamBSubmittedScore: game.teamBSubmittedScore
          }))
        }))
      }))
    };

    // Write to JSON file
    const filename = `stop3-data-${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(filename, JSON.stringify(stopData, null, 2));

    console.log(`✅ Data exported to ${filename}`);
    console.log(`📊 Summary:`);
    console.log(`   - Rounds: ${stopData.rounds.length}`);
    console.log(`   - Total matches: ${stopData.rounds.reduce((sum, round) => sum + round.matches.length, 0)}`);
    console.log(`   - Total games: ${stopData.rounds.reduce((sum, round) => 
      sum + round.matches.reduce((matchSum, match) => matchSum + match.games.length, 0), 0)}`);

    // Show some sample data
    console.log(`\n📋 Sample match data:`);
    if (stopData.rounds.length > 0 && stopData.rounds[0].matches.length > 0) {
      const sampleMatch = stopData.rounds[0].matches[0];
      console.log(`   Match: ${sampleMatch.teamA?.name || 'TBD'} vs ${sampleMatch.teamB?.name || 'TBD'}`);
      console.log(`   Games: ${sampleMatch.games.length}`);
      if (sampleMatch.games.length > 0) {
        const sampleGame = sampleMatch.games[0];
        console.log(`   Sample game: ${sampleGame.slot} - ${sampleGame.teamAScore || 'TBD'}:${sampleGame.teamBScore || 'TBD'}`);
        console.log(`   Players in game: ${sampleGame.lineupA.length + sampleGame.lineupB.length}`);
      }
    }

  } catch (error) {
    console.error('❌ Error exporting Stop 3 data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

exportStop3Data();
