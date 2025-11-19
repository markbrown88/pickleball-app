import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function investigatePlayer(searchValue: string) {
  console.log('\n' + '='.repeat(80));
  console.log(`INVESTIGATING PLAYER: ${searchValue}`);
  console.log('='.repeat(80));

  // Find player by email or ID
  const player = await prisma.player.findFirst({
    where: {
      OR: [
        { email: searchValue },
        { id: searchValue },
      ],
    },
    include: {
      tournamentRegistrations: {
        include: {
          tournament: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
        orderBy: {
          registeredAt: 'desc',
        },
      },
      stopRosterLinks: {
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
          team: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
      lineupEntriesAsP1: {
        include: {
          lineup: {
            include: {
              Stop: {
                include: {
                  tournament: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
              team: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
      lineupEntriesAsP2: {
        include: {
          lineup: {
            include: {
              Stop: {
                include: {
                  tournament: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
              team: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
      TournamentCaptain: {
        include: {
          tournament: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      tournamentAdminLinks: {
        include: {
          tournament: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      TournamentEventManager: {
        include: {
          Tournament: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!player) {
    console.log('\n❌ Player not found in database');
    await prisma.$disconnect();
    return;
  }

  console.log(`\n👤 PLAYER INFORMATION`);
  console.log('='.repeat(80));
  console.log(`ID: ${player.id}`);
  console.log(`Name: ${player.firstName || ''} ${player.lastName || ''}`.trim() || 'Not set');
  console.log(`Email: ${player.email || 'Not set'}`);
  console.log(`Phone: ${player.phone || 'Not set'}`);
  console.log(`Gender: ${player.gender || 'Not set'}`);
  console.log(`Age: ${player.age || 'Not set'}`);
  console.log(`DUPR: ${player.dupr || 'Not set'}`);
  console.log(`Clerk User ID: ${player.clerkUserId || 'Not set'}`);
  console.log(`Primary Club: ${player.primaryClubId || 'Not set'}`);
  console.log(`Created: ${player.createdAt.toISOString()}`);
  console.log(`Updated: ${player.updatedAt.toISOString()}`);

  // Tournament Registrations
  console.log(`\n📋 TOURNAMENT REGISTRATIONS (${player.tournamentRegistrations.length})`);
  console.log('='.repeat(80));
  if (player.tournamentRegistrations.length > 0) {
    player.tournamentRegistrations.forEach((reg, idx) => {
      console.log(`\n${idx + 1}. Registration ID: ${reg.id}`);
      console.log(`   Tournament: ${reg.tournament.name} (${reg.tournament.type})`);
      console.log(`   Status: ${reg.status}`);
      console.log(`   Payment Status: ${reg.paymentStatus}`);
      console.log(`   Amount Paid: $${((reg.amountPaid || 0) / 100).toFixed(2)}`);
      console.log(`   Payment ID: ${reg.paymentId || 'None'}`);
      console.log(`   Registered: ${reg.registeredAt.toISOString()}`);
      if (reg.notes) {
        try {
          const notes = JSON.parse(reg.notes);
          if (notes.stopIds) {
            console.log(`   Stops: ${notes.stopIds.length} stop(s)`);
          }
          if (notes.brackets) {
            console.log(`   Brackets: ${notes.brackets.length} bracket(s)`);
          }
        } catch (e) {
          // Ignore
        }
      }
    });
  } else {
    console.log('   No registrations found');
  }

  // Roster Entries
  console.log(`\n👥 ROSTER ENTRIES (${player.stopRosterLinks.length})`);
  console.log('='.repeat(80));
  if (player.stopRosterLinks.length > 0) {
    player.stopRosterLinks.forEach((entry, idx) => {
      console.log(`\n${idx + 1}. Stop: ${entry.stop.name}`);
      console.log(`   Tournament: ${entry.stop.tournament.name}`);
      console.log(`   Team: ${entry.team.name}`);
      console.log(`   Payment Method: ${entry.paymentMethod}`);
      console.log(`   Dates: ${entry.stop.startAt ? new Date(entry.stop.startAt).toLocaleDateString() : 'Not set'} - ${entry.stop.endAt ? new Date(entry.stop.endAt).toLocaleDateString() : 'Not set'}`);
      console.log(`   Created: ${entry.createdAt.toISOString()}`);
    });
  } else {
    console.log('   No roster entries found');
  }

  // Lineup Entries (combine P1 and P2)
  const allLineupEntries = [...player.lineupEntriesAsP1, ...player.lineupEntriesAsP2];
  const uniqueLineupEntries = Array.from(
    new Map(allLineupEntries.map(entry => [entry.id, entry])).values()
  );
  
  console.log(`\n🎾 LINEUP ENTRIES (${uniqueLineupEntries.length})`);
  console.log('='.repeat(80));
  if (uniqueLineupEntries.length > 0) {
    uniqueLineupEntries.forEach((entry, idx) => {
      const stop = entry.lineup.Stop;
      console.log(`\n${idx + 1}. Stop: ${stop?.name || 'Unknown'}`);
      console.log(`   Tournament: ${stop?.tournament?.name || 'Unknown'}`);
      console.log(`   Team: ${entry.lineup.team.name}`);
      console.log(`   Slot: ${entry.slot}`);
      console.log(`   Player 1: ${entry.player1Id === player.id ? 'THIS PLAYER' : entry.player1Id}`);
      console.log(`   Player 2: ${entry.player2Id === player.id ? 'THIS PLAYER' : entry.player2Id}`);
      console.log(`   Created: ${entry.createdAt.toISOString()}`);
    });
  } else {
    console.log('   No lineup entries found');
  }

  // Captain Roles
  console.log(`\n👑 CAPTAIN ROLES (${player.TournamentCaptain.length})`);
  console.log('='.repeat(80));
  if (player.TournamentCaptain.length > 0) {
    player.TournamentCaptain.forEach((captain, idx) => {
      console.log(`${idx + 1}. Tournament: ${captain.tournament.name}`);
    });
  } else {
    console.log('   No captain roles found');
  }

  // Admin Links
  console.log(`\n🔧 ADMIN LINKS (${player.tournamentAdminLinks.length})`);
  console.log('='.repeat(80));
  if (player.tournamentAdminLinks.length > 0) {
    player.tournamentAdminLinks.forEach((link, idx) => {
      console.log(`${idx + 1}. Tournament: ${link.tournament.name}`);
    });
  } else {
    console.log('   No admin links found');
  }

  // Event Manager Roles
  console.log(`\n📅 EVENT MANAGER ROLES (${player.TournamentEventManager.length})`);
  console.log('='.repeat(80));
  if (player.TournamentEventManager.length > 0) {
    player.TournamentEventManager.forEach((manager, idx) => {
      console.log(`${idx + 1}. Tournament: ${manager.Tournament.name}`);
    });
  } else {
    console.log('   No event manager roles found');
  }

  await prisma.$disconnect();
}

// Search by name or email
const searchTerm = process.argv[2] || '';

if (!searchTerm) {
  console.log('Usage: npx tsx scripts/investigate-player.ts <email or "FirstName LastName">');
  process.exit(1);
}

async function searchAndInvestigate() {
  // Try as email first
  let player = await prisma.player.findFirst({
    where: { email: searchTerm },
  });

  // If not found, try as name
  if (!player) {
    const nameParts = searchTerm.split(' ');
    if (nameParts.length >= 2) {
      player = await prisma.player.findFirst({
        where: {
          firstName: { contains: nameParts[0], mode: 'insensitive' },
          lastName: { contains: nameParts.slice(1).join(' '), mode: 'insensitive' },
        },
      });
    } else if (nameParts.length === 1) {
      player = await prisma.player.findFirst({
        where: {
          OR: [
            { firstName: { contains: nameParts[0], mode: 'insensitive' } },
            { lastName: { contains: nameParts[0], mode: 'insensitive' } },
          ],
        },
      });
    }
  }

  if (!player) {
    console.log(`\n❌ Player not found: ${searchTerm}`);
    await prisma.$disconnect();
    return;
  }

  // Now investigate with the found player's email or ID
  const email = player.email || player.id;
  await investigatePlayer(email);
}

searchAndInvestigate();

