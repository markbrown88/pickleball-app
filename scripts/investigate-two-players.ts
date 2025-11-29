import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function investigatePlayer(playerId: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`INVESTIGATING PLAYER: ${playerId}`);
  console.log('='.repeat(80));

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      name: true,
      email: true,
      phone: true,
      clerkUserId: true,
      city: true,
      region: true,
      duprDoubles: true,
      createdAt: true,
    },
  });

  if (!player) {
    console.log(`❌ Player with ID ${playerId} not found.`);
    return;
  }

  console.log(`\nPlayer Info:`);
  console.log(`  Name: ${player.name || `${player.firstName} ${player.lastName}`}`);
  console.log(`  Email: ${player.email || 'None'}`);
  console.log(`  Phone: ${player.phone || 'None'}`);
  console.log(`  Clerk ID: ${player.clerkUserId || 'None'}`);
  console.log(`  Location: ${player.city || 'None'}, ${player.region || 'None'}`);
  console.log(`  DUPR Doubles: ${player.duprDoubles || 'None'}`);
  console.log(`  Created: ${player.createdAt.toISOString()}`);

  // Tournament Registrations
  const registrations = await prisma.tournamentRegistration.findMany({
    where: { playerId },
    include: {
      tournament: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
  });
  console.log(`\n📋 Tournament Registrations: ${registrations.length}`);
  if (registrations.length > 0) {
    registrations.forEach((reg, idx) => {
      console.log(`  ${idx + 1}. ${reg.tournament.name} (${reg.tournament.type})`);
      console.log(`     Registration ID: ${reg.id}`);
      console.log(`     Status: ${reg.status}, Payment: ${reg.paymentStatus}`);
    });
  }

  // Roster Entries (StopTeamPlayer)
  const rosterEntries = await prisma.stopTeamPlayer.findMany({
    where: { playerId },
    include: {
      stop: {
        include: {
          tournament: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      team: {
        include: {
          bracket: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });
  console.log(`\n👥 Roster Entries: ${rosterEntries.length}`);
  if (rosterEntries.length > 0) {
    rosterEntries.forEach((entry, idx) => {
      console.log(`  ${idx + 1}. Tournament: ${entry.stop.tournament.name}`);
      console.log(`     Stop: ${entry.stop.name}`);
      console.log(`     Team: ${entry.team?.name || 'No team'}`);
      console.log(`     Bracket: ${entry.team?.bracket?.name || 'No bracket'}`);
      console.log(`     Payment Method: ${entry.paymentMethod || 'None'}`);
    });
  }

  // Lineup Entries as Player 1
  const lineupEntriesP1 = await prisma.lineupEntry.findMany({
    where: { player1Id: playerId },
    include: {
      lineup: {
        include: {
          round: {
            include: {
              stop: {
                include: {
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
    },
  });
  console.log(`\n🎾 Lineup Entries as Player 1: ${lineupEntriesP1.length}`);
  if (lineupEntriesP1.length > 0) {
    lineupEntriesP1.forEach((entry, idx) => {
      const partner = entry.player2;
      const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'TBD';
      console.log(`  ${idx + 1}. Tournament: ${entry.lineup.round.stop.tournament.name}`);
      console.log(`     Stop: ${entry.lineup.round.stop.name}`);
      console.log(`     Round: ${entry.lineup.round.idx} (${entry.lineup.round.bracketType})`);
      console.log(`     Partner: ${partnerName}`);
      console.log(`     Slot: ${entry.slot}`);
    });
  }

  // Lineup Entries as Player 2
  const lineupEntriesP2 = await prisma.lineupEntry.findMany({
    where: { player2Id: playerId },
    include: {
      lineup: {
        include: {
          round: {
            include: {
              stop: {
                include: {
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
        },
      },
      player1: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
  console.log(`\n🎾 Lineup Entries as Player 2: ${lineupEntriesP2.length}`);
  if (lineupEntriesP2.length > 0) {
    lineupEntriesP2.forEach((entry, idx) => {
      const partner = entry.player1;
      const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'TBD';
      console.log(`  ${idx + 1}. Tournament: ${entry.lineup.round.stop.tournament.name}`);
      console.log(`     Stop: ${entry.lineup.round.stop.name}`);
      console.log(`     Round: ${entry.lineup.round.idx} (${entry.lineup.round.bracketType})`);
      console.log(`     Partner: ${partnerName}`);
      console.log(`     Slot: ${entry.slot}`);
    });
  }

  // Games (through matches in rounds where player has lineups)
  const roundIds = [
    ...new Set([
      ...lineupEntriesP1.map(e => e.lineup.roundId),
      ...lineupEntriesP2.map(e => e.lineup.roundId),
    ]),
  ];

  const games = await prisma.game.findMany({
    where: {
      match: {
        roundId: { in: roundIds },
      },
    },
    include: {
      bracket: {
        select: {
          name: true,
        },
      },
      match: {
        include: {
          round: {
            include: {
              stop: {
                include: {
                  tournament: {
                    select: {
                      name: true,
                    },
                  },
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
    },
  });
  console.log(`\n🏓 Games in Rounds with Lineups: ${games.length}`);
  if (games.length > 0) {
    games.forEach((game, idx) => {
      console.log(`  ${idx + 1}. Tournament: ${game.match.round.stop.tournament.name}`);
      console.log(`     Stop: ${game.match.round.stop.name}`);
      console.log(`     Round: ${game.match.round.idx} (${game.match.round.bracketType || 'null'})`);
      console.log(`     Bracket: ${game.bracket?.name || 'No bracket'}`);
      console.log(`     Slot: ${game.slot || 'No slot'}`);
      console.log(`     Teams: ${game.match.teamA?.name || 'TBD'} vs ${game.match.teamB?.name || 'TBD'}`);
      console.log(`     Score: ${game.teamAScore || 0} - ${game.teamBScore || 0}`);
      console.log(`     Complete: ${game.isComplete ? 'Yes' : 'No'}`);
    });
  }

  // Team Memberships
  const teamMemberships = await prisma.teamPlayer.findMany({
    where: { playerId },
    include: {
      team: {
        include: {
          bracket: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });
  console.log(`\n👥 Team Memberships: ${teamMemberships.length}`);
  if (teamMemberships.length > 0) {
    teamMemberships.forEach((membership, idx) => {
      console.log(`  ${idx + 1}. Team: ${membership.team.name}`);
      console.log(`     Bracket: ${membership.team.bracket?.name || 'No bracket'}`);
    });
  }

  // Tournament Captain Roles
  const captainRoles = await prisma.tournamentCaptain.findMany({
    where: { playerId },
    include: {
      tournament: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
  console.log(`\n👑 Tournament Captain Roles: ${captainRoles.length}`);
  if (captainRoles.length > 0) {
    captainRoles.forEach((role, idx) => {
      console.log(`  ${idx + 1}. ${role.tournament.name}`);
    });
  }

  // Tournament Admin Roles
  const adminRoles = await prisma.tournamentAdmin.findMany({
    where: { playerId },
    include: {
      tournament: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
  console.log(`\n⚙️ Tournament Admin Roles: ${adminRoles.length}`);
  if (adminRoles.length > 0) {
    adminRoles.forEach((role, idx) => {
      console.log(`  ${idx + 1}. ${role.tournament.name}`);
    });
  }

  // Match Tiebreaker Decisions
  const matchTiebreakers = await prisma.match.findMany({
    where: { tiebreakerDecidedById: playerId },
    include: {
      round: {
        include: {
          stop: {
            include: {
              tournament: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });
  console.log(`\n⚖️ Match Tiebreaker Decisions: ${matchTiebreakers.length}`);
  if (matchTiebreakers.length > 0) {
    matchTiebreakers.forEach((match, idx) => {
      console.log(`  ${idx + 1}. Tournament: ${match.round.stop.tournament.name}`);
      console.log(`     Stop: ${match.round.stop.name}`);
      console.log(`     Match ID: ${match.id}`);
    });
  }

  console.log(`\n${'='.repeat(80)}`);
}

async function main() {
  const playerIds = process.argv.slice(2);

  if (playerIds.length === 0) {
    console.log('Usage: npx tsx scripts/investigate-two-players.ts <player_id_1> <player_id_2> ...');
    return;
  }

  try {
    for (const id of playerIds) {
      await investigatePlayer(id);
    }
  } catch (error) {
    console.error('Error during investigation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

