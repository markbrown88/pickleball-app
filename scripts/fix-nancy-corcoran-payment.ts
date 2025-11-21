import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function fixNancyCorcoranPayment() {
  try {
    console.log('\n=== Fixing Nancy Corcoran Payment Status ===\n');

    const playerId = 'cmi6f8kny0001l804npqwxp0s';
    const stopId = 'cmh7rtx46000jl804twvhjt1p';
    const teamId = 'cmh7rty0g001pl804596jhwzw';

    // Check current status
    const rosterEntry = await prisma.stopTeamPlayer.findUnique({
      where: {
        stopId_teamId_playerId: {
          stopId,
          teamId,
          playerId,
        },
      },
      include: {
        player: {
          select: {
            name: true,
            email: true,
          },
        },
        stop: {
          select: {
            name: true,
            tournament: {
              select: {
                name: true,
              },
            },
          },
        },
        team: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!rosterEntry) {
      console.log('❌ Roster entry not found');
      return;
    }

    console.log(`Player: ${rosterEntry.player.name || rosterEntry.player.email}`);
    console.log(`Tournament: ${rosterEntry.stop.tournament.name}`);
    console.log(`Stop: ${rosterEntry.stop.name}`);
    console.log(`Team: ${rosterEntry.team.name}`);
    console.log(`Current Payment Status: ${rosterEntry.paymentMethod}\n`);

    // Check registration
    const registration = await prisma.tournamentRegistration.findFirst({
      where: {
        playerId,
        tournamentId: rosterEntry.stop.tournamentId,
        paymentStatus: {
          in: ['PAID', 'COMPLETED'],
        },
      },
    });

    if (!registration) {
      console.log('❌ No paid registration found');
      return;
    }

    console.log(`Registration Payment Status: ${registration.paymentStatus}`);
    console.log(`Amount Paid: $${((registration.amountPaid || 0) / 100).toFixed(2)}`);
    console.log(`Payment ID: ${registration.paymentId || 'None'}\n`);

    // Check if stop is in registration
    let stopIds: string[] = [];
    if (registration.notes) {
      try {
        const notes = JSON.parse(registration.notes);
        stopIds = notes.stopIds || [];
      } catch (e) {
        console.log('⚠️  Could not parse registration notes');
      }
    }

    if (!stopIds.includes(stopId)) {
      console.log(`⚠️  Stop ${stopId} is not in registration stopIds: ${JSON.stringify(stopIds)}`);
      console.log('This might be a different issue - registration may not include this stop');
      return;
    }

    // Update roster entry to STRIPE
    if (rosterEntry.paymentMethod !== 'STRIPE') {
      await prisma.stopTeamPlayer.update({
        where: {
          stopId_teamId_playerId: {
            stopId,
            teamId,
            playerId,
          },
        },
        data: {
          paymentMethod: 'STRIPE',
        },
      });

      console.log('✅ Updated roster entry payment status to STRIPE');
    } else {
      console.log('✅ Roster entry already has STRIPE payment status');
    }

    console.log('\n✅ Fix complete!\n');

  } catch (error) {
    console.error('Error fixing payment status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixNancyCorcoranPayment();

