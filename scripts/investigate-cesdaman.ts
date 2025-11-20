import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function investigateCesdaman() {
  try {
    console.log(`\n=== Investigating cesdaman@gmail.com ===\n`);

    const email = 'cesdaman@gmail.com';
    
    // Find player
    const player = await prisma.player.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        club: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!player) {
      console.log(`❌ Player not found with email: ${email}`);
      await prisma.$disconnect();
      return;
    }

    console.log(`👤 PLAYER RECORD:`);
    console.log(`   ID: ${player.id}`);
    console.log(`   Email: ${player.email}`);
    console.log(`   First Name: ${JSON.stringify(player.firstName)}`);
    console.log(`   Last Name: ${JSON.stringify(player.lastName)}`);
    console.log(`   Name: ${JSON.stringify(player.name)}`);
    console.log(`   Gender: ${player.gender}`);
    console.log(`   Club: ${player.club?.name || 'None'} (ID: ${player.clubId})`);
    console.log(`   Clerk User ID: ${player.clerkUserId || 'None'}`);
    console.log(`   Created: ${player.createdAt.toISOString()}`);
    console.log(`   Updated: ${player.updatedAt.toISOString()}`);
    console.log(`   Disabled: ${player.disabled}`);
    console.log(`   Is App Admin: ${player.isAppAdmin}`);

    // Check registrations
    console.log(`\n📝 REGISTRATIONS:`);
    const registrations = await prisma.tournamentRegistration.findMany({
      where: {
        playerId: player.id,
      },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        registeredAt: 'desc',
      },
    });

    if (registrations.length === 0) {
      console.log(`   No registrations found`);
    } else {
      registrations.forEach((reg, idx) => {
        console.log(`   ${idx + 1}. ${reg.tournament.name}`);
        console.log(`      Status: ${reg.status}`);
        console.log(`      Registered: ${reg.registeredAt.toISOString()}`);
        console.log(`      Payment ID: ${reg.paymentId || 'None'}`);
        console.log(`      Amount Paid: ${reg.amountPaidInCents ? `$${(reg.amountPaidInCents / 100).toFixed(2)}` : 'None'}`);
        console.log(`      Notes: ${reg.notes || 'None'}`);
      });
    }

    // Check roster entries
    console.log(`\n📋 ROSTER ENTRIES:`);
    const rosterEntries = await prisma.stopTeamPlayer.findMany({
      where: {
        playerId: player.id,
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
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (rosterEntries.length === 0) {
      console.log(`   No roster entries found`);
    } else {
      rosterEntries.forEach((entry, idx) => {
        console.log(`   ${idx + 1}. ${entry.stop.tournament.name} - ${entry.stop.name}`);
        console.log(`      Team: ${entry.team.name} (${entry.team.bracket.name})`);
        console.log(`      Paid Status: ${entry.paidStatus || 'None'}`);
        console.log(`      Created: ${entry.createdAt.toISOString()}`);
      });
    }

    // Check lineup entries
    console.log(`\n🎯 LINEUP ENTRIES:`);
    const lineupEntries = await prisma.lineupEntry.findMany({
      where: {
        OR: [
          { player1Id: player.id },
          { player2Id: player.id },
        ],
      },
      select: {
        id: true,
        lineupId: true,
        slot: true,
        player1Id: true,
        player2Id: true,
      },
    });

    if (lineupEntries.length === 0) {
      console.log(`   No lineup entries found`);
    } else {
      console.log(`   Found ${lineupEntries.length} lineup entries`);
      lineupEntries.forEach((entry, idx) => {
        const isPlayer1 = entry.player1Id === player.id;
        const isPlayer2 = entry.player2Id === player.id;
        console.log(`   ${idx + 1}. Lineup ID: ${entry.lineupId}`);
        console.log(`      Slot: ${entry.slot}`);
        console.log(`      Role: ${isPlayer1 ? 'Player 1' : 'Player 2'}`);
      });
    }

    // Check team memberships
    console.log(`\n👥 TEAM MEMBERSHIPS:`);
    const teamMemberships = await prisma.teamPlayer.findMany({
      where: {
        playerId: player.id,
      },
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
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (teamMemberships.length === 0) {
      console.log(`   No team memberships found`);
    } else {
      teamMemberships.forEach((membership, idx) => {
        console.log(`   ${idx + 1}. ${membership.team.tournament.name} - ${membership.team.bracket.name}`);
        console.log(`      Team: ${membership.team.name}`);
      });
    }

    // Check if there are any other players with similar emails or names
    console.log(`\n🔍 SIMILAR RECORDS:`);
    const similarEmails = await prisma.player.findMany({
      where: {
        email: {
          contains: 'cesdaman',
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });

    if (similarEmails.length > 1) {
      console.log(`   Found ${similarEmails.length} players with similar emails:`);
      similarEmails.forEach(p => {
        console.log(`      - ${p.email} (ID: ${p.id}, Created: ${p.createdAt.toISOString()})`);
      });
    } else {
      console.log(`   No similar email addresses found`);
    }

    // Check creation method - was it created via Clerk or manually?
    console.log(`\n🔐 ACCOUNT CREATION:`);
    if (player.clerkUserId) {
      console.log(`   ✅ Has Clerk account (ID: ${player.clerkUserId})`);
      console.log(`   This suggests the player was created through Clerk authentication`);
    } else {
      console.log(`   ⚠️  No Clerk account`);
      console.log(`   This suggests the player was created manually or imported`);
    }

    // Check recent activity
    const hoursSinceCreation = (Date.now() - player.createdAt.getTime()) / (1000 * 60 * 60);
    console.log(`\n⏰ TIMELINE:`);
    console.log(`   Created: ${player.createdAt.toISOString()} (${hoursSinceCreation.toFixed(1)} hours ago)`);
    console.log(`   Last Updated: ${player.updatedAt.toISOString()}`);

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

investigateCesdaman();

