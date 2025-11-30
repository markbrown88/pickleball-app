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
    name: 'Amna Jamal',
    keepId: 'cmikl8a4d0001if04fzpoxvw1', // Newer account with Clerk, email
    deleteId: 'cmg07a9x00017rddcuw7svm1u', // Older account with location data
  },
  {
    name: 'Leanna Macdonnell',
    keepId: 'cmiks46x30001ky04usw7o6kk', // Newer account with Clerk, email
    deleteId: 'cmfpbp87k002drdn0yln7mvny', // Older account with DUPR rating, location data
  },
  {
    name: 'Ryan McNamara',
    keepId: 'cmikmawnn0001le046faiqaa9', // Newer account with Clerk, email
    deleteId: 'cmg079k1n0013rddclc7k9z9c', // Older account with location data
  },
  {
    name: 'Troy Noseworthy',
    keepId: 'cmiluf9da0001lh0436v0zknb', // Newer account with Clerk, email
    deleteId: 'cmfpfe8qo000lrdb4u8xkqiwj', // Older account with DUPR rating, location data
  },
  {
    name: 'Syl Painchaud',
    keepId: 'cmiknypx70001i605b1tf57af', // Newer account with Clerk, email
    deleteId: 'cmfpbp99o0049rdn0t7715lf9', // Older account with DUPR rating, location data
  },
  {
    name: 'Daniel Rasquin',
    keepId: 'cmiklx9pw0001jv04svq5okaw', // Newer account with Clerk, email
    deleteId: 'cmgtciolw000vl4047irmud2h', // Older account with DUPR rating, location data
  },
  {
    name: 'Tom Svoboda',
    keepId: 'cmikoim0r0001l40480w42hzc', // Newer account with Clerk, email
    deleteId: 'cmg073j95000nrddccovelc4z', // Older account with location data
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
      where: { playerId: merge.deleteId },
    });
    console.log(`Found ${rosterEntries.length} roster entries`);

    const lineupEntriesP1 = await prisma.lineupEntry.findMany({
      where: { player1Id: merge.deleteId },
    });
    console.log(`Found ${lineupEntriesP1.length} lineup entries as player1`);

    const lineupEntriesP2 = await prisma.lineupEntry.findMany({
      where: { player2Id: merge.deleteId },
    });
    console.log(`Found ${lineupEntriesP2.length} lineup entries as player2`);

    const teamMemberships = await prisma.teamPlayer.findMany({
      where: { playerId: merge.deleteId },
    });
    console.log(`Found ${teamMemberships.length} team memberships`);

    const registrations = await prisma.tournamentRegistration.findMany({
      where: { playerId: merge.deleteId },
    });
    console.log(`Found ${registrations.length} tournament registrations`);

    const captainRoles = await prisma.tournamentCaptain.findMany({
      where: { playerId: merge.deleteId },
    });
    console.log(`Found ${captainRoles.length} tournament captain roles`);

    const adminRoles = await prisma.tournamentAdmin.findMany({
      where: { playerId: merge.deleteId },
    });
    console.log(`Found ${adminRoles.length} tournament admin roles`);

    const matchTiebreakers = await prisma.match.findMany({
      where: { tiebreakerDecidedById: merge.deleteId },
    });
    console.log(`Found ${matchTiebreakers.length} match tiebreaker decisions\n`);

    await prisma.$transaction(async (tx) => {
      // Update roster entries
      if (rosterEntries.length > 0) {
        await tx.stopTeamPlayer.updateMany({
          where: { playerId: merge.deleteId },
          data: { playerId: merge.keepId },
        });
        console.log(`✅ Updated ${rosterEntries.length} roster entries`);
      }

      // Update lineup entries (player1)
      if (lineupEntriesP1.length > 0) {
        await tx.lineupEntry.updateMany({
          where: { player1Id: merge.deleteId },
          data: { player1Id: merge.keepId },
        });
        console.log(`✅ Updated ${lineupEntriesP1.length} lineup entries (player1)`);
      }

      // Update lineup entries (player2)
      if (lineupEntriesP2.length > 0) {
        await tx.lineupEntry.updateMany({
          where: { player2Id: merge.deleteId },
          data: { player2Id: merge.keepId },
        });
        console.log(`✅ Updated ${lineupEntriesP2.length} lineup entries (player2)`);
      }

      // Update team memberships
      if (teamMemberships.length > 0) {
        await tx.teamPlayer.updateMany({
          where: { playerId: merge.deleteId },
          data: { playerId: merge.keepId },
        });
        console.log(`✅ Updated ${teamMemberships.length} team memberships`);
      }

      // Update tournament registrations
      if (registrations.length > 0) {
        await tx.tournamentRegistration.updateMany({
          where: { playerId: merge.deleteId },
          data: { playerId: merge.keepId },
        });
        console.log(`✅ Updated ${registrations.length} tournament registrations`);
      }

      // Update tournament captain roles
      if (captainRoles.length > 0) {
        await tx.tournamentCaptain.updateMany({
          where: { playerId: merge.deleteId },
          data: { playerId: merge.keepId },
        });
        console.log(`✅ Updated ${captainRoles.length} tournament captain roles`);
      }

      // Update tournament admin roles
      if (adminRoles.length > 0) {
        await tx.tournamentAdmin.updateMany({
          where: { playerId: merge.deleteId },
          data: { playerId: merge.keepId },
        });
        console.log(`✅ Updated ${adminRoles.length} tournament admin roles`);
      }

      // Update match tiebreaker decisions
      if (matchTiebreakers.length > 0) {
        await tx.match.updateMany({
          where: { tiebreakerDecidedById: merge.deleteId },
          data: { tiebreakerDecidedById: merge.keepId },
        });
        console.log(`✅ Updated ${matchTiebreakers.length} match tiebreaker decisions`);
      }

      // Merge profile data - only update if keep player doesn't have the data
      const profileUpdates: any = {};
      if (deletePlayer.city && !keepPlayer.city) profileUpdates.city = deletePlayer.city;
      if (deletePlayer.region && !keepPlayer.region) profileUpdates.region = deletePlayer.region;
      if (deletePlayer.duprDoubles !== null && keepPlayer.duprDoubles === null && deletePlayer.duprDoubles < 10) {
        profileUpdates.duprDoubles = deletePlayer.duprDoubles;
      }
      if (deletePlayer.duprSingles !== null && keepPlayer.duprSingles === null && deletePlayer.duprSingles < 10) {
        profileUpdates.duprSingles = deletePlayer.duprSingles;
      }
      if (deletePlayer.clubRatingDoubles !== null && keepPlayer.clubRatingDoubles === null) {
        profileUpdates.clubRatingDoubles = deletePlayer.clubRatingDoubles;
      }
      if (deletePlayer.clubRatingSingles !== null && keepPlayer.clubRatingSingles === null) {
        profileUpdates.clubRatingSingles = deletePlayer.clubRatingSingles;
      }

      if (Object.keys(profileUpdates).length > 0) {
        await tx.player.update({
          where: { id: merge.keepId },
          data: profileUpdates,
        });
        console.log(`✅ Merged profile data: ${Object.keys(profileUpdates).join(', ')}`);
      }

      // Delete the old player
      await tx.player.delete({
        where: { id: merge.deleteId },
      });
      console.log(`✅ Deleted old player record`);
    });

    console.log(`\n✅ Successfully merged ${merge.name} accounts\n`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ ALL MERGES COMPLETED SUCCESSFULLY');
  console.log('='.repeat(80));
}

mergePlayers()
  .catch((error) => {
    console.error('\n❌ Error during merge:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

