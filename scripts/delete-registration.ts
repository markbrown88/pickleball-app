import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function deleteRegistration(registrationId: string) {
  try {
    // First, fetch the registration details to show what we're deleting
    const registration = await prisma.tournamentRegistration.findUnique({
      where: { id: registrationId },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        tournament: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!registration) {
      console.error(`Registration ${registrationId} not found.`);
      return;
    }

    console.log('Registration to delete:');
    console.log(`  ID: ${registration.id}`);
    console.log(`  Player: ${registration.player.firstName} ${registration.player.lastName} (${registration.player.email})`);
    console.log(`  Tournament: ${registration.tournament.name}`);
    console.log(`  Status: ${registration.status}`);
    console.log(`  Payment Status: ${registration.paymentStatus}`);
    console.log(`  Amount Paid: ${registration.amountPaid ?? 0}`);

    // Check for related roster entries
    const rosterEntries = await prisma.stopTeamPlayer.findMany({
      where: {
        playerId: registration.playerId,
        stop: {
          tournamentId: registration.tournamentId,
        },
      },
      include: {
        stop: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (rosterEntries.length > 0) {
      console.log(`\nWarning: This registration has ${rosterEntries.length} roster entry(ies) that will be cascade deleted:`);
      rosterEntries.forEach((entry) => {
        console.log(`  - Stop: ${entry.stop.name}`);
      });
    }

    // Delete the registration (this will cascade delete roster entries)
    await prisma.tournamentRegistration.delete({
      where: { id: registrationId },
    });

    console.log(`\n✓ Successfully deleted registration ${registrationId}`);
  } catch (error: any) {
    console.error('Error deleting registration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

const registrationId = process.argv[2];

if (!registrationId) {
  console.error('Usage: npx tsx scripts/delete-registration.ts <registrationId>');
  process.exit(1);
}

deleteRegistration(registrationId)
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

