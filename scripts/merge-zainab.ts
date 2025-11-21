import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function mergeZainab() {
  try {
    const keepId = 'cmi8u80zo0001ju042vm9zpg8'; // Zainab with email and Clerk ID
    const deleteId = 'cmg0683gm000brddchkrs3x9x'; // Zainab Eaton with full name but no email

    console.log(`\n=== Merging Zainab Accounts ===\n`);
    console.log(`Keep: ${keepId} (has email and Clerk ID)`);
    console.log(`Delete: ${deleteId} (has full name but no email)\n`);

    // Verify players exist
    const keepPlayer = await prisma.player.findUnique({
      where: { id: keepId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        clerkUserId: true,
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
        clerkUserId: true,
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
    console.log(`  Clerk ID: ${keepPlayer.clerkUserId || 'None'}`);
    console.log(`  Last Name: ${keepPlayer.lastName || 'null'}`);
    console.log(`\nDelete Player: ${deletePlayer.name || `${deletePlayer.firstName} ${deletePlayer.lastName}`}`);
    console.log(`  Email: ${deletePlayer.email || 'None'}`);
    console.log(`  Clerk ID: ${deletePlayer.clerkUserId || 'None'}`);
    console.log(`  Last Name: ${deletePlayer.lastName || 'null'}\n`);

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

      // Update the kept player's lastName if it's null and the deleted player has one
      if (!keepPlayer.lastName && deletePlayer.lastName) {
        const updatedName = keepPlayer.firstName && deletePlayer.lastName
          ? `${keepPlayer.firstName} ${deletePlayer.lastName}`.trim()
          : keepPlayer.name || deletePlayer.name || null;
        
        // Use raw SQL to avoid Prisma client schema issues
        await tx.$executeRaw`
          UPDATE "Player"
          SET "lastName" = ${deletePlayer.lastName}, "name" = ${updatedName}
          WHERE id = ${keepId}
        `;
        console.log(`✅ Updated kept player's lastName to "${deletePlayer.lastName}"`);
        console.log(`✅ Updated kept player's name to "${updatedName}"`);
      }

      // Delete the old player
      await tx.player.delete({
        where: { id: deleteId }
      });
      console.log(`✅ Deleted old player ${deleteId}`);
    });

    console.log(`\n✅ Successfully merged Zainab accounts!\n`);

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

mergeZainab();

