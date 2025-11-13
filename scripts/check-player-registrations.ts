import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPlayerRegistrations(registrationId: string) {
  try {
    console.log(`\n=== Checking All Registrations for Player ===\n`);

    // Get the registration
    const registration = await prisma.tournamentRegistration.findUnique({
      where: { id: registrationId },
      select: {
        id: true,
        tournamentId: true,
        playerId: true,
        player: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!registration) {
      console.log('❌ Registration not found!');
      return;
    }

    // Get all registrations for this player and tournament
    const allRegistrations = await prisma.tournamentRegistration.findMany({
      where: {
        tournamentId: registration.tournamentId,
        playerId: registration.playerId,
      },
      orderBy: {
        registeredAt: 'asc',
      },
    });

    console.log(`Found ${allRegistrations.length} registration(s) for this player/tournament:\n`);

    for (let i = 0; i < allRegistrations.length; i++) {
      const reg = allRegistrations[i];
      console.log(`\n--- Registration ${i + 1} ---`);
      console.log('  ID:', reg.id);
      console.log('  Status:', reg.status);
      console.log('  Payment Status:', reg.paymentStatus);
      console.log('  Payment ID:', reg.paymentId || 'None');
      console.log('  Amount Paid:', reg.amountPaid ? `$${(reg.amountPaid / 100).toFixed(2)}` : 'None');
      console.log('  Registered At:', reg.registeredAt);

      if (reg.notes) {
        try {
          const notes = JSON.parse(reg.notes);
          console.log('  Stop IDs:', notes.stopIds || 'None');
          console.log('  Brackets:', notes.brackets?.length || 0, 'bracket(s)');
          if (notes.brackets) {
            notes.brackets.forEach((b: any, idx: number) => {
              console.log(`    Bracket ${idx + 1}: Stop ${b.stopId}, Bracket ${b.bracketId}`);
            });
          }
          console.log('  Club ID:', notes.clubId || 'None');
          console.log('  Expected Amount:', notes.expectedAmount ? `$${notes.expectedAmount.toFixed(2)}` : 'None');
          console.log('  New Stops Total:', notes.newStopsTotal ? `$${notes.newStopsTotal.toFixed(2)}` : 'None');
          console.log('  Existing Amount Paid:', notes.existingAmountPaid ? `$${(notes.existingAmountPaid / 100).toFixed(2)}` : 'None');
          console.log('  Stripe Session ID:', notes.stripeSessionId || 'None');
          console.log('  Payment Intent ID:', notes.paymentIntentId || 'None');
        } catch (e) {
          console.log('  ❌ Failed to parse notes');
        }
      } else {
        console.log('  No notes');
      }
    }

    // Get tournament stops
    const tournament = await prisma.tournament.findUnique({
      where: { id: registration.tournamentId },
      select: {
        id: true,
        name: true,
        stops: {
          select: {
            id: true,
            name: true,
            startAt: true,
            endAt: true,
          },
          orderBy: {
            startAt: 'asc',
          },
        },
      },
    });

    if (tournament) {
      console.log(`\n\n🏆 Tournament: ${tournament.name}`);
      console.log(`Total Stops: ${tournament.stops.length}\n`);
      
      // Collect all registered stop IDs
      const allRegisteredStopIds: string[] = [];
      allRegistrations.forEach(reg => {
        if (reg.notes) {
          try {
            const notes = JSON.parse(reg.notes);
            if (notes.stopIds) {
              allRegisteredStopIds.push(...notes.stopIds);
            }
          } catch {}
        }
      });

      tournament.stops.forEach((stop, idx) => {
        const isRegistered = allRegisteredStopIds.includes(stop.id);
        console.log(`Stop ${idx + 1}: ${stop.name} (${stop.id})`);
        console.log(`  Registered: ${isRegistered ? '✅ YES' : '❌ NO'}`);
        console.log(`  Dates: ${stop.startAt ? new Date(stop.startAt).toLocaleDateString() : 'TBD'} - ${stop.endAt ? new Date(stop.endAt).toLocaleDateString() : 'TBD'}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get registration ID from command line args
const registrationId = process.argv[2];

if (!registrationId) {
  console.error('Usage: tsx scripts/check-player-registrations.ts <registrationId>');
  process.exit(1);
}

checkPlayerRegistrations(registrationId);
