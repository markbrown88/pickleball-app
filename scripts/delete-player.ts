import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function deletePlayer() {
  try {
    const playerId = process.argv[2];
    
    if (!playerId) {
      console.log('Usage: npx tsx scripts/delete-player.ts <playerId>');
      process.exit(1);
    }

    console.log(`\n=== Deleting Player: ${playerId} ===\n`);

    // Verify player exists
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        clerkUserId: true,
      },
    });

    if (!player) {
      console.log(`❌ Player not found`);
      await prisma.$disconnect();
      return;
    }

    console.log(`Player to delete:`);
    console.log(`   Name: ${player.name || `${player.firstName} ${player.lastName}`}`);
    console.log(`   Email: ${player.email || 'None'}`);
    console.log(`   Clerk User ID: ${player.clerkUserId || 'None'}`);

    // Check for any relationships
    const rosterEntries = await prisma.stopTeamPlayer.count({
      where: { playerId },
    });
    const lineupEntriesP1 = await prisma.lineupEntry.count({
      where: { player1Id: playerId },
    });
    const lineupEntriesP2 = await prisma.lineupEntry.count({
      where: { player2Id: playerId },
    });
    const registrations = await prisma.tournamentRegistration.count({
      where: { playerId },
    });
    const teamMemberships = await prisma.teamPlayer.count({
      where: { playerId },
    });
    const captainTeams = await prisma.team.count({
      where: { captainId: playerId },
    });

    console.log(`\nRelationships:`);
    console.log(`   Roster Entries: ${rosterEntries}`);
    console.log(`   Lineup Entries (P1): ${lineupEntriesP1}`);
    console.log(`   Lineup Entries (P2): ${lineupEntriesP2}`);
    console.log(`   Registrations: ${registrations}`);
    console.log(`   Team Memberships: ${teamMemberships}`);
    console.log(`   Teams as Captain: ${captainTeams}`);

    if (rosterEntries > 0 || lineupEntriesP1 > 0 || lineupEntriesP2 > 0 || 
        registrations > 0 || teamMemberships > 0 || captainTeams > 0) {
      console.log(`\n⚠️  WARNING: Player has relationships! This deletion may fail or cause issues.`);
      console.log(`   Consider merging instead of deleting.`);
    }

    // Delete the player
    await prisma.player.delete({
      where: { id: playerId },
    });

    console.log(`\n✅ Successfully deleted player ${playerId}`);

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

deletePlayer();
