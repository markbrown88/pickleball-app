import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function checkManualPayments() {
  try {
    console.log('Checking roster entries with MANUAL payment method...\n');
    
    // Find all roster entries marked as MANUAL
    const manualEntries = await prisma.stopTeamPlayer.findMany({
      where: {
        paymentMethod: 'MANUAL',
      },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        stop: {
          select: {
            id: true,
            name: true,
            tournament: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    console.log(`Found ${manualEntries.length} roster entries marked as MANUAL (Paid External)\n`);

    if (manualEntries.length > 0) {
      console.log('Manual payment entries:');
      console.log('='.repeat(80));
      manualEntries.forEach((entry, index) => {
        const playerName = entry.player.firstName && entry.player.lastName
          ? `${entry.player.firstName} ${entry.player.lastName}`
          : entry.player.email || 'Unknown';
        console.log(`${index + 1}. ${playerName} (${entry.player.email || 'No email'})`);
        console.log(`   Tournament: ${entry.stop.tournament.name}`);
        console.log(`   Stop: ${entry.stop.name}`);
        console.log(`   Payment Method: ${entry.paymentMethod}`);
        console.log('');
      });
    } else {
      console.log('No manual payment entries found.');
    }

    // Also check STRIPE and UNPAID entries
    const stripeCount = await prisma.stopTeamPlayer.count({ where: { paymentMethod: 'STRIPE' } });
    const unpaidCount = await prisma.stopTeamPlayer.count({ where: { paymentMethod: 'UNPAID' } });

    console.log(`\n=== Payment Method Summary ===`);
    console.log(`Total STRIPE entries: ${stripeCount}`);
    console.log(`Total MANUAL entries: ${manualEntries.length}`);
    console.log(`Total UNPAID entries: ${unpaidCount}`);

  } catch (error) {
    console.error('Error checking manual payments:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkManualPayments()
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

