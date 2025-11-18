import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

/**
 * Merges two duplicate player records
 * @param fromPlayerId - Player ID to merge FROM (will be deleted)
 * @param toPlayerId - Player ID to merge TO (will be kept)
 */
async function mergePlayers(fromPlayerId: string, toPlayerId: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`MERGING PLAYERS`);
  console.log('='.repeat(80));
  console.log(`From: ${fromPlayerId} (will be deleted)`);
  console.log(`To: ${toPlayerId} (will be kept)\n`);

  // Verify both players exist
  const fromPlayer = await prisma.player.findUnique({
    where: { id: fromPlayerId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      clerkUserId: true,
    },
  });

  const toPlayer = await prisma.player.findUnique({
    where: { id: toPlayerId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      clerkUserId: true,
    },
  });

  if (!fromPlayer) {
    throw new Error(`From player ${fromPlayerId} not found`);
  }
  if (!toPlayer) {
    throw new Error(`To player ${toPlayerId} not found`);
  }

  console.log(`From: ${fromPlayer.firstName} ${fromPlayer.lastName} (${fromPlayer.email || 'no email'})`);
  console.log(`To: ${toPlayer.firstName} ${toPlayer.lastName} (${toPlayer.email || 'no email'})`);

  if (fromPlayer.clerkUserId) {
    console.warn(`⚠️  WARNING: From player has Clerk account (${fromPlayer.clerkUserId}). This will be lost!`);
  }
  if (!toPlayer.clerkUserId) {
    console.warn(`⚠️  WARNING: To player has no Clerk account. Make sure this is correct!`);
  }

  // Count what will be transferred
  const lineupP1Count = await prisma.lineupEntry.count({ where: { player1Id: fromPlayerId } });
  const lineupP2Count = await prisma.lineupEntry.count({ where: { player2Id: fromPlayerId } });
  const rosterCount = await prisma.stopTeamPlayer.count({ where: { playerId: fromPlayerId } });
  const registrationCount = await prisma.tournamentRegistration.count({ where: { playerId: fromPlayerId } });
  const captainCount = await prisma.tournamentCaptain.count({ where: { playerId: fromPlayerId } });
  const adminCount = await prisma.tournamentAdmin.count({ where: { playerId: fromPlayerId } });
  const eventManagerStopCount = await prisma.stop.count({ where: { eventManagerId: fromPlayerId } });
  const eventManagerTournamentCount = await prisma.tournamentEventManager.count({ where: { playerId: fromPlayerId } });

  console.log(`\nItems to transfer:`);
  console.log(`  - Lineup entries (as Player 1): ${lineupP1Count}`);
  console.log(`  - Lineup entries (as Player 2): ${lineupP2Count}`);
  console.log(`  - Roster entries: ${rosterCount}`);
  console.log(`  - Registrations: ${registrationCount}`);
  console.log(`  - Captain roles: ${captainCount}`);
  console.log(`  - Admin roles: ${adminCount}`);
  console.log(`  - Event manager stops: ${eventManagerStopCount}`);
  console.log(`  - Event manager tournaments: ${eventManagerTournamentCount}`);

  // Check for conflicts
  console.log(`\nChecking for conflicts...`);
  
  // Check for duplicate roster entries
  const fromRosters = await prisma.stopTeamPlayer.findMany({
    where: { playerId: fromPlayerId },
    select: { stopId: true, teamId: true },
  });
  
  const toRosters = await prisma.stopTeamPlayer.findMany({
    where: { playerId: toPlayerId },
    select: { stopId: true, teamId: true },
  });

  const rosterConflicts = fromRosters.filter(fr => 
    toRosters.some(tr => tr.stopId === fr.stopId && tr.teamId === fr.teamId)
  );

  if (rosterConflicts.length > 0) {
    console.log(`  ⚠️  Found ${rosterConflicts.length} duplicate roster entries (will skip)`);
  }

  // Check for duplicate captain roles
  const fromCaptains = await prisma.tournamentCaptain.findMany({
    where: { playerId: fromPlayerId },
    select: { tournamentId: true },
  });
  
  const toCaptains = await prisma.tournamentCaptain.findMany({
    where: { playerId: toPlayerId },
    select: { tournamentId: true },
  });

  const captainConflicts = fromCaptains.filter(fc => 
    toCaptains.some(tc => tc.tournamentId === fc.tournamentId)
  );

  if (captainConflicts.length > 0) {
    console.log(`  ⚠️  Found ${captainConflicts.length} duplicate captain roles (will skip)`);
  }

  // Perform the merge in a transaction
  console.log(`\nStarting merge transaction...`);
  
  await prisma.$transaction(async (tx) => {
    // 1. Transfer lineup entries (as Player 1)
    if (lineupP1Count > 0) {
      await tx.lineupEntry.updateMany({
        where: { player1Id: fromPlayerId },
        data: { player1Id: toPlayerId },
      });
      console.log(`  ✓ Transferred ${lineupP1Count} lineup entries (as Player 1)`);
    }

    // 2. Transfer lineup entries (as Player 2)
    if (lineupP2Count > 0) {
      await tx.lineupEntry.updateMany({
        where: { player2Id: fromPlayerId },
        data: { player2Id: toPlayerId },
      });
      console.log(`  ✓ Transferred ${lineupP2Count} lineup entries (as Player 2)`);
    }

    // 3. Transfer roster entries (skip duplicates)
    if (rosterCount > 0) {
      const fromRosterIds = fromRosters.map(r => ({ stopId: r.stopId, teamId: r.teamId }));
      const toRosterIds = toRosters.map(r => ({ stopId: r.stopId, teamId: r.teamId }));
      
      const uniqueRosters = fromRosterIds.filter(fr => 
        !toRosterIds.some(tr => tr.stopId === fr.stopId && tr.teamId === fr.teamId)
      );

      for (const roster of uniqueRosters) {
        await tx.stopTeamPlayer.updateMany({
          where: {
            stopId: roster.stopId,
            teamId: roster.teamId,
            playerId: fromPlayerId,
          },
          data: { playerId: toPlayerId },
        });
      }
      console.log(`  ✓ Transferred ${uniqueRosters.length} roster entries (skipped ${rosterConflicts.length} duplicates)`);
    }

    // 4. Transfer registrations
    if (registrationCount > 0) {
      await tx.tournamentRegistration.updateMany({
        where: { playerId: fromPlayerId },
        data: { playerId: toPlayerId },
      });
      console.log(`  ✓ Transferred ${registrationCount} registrations`);
    }

    // 5. Transfer captain roles (skip duplicates)
    if (captainCount > 0) {
      const fromCaptainTournamentIds = fromCaptains.map(c => c.tournamentId);
      const toCaptainTournamentIds = toCaptains.map(c => c.tournamentId);
      
      const uniqueCaptains = fromCaptains.filter(fc => 
        !toCaptainTournamentIds.includes(fc.tournamentId)
      );

      for (const captain of uniqueCaptains) {
        await tx.tournamentCaptain.updateMany({
          where: {
            tournamentId: captain.tournamentId,
            playerId: fromPlayerId,
          },
          data: { playerId: toPlayerId },
        });
      }
      console.log(`  ✓ Transferred ${uniqueCaptains.length} captain roles (skipped ${captainConflicts.length} duplicates)`);
    }

    // 6. Transfer admin roles
    if (adminCount > 0) {
      await tx.tournamentAdmin.updateMany({
        where: { playerId: fromPlayerId },
        data: { playerId: toPlayerId },
      });
      console.log(`  ✓ Transferred ${adminCount} admin roles`);
    }

    // 7. Transfer event manager stop roles
    if (eventManagerStopCount > 0) {
      await tx.stop.updateMany({
        where: { eventManagerId: fromPlayerId },
        data: { eventManagerId: toPlayerId },
      });
      console.log(`  ✓ Transferred ${eventManagerStopCount} event manager stop roles`);
    }

    // 8. Transfer event manager tournament roles
    if (eventManagerTournamentCount > 0) {
      await tx.tournamentEventManager.updateMany({
        where: { playerId: fromPlayerId },
        data: { playerId: toPlayerId },
      });
      console.log(`  ✓ Transferred ${eventManagerTournamentCount} event manager tournament roles`);
    }

    // 9. Delete the old player record
    await tx.player.delete({
      where: { id: fromPlayerId },
    });
    console.log(`  ✓ Deleted old player record`);
  });

  console.log(`\n✅ Merge completed successfully!`);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.error('Usage: npx tsx scripts/merge-duplicate-players.ts <fromPlayerId> <toPlayerId>');
    console.error('Example: npx tsx scripts/merge-duplicate-players.ts cmh7rgafv0005l804xifim71g cmi0hr3um0001l204jhzhrvxa');
    process.exit(1);
  }

  const [fromPlayerId, toPlayerId] = args;

  try {
    await mergePlayers(fromPlayerId, toPlayerId);
  } catch (error) {
    console.error('\n❌ Error during merge:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

