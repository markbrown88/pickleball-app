import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

// Merges to perform: [deleteId (initial/incomplete), keepId (full name)]
const MERGES = [
  {
    deleteId: 'cmfpbp81i0023rdn00fxs9k7e', // Karen C
    keepId: 'cmikhfbdq0001ju04xshvsqfg',   // Karen Cutaia
    description: 'Karen C → Karen Cutaia',
  },
  {
    deleteId: 'cmfpfejy0000nrdb4tbua2xkv', // Krista J
    keepId: 'cmilvr1430003lh04ay590iiq',   // Krista Jones
    description: 'Krista J → Krista Jones',
  },
  {
    deleteId: 'cmg07dqaa001lrddcejsw4ixx', // Tara D
    keepId: 'cmike38wj0001l204qtl93kkz',   // Tara Di Giuseppe
    description: 'Tara D → Tara Di Giuseppe',
  },
  {
    deleteId: 'cmgp4uqpz000djl0457zdjtd3', // Arun ?
    keepId: 'cmihrz3f4000ple0461pqifkx',   // Arun Kumar
    description: 'Arun ? → Arun Kumar',
  },
];

async function mergePlayers(deleteId: string, keepId: string, description: string) {
  console.log(`\n=== ${description} ===\n`);

  // Verify players exist
  const keepPlayer = await prisma.player.findUnique({
    where: { id: keepId },
    select: { id: true, firstName: true, lastName: true, name: true, email: true, clerkUserId: true },
  });

  const deletePlayer = await prisma.player.findUnique({
    where: { id: deleteId },
    select: { id: true, firstName: true, lastName: true, name: true, email: true, clerkUserId: true },
  });

  if (!keepPlayer) {
    console.log(`❌ Keep player ${keepId} not found - skipping`);
    return false;
  }

  if (!deletePlayer) {
    console.log(`❌ Delete player ${deleteId} not found - skipping`);
    return false;
  }

  console.log(`Keep: ${keepPlayer.name} (${keepPlayer.email || 'no email'})`);
  console.log(`Delete: ${deletePlayer.name} (${deletePlayer.email || 'no email'})`);

  // Count relationships
  const counts = {
    rosterEntries: await prisma.stopTeamPlayer.count({ where: { playerId: deleteId } }),
    lineupP1: await prisma.lineupEntry.count({ where: { player1Id: deleteId } }),
    lineupP2: await prisma.lineupEntry.count({ where: { player2Id: deleteId } }),
    teamMemberships: await prisma.teamPlayer.count({ where: { playerId: deleteId } }),
    registrations: await prisma.tournamentRegistration.count({ where: { playerId: deleteId } }),
    captainTeams: await prisma.team.count({ where: { captainId: deleteId } }),
    captainInvites: await prisma.captainInvite.count({ where: { captainId: deleteId } }),
    tournamentAdmins: await prisma.tournamentAdmin.count({ where: { playerId: deleteId } }),
    tournamentCaptains: await prisma.tournamentCaptain.count({ where: { playerId: deleteId } }),
    eventManagers: await prisma.tournamentEventManager.count({ where: { playerId: deleteId } }),
    stopManagers: await prisma.stop.count({ where: { eventManagerId: deleteId } }),
    clubDirectors: await prisma.clubDirector.count({ where: { playerId: deleteId } }),
    tiebreakerDecisions: await prisma.match.count({ where: { tiebreakerDecidedById: deleteId } }),
    waitlistEntries: await prisma.tournamentWaitlist.count({ where: { playerId: deleteId } }),
    invitesReceived: await prisma.tournamentInvite.count({ where: { playerId: deleteId } }),
    invitesSent: await prisma.tournamentInvite.count({ where: { invitedBy: deleteId } }),
    inviteRequestsSent: await prisma.inviteRequest.count({ where: { playerId: deleteId } }),
    inviteRequestsReviewed: await prisma.inviteRequest.count({ where: { reviewedBy: deleteId } }),
  };

  const totalRelationships = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`Found ${totalRelationships} relationships to transfer`);

  // Perform the merge in a transaction
  await prisma.$transaction(async (tx) => {
    // Transfer all relationships
    if (counts.rosterEntries > 0) {
      // Check for duplicates first
      const existingRosters = await tx.stopTeamPlayer.findMany({
        where: { playerId: keepId },
        select: { stopId: true, teamId: true },
      });
      const existingKeys = new Set(existingRosters.map(r => `${r.stopId}-${r.teamId}`));

      const toTransfer = await tx.stopTeamPlayer.findMany({
        where: { playerId: deleteId },
        select: { stopId: true, teamId: true },
      });

      for (const roster of toTransfer) {
        const key = `${roster.stopId}-${roster.teamId}`;
        if (!existingKeys.has(key)) {
          await tx.stopTeamPlayer.updateMany({
            where: { stopId: roster.stopId, teamId: roster.teamId, playerId: deleteId },
            data: { playerId: keepId },
          });
        } else {
          await tx.stopTeamPlayer.deleteMany({
            where: { stopId: roster.stopId, teamId: roster.teamId, playerId: deleteId },
          });
        }
      }
    }

    if (counts.lineupP1 > 0) {
      await tx.lineupEntry.updateMany({ where: { player1Id: deleteId }, data: { player1Id: keepId } });
    }
    if (counts.lineupP2 > 0) {
      await tx.lineupEntry.updateMany({ where: { player2Id: deleteId }, data: { player2Id: keepId } });
    }
    if (counts.teamMemberships > 0) {
      // Handle duplicates
      const existing = await tx.teamPlayer.findMany({ where: { playerId: keepId }, select: { tournamentId: true } });
      const existingTournaments = new Set(existing.map(t => t.tournamentId));
      const toTransfer = await tx.teamPlayer.findMany({ where: { playerId: deleteId }, select: { teamId: true, tournamentId: true } });

      for (const link of toTransfer) {
        if (!existingTournaments.has(link.tournamentId)) {
          await tx.teamPlayer.updateMany({ where: { teamId: link.teamId, playerId: deleteId }, data: { playerId: keepId } });
        } else {
          await tx.teamPlayer.deleteMany({ where: { teamId: link.teamId, playerId: deleteId } });
        }
      }
    }
    if (counts.registrations > 0) {
      // Handle duplicates
      const existing = await tx.tournamentRegistration.findMany({ where: { playerId: keepId }, select: { tournamentId: true } });
      const existingTournaments = new Set(existing.map(r => r.tournamentId));
      const toTransfer = await tx.tournamentRegistration.findMany({ where: { playerId: deleteId }, select: { id: true, tournamentId: true } });

      for (const reg of toTransfer) {
        if (!existingTournaments.has(reg.tournamentId)) {
          await tx.tournamentRegistration.update({ where: { id: reg.id }, data: { playerId: keepId } });
        } else {
          await tx.tournamentRegistration.delete({ where: { id: reg.id } });
        }
      }
    }
    if (counts.captainTeams > 0) {
      await tx.team.updateMany({ where: { captainId: deleteId }, data: { captainId: keepId } });
    }
    if (counts.captainInvites > 0) {
      await tx.captainInvite.updateMany({ where: { captainId: deleteId }, data: { captainId: keepId } });
    }
    if (counts.tournamentAdmins > 0) {
      // Handle duplicates
      const existing = await tx.tournamentAdmin.findMany({ where: { playerId: keepId }, select: { tournamentId: true } });
      const existingTournaments = new Set(existing.map(a => a.tournamentId));
      const toTransfer = await tx.tournamentAdmin.findMany({ where: { playerId: deleteId }, select: { tournamentId: true } });

      for (const admin of toTransfer) {
        if (!existingTournaments.has(admin.tournamentId)) {
          await tx.tournamentAdmin.updateMany({ where: { tournamentId: admin.tournamentId, playerId: deleteId }, data: { playerId: keepId } });
        } else {
          await tx.tournamentAdmin.deleteMany({ where: { tournamentId: admin.tournamentId, playerId: deleteId } });
        }
      }
    }
    if (counts.tournamentCaptains > 0) {
      // Handle duplicates
      const existing = await tx.tournamentCaptain.findMany({ where: { playerId: keepId }, select: { tournamentId: true } });
      const existingTournaments = new Set(existing.map(c => c.tournamentId));
      const toTransfer = await tx.tournamentCaptain.findMany({ where: { playerId: deleteId }, select: { tournamentId: true, clubId: true } });

      for (const captain of toTransfer) {
        if (!existingTournaments.has(captain.tournamentId)) {
          await tx.tournamentCaptain.updateMany({ where: { tournamentId: captain.tournamentId, clubId: captain.clubId, playerId: deleteId }, data: { playerId: keepId } });
        } else {
          await tx.tournamentCaptain.deleteMany({ where: { tournamentId: captain.tournamentId, clubId: captain.clubId, playerId: deleteId } });
        }
      }
    }
    if (counts.eventManagers > 0) {
      // Handle duplicates
      const existing = await tx.tournamentEventManager.findMany({ where: { playerId: keepId }, select: { tournamentId: true } });
      const existingTournaments = new Set(existing.map(e => e.tournamentId));
      const toTransfer = await tx.tournamentEventManager.findMany({ where: { playerId: deleteId }, select: { tournamentId: true } });

      for (const em of toTransfer) {
        if (!existingTournaments.has(em.tournamentId)) {
          await tx.tournamentEventManager.updateMany({ where: { tournamentId: em.tournamentId, playerId: deleteId }, data: { playerId: keepId } });
        } else {
          await tx.tournamentEventManager.deleteMany({ where: { tournamentId: em.tournamentId, playerId: deleteId } });
        }
      }
    }
    if (counts.stopManagers > 0) {
      await tx.stop.updateMany({ where: { eventManagerId: deleteId }, data: { eventManagerId: keepId } });
    }
    if (counts.clubDirectors > 0) {
      // Handle duplicates
      const existing = await tx.clubDirector.findMany({ where: { playerId: keepId }, select: { clubId: true } });
      const existingClubs = new Set(existing.map(d => d.clubId));
      const toTransfer = await tx.clubDirector.findMany({ where: { playerId: deleteId }, select: { clubId: true } });

      for (const director of toTransfer) {
        if (!existingClubs.has(director.clubId)) {
          await tx.clubDirector.updateMany({ where: { clubId: director.clubId, playerId: deleteId }, data: { playerId: keepId } });
        } else {
          await tx.clubDirector.deleteMany({ where: { clubId: director.clubId, playerId: deleteId } });
        }
      }
    }
    if (counts.tiebreakerDecisions > 0) {
      await tx.match.updateMany({ where: { tiebreakerDecidedById: deleteId }, data: { tiebreakerDecidedById: keepId } });
    }
    if (counts.waitlistEntries > 0) {
      // Handle duplicates
      const existing = await tx.tournamentWaitlist.findMany({ where: { playerId: keepId }, select: { tournamentId: true } });
      const existingTournaments = new Set(existing.map(w => w.tournamentId));
      const toTransfer = await tx.tournamentWaitlist.findMany({ where: { playerId: deleteId }, select: { id: true, tournamentId: true } });

      for (const entry of toTransfer) {
        if (!existingTournaments.has(entry.tournamentId)) {
          await tx.tournamentWaitlist.update({ where: { id: entry.id }, data: { playerId: keepId } });
        } else {
          await tx.tournamentWaitlist.delete({ where: { id: entry.id } });
        }
      }
    }
    if (counts.invitesReceived > 0) {
      await tx.tournamentInvite.updateMany({ where: { playerId: deleteId }, data: { playerId: keepId } });
    }
    if (counts.invitesSent > 0) {
      await tx.tournamentInvite.updateMany({ where: { invitedBy: deleteId }, data: { invitedBy: keepId } });
    }
    if (counts.inviteRequestsSent > 0) {
      await tx.inviteRequest.updateMany({ where: { playerId: deleteId }, data: { playerId: keepId } });
    }
    if (counts.inviteRequestsReviewed > 0) {
      await tx.inviteRequest.updateMany({ where: { reviewedBy: deleteId }, data: { reviewedBy: keepId } });
    }

    // Delete the old player
    await tx.player.delete({ where: { id: deleteId } });
  });

  console.log(`✅ Successfully merged!`);
  return true;
}

async function main() {
  console.log(`\n========================================`);
  console.log(`  Batch Merge: Initial/Incomplete Names`);
  console.log(`========================================\n`);
  console.log(`Merging ${MERGES.length} player pairs...\n`);

  let successCount = 0;
  let failCount = 0;

  for (const merge of MERGES) {
    try {
      const success = await mergePlayers(merge.deleteId, merge.keepId, merge.description);
      if (success) successCount++;
      else failCount++;
    } catch (error) {
      console.log(`❌ Error merging ${merge.description}:`, error);
      failCount++;
    }
  }

  console.log(`\n========================================`);
  console.log(`  SUMMARY`);
  console.log(`========================================`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`========================================\n`);

  await prisma.$disconnect();
}

main();
