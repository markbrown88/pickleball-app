import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRegistration(registrationId: string) {
  try {
    console.log(`\n=== Checking Registration: ${registrationId} ===\n`);

    // Get registration with all related data
    const registration = await prisma.tournamentRegistration.findUnique({
      where: { id: registrationId },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            email: true,
            phone: true,
            clubId: true,
          },
        },
        tournament: {
          select: {
            id: true,
            name: true,
            type: true,
            registrationType: true,
            registrationCost: true,
            pricingModel: true,
          },
        },
      },
    });

    if (!registration) {
      console.log('❌ Registration not found!');
      return;
    }

    console.log('📋 Registration Details:');
    console.log('  ID:', registration.id);
    console.log('  Status:', registration.status);
    console.log('  Payment Status:', registration.paymentStatus);
    console.log('  Payment ID:', registration.paymentId || 'None');
    console.log('  Amount Paid:', registration.amountPaid ? `$${(registration.amountPaid / 100).toFixed(2)}` : 'None');
    console.log('  Registered At:', registration.registeredAt);
    console.log('  Withdrawn At:', registration.withdrawnAt || 'No');
    console.log('  Rejected At:', registration.rejectedAt || 'No');

    console.log('\n👤 Player Details:');
    console.log('  ID:', registration.player.id);
    console.log('  Name:', registration.player.name || `${registration.player.firstName} ${registration.player.lastName}`);
    console.log('  Email:', registration.player.email);
    console.log('  Phone:', registration.player.phone || 'None');
    console.log('  Club ID:', registration.player.clubId || 'None');

    console.log('\n🏆 Tournament Details:');
    console.log('  ID:', registration.tournament.id);
    console.log('  Name:', registration.tournament.name);
    console.log('  Type:', registration.tournament.type);
    console.log('  Registration Type:', registration.tournament.registrationType);
    console.log('  Registration Cost:', registration.tournament.registrationCost ? `$${(registration.tournament.registrationCost / 100).toFixed(2)}` : 'Free');
    console.log('  Pricing Model:', registration.tournament.pricingModel);

    console.log('\n📝 Notes (Parsed):');
    if (registration.notes) {
      try {
        const notes = JSON.parse(registration.notes);
        console.log('  Stop IDs:', notes.stopIds || 'None');
        console.log('  Brackets:', JSON.stringify(notes.brackets || [], null, 2));
        console.log('  Club ID:', notes.clubId || 'None');
        console.log('  Subtotal:', notes.subtotal ? `$${notes.subtotal.toFixed(2)}` : 'None');
        console.log('  Tax:', notes.tax ? `$${notes.tax.toFixed(2)}` : 'None');
        console.log('  Expected Amount:', notes.expectedAmount ? `$${notes.expectedAmount.toFixed(2)}` : 'None');
        console.log('  New Stops Subtotal:', notes.newStopsSubtotal ? `$${notes.newStopsSubtotal.toFixed(2)}` : 'None');
        console.log('  New Stops Tax:', notes.newStopsTax ? `$${notes.newStopsTax.toFixed(2)}` : 'None');
        console.log('  New Stops Total:', notes.newStopsTotal ? `$${notes.newStopsTotal.toFixed(2)}` : 'None');
        console.log('  Existing Amount Paid:', notes.existingAmountPaid ? `$${(notes.existingAmountPaid / 100).toFixed(2)}` : 'None');
        console.log('  Stripe Session ID:', notes.stripeSessionId || 'None');
        console.log('  Payment Intent ID:', notes.paymentIntentId || 'None');
        console.log('  Pricing Model:', notes.pricingModel || 'None');
      } catch (e) {
        console.log('  ❌ Failed to parse notes:', e);
        console.log('  Raw notes:', registration.notes);
      }
    } else {
      console.log('  No notes found');
    }

    // Check roster entries
    const stopIds = registration.notes ? (() => {
      try {
        const notes = JSON.parse(registration.notes);
        return notes.stopIds || [];
      } catch {
        return [];
      }
    })() : [];

    console.log('\n👥 Roster Entries:');
    if (stopIds.length > 0) {
      const rosterEntries = await prisma.stopTeamPlayer.findMany({
        where: {
          stopId: { in: stopIds },
          playerId: registration.playerId,
        },
        include: {
          stop: {
            select: {
              id: true,
              name: true,
              startAt: true,
              endAt: true,
            },
          },
          team: {
            include: {
              bracket: {
                select: {
                  id: true,
                  name: true,
                },
              },
              club: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (rosterEntries.length === 0) {
        console.log('  ❌ No roster entries found!');
        console.log('  Expected stops:', stopIds);
      } else {
        console.log(`  ✅ Found ${rosterEntries.length} roster entry/entries:`);
        rosterEntries.forEach((entry, idx) => {
          console.log(`\n  Entry ${idx + 1}:`);
          console.log('    Stop:', entry.stop.name, `(${entry.stop.id})`);
          console.log('    Team:', entry.team.name, `(${entry.team.id})`);
          console.log('    Bracket:', entry.team.bracket?.name || 'None', `(${entry.team.bracket?.id || 'None'})`);
          console.log('    Club:', entry.team.club?.name || 'None', `(${entry.team.club?.id || 'None'})`);
        });
      }
    } else {
      console.log('  ⚠️  No stop IDs found in notes, cannot check roster entries');
    }

    // Check if payment was processed
    console.log('\n💳 Payment Status:');
    if (registration.paymentStatus === 'PAID' && registration.paymentId) {
      console.log('  ✅ Payment marked as PAID');
      console.log('  Payment ID:', registration.paymentId);
    } else if (registration.paymentStatus === 'PENDING') {
      console.log('  ⚠️  Payment still PENDING');
      if (registration.notes) {
        try {
          const notes = JSON.parse(registration.notes);
          if (notes.stripeSessionId) {
            console.log('  Stripe Session ID:', notes.stripeSessionId);
          }
        } catch {}
      }
    } else {
      console.log('  ❌ Payment status:', registration.paymentStatus);
    }

    // Check for email sending
    console.log('\n📧 Email Status:');
    console.log('  Player Email:', registration.player.email || 'None');
    if (registration.paymentStatus === 'PAID' && registration.player.email) {
      console.log('  ✅ Should have received payment receipt email');
    } else if (registration.paymentStatus === 'PENDING') {
      console.log('  ⚠️  Email will be sent after payment is confirmed');
    }

  } catch (error) {
    console.error('❌ Error checking registration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get registration ID from command line args
const registrationId = process.argv[2];

if (!registrationId) {
  console.error('Usage: tsx scripts/check-registration.ts <registrationId>');
  process.exit(1);
}

checkRegistration(registrationId);

