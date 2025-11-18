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
    return null;
  }

  console.log(`Name: ${player.firstName || ''} ${player.lastName || ''}`.trim() || 'N/A');
  console.log(`Email: ${player.email || 'No email'}`);
  console.log(`Phone: ${player.phone || 'No phone'}`);
  console.log(`Club: ${player.club?.name || 'No club'}`);
  console.log(`Clerk User ID: ${player.clerkUserId || 'No Clerk account'}`);
  console.log(`Created: ${player.createdAt.toISOString()}`);
  console.log(`Updated: ${player.updatedAt.toISOString()}`);

  // Check roster entries
  const rosterEntries = await prisma.stopTeamPlayer.findMany({
    where: { playerId: player.id },
    include: {
      stop: {
        include: {
          tournament: {
            select: { name: true },
          },
          club: {
            select: { name: true },
          },
        },
      },
      team: {
        include: {
          bracket: {
            select: { name: true },
          },
          club: {
            select: { name: true },
          },
        },
      },
    },
  });
  console.log(`\n📋 Roster Entries: ${rosterEntries.length}`);
  rosterEntries.forEach((entry, idx) => {
    console.log(`   ${idx + 1}. ${entry.stop.tournament.name} - ${entry.stop.name} (${entry.team.club.name}, ${entry.team.bracket.name})`);
  });

  // Check lineup entries
  const lineupP1Count = await prisma.lineupEntry.count({
    where: { player1Id: player.id },
  });
  const lineupP2Count = await prisma.lineupEntry.count({
    where: { player2Id: player.id },
  });
  console.log(`\n🎾 Lineup Entries: ${lineupP1Count + lineupP2Count} total (${lineupP1Count} as Player 1, ${lineupP2Count} as Player 2)`);

  // Check registrations
  const registrations = await prisma.tournamentRegistration.findMany({
    where: { playerId: player.id },
    include: {
      tournament: {
        select: { name: true },
      },
    },
    orderBy: {
      registeredAt: 'desc',
    },
  });
  console.log(`\n📝 Registrations: ${registrations.length}`);
  registrations.forEach((reg, idx) => {
    console.log(`   ${idx + 1}. ${reg.tournament.name}`);
    console.log(`      Status: ${reg.status}`);
    console.log(`      Payment Status: ${reg.paymentStatus}`);
    console.log(`      Amount Paid: $${((reg.amountPaid || 0) / 100).toFixed(2)}`);
    console.log(`      Registered At: ${reg.registeredAt.toISOString()}`);
    if (reg.stripeSessionId) {
      console.log(`      Stripe Session: ${reg.stripeSessionId}`);
    }
  });

  // Check captain roles
  const captainRoles = await prisma.tournamentCaptain.findMany({
    where: { playerId: player.id },
    include: {
      tournament: {
        select: { name: true },
      },
    },
  });
  console.log(`\n👑 Captain Roles: ${captainRoles.length}`);
  captainRoles.forEach((role, idx) => {
    console.log(`   ${idx + 1}. ${role.tournament.name}`);
  });

  // Check admin roles
  const adminRoles = await prisma.tournamentAdmin.findMany({
    where: { playerId: player.id },
    include: {
      tournament: {
        select: { name: true },
      },
    },
  });
  console.log(`\n🔧 Admin Roles: ${adminRoles.length}`);
  adminRoles.forEach((role, idx) => {
    console.log(`   ${idx + 1}. ${role.tournament.name}`);
  });

  return {
    player,
    rosterCount: rosterEntries.length,
    lineupCount: lineupP1Count + lineupP2Count,
    registrations,
    captainRoles: captainRoles.length,
    adminRoles: adminRoles.length,
  };
}

async function main() {
  const player1Id = 'cmi4ub86q0001l204ozm499bx';
  const player2Id = 'cmh85d5og000nr0fwnjl2rabk';

  try {
    const stats1 = await analyzePlayer(player1Id, 'PLAYER 1');
    const stats2 = await analyzePlayer(player2Id, 'PLAYER 2');

    if (!stats1 || !stats2) {
      console.log('\n❌ Could not analyze both players');
      return;
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('COMPARISON');
    console.log('='.repeat(80));

    const p1 = stats1.player;
    const p2 = stats2.player;

    console.log(`\nEmail Comparison:`);
    console.log(`  Player 1: ${p1.email || 'No email'}`);
    console.log(`  Player 2: ${p2.email || 'No email'}`);

    console.log(`\nClerk Account Comparison:`);
    console.log(`  Player 1: ${p1.clerkUserId || 'No Clerk account'}`);
    console.log(`  Player 2: ${p2.clerkUserId || 'No Clerk account'}`);

    console.log(`\nAccount Age:`);
    console.log(`  Player 1: Created ${p1.createdAt.toISOString().split('T')[0]} (${Math.floor((Date.now() - p1.createdAt.getTime()) / (1000 * 60 * 60 * 24))} days ago)`);
    console.log(`  Player 2: Created ${p2.createdAt.toISOString().split('T')[0]} (${Math.floor((Date.now() - p2.createdAt.getTime()) / (1000 * 60 * 60 * 24))} days ago)`);

    console.log(`\nActivity Comparison:`);
    console.log(`  Player 1:`);
    console.log(`    - Roster entries: ${stats1.rosterCount}`);
    console.log(`    - Lineup entries: ${stats1.lineupCount}`);
    console.log(`    - Registrations: ${stats1.registrations.length}`);
    console.log(`    - Paid registrations: ${stats1.registrations.filter(r => r.paymentStatus === 'PAID').length}`);
    console.log(`    - Captain roles: ${stats1.captainRoles}`);
    console.log(`    - Admin roles: ${stats1.adminRoles}`);
    
    console.log(`  Player 2:`);
    console.log(`    - Roster entries: ${stats2.rosterCount}`);
    console.log(`    - Lineup entries: ${stats2.lineupCount}`);
    console.log(`    - Registrations: ${stats2.registrations.length}`);
    console.log(`    - Paid registrations: ${stats2.registrations.filter(r => r.paymentStatus === 'PAID').length}`);
    console.log(`    - Captain roles: ${stats2.captainRoles}`);
    console.log(`    - Admin roles: ${stats2.adminRoles}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

