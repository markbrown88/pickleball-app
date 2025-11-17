// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-10-29.clover',
});

async function checkStripeSession(sessionId: string) {
  try {
    console.log(`\n=== Checking Stripe Session: ${sessionId} ===\n`);

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent', 'line_items'],
    });

    console.log(`Session Status: ${session.status}`);
    console.log(`Payment Status: ${session.payment_status}`);
    console.log(`Amount Total: $${((session.amount_total || 0) / 100).toFixed(2)}`);
    console.log(`Currency: ${session.currency}`);
    console.log(`Customer Email: ${session.customer_email || 'None'}`);
    console.log(`Created: ${new Date(session.created * 1000).toISOString()}`);

    if (session.payment_intent) {
      const paymentIntent = typeof session.payment_intent === 'string' 
        ? await stripe.paymentIntents.retrieve(session.payment_intent)
        : session.payment_intent;
      
      console.log(`\n--- Payment Intent ---`);
      console.log(`   ID: ${paymentIntent.id}`);
      console.log(`   Status: ${paymentIntent.status}`);
      console.log(`   Amount: $${((paymentIntent.amount || 0) / 100).toFixed(2)}`);
      console.log(`   Currency: ${paymentIntent.currency}`);
      console.log(`   Created: ${new Date(paymentIntent.created * 1000).toISOString()}`);
      
      if (paymentIntent.charges && paymentIntent.charges.data.length > 0) {
        console.log(`\n   Charges:`);
        for (const charge of paymentIntent.charges.data) {
          console.log(`     - ${charge.id}: ${charge.status} ($${((charge.amount || 0) / 100).toFixed(2)})`);
        }
      }
    } else {
      console.log(`\n⚠️  No payment intent found for this session`);
    }

    if (session.line_items) {
      const lineItems = await stripe.checkout.sessions.listLineItems(sessionId);
      console.log(`\n--- Line Items ---`);
      for (const item of lineItems.data) {
        console.log(`   - ${item.description}: $${((item.amount_total || 0) / 100).toFixed(2)}`);
      }
    }

    console.log(`\n--- Metadata ---`);
    console.log(JSON.stringify(session.metadata || {}, null, 2));

  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message);
    if (error.type === 'StripeInvalidRequestError') {
      console.error(`   This session may not exist or may have been deleted`);
    }
  }
}

const sessionId = process.argv[2];
if (!sessionId) {
  console.error('Usage: npx tsx scripts/check-stripe-session.ts <sessionId>');
  console.error('Example: npx tsx scripts/check-stripe-session.ts cs_live_...');
  process.exit(1);
}

checkStripeSession(sessionId)
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
