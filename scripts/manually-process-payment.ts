import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function manuallyProcessPayment(registrationId: string) {
  try {
    console.log(`\n=== Manually Processing Payment for Registration: ${registrationId} ===\n`);

    // Get registration with all details
    const registration = await prisma.tournamentRegistration.findUnique({
      where: { id: registrationId },
      include: {
        player: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            name: true,
          },
        },
        tournament: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    if (!registration) {
      console.log('❌ Registration not found!');
      return;
    }

    if (registration.paymentStatus === 'PAID') {
      console.log('✅ Registration is already marked as PAID');
      return;
    }

    // Parse notes
    let notes: any = {};
    if (registration.notes) {
      try {
        notes = JSON.parse(registration.notes);
      } catch (e) {
        console.log('❌ Failed to parse notes');
        return;
      }
    }

    const stripeSessionId = notes.stripeSessionId;
    if (!stripeSessionId) {
      console.log('❌ No Stripe Session ID found in notes');
      return;
    }

    console.log('Stripe Session ID:', stripeSessionId);
    console.log('Current Payment Status:', registration.paymentStatus);
    console.log('Amount Paid:', registration.amountPaid ? `$${(registration.amountPaid / 100).toFixed(2)}` : 'None');

    // Check if we need to manually mark as paid
    // Since we can't access Stripe API without keys, we'll need to manually update
    console.log('\n⚠️  To manually process this payment, you need to:');
    console.log('1. Check Stripe dashboard for session:', stripeSessionId);
    console.log('2. If payment is confirmed, get the payment_intent ID');
    console.log('3. Run the webhook handler manually or update the registration directly');
    
    console.log('\n📋 Registration Details for Manual Processing:');
    console.log('  Stop IDs:', notes.stopIds || []);
    console.log('  Brackets:', JSON.stringify(notes.brackets || [], null, 2));
    console.log('  Club ID:', notes.clubId || 'None');
    console.log('  Expected Amount:', notes.expectedAmount ? `$${notes.expectedAmount.toFixed(2)}` : 'None');

    // Show what needs to be done
    console.log('\n🔧 To fix this registration:');
    console.log('1. Check Stripe dashboard for payment status');
    console.log('2. If paid, get payment_intent ID');
    console.log('3. Update registration with:');
    console.log('   - paymentStatus: PAID');
    console.log('   - paymentId: <payment_intent_id>');
    console.log('   - Update notes to include paymentIntentId');
    console.log('4. Create roster entries for team tournaments');
    console.log('5. Send payment receipt email');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get registration ID from command line args
const registrationId = process.argv[2];

if (!registrationId) {
  console.error('Usage: tsx scripts/manually-process-payment.ts <registrationId>');
  process.exit(1);
}

manuallyProcessPayment(registrationId);

