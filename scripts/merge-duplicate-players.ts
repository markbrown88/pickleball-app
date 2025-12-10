import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

interface MergePair {
  oldId: string; // No email account to delete
  newId: string; // Email account to keep
  name: string;
}

const merges: MergePair[] = [
  {
    oldId: 'cmg067sat0009rddcid5r3u7a', // Kara Blair - no email, no Clerk
    newId: 'cmiw6ortx0001jm04t8y1avyb', // Kara Blair - karablair22@gmail.com, has Clerk
    name: 'Kara Blair'
  },
  {
    oldId: 'cmh8226q00015r0j4sxq5n7fo', // Cheryl Teti - cherylteti@icloud.com, no Clerk
    newId: 'cmizbjx5d0003l104r6o11kdw', // Cheryl Teti - cherteti@gmail.com, has Clerk
    name: 'Cheryl Teti'
  },
  {
    oldId: 'cmh822dg5006dr0j4d8iada7s', // Roger Lam - no email, no Clerk
    newId: 'cmit2espj0001l50476616jp3', // Roger Lam - jorolam@rogers.com, has Clerk
    name: 'Roger Lam'
  }
];

async function mergePlayers() {
  try {
    console.log(`\n=== Merging Duplicate Players ===\n`);

    for (const merge of merges) {
      console.log(`\n🔄 Merging ${merge.name}:`);
      console.log(`   Old (to delete): ${merge.oldId}`);
      console.log(`   New (to keep): ${merge.newId}`);

      // Verify players exist
      const oldPlayer = await prisma.player.findUnique({
        where: { id: merge.oldId },
        select: { id: true, email: true, clerkUserId: true }
      });

      const newPlayer = await prisma.player.findUnique({
        where: { id: merge.newId },
        select: { id: true, email: true, clerkUserId: true }
      });

      if (!oldPlayer) {
        console.log(`   ⚠️  Old player not found, skipping...`);
        continue;
      }

      if (!newPlayer) {
        console.log(`   ⚠️  New player not found, skipping...`);
        continue;
      }

      // Check for roster entries
      const rosterEntries = await prisma.stopTeamPlayer.findMany({
        where: { playerId: merge.oldId }
      });
      console.log(`   Found ${rosterEntries.length} roster entries`);

      // Check for lineup entries (as player1)
      const lineupEntriesP1 = await prisma.lineupEntry.findMany({
        where: { player1Id: merge.oldId }
      });
      console.log(`   Found ${lineupEntriesP1.length} lineup entries as player1`);

      // Check for lineup entries (as player2)
      const lineupEntriesP2 = await prisma.lineupEntry.findMany({
        where: { player2Id: merge.oldId }
      });
      console.log(`   Found ${lineupEntriesP2.length} lineup entries as player2`);

      // Check for team memberships
      const teamMemberships = await prisma.teamPlayer.findMany({
        where: { playerId: merge.oldId }
      });
      console.log(`   Found ${teamMemberships.length} team memberships`);

      // Check for registrations
      const registrations = await prisma.tournamentRegistration.findMany({
        where: { playerId: merge.oldId }
      });
      console.log(`   Found ${registrations.length} registrations`);

      // Check for captain teams
      const captainTeams = await prisma.team.findMany({
        where: { captainId: merge.oldId }
      });
      console.log(`   Found ${captainTeams.length} teams as captain`);

      // Check for captain invites
      const captainInvites = await prisma.captainInvite.findMany({
        where: { playerId: merge.oldId }
      });
      console.log(`   Found ${captainInvites.length} captain invites`);

      // Check for tournament admins
      const tournamentAdmins = await prisma.tournamentAdmin.findMany({
        where: { playerId: merge.oldId }
      });
      console.log(`   Found ${tournamentAdmins.length} tournament admin roles`);

      // Check for tournament captains
      const tournamentCaptains = await prisma.tournamentCaptain.findMany({
        where: { playerId: merge.oldId }
      });
      console.log(`   Found ${tournamentCaptains.length} tournament captain roles`);

      // Check for event manager roles
      const eventManagers = await prisma.tournamentEventManager.findMany({
        where: { playerId: merge.oldId }
      });
      console.log(`   Found ${eventManagers.length} event manager roles`);

      // Check for stop managers
      const stopManagers = await prisma.stop.findMany({
        where: { eventManagerId: merge.oldId }
      });
      console.log(`   Found ${stopManagers.length} stops managed`);

      // Check for club directors (via clubsAsDirector relation)
      const playerWithClubs = await prisma.player.findUnique({
        where: { id: merge.oldId },
        select: {
          clubsAsDirector: {
            select: { id: true }
          }
        }
      });
      const clubDirectorsCount = playerWithClubs?.clubsAsDirector?.length || 0;
      console.log(`   Found ${clubDirectorsCount} club director roles`);

      // Check for tiebreaker decisions
      const tiebreakerDecisions = await prisma.match.findMany({
        where: { tiebreakerDecidedById: merge.oldId }
      });
      console.log(`   Found ${tiebreakerDecisions.length} tiebreaker decisions`);

      // Perform the merge in a transaction
      await prisma.$transaction(async (tx) => {
        // Update roster entries
        if (rosterEntries.length > 0) {
          await tx.stopTeamPlayer.updateMany({
            where: { playerId: merge.oldId },
            data: { playerId: merge.newId }
          });
          console.log(`   ✅ Updated ${rosterEntries.length} roster entries`);
        }

        // Update lineup entries (player1)
        if (lineupEntriesP1.length > 0) {
          await tx.lineupEntry.updateMany({
            where: { player1Id: merge.oldId },
            data: { player1Id: merge.newId }
          });
          console.log(`   ✅ Updated ${lineupEntriesP1.length} lineup entries (player1)`);
        }

        // Update lineup entries (player2)
        if (lineupEntriesP2.length > 0) {
          await tx.lineupEntry.updateMany({
            where: { player2Id: merge.oldId },
            data: { player2Id: merge.newId }
          });
          console.log(`   ✅ Updated ${lineupEntriesP2.length} lineup entries (player2)`);
        }

        // Update team memberships
        if (teamMemberships.length > 0) {
          await tx.teamPlayer.updateMany({
            where: { playerId: merge.oldId },
            data: { playerId: merge.newId }
          });
          console.log(`   ✅ Updated ${teamMemberships.length} team memberships`);
        }

        // Update registrations
        if (registrations.length > 0) {
          await tx.tournamentRegistration.updateMany({
            where: { playerId: merge.oldId },
            data: { playerId: merge.newId }
          });
          console.log(`   ✅ Updated ${registrations.length} registrations`);
        }

        // Update captain teams
        if (captainTeams.length > 0) {
          await tx.team.updateMany({
            where: { captainId: merge.oldId },
            data: { captainId: merge.newId }
          });
          console.log(`   ✅ Updated ${captainTeams.length} teams as captain`);
        }

        // Update captain invites
        if (captainInvites.length > 0) {
          await tx.captainInvite.updateMany({
            where: { playerId: merge.oldId },
            data: { playerId: merge.newId }
          });
          console.log(`   ✅ Updated ${captainInvites.length} captain invites`);
        }

        // Update tournament admins
        if (tournamentAdmins.length > 0) {
          await tx.tournamentAdmin.updateMany({
            where: { playerId: merge.oldId },
            data: { playerId: merge.newId }
          });
          console.log(`   ✅ Updated ${tournamentAdmins.length} tournament admin roles`);
        }

        // Update tournament captains
        if (tournamentCaptains.length > 0) {
          await tx.tournamentCaptain.updateMany({
            where: { playerId: merge.oldId },
            data: { playerId: merge.newId }
          });
          console.log(`   ✅ Updated ${tournamentCaptains.length} tournament captain roles`);
        }

        // Update event managers
        if (eventManagers.length > 0) {
          await tx.tournamentEventManager.updateMany({
            where: { playerId: merge.oldId },
            data: { playerId: merge.newId }
          });
          console.log(`   ✅ Updated ${eventManagers.length} event manager roles`);
        }

        // Update stop managers
        if (stopManagers.length > 0) {
          await tx.stop.updateMany({
            where: { eventManagerId: merge.oldId },
            data: { eventManagerId: merge.newId }
          });
          console.log(`   ✅ Updated ${stopManagers.length} stops managed`);
        }

        // Update club directors (via Club model)
        if (clubDirectorsCount > 0) {
          await tx.club.updateMany({
            where: { directorId: merge.oldId },
            data: { directorId: merge.newId }
          });
          console.log(`   ✅ Updated ${clubDirectorsCount} club director roles`);
        }

        // Update tiebreaker decisions
        if (tiebreakerDecisions.length > 0) {
          await tx.match.updateMany({
            where: { tiebreakerDecidedById: merge.oldId },
            data: { tiebreakerDecidedById: merge.newId }
          });
          console.log(`   ✅ Updated ${tiebreakerDecisions.length} tiebreaker decisions`);
        }

        // Delete the old player
        await tx.player.delete({
          where: { id: merge.oldId }
        });
        console.log(`   ✅ Deleted old player ${merge.oldId}`);
      });

      console.log(`   ✅ Successfully merged ${merge.name}`);
    }

    console.log(`\n✅ All merges completed successfully!\n`);

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

mergePlayers();
