import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function analyzePlayer(playerId: string, label: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`${label}: ${playerId}`);
  console.log('='.repeat(80));

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      club: {
        select: { name: true },
      },
    },
  });

  if (!player) {
    console.log(`❌ Player not found`);
    return;
  }

  console.log(`Name: ${player.firstName || ''} ${player.lastName || ''}`.trim() || 'N/A');
  console.log(`Email: ${player.email || 'No email'}`);
  console.log(`Phone: ${player.phone || 'No phone'}`);
  console.log(`Club: ${player.club?.name || 'No club'}`);
  console.log(`Clerk User ID: ${player.clerkUserId || 'No Clerk account'}`);
  console.log(`Created: ${player.createdAt.toISOString().split('T')[0]}`);

  // Check roster entries
  const rosterCount = await prisma.stopTeamPlayer.count({
    where: { playerId: player.id },
  });
  console.log(`\n📋 Roster Entries: ${rosterCount}`);

  // Check lineup entries (as player1)
  const lineupAsP1 = await prisma.lineupEntry.findMany({
    where: { player1Id: player.id },
    include: {
      lineup: {
        include: {
          round: {
            include: {
              stop: {
                include: {
                  tournament: {
                    select: { name: true },
                  },
                },
              },
            },
          },
          team: {
            include: {
              club: {
                select: { name: true },
              },
            },
          },
        },
      },
    },
    take: 5,
  });

  // Check lineup entries (as player2)
  const lineupAsP2 = await prisma.lineupEntry.findMany({
    where: { player2Id: player.id },
    include: {
      lineup: {
        include: {
          round: {
            include: {
              stop: {
                include: {
                  tournament: {
                    select: { name: true },
                  },
                },
              },
            },
          },
          team: {
            include: {
              club: {
                select: { name: true },
              },
            },
          },
        },
      },
    },
    take: 5,
  });

  const lineupP1Count = await prisma.lineupEntry.count({
    where: { player1Id: player.id },
  });
  const lineupP2Count = await prisma.lineupEntry.count({
    where: { player2Id: player.id },
  });

  console.log(`🎾 Lineup Entries: ${lineupP1Count + lineupP2Count} total (${lineupP1Count} as Player 1, ${lineupP2Count} as Player 2)`);
  
  if (lineupAsP1.length > 0 || lineupAsP2.length > 0) {
    console.log(`   Sample entries:`);
    [...lineupAsP1, ...lineupAsP2].slice(0, 3).forEach((entry, idx) => {
      const isP1 = entry.player1Id === player.id;
      console.log(`   ${idx + 1}. ${entry.lineup.round.stop.tournament.name} - ${entry.lineup.round.stop.name} - ${entry.lineup.team.club.name} (${entry.slot})`);
    });
  }

  // Check registrations
  const registrations = await prisma.tournamentRegistration.findMany({
    where: { playerId: player.id },
    include: {
      tournament: {
        select: { name: true },
      },
    },
  });
  console.log(`\n📝 Registrations: ${registrations.length}`);
  registrations.forEach((reg, idx) => {
    console.log(`   ${idx + 1}. ${reg.tournament.name} - ${reg.status} - ${reg.paymentStatus} - $${((reg.amountPaid || 0) / 100).toFixed(2)}`);
  });

  // Check captain roles
  const captainRoles = await prisma.tournamentCaptain.count({
    where: { playerId: player.id },
  });
  console.log(`\n👑 Captain Roles: ${captainRoles}`);

  // Check admin roles
  const adminRoles = await prisma.tournamentAdmin.count({
    where: { playerId: player.id },
  });
  console.log(`🔧 Admin Roles: ${adminRoles}`);

  // Check event manager roles
  const eventManagerStops = await prisma.stop.count({
    where: { eventManagerId: player.id },
  });
  const eventManagerTournaments = await prisma.tournamentEventManager.count({
    where: { playerId: player.id },
  });
  console.log(`📅 Event Manager Roles: ${eventManagerStops} stops, ${eventManagerTournaments} tournaments`);

  return {
    player,
    rosterCount,
    lineupP1Count,
    lineupP2Count,
    registrationsCount: registrations.length,
    captainRoles,
    adminRoles,
    eventManagerStops,
    eventManagerTournaments,
  };
}

async function main() {
  const player1Id = 'cmh7rgafv0005l804xifim71g';
  const player2Id = 'cmi0hr3um0001l204jhzhrvxa';

  try {
    const stats1 = await analyzePlayer(player1Id, 'PLAYER 1 (Old - Has Game History)');
    const stats2 = await analyzePlayer(player2Id, 'PLAYER 2 (New - Has Clerk Account)');

    console.log(`\n${'='.repeat(80)}`);
    console.log('MERGE STRATEGY');
    console.log('='.repeat(80));
    console.log(`\nKeep: Player 2 (${player2Id}) - Has Clerk account and registration`);
    console.log(`Merge from: Player 1 (${player1Id}) - Has game/match history`);
    console.log(`\nActions needed:`);
    console.log(`  1. Transfer ${stats1?.lineupP1Count || 0} lineup entries (as Player 1)`);
    console.log(`  2. Transfer ${stats1?.lineupP2Count || 0} lineup entries (as Player 2)`);
    console.log(`  3. Transfer ${stats1?.rosterCount || 0} roster entries`);
    console.log(`  4. Transfer ${stats1?.captainRoles || 0} captain roles`);
    console.log(`  5. Transfer ${stats1?.adminRoles || 0} admin roles`);
    console.log(`  6. Transfer ${stats1?.eventManagerStops || 0} event manager stop roles`);
    console.log(`  7. Transfer ${stats1?.eventManagerTournaments || 0} event manager tournament roles`);
    console.log(`  8. Update any other references`);
    console.log(`  9. Delete Player 1 record`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

