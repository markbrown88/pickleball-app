import Stripe from 'stripe';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

async function checkPaymentIntents(paymentIntentIds: string[]) {
  try {
    for (const piId of paymentIntentIds) {
      console.log(`\n=== Payment Intent: ${piId} ===`);
      
      const pi = await stripe.paymentIntents.retrieve(piId);
      
      console.log(`Status: ${pi.status}`);
      console.log(`Amount: $${(pi.amount / 100).toFixed(2)} ${pi.currency.toUpperCase()}`);
      console.log(`Created: ${new Date(pi.created * 1000).toISOString()}`);
      console.log(`Customer: ${pi.customer || 'N/A'}`);
      console.log(`Receipt Email: ${pi.receipt_email || 'N/A'}`);
      console.log(`Metadata:`, JSON.stringify(pi.metadata, null, 2));
      
      // Get charges
      if (pi.charges && pi.charges.data.length > 0) {
        console.log(`\nCharges:`);
        pi.charges.data.forEach((charge: any) => {
          console.log(`  - ${charge.id}: $${(charge.amount / 100).toFixed(2)} - Status: ${charge.status}`);
          console.log(`    Receipt Email: ${charge.receipt_email || 'N/A'}`);
          console.log(`    Billing Details:`, JSON.stringify(charge.billing_details, null, 2));
        });
      }
      
      // Try to find checkout session
      if (pi.metadata?.sessionId) {
        try {
          const session = await stripe.checkout.sessions.retrieve(pi.metadata.sessionId);
          console.log(`\nCheckout Session: ${session.id}`);
          console.log(`  Status: ${session.status}`);
          console.log(`  Payment Status: ${session.payment_status}`);
          console.log(`  Customer Email: ${session.customer_email || 'N/A'}`);
          console.log(`  Metadata:`, JSON.stringify(session.metadata, null, 2));
        } catch (e) {
          // Ignore
        }
      }
    }
  } catch (error: any) {
    console.error(`❌ Error:`, error.message);
  }
}

const piIds = process.argv.slice(2);
if (piIds.length === 0) {
  console.error('Usage: npx tsx scripts/check-payment-intents.ts <pi_id1> [pi_id2] ...');
  process.exit(1);
}

checkPaymentIntents(piIds)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });

