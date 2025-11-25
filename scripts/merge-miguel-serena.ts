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
    name: 'Miguel Chicas',
    keepId: 'cmiepuj2r0001l404xffp6tcm', // Clerk + email
    deleteId: 'cmfpbp8mv0035rdn02p2408o2', // Legacy entry with DUPR + history
  },
  {
    name: 'Serena Smith',
    keepId: 'cmiercjiq0001jo04nme1ysyz', // Clerk + email
    deleteId: 'cmfpbp8yr003rrdn0hkkpthhn', // Legacy entry with DUPR + history
  },
  {
    name: 'Lucas Wong',
    keepId: 'cmierq5or0003l204en2c773y', // Clerk + email (Lucas Wong)
    deleteId: 'cmfpbp8bj002lrdn04j59j4g8', // Legacy entry (Lucas W) with DUPR + history
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
      throw new Error(`Keep player ${merge.keepId} not found`);
    }
    if (!deletePlayer) {
      throw new Error(`Delete player ${merge.deleteId} not found`);
    }

    console.log('Keep Player:');
    logPlayerSummary(keepPlayer);

    console.log('\nDelete Player:');
    logPlayerSummary(deletePlayer);

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
    const clubDirectorships = await prisma.club.count({
      where: { directorId: merge.deleteId },
    });
    const tiebreakerDecisions = await prisma.match.findMany({
      where: { tiebreakerDecidedById: merge.deleteId },
    });

    console.log('\nRelationships to transfer:');
    logCount('Roster entries', rosterEntries.length);
    logCount('Lineup entries (Player 1)', lineupEntriesP1.length);
    logCount('Lineup entries (Player 2)', lineupEntriesP2.length);
    logCount('Team memberships', teamMemberships.length);
    logCount('Registrations', registrations.length);
    logCount('Teams as captain', captainTeams.length);
    logCount('Captain invites', captainInvites.length);
    logCount('Tournament admin roles', tournamentAdmins.length);
    logCount('Tournament captain roles', tournamentCaptains.length);
    logCount('Event manager roles', eventManagers.length);
    logCount('Stops managed', stopManagers.length);
    logCount('Club director roles', clubDirectorships);
    logCount('Tiebreaker decisions', tiebreakerDecisions.length);

    const profileUpdates: Record<string, unknown> = {};
    if (!keepPlayer.city && deletePlayer.city) profileUpdates.city = deletePlayer.city;
    if (!keepPlayer.region && deletePlayer.region) profileUpdates.region = deletePlayer.region;
    if (!keepPlayer.duprDoubles && deletePlayer.duprDoubles) {
      profileUpdates.duprDoubles = deletePlayer.duprDoubles;
    }
    if (!keepPlayer.duprSingles && deletePlayer.duprSingles) {
      profileUpdates.duprSingles = deletePlayer.duprSingles;
    }
    if (!keepPlayer.clubRatingDoubles && deletePlayer.clubRatingDoubles) {
      profileUpdates.clubRatingDoubles = deletePlayer.clubRatingDoubles;
    }
    if (!keepPlayer.clubRatingSingles && deletePlayer.clubRatingSingles) {
      profileUpdates.clubRatingSingles = deletePlayer.clubRatingSingles;
    }

    await prisma.$transaction(async tx => {
      if (rosterEntries.length) {
        await tx.stopTeamPlayer.updateMany({
          where: { playerId: merge.deleteId },
          data: { playerId: merge.keepId },
        });
        console.log(`✅ Transferred ${rosterEntries.length} roster entries`);
      }

      if (lineupEntriesP1.length) {
        await tx.lineupEntry.updateMany({
          where: { player1Id: merge.deleteId },
          data: { player1Id: merge.keepId },
        });
        console.log(`✅ Transferred ${lineupEntriesP1.length} lineup entries (Player 1)`);
      }

      if (lineupEntriesP2.length) {
        await tx.lineupEntry.updateMany({
          where: { player2Id: merge.deleteId },
          data: { player2Id: merge.keepId },
        });
        console.log(`✅ Transferred ${lineupEntriesP2.length} lineup entries (Player 2)`);
      }

      if (teamMemberships.length) {
        await tx.teamPlayer.updateMany({
          where: { playerId: merge.deleteId },
          data: { playerId: merge.keepId },
        });
        console.log(`✅ Transferred ${teamMemberships.length} team memberships`);
      }

      if (registrations.length) {
        await tx.tournamentRegistration.updateMany({
          where: { playerId: merge.deleteId },
          data: { playerId: merge.keepId },
        });
        console.log(`✅ Transferred ${registrations.length} registrations`);
      }

      if (captainTeams.length) {
        await tx.team.updateMany({
          where: { captainId: merge.deleteId },
          data: { captainId: merge.keepId },
        });
        console.log(`✅ Transferred ${captainTeams.length} teams as captain`);
      }

      if (captainInvites.length) {
        await tx.captainInvite.updateMany({
          where: { playerId: merge.deleteId },
          data: { playerId: merge.keepId },
        });
        console.log(`✅ Transferred ${captainInvites.length} captain invites`);
      }

      if (tournamentAdmins.length) {
        await tx.tournamentAdmin.updateMany({
          where: { playerId: merge.deleteId },
          data: { playerId: merge.keepId },
        });
        console.log(`✅ Transferred ${tournamentAdmins.length} tournament admin roles`);
      }

      if (tournamentCaptains.length) {
        await tx.tournamentCaptain.updateMany({
          where: { playerId: merge.deleteId },
          data: { playerId: merge.keepId },
        });
        console.log(`✅ Transferred ${tournamentCaptains.length} tournament captain roles`);
      }

      if (eventManagers.length) {
        await tx.tournamentEventManager.updateMany({
          where: { playerId: merge.deleteId },
          data: { playerId: merge.keepId },
        });
        console.log(`✅ Transferred ${eventManagers.length} event manager roles`);
      }

      if (stopManagers.length) {
        await tx.stop.updateMany({
          where: { eventManagerId: merge.deleteId },
          data: { eventManagerId: merge.keepId },
        });
        console.log(`✅ Transferred ${stopManagers.length} stops managed`);
      }

      if (clubDirectorships) {
        await tx.club.updateMany({
          where: { directorId: merge.deleteId },
          data: { directorId: merge.keepId },
        });
        console.log(`✅ Transferred ${clubDirectorships} club director roles`);
      }

      if (tiebreakerDecisions.length) {
        await tx.match.updateMany({
          where: { tiebreakerDecidedById: merge.deleteId },
          data: { tiebreakerDecidedById: merge.keepId },
        });
        console.log(`✅ Transferred ${tiebreakerDecisions.length} tiebreaker decisions`);
      }

      if (Object.keys(profileUpdates).length) {
        await tx.player.update({
          where: { id: merge.keepId },
          data: profileUpdates,
        });
        console.log(`✅ Applied profile updates: ${JSON.stringify(profileUpdates)}`);
      }

      await tx.player.delete({
        where: { id: merge.deleteId },
      });
      console.log(`✅ Deleted legacy player ${merge.deleteId}`);
    });

    console.log(`\n🎉 Completed merge for ${merge.name}\n`);
  }
}

function logPlayerSummary(player: {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  region: string | null;
  duprDoubles: number | null;
  duprSingles: number | null;
  clubRatingDoubles: number | null;
  clubRatingSingles: number | null;
  clerkUserId: string | null;
  createdAt: Date;
}) {
  console.log(`  Name: ${player.name || `${player.firstName ?? ''} ${player.lastName ?? ''}`.trim() || 'N/A'}`);
  console.log(`  Email: ${player.email ?? 'None'}`);
  console.log(`  Phone: ${player.phone ?? 'None'}`);
  console.log(`  City/Region: ${player.city ?? 'None'} / ${player.region ?? 'None'}`);
  console.log(`  DUPR Doubles/Singles: ${player.duprDoubles ?? 'None'} / ${player.duprSingles ?? 'None'}`);
  console.log(
    `  Club Rating Doubles/Singles: ${player.clubRatingDoubles ?? 'None'} / ${player.clubRatingSingles ?? 'None'}`
  );
  console.log(`  Clerk ID: ${player.clerkUserId ?? 'None'}`);
  console.log(`  Created: ${player.createdAt.toISOString()}`);
}

function logCount(label: string, count: number) {
  console.log(`  • ${label}: ${count}`);
}

mergePlayers()
  .catch(err => {
    console.error('Error during merge:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

