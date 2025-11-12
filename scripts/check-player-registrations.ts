import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const playerIds = [
  'cmg07c262001drddc12y5sss9',
];

async function checkPlayerActivity() {
  try {
    console.log('Checking player activity for IDs:');
    console.log('  -', playerIds[0]);
    console.log('  -', playerIds[1]);
    console.log('\n');

    // Get player info first
    const players = await prisma.player.findMany({
      where: {
        id: { in: playerIds },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        name: true,
      },
    });

    console.log('Player Information:');
    players.forEach((player) => {
      const name = [player.firstName, player.lastName].filter(Boolean).join(' ') || player.name || 'Unknown';
      console.log(`  ID: ${player.id}`);
      console.log(`  Name: ${name}`);
      console.log(`  Email: ${player.email || 'N/A'}`);
      console.log('');
    });

    // 1. Check Team Rosters (TeamPlayer)
    console.log('\n=== Team Rosters (TeamPlayer) ===\n');
    const teamRosters = await prisma.teamPlayer.findMany({
      where: {
        playerId: { in: playerIds },
      },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            bracket: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (teamRosters.length === 0) {
      console.log('No team roster entries found.');
    } else {
      const rostersByPlayer = teamRosters.reduce((acc, roster) => {
        if (!acc[roster.playerId]) {
          acc[roster.playerId] = [];
        }
        acc[roster.playerId].push(roster);
        return acc;
      }, {} as Record<string, typeof teamRosters>);

      for (const playerId of playerIds) {
        const playerRosters = rostersByPlayer[playerId] || [];
        const player = players.find((p) => p.id === playerId);
        const playerName = player
          ? [player.firstName, player.lastName].filter(Boolean).join(' ') || player.name || 'Unknown'
          : 'Unknown';

        console.log(`\nPlayer: ${playerName} (${playerId})`);
        console.log('─'.repeat(60));

        if (playerRosters.length === 0) {
          console.log('  No team roster entries found.');
        } else {
          playerRosters.forEach((roster) => {
            console.log(`\n  Tournament: ${roster.tournament.name}`);
            console.log(`    Tournament ID: ${roster.tournament.id}`);
            console.log(`    Type: ${roster.tournament.type}`);
            console.log(`    Team: ${roster.team.name}`);
            console.log(`    Team ID: ${roster.team.id}`);
            console.log(`    Bracket: ${roster.team.bracket?.name || 'N/A'}`);
            console.log(`    Created At: ${roster.createdAt.toISOString()}`);
          });
        }
      }
    }

    // 2. Check Stop Rosters (StopTeamPlayer)
    console.log('\n\n=== Stop Rosters (StopTeamPlayer) ===\n');
    const stopRosters = await prisma.stopTeamPlayer.findMany({
      where: {
        playerId: { in: playerIds },
      },
      include: {
        stop: {
          select: {
            id: true,
            name: true,
            tournament: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            bracket: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (stopRosters.length === 0) {
      console.log('No stop roster entries found.');
    } else {
      const stopRostersByPlayer = stopRosters.reduce((acc, roster) => {
        if (!acc[roster.playerId]) {
          acc[roster.playerId] = [];
        }
        acc[roster.playerId].push(roster);
        return acc;
      }, {} as Record<string, typeof stopRosters>);

      for (const playerId of playerIds) {
        const playerStopRosters = stopRostersByPlayer[playerId] || [];
        const player = players.find((p) => p.id === playerId);
        const playerName = player
          ? [player.firstName, player.lastName].filter(Boolean).join(' ') || player.name || 'Unknown'
          : 'Unknown';

        console.log(`\nPlayer: ${playerName} (${playerId})`);
        console.log('─'.repeat(60));

        if (playerStopRosters.length === 0) {
          console.log('  No stop roster entries found.');
        } else {
          playerStopRosters.forEach((roster) => {
            console.log(`\n  Tournament: ${roster.stop.tournament.name}`);
            console.log(`    Tournament ID: ${roster.stop.tournament.id}`);
            console.log(`    Type: ${roster.stop.tournament.type}`);
            console.log(`    Stop: ${roster.stop.name}`);
            console.log(`    Stop ID: ${roster.stop.id}`);
            console.log(`    Team: ${roster.team.name}`);
            console.log(`    Team ID: ${roster.team.id}`);
            console.log(`    Bracket: ${roster.team.bracket?.name || 'N/A'}`);
            console.log(`    Created At: ${roster.createdAt.toISOString()}`);
          });
        }
      }
    }

    // 3. Check Lineups (LineupEntry - as player1 or player2)
    console.log('\n\n=== Lineups (LineupEntry) ===\n');
    const lineupEntries = await prisma.lineupEntry.findMany({
      where: {
        OR: [
          { player1Id: { in: playerIds } },
          { player2Id: { in: playerIds } },
        ],
      },
      include: {
        player1: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
          },
        },
        player2: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
          },
        },
        lineup: {
          include: {
            round: {
              include: {
                stop: {
                  select: {
                    id: true,
                    name: true,
                    tournament: {
                      select: {
                        id: true,
                        name: true,
                        type: true,
                      },
                    },
                  },
                },
              },
            },
            team: {
              select: {
                id: true,
                name: true,
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (lineupEntries.length === 0) {
      console.log('No lineup entries found.');
    } else {
      const lineupsByPlayer = lineupEntries.reduce((acc, entry) => {
        const playerId = entry.player1Id;
        const otherPlayerId = entry.player2Id;
        
        if (playerIds.includes(playerId)) {
          if (!acc[playerId]) {
            acc[playerId] = [];
          }
          acc[playerId].push({ ...entry, position: 'player1' });
        }
        
        if (playerIds.includes(otherPlayerId)) {
          if (!acc[otherPlayerId]) {
            acc[otherPlayerId] = [];
          }
          acc[otherPlayerId].push({ ...entry, position: 'player2' });
        }
        
        return acc;
      }, {} as Record<string, (typeof lineupEntries[0] & { position: 'player1' | 'player2' })[]>);

      for (const playerId of playerIds) {
        const playerLineups = lineupsByPlayer[playerId] || [];
        const player = players.find((p) => p.id === playerId);
        const playerName = player
          ? [player.firstName, player.lastName].filter(Boolean).join(' ') || player.name || 'Unknown'
          : 'Unknown';

        console.log(`\nPlayer: ${playerName} (${playerId})`);
        console.log('─'.repeat(60));

        if (playerLineups.length === 0) {
          console.log('  No lineup entries found.');
        } else {
          playerLineups.forEach((entry) => {
            const partner = entry.position === 'player1' ? entry.player2 : entry.player1;
            const partnerName = [partner.firstName, partner.lastName].filter(Boolean).join(' ') || partner.name || 'Unknown';
            
            console.log(`\n  Tournament: ${entry.lineup.round.stop.tournament.name}`);
            console.log(`    Tournament ID: ${entry.lineup.round.stop.tournament.id}`);
            console.log(`    Type: ${entry.lineup.round.stop.tournament.type}`);
            console.log(`    Stop: ${entry.lineup.round.stop.name}`);
            console.log(`    Team: ${entry.lineup.team.name}`);
            console.log(`    Round: ${entry.lineup.round.idx}`);
            console.log(`    Game Slot: ${entry.slot}`);
            console.log(`    Position: ${entry.position}`);
            console.log(`    Partner: ${partnerName} (${entry.position === 'player1' ? entry.player2Id : entry.player1Id})`);
            console.log(`    Created At: ${entry.createdAt.toISOString()}`);
          });
        }
      }
    }

    // 4. Get teams these players are on, then check matches
    console.log('\n\n=== Matches (via Teams) ===\n');
    const allTeamIds = [
      ...new Set([
        ...teamRosters.map((r) => r.teamId),
        ...stopRosters.map((r) => r.teamId),
      ]),
    ];

    let matches: Awaited<ReturnType<typeof prisma.match.findMany>> = [];
    if (allTeamIds.length === 0) {
      console.log('No teams found, so no matches to check.');
    } else {
      matches = await prisma.match.findMany({
        where: {
          OR: [
            { teamAId: { in: allTeamIds } },
            { teamBId: { in: allTeamIds } },
          ],
        },
        include: {
          teamA: {
            select: {
              id: true,
              name: true,
              tournament: {
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
              tournament: {
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
                  id: true,
                  name: true,
                  tournament: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
          games: {
            select: {
              id: true,
              slot: true,
              teamAScore: true,
              teamBScore: true,
              isComplete: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (matches.length === 0) {
        console.log('No matches found for teams these players are on.');
      } else {
        // Group matches by which player's teams are involved
        const matchesByPlayer = matches.reduce((acc, match) => {
          const teamAId = match.teamAId;
          const teamBId = match.teamBId;
          
          // Check which players are on these teams
          for (const playerId of playerIds) {
            const playerTeams = [
              ...teamRosters.filter((r) => r.playerId === playerId).map((r) => r.teamId),
              ...stopRosters.filter((r) => r.playerId === playerId).map((r) => r.teamId),
            ];
            
            if (playerTeams.includes(teamAId || '') || playerTeams.includes(teamBId || '')) {
              if (!acc[playerId]) {
                acc[playerId] = [];
              }
              if (!acc[playerId].find((m) => m.id === match.id)) {
                acc[playerId].push(match);
              }
            }
          }
          
          return acc;
        }, {} as Record<string, typeof matches>);

        for (const playerId of playerIds) {
          const playerMatches = matchesByPlayer[playerId] || [];
          const player = players.find((p) => p.id === playerId);
          const playerName = player
            ? [player.firstName, player.lastName].filter(Boolean).join(' ') || player.name || 'Unknown'
            : 'Unknown';

          console.log(`\nPlayer: ${playerName} (${playerId})`);
          console.log('─'.repeat(60));

          if (playerMatches.length === 0) {
            console.log('  No matches found.');
          } else {
            console.log(`  Found ${playerMatches.length} match(es):`);
            playerMatches.forEach((match) => {
              console.log(`\n    Match ID: ${match.id}`);
              console.log(`      Tournament: ${match.round.stop.tournament.name}`);
              console.log(`      Stop: ${match.round.stop.name}`);
              console.log(`      Round: ${match.round.idx}`);
              console.log(`      Team A: ${match.teamA?.name || 'Bye'}`);
              console.log(`      Team B: ${match.teamB?.name || 'Bye'}`);
              console.log(`      Winner: ${match.winnerId ? (match.teamAId === match.winnerId ? match.teamA?.name : match.teamB?.name) : 'Not decided'}`);
              console.log(`      Games: ${match.games.length}`);
              match.games.forEach((game) => {
                console.log(`        - ${game.slot || 'N/A'}: ${game.teamAScore || 0} - ${game.teamBScore || 0} ${game.isComplete ? '(Complete)' : '(Incomplete)'}`);
              });
            });
          }
        }
      }
    }

    // Summary
    console.log('\n\n=== Summary ===\n');
    for (const playerId of playerIds) {
      const player = players.find((p) => p.id === playerId);
      const playerName = player
        ? [player.firstName, player.lastName].filter(Boolean).join(' ') || player.name || 'Unknown'
        : 'Unknown';
      
      const teamRosterCount = teamRosters.filter((r) => r.playerId === playerId).length;
      const stopRosterCount = stopRosters.filter((r) => r.playerId === playerId).length;
      const lineupCount = lineupEntries.filter((e) => e.player1Id === playerId || e.player2Id === playerId).length;
      const playerTeams = [
        ...teamRosters.filter((r) => r.playerId === playerId).map((r) => r.teamId),
        ...stopRosters.filter((r) => r.playerId === playerId).map((r) => r.teamId),
      ];
      const matchCount = matches.filter((m) => 
        playerTeams.includes(m.teamAId || '') || playerTeams.includes(m.teamBId || '')
      ).length;

      console.log(`${playerName} (${playerId}):`);
      console.log(`  - Team Rosters: ${teamRosterCount}`);
      console.log(`  - Stop Rosters: ${stopRosterCount}`);
      console.log(`  - Lineup Entries: ${lineupCount}`);
      console.log(`  - Matches: ${matchCount}`);
    }

  } catch (error) {
    console.error('Error checking player activity:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPlayerActivity();

