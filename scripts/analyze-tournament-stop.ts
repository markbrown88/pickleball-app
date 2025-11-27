import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function analyzeTournamentStop(tournamentName: string, stopIndex: number = 1) {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`ANALYZING TOURNAMENT: ${tournamentName}`);
    console.log(`STOP INDEX: ${stopIndex + 1} (0-indexed: ${stopIndex})`);
    console.log('='.repeat(80));

    // Find the tournament
    const tournament = await prisma.tournament.findFirst({
      where: {
        name: {
          contains: tournamentName,
          mode: 'insensitive',
        },
      },
      include: {
        stops: {
          orderBy: {
            startAt: 'asc',
          },
          include: {
            club: {
              select: {
                name: true,
                city: true,
                region: true,
              },
            },
          },
        },
      },
    });

    if (!tournament) {
      console.log(`\n❌ Tournament "${tournamentName}" not found`);
      return;
    }

    console.log(`\n🏆 Tournament:`);
    console.log(`   ID: ${tournament.id}`);
    console.log(`   Name: ${tournament.name}`);
    console.log(`   Type: ${tournament.type}`);
    console.log(`   Registration Type: ${tournament.registrationType}`);
    console.log(`   Total Stops: ${tournament.stops.length}`);

    if (tournament.stops.length === 0) {
      console.log(`\n❌ No stops found for this tournament`);
      return;
    }

    // Display all stops
    console.log(`\n📍 All Stops:`);
    tournament.stops.forEach((stop, idx) => {
      console.log(`   ${idx + 1}. ${stop.name} (${stop.club?.name || 'No club'})`);
      console.log(`      ID: ${stop.id}`);
      console.log(`      Start: ${stop.startAt ? new Date(stop.startAt).toLocaleString() : 'N/A'}`);
      console.log(`      End: ${stop.endAt ? new Date(stop.endAt).toLocaleString() : 'N/A'}`);
    });

    // Get the specific stop
    if (stopIndex >= tournament.stops.length) {
      console.log(`\n❌ Stop index ${stopIndex} is out of range. Tournament has ${tournament.stops.length} stop(s)`);
      return;
    }

    const targetStop = tournament.stops[stopIndex];
    console.log(`\n${'='.repeat(80)}`);
    console.log(`ANALYZING STOP: ${targetStop.name}`);
    console.log('='.repeat(80));
    console.log(`   Stop ID: ${targetStop.id}`);
    console.log(`   Club: ${targetStop.club?.name || 'No club'} (${targetStop.club?.city || 'N/A'}, ${targetStop.club?.region || 'N/A'})`);
    console.log(`   Start: ${targetStop.startAt ? new Date(targetStop.startAt).toLocaleString() : 'N/A'}`);
    console.log(`   End: ${targetStop.endAt ? new Date(targetStop.endAt).toLocaleString() : 'N/A'}`);

    // Get all registrations for this tournament
    const allRegistrations = await prisma.tournamentRegistration.findMany({
      where: {
        tournamentId: tournament.id,
      },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            email: true,
          },
        },
      },
    });

    console.log(`\n📊 Registration Analysis:`);
    console.log(`   Total Registrations for Tournament: ${allRegistrations.length}`);

    // Get roster entries for this stop
    const rosterEntries = await prisma.stopTeamPlayer.findMany({
      where: {
        stopId: targetStop.id,
      },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            email: true,
          },
        },
        team: {
          select: {
            name: true,
          },
        },
      },
    });

    // Get player IDs that have roster entries for this stop
    const playerIdsWithRoster = new Set(rosterEntries.map(r => r.playerId));

    // Filter registrations that have roster entries for this stop
    const registrationsForStop = allRegistrations.filter(reg => playerIdsWithRoster.has(reg.playerId));

    console.log(`   Registrations with Roster Entry for This Stop: ${registrationsForStop.length}`);

    // Analyze payment status
    const paidRegistrations = registrationsForStop.filter(reg => reg.paymentStatus === 'PAID');
    const pendingRegistrations = registrationsForStop.filter(reg => reg.paymentStatus === 'PENDING');
    const completedRegistrations = registrationsForStop.filter(reg => reg.paymentStatus === 'COMPLETED');
    const failedRegistrations = registrationsForStop.filter(reg => reg.paymentStatus === 'FAILED');

    console.log(`\n💳 Payment Status Breakdown:`);
    console.log(`   PAID: ${paidRegistrations.length}`);
    console.log(`   PENDING: ${pendingRegistrations.length}`);
    console.log(`   COMPLETED: ${completedRegistrations.length}`);
    console.log(`   FAILED: ${failedRegistrations.length}`);

    console.log(`\n👥 Roster Entries for This Stop: ${rosterEntries.length}`);

    // Count payment methods
    const manualPayments = rosterEntries.filter(roster => roster.paymentMethod === 'MANUAL');
    const stripePayments = rosterEntries.filter(roster => roster.paymentMethod === 'STRIPE');
    const unpaidEntries = rosterEntries.filter(roster => roster.paymentMethod === 'UNPAID');

    console.log(`\n💵 Payment Method Breakdown (from Roster Entries):`);
    console.log(`   MANUAL: ${manualPayments.length}`);
    console.log(`   STRIPE: ${stripePayments.length}`);
    console.log(`   UNPAID: ${unpaidEntries.length}`);

    // Cross-reference: paid registrations vs manual payments
    const paidRegistrationIds = new Set(paidRegistrations.map(r => r.id));
    const paidPlayerIds = new Set(paidRegistrations.map(r => r.playerId));
    
    const manualPaymentPlayerIds = new Set(manualPayments.map(r => r.playerId));
    const stripePaymentPlayerIds = new Set(stripePayments.map(r => r.playerId));

    console.log(`\n🔗 Cross-Reference Analysis:`);
    console.log(`   Players with PAID registration AND roster entry: ${paidRegistrations.length}`);
    console.log(`   Players with MANUAL payment in roster: ${manualPayments.length}`);
    console.log(`   Players with STRIPE payment in roster: ${stripePayments.length}`);

    // Find players who have paid registration but manual payment method
    const paidButManual = Array.from(paidPlayerIds).filter(playerId => 
      manualPaymentPlayerIds.has(playerId)
    );
    console.log(`   Players with PAID registration AND MANUAL payment method: ${paidButManual.length}`);

    // Find players who have paid registration but stripe payment method
    const paidButStripe = Array.from(paidPlayerIds).filter(playerId => 
      stripePaymentPlayerIds.has(playerId)
    );
    console.log(`   Players with PAID registration AND STRIPE payment method: ${paidButStripe.length}`);

    // Detailed breakdown
    console.log(`\n${'='.repeat(80)}`);
    console.log(`DETAILED BREAKDOWN`);
    console.log('='.repeat(80));

    console.log(`\n✅ Summary for Stop "${targetStop.name}":`);
    console.log(`   • Total Roster Entries: ${rosterEntries.length}`);
    console.log(`   • Registrations with PAID status: ${paidRegistrations.length}`);
    console.log(`   • Manual Payments: ${manualPayments.length}`);
    console.log(`   • Stripe Payments: ${stripePayments.length}`);
    console.log(`   • Unpaid Entries: ${unpaidEntries.length}`);

    // Show some examples
    if (manualPayments.length > 0) {
      console.log(`\n📋 Sample Manual Payment Entries (first 5):`);
      manualPayments.slice(0, 5).forEach((roster, idx) => {
        const player = roster.player;
        const playerName = player.name || `${player.firstName || ''} ${player.lastName || ''}`.trim() || 'Unknown';
        console.log(`   ${idx + 1}. ${playerName} (${player.email || 'No email'}) - Team: ${roster.team?.name || 'No team'}`);
      });
    }

    if (stripePayments.length > 0) {
      console.log(`\n💳 Sample Stripe Payment Entries (first 5):`);
      stripePayments.slice(0, 5).forEach((roster, idx) => {
        const player = roster.player;
        const playerName = player.name || `${player.firstName || ''} ${player.lastName || ''}`.trim() || 'Unknown';
        console.log(`   ${idx + 1}. ${playerName} (${player.email || 'No email'}) - Team: ${roster.team?.name || 'No team'}`);
      });
    }

  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: npx tsx scripts/analyze-tournament-stop.ts <tournamentName> [stopIndex]');
  console.error('Example: npx tsx scripts/analyze-tournament-stop.ts "Klyng Cup" 1');
  process.exit(1);
}

const tournamentName = args[0];
const stopIndex = args[1] ? parseInt(args[1], 10) : 1;

if (isNaN(stopIndex) || stopIndex < 0) {
  console.error('Stop index must be a non-negative number');
  process.exit(1);
}

analyzeTournamentStop(tournamentName, stopIndex);

