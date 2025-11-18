import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

/**
 * Merges two duplicate player records with special handling for Clerk account and email
 * @param fromPlayerId - Player ID to merge FROM (will be deleted)
 * @param toPlayerId - Player ID to merge TO (will be kept)
 * @param updateEmail - Email to set on the kept player (optional)
 * @param updateClerkUserId - Clerk User ID to set on the kept player (optional)
 */
async function mergePlayersWithUpdate(
  fromPlayerId: string, 
  toPlayerId: string,
  updateEmail?: string,
  updateClerkUserId?: string
) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`MERGING PLAYERS WITH UPDATES`);
  console.log('='.repeat(80));
  console.log(`From: ${fromPlayerId} (will be deleted)`);
  console.log(`To: ${toPlayerId} (will be kept)`);
  if (updateEmail) {
    console.log(`Update email to: ${updateEmail}`);
  }
  if (updateClerkUserId) {
    console.log(`Update Clerk User ID to: ${updateClerkUserId}`);
  }
  console.log('');

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
  console.log(`  Clerk: ${fromPlayer.clerkUserId || 'No Clerk account'}`);
  console.log(`To: ${toPlayer.firstName} ${toPlayer.lastName} (${toPlayer.email || 'no email'})`);
  console.log(`  Clerk: ${toPlayer.clerkUserId || 'No Clerk account'}`);

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

  // Check if email or clerkUserId conflicts with another player (excluding the fromPlayer since we'll delete it)
  if (updateEmail) {
    const emailConflict = await prisma.player.findFirst({
      where: {
        email: updateEmail,
        id: { notIn: [toPlayerId, fromPlayerId] },
      },
    });
    if (emailConflict) {
      throw new Error(`Email ${updateEmail} is already used by another player (${emailConflict.id})`);
    }
  }

  if (updateClerkUserId) {
    const clerkConflict = await prisma.player.findFirst({
      where: {
        clerkUserId: updateClerkUserId,
        id: { notIn: [toPlayerId, fromPlayerId] },
      },
    });
    if (clerkConflict) {
      throw new Error(`Clerk User ID ${updateClerkUserId} is already used by another player (${clerkConflict.id})`);
    }
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

    // 4. Transfer registrations (skip duplicates)
    if (registrationCount > 0) {
      const fromRegistrations = await tx.tournamentRegistration.findMany({
        where: { playerId: fromPlayerId },
        select: { tournamentId: true, id: true },
      });
      
      const toRegistrations = await tx.tournamentRegistration.findMany({
        where: { playerId: toPlayerId },
        select: { tournamentId: true },
      });
      
      const toTournamentIds = new Set(toRegistrations.map(r => r.tournamentId));
      
      const uniqueRegistrations = fromRegistrations.filter(fr => 
        !toTournamentIds.has(fr.tournamentId)
      );
      
      // Transfer unique registrations
      for (const reg of uniqueRegistrations) {
        await tx.tournamentRegistration.update({
          where: { id: reg.id },
          data: { playerId: toPlayerId },
        });
      }
      
      // Delete duplicate registrations from fromPlayer (keep the one on toPlayer)
      const duplicateRegIds = fromRegistrations
        .filter(fr => toTournamentIds.has(fr.tournamentId))
        .map(r => r.id);
      
      if (duplicateRegIds.length > 0) {
        await tx.tournamentRegistration.deleteMany({
          where: {
            id: { in: duplicateRegIds },
          },
        });
        console.log(`  ✓ Transferred ${uniqueRegistrations.length} registrations (deleted ${duplicateRegIds.length} duplicates)`);
      } else {
        console.log(`  ✓ Transferred ${uniqueRegistrations.length} registrations`);
      }
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

    // 9. Update the kept player's email and/or Clerk User ID
    // First, clear the email and Clerk User ID from fromPlayer if we're transferring them
    const clearFromPlayerData: any = {};
    if (updateEmail && fromPlayer.email === updateEmail) {
      clearFromPlayerData.email = null;
    }
    if (updateClerkUserId && fromPlayer.clerkUserId === updateClerkUserId) {
      clearFromPlayerData.clerkUserId = null;
    }
    
    if (Object.keys(clearFromPlayerData).length > 0) {
      await tx.player.update({
        where: { id: fromPlayerId },
        data: clearFromPlayerData,
      });
    }
    
    const updateData: any = {};
    if (updateEmail) {
      updateData.email = updateEmail;
    }
    if (updateClerkUserId) {
      updateData.clerkUserId = updateClerkUserId;
    }
    
    if (Object.keys(updateData).length > 0) {
      await tx.player.update({
        where: { id: toPlayerId },
        data: updateData,
      });
      console.log(`  ✓ Updated kept player's email and/or Clerk User ID`);
    }

    // 10. Delete the old player record
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
  
  if (args.length < 2) {
    console.error('Usage: npx tsx scripts/merge-with-clerk-update.ts <fromPlayerId> <toPlayerId> [email] [clerkUserId]');
    console.error('Example: npx tsx scripts/merge-with-clerk-update.ts cmg1d3yih00a6rdlb8dg44icb cmi3lhkv40001js04g834lent lourdesvillamor@gmail.com user_35cYMCWTRBNNaBf19IzszcJCg7S');
    process.exit(1);
  }

  const [fromPlayerId, toPlayerId, updateEmail, updateClerkUserId] = args;

  try {
    await mergePlayersWithUpdate(fromPlayerId, toPlayerId, updateEmail, updateClerkUserId);
  } catch (error) {
    console.error('\n❌ Error during merge:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

