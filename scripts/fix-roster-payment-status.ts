import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function fixRosterPaymentStatus() {
  try {
    console.log('Finding paid registrations...');
    
    // Find all registrations that are PAID or COMPLETED
    const paidRegistrations = await prisma.tournamentRegistration.findMany({
      where: {
        paymentStatus: {
          in: ['PAID', 'COMPLETED'],
        },
      },
      select: {
        id: true,
        playerId: true,
        tournamentId: true,
        notes: true,
      },
    });

    console.log(`Found ${paidRegistrations.length} paid registrations`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const registration of paidRegistrations) {
      try {
        // Parse registration notes to get stopIds
        let stopIds: string[] = [];
        if (registration.notes) {
          try {
            const notes = JSON.parse(registration.notes);
            stopIds = notes.stopIds || [];
          } catch (e) {
            console.warn(`Failed to parse notes for registration ${registration.id}:`, e);
            skippedCount++;
            continue;
          }
        }

        if (stopIds.length === 0) {
          console.log(`Registration ${registration.id} has no stopIds, skipping`);
          skippedCount++;
          continue;
        }

        // Find roster entries for this player and these stops
        const rosterEntries = await prisma.stopTeamPlayer.findMany({
          where: {
            playerId: registration.playerId,
            stopId: { in: stopIds },
            paymentMethod: 'UNPAID', // Only update unpaid entries
          },
        });

        if (rosterEntries.length === 0) {
          continue;
        }

        // Update payment method to STRIPE
        const result = await prisma.stopTeamPlayer.updateMany({
          where: {
            playerId: registration.playerId,
            stopId: { in: stopIds },
            paymentMethod: 'UNPAID',
          },
          data: {
            paymentMethod: 'STRIPE',
          },
        });

        updatedCount += result.count;
        console.log(`Updated ${result.count} roster entries for registration ${registration.id}`);
      } catch (error: any) {
        console.error(`Error processing registration ${registration.id}:`, error);
        errorCount++;
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Total paid registrations: ${paidRegistrations.length}`);
    console.log(`Roster entries updated: ${updatedCount}`);
    console.log(`Registrations skipped: ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
  } catch (error) {
    console.error('Script failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixRosterPaymentStatus()
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

