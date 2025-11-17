import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function investigatePendingPayments(email: string) {
  try {
    console.log(`\n=== Investigating Pending Payments for: ${email} ===\n`);

    // Find the player
    const player = await prisma.player.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
      },
    });

    if (!player) {
      console.log(`❌ Player not found for email: ${email}`);
      return;
    }

    console.log(`✅ Found player:`);
    console.log(`   ID: ${player.id}`);
    console.log(`   Name: ${player.name || `${player.firstName} ${player.lastName}`}`);
    console.log(`   Email: ${player.email}`);

    // Get all registrations for this player
    const registrations = await prisma.tournamentRegistration.findMany({
      where: { playerId: player.id },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            registrationType: true,
            registrationCost: true,
          },
        },
      },
      orderBy: {
        registeredAt: 'desc',
      },
    });

    console.log(`\n📋 Found ${registrations.length} registration(s):\n`);

    for (const reg of registrations) {
      console.log(`--- Registration ID: ${reg.id} ---`);
      console.log(`   Tournament: ${reg.tournament.name}`);
      console.log(`   Tournament ID: ${reg.tournament.id}`);
      console.log(`   Status: ${reg.status}`);
      console.log(`   Payment Status: ${reg.paymentStatus}`);
      console.log(`   Amount Paid: ${reg.amountPaid ? `$${(reg.amountPaid / 100).toFixed(2)}` : 'None'}`);
      console.log(`   Payment ID: ${reg.paymentId || 'None'}`);
      console.log(`   Registered At: ${reg.registeredAt}`);
      console.log(`   Notes: ${reg.notes || 'None'}`);

      // Parse notes to see stop IDs
      if (reg.notes) {
        try {
          const notes = JSON.parse(reg.notes);
          console.log(`   Parsed Notes:`);
          console.log(`     Stop IDs: ${notes.stopIds ? notes.stopIds.join(', ') : 'None'}`);
          console.log(`     Club ID: ${notes.clubId || 'None'}`);
          console.log(`     Expected Amount: ${notes.expectedAmount ? `$${(notes.expectedAmount / 100).toFixed(2)}` : 'None'}`);
        } catch (e) {
          console.log(`   (Could not parse notes)`);
        }
      }

      // Check if there are any Stripe checkout sessions for this registration
      if (reg.paymentStatus === 'PENDING' && reg.paymentId) {
        console.log(`   ⚠️  PENDING payment with Payment ID: ${reg.paymentId}`);
        console.log(`   This might be a Stripe payment intent or checkout session ID`);
      }

      console.log('');
    }

    // Check for any recent Stripe events or issues
    console.log(`\n🔍 Checking for payment issues...\n`);

    const pendingRegistrations = registrations.filter(r => r.paymentStatus === 'PENDING');
    if (pendingRegistrations.length > 0) {
      console.log(`Found ${pendingRegistrations.length} pending registration(s):`);
      for (const pending of pendingRegistrations) {
        console.log(`\n   Registration: ${pending.id}`);
        console.log(`   Tournament: ${pending.tournament.name}`);
        console.log(`   Amount Expected: ${pending.tournament.registrationCost ? `$${(pending.tournament.registrationCost / 100).toFixed(2)}` : 'FREE'}`);
        console.log(`   Payment ID: ${pending.paymentId || 'None'}`);
        
        if (!pending.paymentId) {
          console.log(`   ⚠️  No payment ID - registration may not have reached Stripe checkout`);
        } else {
          console.log(`   ℹ️  Payment ID exists: ${pending.paymentId}`);
          console.log(`      This could be a payment intent ID that needs webhook processing`);
        }
      }
    } else {
      console.log(`✅ No pending registrations found`);
    }

  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: npx tsx scripts/investigate-pending-payments.ts <email>');
  process.exit(1);
}

investigatePendingPayments(email)
  .then(() => {
    console.log('\n✅ Investigation complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });

