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
  const player1Id = 'cmg1d3yih00a6rdlb8dg44icb';
  const player2Id = 'cmi3lhkv40001js04g834lent';

  try {
    const stats1 = await analyzePlayer(player1Id, 'PLAYER 1');
    const stats2 = await analyzePlayer(player2Id, 'PLAYER 2');

    console.log(`\n${'='.repeat(80)}`);
    console.log('COMPARISON & RECOMMENDATION');
    console.log('='.repeat(80));

    if (!stats1 || !stats2) {
      console.log('❌ Could not analyze both players');
      return;
    }

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

    console.log(`\n📊 RECOMMENDATION:`);
    
    // Factors to consider:
    // 1. Which has more recent activity (registrations)?
    // 2. Which has paid registrations?
    // 3. Which has more game/match history?
    // 4. Which email looks more legitimate?
    
    const p1HasPaidReg = stats1.registrations.some(r => r.paymentStatus === 'PAID');
    const p2HasPaidReg = stats2.registrations.some(r => r.paymentStatus === 'PAID');
    
    const p1MostRecentReg = stats1.registrations[0]?.registeredAt;
    const p2MostRecentReg = stats2.registrations[0]?.registeredAt;
    
    let recommendation = '';
    let keepPlayerId = '';
    let reason = '';

    if (p1HasPaidReg && !p2HasPaidReg) {
      recommendation = 'Keep Player 1';
      keepPlayerId = player1Id;
      reason = 'Player 1 has paid registrations';
    } else if (p2HasPaidReg && !p1HasPaidReg) {
      recommendation = 'Keep Player 2';
      keepPlayerId = player2Id;
      reason = 'Player 2 has paid registrations';
    } else if (stats1.lineupCount > stats2.lineupCount) {
      recommendation = 'Keep Player 1';
      keepPlayerId = player1Id;
      reason = 'Player 1 has more game/match history';
    } else if (stats2.lineupCount > stats1.lineupCount) {
      recommendation = 'Keep Player 2';
      keepPlayerId = player2Id;
      reason = 'Player 2 has more game/match history';
    } else if (p2MostRecentReg && p1MostRecentReg && p2MostRecentReg > p1MostRecentReg) {
      recommendation = 'Keep Player 2';
      keepPlayerId = player2Id;
      reason = 'Player 2 has more recent registration activity';
    } else if (p1MostRecentReg && p2MostRecentReg && p1MostRecentReg > p2MostRecentReg) {
      recommendation = 'Keep Player 1';
      keepPlayerId = player1Id;
      reason = 'Player 1 has more recent registration activity';
    } else {
      recommendation = 'Keep Player 2';
      keepPlayerId = player2Id;
      reason = 'Player 2 was created more recently (likely the correct account)';
    }

    console.log(`  ${recommendation} (${keepPlayerId})`);
    console.log(`  Reason: ${reason}`);
    console.log(`\n⚠️  NOTE: Both players have Clerk accounts. You may need to:`);
    console.log(`  1. Check which Clerk account email matches the player's actual email`);
    console.log(`  2. Verify which account the user actually uses`);
    console.log(`  3. Consider merging Clerk accounts if they're duplicates`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

