import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function deletePlayer(playerId: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`DELETING PLAYER: ${playerId}`);
  console.log('='.repeat(80));

  // Check if player exists
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      clerkUserId: true,
    },
  });

  if (!player) {
    console.log(`❌ Player not found`);
    return;
  }

  console.log(`Name: ${player.firstName || ''} ${player.lastName || ''}`.trim() || 'N/A');
  console.log(`Email: ${player.email || 'No email'}`);
  console.log(`Clerk User ID: ${player.clerkUserId || 'No Clerk account'}`);

  // Check for dependencies
  const rosterCount = await prisma.stopTeamPlayer.count({ where: { playerId } });
  const lineupP1Count = await prisma.lineupEntry.count({ where: { player1Id: playerId } });
  const lineupP2Count = await prisma.lineupEntry.count({ where: { player2Id: playerId } });
  const registrationCount = await prisma.tournamentRegistration.count({ where: { playerId } });
  const captainCount = await prisma.tournamentCaptain.count({ where: { playerId } });
  const adminCount = await prisma.tournamentAdmin.count({ where: { playerId } });
  const eventManagerStopCount = await prisma.stop.count({ where: { eventManagerId: playerId } });
  const eventManagerTournamentCount = await prisma.tournamentEventManager.count({ where: { playerId } });

  console.log(`\nDependencies:`);
  console.log(`  - Roster entries: ${rosterCount}`);
  console.log(`  - Lineup entries: ${lineupP1Count + lineupP2Count}`);
  console.log(`  - Registrations: ${registrationCount}`);
  console.log(`  - Captain roles: ${captainCount}`);
  console.log(`  - Admin roles: ${adminCount}`);
  console.log(`  - Event manager stops: ${eventManagerStopCount}`);
  console.log(`  - Event manager tournaments: ${eventManagerTournamentCount}`);

  const totalDependencies = rosterCount + lineupP1Count + lineupP2Count + registrationCount + 
    captainCount + adminCount + eventManagerStopCount + eventManagerTournamentCount;

  if (totalDependencies > 0) {
    console.log(`\n⚠️  WARNING: This player has ${totalDependencies} dependencies!`);
    console.log(`   Deleting will cascade delete or set null on these records.`);
    console.log(`   This action cannot be undone!`);
  }

  // Delete the player (Prisma will handle cascading deletes based on schema)
  try {
    await prisma.player.delete({
      where: { id: playerId },
    });
    console.log(`\n✅ Player deleted successfully!`);
  } catch (error: any) {
    console.error(`\n❌ Error deleting player:`, error.message);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: npx tsx scripts/delete-player.ts <playerId>');
    console.error('Example: npx tsx scripts/delete-player.ts cmi3qkpm90001l804zzaz90vc');
    process.exit(1);
  }

  const playerId = args[0];

  try {
    await deletePlayer(playerId);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
