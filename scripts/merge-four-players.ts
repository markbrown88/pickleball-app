import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

type MergePair = {
  name: string;
  keepId: string;
  deleteId: string;
};

const merges: MergePair[] = [
  {
    name: 'Christie Han',
    keepId: 'cmiew8qok0005jr04ve2g3bwo', // Clerk + email
    deleteId: 'cmfpbp773000rrdn0gu503m4k', // Legacy entry with DUPR + history
  },
  {
    name: 'Jen Cheah',
    keepId: 'cmiew9ont0009jr04u65gos7c', // Clerk + email
    deleteId: 'cmfpbp7u7001trdn0hz2lndo9', // Legacy entry with DUPR + history
  },
  {
    name: 'Kim Shpeer',
    keepId: 'cmiexcg710001l504erkhbu8l', // Clerk + email
    deleteId: 'cmfpd071i0003rdb4nhoiiwqk', // Legacy entry with DUPR + history
  },
  {
    name: 'Tiffany Lin',
    keepId: 'cmieyikdx0001ju040igqmf4i', // Clerk + email (note: name is "Tiffant" but should be Tiffany)
    deleteId: 'cmfpbp9cr004frdn0e12zgrzy', // Legacy entry with DUPR + history
  },
];

async function mergePlayers() {
  for (const merge of merges) {
    console.log('\n' + '='.repeat(80));
    console.log(`MERGING ${merge.name.toUpperCase()}`);
    console.log('='.repeat(80));
    console.log(`Keep:   ${merge.keepId}`);
    console.log(`Delete: ${merge.deleteId}\n`);

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

    console.log('Keep Player:');
    console.log(`  Name: ${keepPlayer.name || `${keepPlayer.firstName} ${keepPlayer.lastName}`}`);
    console.log(`  Email: ${keepPlayer.email || 'None'}`);
    console.log(`  Phone: ${keepPlayer.phone || 'None'}`);
    console.log(`  City/Region: ${keepPlayer.city || 'None'} / ${keepPlayer.region || 'None'}`);
    console.log(`  DUPR Doubles/Singles: ${keepPlayer.duprDoubles || 'None'} / ${keepPlayer.duprSingles || 'None'}`);
    console.log(`  Club Rating Doubles/Singles: ${keepPlayer.clubRatingDoubles || 'None'} / ${keepPlayer.clubRatingSingles || 'None'}`);
    console.log(`  Clerk ID: ${keepPlayer.clerkUserId || 'None'}`);
    console.log(`  Created: ${keepPlayer.createdAt.toISOString()}`);

    console.log('\nDelete Player:');
    console.log(`  Name: ${deletePlayer.name || `${deletePlayer.firstName} ${deletePlayer.lastName}`}`);
    console.log(`  Email: ${deletePlayer.email || 'None'}`);
    console.log(`  Phone: ${deletePlayer.phone || 'None'}`);
    console.log(`  City/Region: ${deletePlayer.city || 'None'} / ${deletePlayer.region || 'None'}`);
    console.log(`  DUPR Doubles/Singles: ${deletePlayer.duprDoubles || 'None'} / ${deletePlayer.duprSingles || 'None'}`);
    console.log(`  Club Rating Doubles/Singles: ${deletePlayer.clubRatingDoubles || 'None'} / ${deletePlayer.clubRatingSingles || 'None'}`);
    console.log(`  Clerk ID: ${deletePlayer.clerkUserId || 'None'}`);
    console.log(`  Created: ${deletePlayer.createdAt.toISOString()}`);

    // Fetch related records
    const rosterEntries = await prisma.stopTeamPlayer.findMany({
      where: { playerId: merge.deleteId },
    });
    const lineupEntriesP1 = await prisma.lineupEntry.findMany({
      where: { player1Id: merge.deleteId },
    });
    const lineupEntriesP2 = await prisma.lineupEntry.findMany({
      where: { player2Id: merge.deleteId },
    });
    const teamMemberships = await prisma.teamPlayer.findMany({
      where: { playerId: merge.deleteId },
    });
    const registrations = await prisma.tournamentRegistration.findMany({
      where: { playerId: merge.deleteId },
    });
    const captainTeams = await prisma.team.findMany({
      where: { captainId: merge.deleteId },
    });
    const captainInvites = await prisma.captainInvite.findMany({
      where: { playerId: merge.deleteId },
    });
    const tournamentAdmins = await prisma.tournamentAdmin.findMany({
      where: { playerId: merge.deleteId },
    });
    const tournamentCaptains = await prisma.tournamentCaptain.findMany({
      where: { playerId: merge.deleteId },
    });
    const eventManagers = await prisma.tournamentEventManager.findMany({
      where: { playerId: merge.deleteId },
    });
    const stopManagers = await prisma.stop.findMany({
      where: { eventManagerId: merge.deleteId },
    });
    const playerWithClubs = await prisma.player.findUnique({
      where: { id: merge.deleteId },
      select: {
        clubsAsDirector: {
          select: { id: true },
        },
      },
    });
    const clubDirectorsCount = playerWithClubs?.clubsAsDirector?.length || 0;
    const tiebreakerDecisions = await prisma.match.findMany({
      where: { tiebreakerDecidedById: merge.deleteId },
    });

    console.log('\nRelationships to transfer:');
    console.log(`  • Roster entries: ${rosterEntries.length}`);
    console.log(`  • Lineup entries (Player 1): ${lineupEntriesP1.length}`);
    console.log(`  • Lineup entries (Player 2): ${lineupEntriesP2.length}`);
    console.log(`  • Team memberships: ${teamMemberships.length}`);
    console.log(`  • Registrations: ${registrations.length}`);
    console.log(`  • Teams as captain: ${captainTeams.length}`);
    console.log(`  • Captain invites: ${captainInvites.length}`);
    console.log(`  • Tournament admin roles: ${tournamentAdmins.length}`);
    console.log(`  • Tournament captain roles: ${tournamentCaptains.length}`);
    console.log(`  • Event manager roles: ${eventManagers.length}`);
    console.log(`  • Stops managed: ${stopManagers.length}`);
    console.log(`  • Club director roles: ${clubDirectorsCount}`);
    console.log(`  • Tiebreaker decisions: ${tiebreakerDecisions.length}`);

    // Prepare data to merge from old account to new account
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
    } = {};

    // Merge location data if new account doesn't have it
    if (!keepPlayer.city && deletePlayer.city) {
      updateData.city = deletePlayer.city;
    }
    if (!keepPlayer.region && deletePlayer.region) {
      updateData.region = deletePlayer.region;
    }

    // Merge DUPR ratings if new account doesn't have them
    if (!keepPlayer.duprDoubles && deletePlayer.duprDoubles) {
      updateData.duprDoubles = deletePlayer.duprDoubles;
    }
    if (!keepPlayer.duprSingles && deletePlayer.duprSingles) {
      updateData.duprSingles = deletePlayer.duprSingles;
    }

    // Merge club ratings if new account doesn't have them
    if (!keepPlayer.clubRatingDoubles && deletePlayer.clubRatingDoubles) {
      updateData.clubRatingDoubles = deletePlayer.clubRatingDoubles;
    }
    if (!keepPlayer.clubRatingSingles && deletePlayer.clubRatingSingles) {
      updateData.clubRatingSingles = deletePlayer.clubRatingSingles;
    }

    // For Tiffany Lin, fix the typo in the new account ("Tiffant" -> "Tiffany")
    if (merge.name === 'Tiffany Lin' && keepPlayer.firstName === 'Tiffant') {
      updateData.firstName = 'Tiffany';
      updateData.name = `Tiffany ${keepPlayer.lastName || ''}`.trim();
    }

    // Perform the merge in a transaction
    await prisma.$transaction(async (tx) => {
      // Update roster entries
      if (rosterEntries.length > 0) {
        await tx.stopTeamPlayer.updateMany({
          where: { playerId: merge.deleteId },
          data: { playerId: merge.keepId },
        });
        console.log(`✅ Transferred ${rosterEntries.length} roster entries`);
      }

      // Update lineup entries (player1)
      if (lineupEntriesP1.length > 0) {
        await tx.lineupEntry.updateMany({
          where: { player1Id: merge.deleteId },
          data: { player1Id: merge.keepId },
        });
        console.log(`✅ Transferred ${lineupEntriesP1.length} lineup entries (Player 1)`);
      }

      // Update lineup entries (player2)
      if (lineupEntriesP2.length > 0) {
        await tx.lineupEntry.updateMany({
          where: { player2Id: merge.deleteId },
          data: { player2Id: merge.keepId },
        });
        console.log(`✅ Transferred ${lineupEntriesP2.length} lineup entries (Player 2)`);
      }

      // Update team memberships
      if (teamMemberships.length > 0) {
        await tx.teamPlayer.updateMany({
          where: { playerId: merge.deleteId },
          data: { playerId: merge.keepId },
        });
        console.log(`✅ Transferred ${teamMemberships.length} team memberships`);
      }

      // Update registrations
      if (registrations.length > 0) {
        await tx.tournamentRegistration.updateMany({
          where: { playerId: merge.deleteId },
          data: { playerId: merge.keepId },
        });
        console.log(`✅ Transferred ${registrations.length} registrations`);
      }

      // Update captain teams
      if (captainTeams.length > 0) {
        await tx.team.updateMany({
          where: { captainId: merge.deleteId },
          data: { captainId: merge.keepId },
        });
        console.log(`✅ Transferred ${captainTeams.length} teams as captain`);
      }

      // Update captain invites
      if (captainInvites.length > 0) {
        await tx.captainInvite.updateMany({
          where: { playerId: merge.deleteId },
          data: { playerId: merge.keepId },
        });
        console.log(`✅ Transferred ${captainInvites.length} captain invites`);
      }

      // Update tournament admins
      if (tournamentAdmins.length > 0) {
        await tx.tournamentAdmin.updateMany({
          where: { playerId: merge.deleteId },
          data: { playerId: merge.keepId },
        });
        console.log(`✅ Transferred ${tournamentAdmins.length} tournament admin roles`);
      }

      // Update tournament captains
      if (tournamentCaptains.length > 0) {
        await tx.tournamentCaptain.updateMany({
          where: { playerId: merge.deleteId },
          data: { playerId: merge.keepId },
        });
        console.log(`✅ Transferred ${tournamentCaptains.length} tournament captain roles`);
      }

      // Update event managers
      if (eventManagers.length > 0) {
        await tx.tournamentEventManager.updateMany({
          where: { playerId: merge.deleteId },
          data: { playerId: merge.keepId },
        });
        console.log(`✅ Transferred ${eventManagers.length} event manager roles`);
      }

      // Update stop managers
      if (stopManagers.length > 0) {
        await tx.stop.updateMany({
          where: { eventManagerId: merge.deleteId },
          data: { eventManagerId: merge.keepId },
        });
        console.log(`✅ Transferred ${stopManagers.length} stops managed`);
      }

      // Update club directors
      if (clubDirectorsCount > 0) {
        await tx.club.updateMany({
          where: { directorId: merge.deleteId },
          data: { directorId: merge.keepId },
        });
        console.log(`✅ Transferred ${clubDirectorsCount} club director roles`);
      }

      // Update tiebreaker decisions
      if (tiebreakerDecisions.length > 0) {
        await tx.match.updateMany({
          where: { tiebreakerDecidedById: merge.deleteId },
          data: { tiebreakerDecidedById: merge.keepId },
        });
        console.log(`✅ Transferred ${tiebreakerDecisions.length} tiebreaker decisions`);
      }

      // Merge useful data from old account to new account
      if (Object.keys(updateData).length > 0) {
        await tx.player.update({
          where: { id: merge.keepId },
          data: updateData,
        });
        console.log(`✅ Applied profile updates:`, updateData);
      }

      // Delete the old player
      await tx.player.delete({
        where: { id: merge.deleteId },
      });
      console.log(`✅ Deleted legacy player ${merge.deleteId}`);
    });

    console.log(`\n🎉 Completed merge for ${merge.name}\n`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ ALL MERGES COMPLETED SUCCESSFULLY');
  console.log('='.repeat(80));
}

mergePlayers()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });

