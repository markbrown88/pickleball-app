import { PrismaClient } from '@prisma/client';
import { stripe } from '../src/lib/stripe/config';

const prisma = new PrismaClient();

async function checkStripeSession(registrationId: string) {
  try {
    console.log(`\n=== Checking Stripe Session for Registration: ${registrationId} ===\n`);

    // Get registration
    const registration = await prisma.tournamentRegistration.findUnique({
      where: { id: registrationId },
      select: {
        id: true,
        notes: true,
        paymentStatus: true,
        paymentId: true,
        amountPaid: true,
      },
    });

    if (!registration) {
      console.log('❌ Registration not found!');
      return;
    }

    // Parse notes to get Stripe session ID
    let stripeSessionId: string | null = null;
    if (registration.notes) {
      try {
        const notes = JSON.parse(registration.notes);
        stripeSessionId = notes.stripeSessionId || null;
      } catch (e) {
        console.log('Failed to parse notes');
      }
    }

    if (!stripeSessionId) {
      console.log('❌ No Stripe Session ID found in registration notes');
      return;
    }

    console.log('Stripe Session ID:', stripeSessionId);
    console.log('Current Payment Status:', registration.paymentStatus);
    console.log('Payment ID:', registration.paymentId || 'None');
    console.log('Amount Paid:', registration.amountPaid ? `$${(registration.amountPaid / 100).toFixed(2)}` : 'None');

    // Retrieve Stripe session
    try {
      const session = await stripe.checkout.sessions.retrieve(stripeSessionId);
      
      console.log('\n📋 Stripe Session Details:');
      console.log('  ID:', session.id);
      console.log('  Status:', session.status);
      console.log('  Payment Status:', session.payment_status);
      console.log('  Payment Intent:', session.payment_intent || 'None');
      console.log('  Amount Total:', session.amount_total ? `$${(session.amount_total / 100).toFixed(2)}` : 'None');
      console.log('  Currency:', session.currency);
      console.log('  Customer Email:', session.customer_email || 'None');
      console.log('  Created:', new Date(session.created * 1000).toISOString());
      
      if (session.payment_status === 'paid' && session.payment_intent) {
        console.log('\n✅ Payment is confirmed in Stripe!');
        console.log('  Payment Intent ID:', session.payment_intent);
        
        // Check if payment intent ID is in registration notes
        if (registration.notes) {
          try {
            const notes = JSON.parse(registration.notes);
            if (notes.paymentIntentId === session.payment_intent) {
              console.log('  ✅ Payment Intent ID is stored in registration notes');
            } else {
              console.log('  ⚠️  Payment Intent ID is NOT stored in registration notes');
              console.log('  Expected:', session.payment_intent);
              console.log('  Found:', notes.paymentIntentId || 'None');
            }
          } catch (e) {
            console.log('  ⚠️  Could not parse notes to check paymentIntentId');
          }
        }

        // Check if registration is marked as PAID
        if (registration.paymentStatus === 'PAID') {
          console.log('  ✅ Registration is marked as PAID in database');
        } else {
          console.log('  ❌ Registration is NOT marked as PAID in database');
          console.log('  Current status:', registration.paymentStatus);
        }
      } else {
        console.log('\n⚠️  Payment is not confirmed in Stripe');
        console.log('  Payment Status:', session.payment_status);
      }

      // Retrieve payment intent if it exists
      if (session.payment_intent) {
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string);
          console.log('\n💳 Payment Intent Details:');
          console.log('  ID:', paymentIntent.id);
          console.log('  Status:', paymentIntent.status);
          console.log('  Amount:', `$${(paymentIntent.amount / 100).toFixed(2)}`);
          console.log('  Currency:', paymentIntent.currency);
          console.log('  Created:', new Date(paymentIntent.created * 1000).toISOString());
        } catch (e) {
          console.log('  ⚠️  Could not retrieve payment intent:', e);
        }
      }

    } catch (error: any) {
      console.error('❌ Error retrieving Stripe session:', error.message);
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
  console.error('Usage: tsx scripts/check-stripe-session.ts <registrationId>');
  process.exit(1);
}

checkStripeSession(registrationId);

