import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function mergeLucasWong() {
  try {
    const keepId = 'cmierq5or0003l204en2c773y'; // Newer account with Clerk, email, registration (Lucas Wong)
    const deleteId = 'cmfpbp8bj002lrdn04j59j4g8'; // Older account with DUPR rating, location data (Lucas W)

    console.log(`\n=== Merging Lucas Wong Accounts ===\n`);
    console.log(`Keep: ${keepId} (newer, has Clerk account, email, registration - Lucas Wong)`);
    console.log(`Delete: ${deleteId} (older, has DUPR rating, location data - Lucas W)\n`);

    // Verify players exist and get full details
    const keepPlayer = await prisma.player.findUnique({
      where: { id: keepId },
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
        clubRatingDoubles: true,
        createdAt: true,
      }
    });

    const deletePlayer = await prisma.player.findUnique({
      where: { id: deleteId },
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
        clubRatingDoubles: true,
        createdAt: true,
      }
    });

    if (!keepPlayer) {
      throw new Error(`Keep player ${keepId} not found`);
    }

    if (!deletePlayer) {
      throw new Error(`Delete player ${deleteId} not found`);
    }

    console.log(`Keep Player: ${keepPlayer.name || `${keepPlayer.firstName} ${keepPlayer.lastName}`}`);
    console.log(`  Email: ${keepPlayer.email || 'None'}`);
    console.log(`  Phone: ${keepPlayer.phone || 'None'}`);
    console.log(`  Clerk ID: ${keepPlayer.clerkUserId || 'None'}`);
    console.log(`  City: ${keepPlayer.city || 'None'}`);
    console.log(`  Region: ${keepPlayer.region || 'None'}`);
    console.log(`  DUPR Doubles: ${keepPlayer.duprDoubles || 'None'}`);
    console.log(`  Created: ${keepPlayer.createdAt.toISOString()}`);
    console.log(`\nDelete Player: ${deletePlayer.name || `${deletePlayer.firstName} ${deletePlayer.lastName}`}`);
    console.log(`  Email: ${deletePlayer.email || 'None'}`);
    console.log(`  Phone: ${deletePlayer.phone || 'None'}`);
    console.log(`  Clerk ID: ${deletePlayer.clerkUserId || 'None'}`);
    console.log(`  City: ${deletePlayer.city || 'None'}`);
    console.log(`  Region: ${deletePlayer.region || 'None'}`);
    console.log(`  DUPR Doubles: ${deletePlayer.duprDoubles || 'None'}`);
    console.log(`  Created: ${deletePlayer.createdAt.toISOString()}\n`);

    // Check for relationships
    const rosterEntries = await prisma.stopTeamPlayer.findMany({
      where: { playerId: deleteId }
    });
    console.log(`Found ${rosterEntries.length} roster entries`);

    const lineupEntriesP1 = await prisma.lineupEntry.findMany({
      where: { player1Id: deleteId }
    });
    console.log(`Found ${lineupEntriesP1.length} lineup entries as player1`);

    const lineupEntriesP2 = await prisma.lineupEntry.findMany({
      where: { player2Id: deleteId }
    });
    console.log(`Found ${lineupEntriesP2.length} lineup entries as player2`);

    const teamMemberships = await prisma.teamPlayer.findMany({
      where: { playerId: deleteId }
    });
    console.log(`Found ${teamMemberships.length} team memberships`);

    const registrations = await prisma.tournamentRegistration.findMany({
      where: { playerId: deleteId }
    });
    console.log(`Found ${registrations.length} registrations`);

    const captainTeams = await prisma.team.findMany({
      where: { captainId: deleteId }
    });
    console.log(`Found ${captainTeams.length} teams as captain`);

    const captainInvites = await prisma.captainInvite.findMany({
      where: { playerId: deleteId }
    });
    console.log(`Found ${captainInvites.length} captain invites`);

    const tournamentAdmins = await prisma.tournamentAdmin.findMany({
      where: { playerId: deleteId }
    });
    console.log(`Found ${tournamentAdmins.length} tournament admin roles`);

    const tournamentCaptains = await prisma.tournamentCaptain.findMany({
      where: { playerId: deleteId }
    });
    console.log(`Found ${tournamentCaptains.length} tournament captain roles`);

    const eventManagers = await prisma.tournamentEventManager.findMany({
      where: { playerId: deleteId }
    });
    console.log(`Found ${eventManagers.length} event manager roles`);

    const stopManagers = await prisma.stop.findMany({
      where: { eventManagerId: deleteId }
    });
    console.log(`Found ${stopManagers.length} stops managed`);

    const playerWithClubs = await prisma.player.findUnique({
      where: { id: deleteId },
      select: {
        clubsAsDirector: {
          select: { id: true }
        }
      }
    });
    const clubDirectorsCount = playerWithClubs?.clubsAsDirector?.length || 0;
    console.log(`Found ${clubDirectorsCount} club director roles`);

    const tiebreakerDecisions = await prisma.match.findMany({
      where: { tiebreakerDecidedById: deleteId }
    });
    console.log(`Found ${tiebreakerDecisions.length} tiebreaker decisions\n`);

    // Prepare data to merge from old account to new account
    const updateData: {
      city?: string;
      region?: string;
      duprDoubles?: number;
      clubRatingDoubles?: number | null;
    } = {};

    // Merge location data if new account doesn't have it
    if (!keepPlayer.city && deletePlayer.city) {
      updateData.city = deletePlayer.city;
    }
    if (!keepPlayer.region && deletePlayer.region) {
      updateData.region = deletePlayer.region;
    }

    // Merge DUPR rating if new account doesn't have it
    if (!keepPlayer.duprDoubles && deletePlayer.duprDoubles) {
      updateData.duprDoubles = deletePlayer.duprDoubles;
    }

    // Merge club rating if new account doesn't have it
    if (!keepPlayer.clubRatingDoubles && deletePlayer.clubRatingDoubles) {
      updateData.clubRatingDoubles = deletePlayer.clubRatingDoubles;
    }

    // Perform the merge in a transaction
    await prisma.$transaction(async (tx) => {
      // Update roster entries
      if (rosterEntries.length > 0) {
        await tx.stopTeamPlayer.updateMany({
          where: { playerId: deleteId },
          data: { playerId: keepId }
        });
        console.log(`✅ Updated ${rosterEntries.length} roster entries`);
      }

      // Update lineup entries (player1)
      if (lineupEntriesP1.length > 0) {
        await tx.lineupEntry.updateMany({
          where: { player1Id: deleteId },
          data: { player1Id: keepId }
        });
        console.log(`✅ Updated ${lineupEntriesP1.length} lineup entries (player1)`);
      }

      // Update lineup entries (player2)
      if (lineupEntriesP2.length > 0) {
        await tx.lineupEntry.updateMany({
          where: { player2Id: deleteId },
          data: { player2Id: keepId }
        });
        console.log(`✅ Updated ${lineupEntriesP2.length} lineup entries (player2)`);
      }

      // Update team memberships
      if (teamMemberships.length > 0) {
        await tx.teamPlayer.updateMany({
          where: { playerId: deleteId },
          data: { playerId: keepId }
        });
        console.log(`✅ Updated ${teamMemberships.length} team memberships`);
      }

      // Update registrations
      if (registrations.length > 0) {
        await tx.tournamentRegistration.updateMany({
          where: { playerId: deleteId },
          data: { playerId: keepId }
        });
        console.log(`✅ Updated ${registrations.length} registrations`);
      }

      // Update captain teams
      if (captainTeams.length > 0) {
        await tx.team.updateMany({
          where: { captainId: deleteId },
          data: { captainId: keepId }
        });
        console.log(`✅ Updated ${captainTeams.length} teams as captain`);
      }

      // Update captain invites
      if (captainInvites.length > 0) {
        await tx.captainInvite.updateMany({
          where: { playerId: deleteId },
          data: { playerId: keepId }
        });
        console.log(`✅ Updated ${captainInvites.length} captain invites`);
      }

      // Update tournament admins
      if (tournamentAdmins.length > 0) {
        await tx.tournamentAdmin.updateMany({
          where: { playerId: deleteId },
          data: { playerId: keepId }
        });
        console.log(`✅ Updated ${tournamentAdmins.length} tournament admin roles`);
      }

      // Update tournament captains
      if (tournamentCaptains.length > 0) {
        await tx.tournamentCaptain.updateMany({
          where: { playerId: deleteId },
          data: { playerId: keepId }
        });
        console.log(`✅ Updated ${tournamentCaptains.length} tournament captain roles`);
      }

      // Update event managers
      if (eventManagers.length > 0) {
        await tx.tournamentEventManager.updateMany({
          where: { playerId: deleteId },
          data: { playerId: keepId }
        });
        console.log(`✅ Updated ${eventManagers.length} event manager roles`);
      }

      // Update stop managers
      if (stopManagers.length > 0) {
        await tx.stop.updateMany({
          where: { eventManagerId: deleteId },
          data: { eventManagerId: keepId }
        });
        console.log(`✅ Updated ${stopManagers.length} stops managed`);
      }

      // Update club directors
      if (clubDirectorsCount > 0) {
        await tx.club.updateMany({
          where: { directorId: deleteId },
          data: { directorId: keepId }
        });
        console.log(`✅ Updated ${clubDirectorsCount} club director roles`);
      }

      // Update tiebreaker decisions
      if (tiebreakerDecisions.length > 0) {
        await tx.match.updateMany({
          where: { tiebreakerDecidedById: deleteId },
          data: { tiebreakerDecidedById: keepId }
        });
        console.log(`✅ Updated ${tiebreakerDecisions.length} tiebreaker decisions`);
      }

      // Merge useful data from old account to new account
      if (Object.keys(updateData).length > 0) {
        await tx.player.update({
          where: { id: keepId },
          data: updateData
        });
        console.log(`✅ Merged data from old account:`, updateData);
      }

      // Delete the old player
      await tx.player.delete({
        where: { id: deleteId }
      });
      console.log(`✅ Deleted old player ${deleteId}`);
    });

    console.log(`\n✅ Successfully merged Lucas Wong accounts!\n`);
    console.log(`Lucas Wong (${keepPlayer.email}) now has:`);
    console.log(`  • All roster entries from old account`);
    console.log(`  • All lineup entries from old account`);
    console.log(`  • All team memberships from old account`);
    console.log(`  • All registrations from old account`);
    if (Object.keys(updateData).length > 0) {
      console.log(`  • Merged data: ${JSON.stringify(updateData)}`);
    }
    console.log(`  • Email: ${keepPlayer.email}`);
    console.log(`  • Clerk account: ${keepPlayer.clerkUserId ? 'Yes' : 'No'}`);
    console.log(`\nOld account has been deleted.`);

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

mergeLucasWong();

