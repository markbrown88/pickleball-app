import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function reportOnPlayers() {
  const playerIds = [
    'cmiqqwqpi0001i604w731kzpb',
    'cmi3pdyrz0001jv048q7gqfrl'
  ];

  for (const playerId of playerIds) {
    console.log('\n' + '='.repeat(80));
    console.log(`PLAYER REPORT: ${playerId}`);
    console.log('='.repeat(80));

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      include: {
        club: {
          select: {
            id: true,
            name: true,
            city: true,
            region: true,
          },
        },
      },
    });

    if (!player) {
      console.log(`❌ Player not found!`);
      continue;
    }

    console.log('\n📋 BASIC INFORMATION');
    console.log('─'.repeat(80));
    console.log(`Name: ${player.firstName || '(blank)'} ${player.lastName || '(blank)'}`);
    console.log(`Full Name: ${player.name || 'N/A'}`);
    console.log(`Email: ${player.email || 'N/A'}`);
    console.log(`Phone: ${player.phone || 'N/A'}`);
    console.log(`City: ${player.city || 'N/A'}`);
    console.log(`Region: ${player.region || 'N/A'}`);
    console.log(`Club: ${player.club?.name || 'N/A'} (${player.club?.city || 'N/A'}, ${player.club?.region || 'N/A'})`);
    console.log(`Clerk User ID: ${player.clerkUserId || 'N/A'}`);
    console.log(`Created: ${player.createdAt.toISOString().split('T')[0]}`);
    console.log(`DUPR Doubles: ${player.duprDoubles ?? 'N/A'}`);
    console.log(`DUPR Singles: ${player.duprSingles ?? 'N/A'}`);
    console.log(`Club Rating Doubles: ${player.clubRatingDoubles ?? 'N/A'}`);
    console.log(`Club Rating Singles: ${player.clubRatingSingles ?? 'N/A'}`);

    // Roster entries
    const rosterEntries = await prisma.stopTeamPlayer.findMany({
      where: { playerId },
      include: {
        stop: {
          select: {
            id: true,
            name: true,
            startAt: true,
            tournament: {
              select: {
                id: true,
                name: true,
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
        stop: {
          startAt: 'asc',
        },
      },
    });

    console.log('\n📊 ROSTER ENTRIES');
    console.log('─'.repeat(80));
    console.log(`Total: ${rosterEntries.length}`);
    if (rosterEntries.length > 0) {
      rosterEntries.forEach((entry, idx) => {
        console.log(`\n${idx + 1}. ${entry.team.name} (${entry.team.bracket?.name || 'No Bracket'})`);
        console.log(`   Tournament: ${entry.stop.tournament.name}`);
        console.log(`   Stop: ${entry.stop.name}`);
        console.log(`   Date: ${entry.stop.startAt ? new Date(entry.stop.startAt).toLocaleDateString() : 'N/A'}`);
      });
    }

    // Lineup entries (as player1)
    const lineupEntriesP1 = await prisma.lineupEntry.findMany({
      where: { player1Id: playerId },
      include: {
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
          },
        },
      },
      orderBy: {
        lineup: {
          round: {
            stop: {
              startAt: 'asc',
            },
          },
        },
      },
    });

    // Lineup entries (as player2)
    const lineupEntriesP2 = await prisma.lineupEntry.findMany({
      where: { player2Id: playerId },
      include: {
        player1: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
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
          },
        },
      },
      orderBy: {
        lineup: {
          round: {
            stop: {
              startAt: 'asc',
            },
          },
        },
      },
    });

    console.log('\n🎾 LINEUP ENTRIES');
    console.log('─'.repeat(80));
    console.log(`As Player 1: ${lineupEntriesP1.length}`);
    console.log(`As Player 2: ${lineupEntriesP2.length}`);
    console.log(`Total: ${lineupEntriesP1.length + lineupEntriesP2.length}`);

    if (lineupEntriesP1.length > 0) {
      console.log('\nAs Player 1:');
      lineupEntriesP1.slice(0, 10).forEach((entry, idx) => {
        const partner = entry.player2;
        const partnerName = partner?.name || `${partner?.firstName || ''} ${partner?.lastName || ''}`.trim() || 'Unknown';
        console.log(`  ${idx + 1}. ${entry.slot} with ${partnerName}`);
        console.log(`     Team: ${entry.lineup.team.name}`);
        console.log(`     Tournament: ${entry.lineup.round.stop.tournament.name}`);
        console.log(`     Stop: ${entry.lineup.round.stop.name}`);
      });
      if (lineupEntriesP1.length > 10) {
        console.log(`  ... and ${lineupEntriesP1.length - 10} more`);
      }
    }

    if (lineupEntriesP2.length > 0) {
      console.log('\nAs Player 2:');
      lineupEntriesP2.slice(0, 10).forEach((entry, idx) => {
        const partner = entry.player1;
        const partnerName = partner?.name || `${partner?.firstName || ''} ${partner?.lastName || ''}`.trim() || 'Unknown';
        console.log(`  ${idx + 1}. ${entry.slot} with ${partnerName}`);
        console.log(`     Team: ${entry.lineup.team.name}`);
        console.log(`     Tournament: ${entry.lineup.round.stop.tournament.name}`);
        console.log(`     Stop: ${entry.lineup.round.stop.name}`);
      });
      if (lineupEntriesP2.length > 10) {
        console.log(`  ... and ${lineupEntriesP2.length - 10} more`);
      }
    }

    // Team memberships
    const teamMemberships = await prisma.teamPlayer.findMany({
      where: { playerId },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            tournament: {
              select: {
                id: true,
                name: true,
              },
            },
            bracket: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    console.log('\n👥 TEAM MEMBERSHIPS');
    console.log('─'.repeat(80));
    console.log(`Total: ${teamMemberships.length}`);
    if (teamMemberships.length > 0) {
      teamMemberships.forEach((membership, idx) => {
        console.log(`  ${idx + 1}. ${membership.team.name} (${membership.team.bracket?.name || 'No Bracket'})`);
        console.log(`     Tournament: ${membership.team.tournament.name}`);
      });
    }

    // Tournament registrations
    const registrations = await prisma.tournamentRegistration.findMany({
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

    console.log('\n📝 TOURNAMENT REGISTRATIONS');
    console.log('─'.repeat(80));
    console.log(`Total: ${registrations.length}`);
    if (registrations.length > 0) {
      registrations.forEach((reg, idx) => {
        console.log(`  ${idx + 1}. ${reg.tournament.name}`);
        console.log(`     Status: ${reg.status}`);
        if (reg.createdAt) {
          console.log(`     Created: ${reg.createdAt.toISOString().split('T')[0]}`);
        }
      });
    }

    // Captain teams
    const captainTeams = await prisma.team.findMany({
      where: { captainId: playerId },
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
    });

    console.log('\n👑 CAPTAIN OF TEAMS');
    console.log('─'.repeat(80));
    console.log(`Total: ${captainTeams.length}`);
    if (captainTeams.length > 0) {
      captainTeams.forEach((team, idx) => {
        console.log(`  ${idx + 1}. ${team.name}`);
        console.log(`     Tournament: ${team.tournament.name}`);
      });
    }

    // Tournament admin roles
    const tournamentAdmins = await prisma.tournamentAdmin.findMany({
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

    console.log('\n⚙️  TOURNAMENT ADMIN ROLES');
    console.log('─'.repeat(80));
    console.log(`Total: ${tournamentAdmins.length}`);
    if (tournamentAdmins.length > 0) {
      tournamentAdmins.forEach((admin, idx) => {
        console.log(`  ${idx + 1}. ${admin.tournament.name}`);
      });
    }

    // Tournament captain roles
    const tournamentCaptains = await prisma.tournamentCaptain.findMany({
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

    console.log('\n🎯 TOURNAMENT CAPTAIN ROLES');
    console.log('─'.repeat(80));
    console.log(`Total: ${tournamentCaptains.length}`);
    if (tournamentCaptains.length > 0) {
      tournamentCaptains.forEach((captain, idx) => {
        console.log(`  ${idx + 1}. ${captain.tournament.name}`);
      });
    }

    // Event manager roles
    const eventManagers = await prisma.tournamentEventManager.findMany({
      where: { playerId },
      include: {
        Tournament: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    console.log('\n📅 EVENT MANAGER ROLES');
    console.log('─'.repeat(80));
    console.log(`Total: ${eventManagers.length}`);
    if (eventManagers.length > 0) {
      eventManagers.forEach((manager, idx) => {
        console.log(`  ${idx + 1}. ${manager.Tournament.name}`);
      });
    }

    // Stops managed
    const stopsManaged = await prisma.stop.findMany({
      where: { eventManagerId: playerId },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    console.log('\n📍 STOPS MANAGED');
    console.log('─'.repeat(80));
    console.log(`Total: ${stopsManaged.length}`);
    if (stopsManaged.length > 0) {
      stopsManaged.forEach((stop, idx) => {
        console.log(`  ${idx + 1}. ${stop.name}`);
        console.log(`     Tournament: ${stop.tournament.name}`);
      });
    }

    // Club director roles
    const clubsAsDirector = await prisma.club.findMany({
      where: { directorId: playerId },
      select: {
        id: true,
        name: true,
        city: true,
        region: true,
      },
    });

    console.log('\n🏢 CLUB DIRECTOR ROLES');
    console.log('─'.repeat(80));
    console.log(`Total: ${clubsAsDirector.length}`);
    if (clubsAsDirector.length > 0) {
      clubsAsDirector.forEach((club, idx) => {
        console.log(`  ${idx + 1}. ${club.name} (${club.city || 'N/A'}, ${club.region || 'N/A'})`);
      });
    }

    // Captain invites
    const captainInvites = await prisma.captainInvite.findMany({
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

    console.log('\n✉️  CAPTAIN INVITES');
    console.log('─'.repeat(80));
    console.log(`Total: ${captainInvites.length}`);
    if (captainInvites.length > 0) {
      captainInvites.forEach((invite, idx) => {
        console.log(`  ${idx + 1}. ${invite.tournament.name}`);
        console.log(`     Status: ${invite.status}`);
      });
    }

    // Summary
    console.log('\n📊 SUMMARY');
    console.log('─'.repeat(80));
    console.log(`Roster Entries: ${rosterEntries.length}`);
    console.log(`Lineup Entries: ${lineupEntriesP1.length + lineupEntriesP2.length}`);
    console.log(`Team Memberships: ${teamMemberships.length}`);
    console.log(`Tournament Registrations: ${registrations.length}`);
    console.log(`Teams as Captain: ${captainTeams.length}`);
    console.log(`Tournament Admin Roles: ${tournamentAdmins.length}`);
    console.log(`Tournament Captain Roles: ${tournamentCaptains.length}`);
    console.log(`Event Manager Roles: ${eventManagers.length}`);
    console.log(`Stops Managed: ${stopsManaged.length}`);
    console.log(`Club Director Roles: ${clubsAsDirector.length}`);
    console.log(`Captain Invites: ${captainInvites.length}`);
  }

  await prisma.$disconnect();
}

reportOnPlayers()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });

