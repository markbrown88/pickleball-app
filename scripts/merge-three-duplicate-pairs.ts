import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

type MergePair = {
  name: string;
  keepId: string; // Clerk account to keep
  deleteId: string; // Non-Clerk account to delete
};

const merges: MergePair[] = [
  {
    name: 'Ben/Benjamin Cates',
    keepId: 'cmig3q9p30001l104hj83r6jj', // Benjamin Cates - has Clerk
    deleteId: 'cmfpbp714000frdn0vzptthnv', // Ben Cates - no Clerk
  },
  {
    name: 'Matt/Matthew Kiss',
    keepId: 'cmig2f4la0001ks04yp62yvpu', // Matt Kiss - has Clerk
    deleteId: 'cmfpbp8iu002xrdn0bt0vx780', // Matthew Kiss - no Clerk
  },
  {
    name: 'Ed/Edward Soptic',
    keepId: 'cmigyqogx0001jo04sk00unxc', // Edward Soptic - has Clerk
    deleteId: 'cmgp4kiun0001jl047v4jrqtz', // Ed Soptic - no Clerk
  },
];

async function mergePlayers() {
  try {
    for (const merge of merges) {
      console.log('\n' + '='.repeat(80));
      console.log(`MERGING ${merge.name.toUpperCase()}`);
      console.log('='.repeat(80));
      console.log(`Keep (Clerk):   ${merge.keepId}`);
      console.log(`Delete (no Clerk): ${merge.deleteId}\n`);

      const keepPlayer = await prisma.player.findUnique({
        where: { id: merge.keepId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          name: true,
          email: true,
          phone: true,
          city: true,
          region: true,
          duprDoubles: true,
          duprSingles: true,
          clubRatingDoubles: true,
          clubRatingSingles: true,
          clerkUserId: true,
          createdAt: true,
        },
      });

      const deletePlayer = await prisma.player.findUnique({
        where: { id: merge.deleteId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          name: true,
          email: true,
          phone: true,
          city: true,
          region: true,
          duprDoubles: true,
          duprSingles: true,
          clubRatingDoubles: true,
          clubRatingSingles: true,
          clerkUserId: true,
          createdAt: true,
        },
      });

      if (!keepPlayer) {
        console.log(`⚠️  Keep player ${merge.keepId} not found, skipping...`);
        continue;
      }
      if (!deletePlayer) {
        console.log(`⚠️  Delete player ${merge.deleteId} not found, skipping...`);
        continue;
      }

      // Verify Clerk account
      if (!keepPlayer.clerkUserId) {
        console.log(`⚠️  WARNING: Keep player ${merge.keepId} does NOT have Clerk account!`);
        console.log(`   Keep player Clerk: ${keepPlayer.clerkUserId || 'NONE'}`);
        console.log(`   Delete player Clerk: ${deletePlayer.clerkUserId || 'NONE'}`);
        console.log(`   Skipping merge to prevent data loss...`);
        continue;
      }

      console.log(`Keep Player: ${keepPlayer.firstName} ${keepPlayer.lastName}`);
      console.log(`  Email: ${keepPlayer.email || 'N/A'}`);
      console.log(`  Clerk: ${keepPlayer.clerkUserId ? 'Yes' : 'No'}`);
      console.log(`Delete Player: ${deletePlayer.firstName} ${deletePlayer.lastName}`);
      console.log(`  Email: ${deletePlayer.email || 'N/A'}`);
      console.log(`  Clerk: ${deletePlayer.clerkUserId ? 'Yes' : 'No'}\n`);

      // Check for roster entries
      const rosterEntries = await prisma.stopTeamPlayer.findMany({
        where: { playerId: merge.deleteId },
      });
      console.log(`  • Roster entries: ${rosterEntries.length}`);

      // Check for lineup entries (as player1)
      const lineupEntriesP1 = await prisma.lineupEntry.findMany({
        where: { player1Id: merge.deleteId },
      });
      console.log(`  • Lineup entries as player1: ${lineupEntriesP1.length}`);

      // Check for lineup entries (as player2)
      const lineupEntriesP2 = await prisma.lineupEntry.findMany({
        where: { player2Id: merge.deleteId },
      });
      console.log(`  • Lineup entries as player2: ${lineupEntriesP2.length}`);

      // Check for team memberships
      const teamMemberships = await prisma.teamPlayer.findMany({
        where: { playerId: merge.deleteId },
      });
      console.log(`  • Team memberships: ${teamMemberships.length}`);

      // Check for registrations
      const registrations = await prisma.tournamentRegistration.findMany({
        where: { playerId: merge.deleteId },
      });
      console.log(`  • Tournament registrations: ${registrations.length}`);

      // Check for captain teams
      const captainTeams = await prisma.team.findMany({
        where: { captainId: merge.deleteId },
      });
      console.log(`  • Teams as captain: ${captainTeams.length}`);

      // Check for captain invites
      const captainInvites = await prisma.captainInvite.findMany({
        where: { playerId: merge.deleteId },
      });
      console.log(`  • Captain invites: ${captainInvites.length}`);

      // Check for tournament admins
      const tournamentAdmins = await prisma.tournamentAdmin.findMany({
        where: { playerId: merge.deleteId },
      });
      console.log(`  • Tournament admin roles: ${tournamentAdmins.length}`);

      // Check for tournament captains
      const tournamentCaptains = await prisma.tournamentCaptain.findMany({
        where: { playerId: merge.deleteId },
      });
      console.log(`  • Tournament captain roles: ${tournamentCaptains.length}`);

      // Check for event manager roles
      const eventManagers = await prisma.tournamentEventManager.findMany({
        where: { playerId: merge.deleteId },
      });
      console.log(`  • Event manager roles: ${eventManagers.length}`);

      // Check for stop managers
      const stopManagers = await prisma.stop.findMany({
        where: { eventManagerId: merge.deleteId },
      });
      console.log(`  • Stops managed: ${stopManagers.length}`);

      // Check for club directors
      const playerWithClubs = await prisma.player.findUnique({
        where: { id: merge.deleteId },
        select: {
          clubsAsDirector: {
            select: { id: true },
          },
        },
      });
      const clubDirectorsCount = playerWithClubs?.clubsAsDirector?.length || 0;
      console.log(`  • Club director roles: ${clubDirectorsCount}`);

      // Check for tiebreaker decisions
      const tiebreakerDecisions = await prisma.match.findMany({
        where: { tiebreakerDecidedById: merge.deleteId },
      });
      console.log(`  • Tiebreaker decisions: ${tiebreakerDecisions.length}`);

      // Prepare data to merge from delete account to keep account
      const updateData: {
        city?: string;
        region?: string;
        duprDoubles?: number;
        duprSingles?: number | null;
        clubRatingDoubles?: number | null;
        clubRatingSingles?: number | null;
        firstName?: string;
        lastName?: string;
        name?: string;
        phone?: string | null;
      } = {};

      // Merge location data if keep account doesn't have it
      if (!keepPlayer.city && deletePlayer.city) {
        updateData.city = deletePlayer.city;
      }
      if (!keepPlayer.region && deletePlayer.region) {
        updateData.region = deletePlayer.region;
      }

      // Merge DUPR ratings if keep account doesn't have them
      if (keepPlayer.duprDoubles === null && deletePlayer.duprDoubles !== null) {
        updateData.duprDoubles = deletePlayer.duprDoubles;
      }
      if (keepPlayer.duprSingles === null && deletePlayer.duprSingles !== null) {
        updateData.duprSingles = deletePlayer.duprSingles;
      }

      // Merge club ratings if keep account doesn't have them
      if (keepPlayer.clubRatingDoubles === null && deletePlayer.clubRatingDoubles !== null) {
        updateData.clubRatingDoubles = deletePlayer.clubRatingDoubles;
      }
      if (keepPlayer.clubRatingSingles === null && deletePlayer.clubRatingSingles !== null) {
        updateData.clubRatingSingles = deletePlayer.clubRatingSingles;
      }

      // Merge phone if keep account doesn't have it
      if (!keepPlayer.phone && deletePlayer.phone) {
        updateData.phone = deletePlayer.phone;
      }

      // Merge name fields if delete account has better data
      // Prefer full names over initials
      const normalize = (str: string | null | undefined): string => {
        if (!str) return '';
        return str.trim().toLowerCase();
      };

      if (deletePlayer.firstName && deletePlayer.firstName.length > 1) {
        const keepFirstName = normalize(keepPlayer.firstName);
        const deleteFirstName = normalize(deletePlayer.firstName);
        // If keep has initial/short name and delete has full name, use delete's name
        if ((!keepFirstName || keepFirstName.length <= 1) && deleteFirstName.length > 1) {
          updateData.firstName = deletePlayer.firstName;
        }
      }

      if (deletePlayer.lastName && deletePlayer.lastName.length > 1) {
        const keepLastName = normalize(keepPlayer.lastName);
        const deleteLastName = normalize(deletePlayer.lastName);
        // If keep has initial/short name and delete has full name, use delete's name
        if ((!keepLastName || keepLastName.length <= 1) && deleteLastName.length > 1) {
          updateData.lastName = deletePlayer.lastName;
          // Update name field too
          updateData.name = `${keepPlayer.firstName || deletePlayer.firstName || ''} ${deletePlayer.lastName}`.trim();
        }
      }

      // Perform the merge in a transaction
      await prisma.$transaction(async (tx) => {
        // Update roster entries
        if (rosterEntries.length > 0) {
          await tx.stopTeamPlayer.updateMany({
            where: { playerId: merge.deleteId },
            data: { playerId: merge.keepId },
          });
          console.log(`  ✅ Updated ${rosterEntries.length} roster entries`);
        }

        // Update lineup entries (player1)
        if (lineupEntriesP1.length > 0) {
          await tx.lineupEntry.updateMany({
            where: { player1Id: merge.deleteId },
            data: { player1Id: merge.keepId },
          });
          console.log(`  ✅ Updated ${lineupEntriesP1.length} lineup entries (player1)`);
        }

        // Update lineup entries (player2)
        if (lineupEntriesP2.length > 0) {
          await tx.lineupEntry.updateMany({
            where: { player2Id: merge.deleteId },
            data: { player2Id: merge.keepId },
          });
          console.log(`  ✅ Updated ${lineupEntriesP2.length} lineup entries (player2)`);
        }

        // Update team memberships
        if (teamMemberships.length > 0) {
          await tx.teamPlayer.updateMany({
            where: { playerId: merge.deleteId },
            data: { playerId: merge.keepId },
          });
          console.log(`  ✅ Updated ${teamMemberships.length} team memberships`);
        }

        // Update registrations
        if (registrations.length > 0) {
          await tx.tournamentRegistration.updateMany({
            where: { playerId: merge.deleteId },
            data: { playerId: merge.keepId },
          });
          console.log(`  ✅ Updated ${registrations.length} registrations`);
        }

        // Update captain teams
        if (captainTeams.length > 0) {
          await tx.team.updateMany({
            where: { captainId: merge.deleteId },
            data: { captainId: merge.keepId },
          });
          console.log(`  ✅ Updated ${captainTeams.length} teams as captain`);
        }

        // Update captain invites
        if (captainInvites.length > 0) {
          await tx.captainInvite.updateMany({
            where: { playerId: merge.deleteId },
            data: { playerId: merge.keepId },
          });
          console.log(`  ✅ Updated ${captainInvites.length} captain invites`);
        }

        // Update tournament admins
        if (tournamentAdmins.length > 0) {
          await tx.tournamentAdmin.updateMany({
            where: { playerId: merge.deleteId },
            data: { playerId: merge.keepId },
          });
          console.log(`  ✅ Updated ${tournamentAdmins.length} tournament admin roles`);
        }

        // Update tournament captains
        if (tournamentCaptains.length > 0) {
          await tx.tournamentCaptain.updateMany({
            where: { playerId: merge.deleteId },
            data: { playerId: merge.keepId },
          });
          console.log(`  ✅ Updated ${tournamentCaptains.length} tournament captain roles`);
        }

        // Update event managers
        if (eventManagers.length > 0) {
          await tx.tournamentEventManager.updateMany({
            where: { playerId: merge.deleteId },
            data: { playerId: merge.keepId },
          });
          console.log(`  ✅ Updated ${eventManagers.length} event manager roles`);
        }

        // Update stop managers
        if (stopManagers.length > 0) {
          await tx.stop.updateMany({
            where: { eventManagerId: merge.deleteId },
            data: { eventManagerId: merge.keepId },
          });
          console.log(`  ✅ Updated ${stopManagers.length} stops managed`);
        }

        // Update club directors
        if (clubDirectorsCount > 0) {
          await tx.club.updateMany({
            where: { directorId: merge.deleteId },
            data: { directorId: merge.keepId },
          });
          console.log(`  ✅ Updated ${clubDirectorsCount} club director roles`);
        }

        // Update tiebreaker decisions
        if (tiebreakerDecisions.length > 0) {
          await tx.match.updateMany({
            where: { tiebreakerDecidedById: merge.deleteId },
            data: { tiebreakerDecidedById: merge.keepId },
          });
          console.log(`  ✅ Updated ${tiebreakerDecisions.length} tiebreaker decisions`);
        }

        // Merge profile data if any updates needed
        if (Object.keys(updateData).length > 0) {
          await tx.player.update({
            where: { id: merge.keepId },
            data: updateData,
          });
          console.log(`  ✅ Merged profile data: ${Object.keys(updateData).join(', ')}`);
        }

        // Delete the old player
        await tx.player.delete({
          where: { id: merge.deleteId },
        });
        console.log(`  ✅ Deleted old player ${merge.deleteId}`);
      });

      console.log(`\n✅ Successfully merged ${merge.name}\n`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ ALL MERGES COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(80) + '\n');
  } catch (error) {
    console.error('\n❌ Error during merge:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

mergePlayers()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

