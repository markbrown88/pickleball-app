// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-10-29.clover',
});

async function searchStripeRecords(email: string, amount: number) {
  try {
    console.log(`\n=== Searching Stripe Records ===\n`);
    console.log(`Email: ${email}`);
    console.log(`Amount: $${(amount / 100).toFixed(2)}`);
    console.log(`Amount in cents: ${amount}\n`);

    // Search for payment intents by amount
    console.log(`1. Searching Payment Intents by amount (${amount} cents)...`);
    const paymentIntents = await stripe.paymentIntents.list({
      limit: 100,
    });

    const matchingPIs = paymentIntents.data.filter(pi => pi.amount === amount);
    console.log(`   Found ${matchingPIs.length} payment intent(s) with amount ${amount} cents:`);
    for (const pi of matchingPIs) {
      console.log(`   - ${pi.id}: ${pi.status} (created: ${new Date(pi.created * 1000).toISOString()})`);
      if (pi.metadata?.email || pi.metadata?.customer_email) {
        console.log(`     Email: ${pi.metadata.email || pi.metadata.customer_email}`);
      }
      if (pi.metadata?.registrationId) {
        console.log(`     Registration ID: ${pi.metadata.registrationId}`);
      }
    }

    // Search for customers by email
    console.log(`\n2. Searching Customers by email...`);
    const customers = await stripe.customers.list({
      email: email,
      limit: 100,
    });
    console.log(`   Found ${customers.data.length} customer(s) with email ${email}:`);
    for (const customer of customers.data) {
      console.log(`   - Customer ID: ${customer.id}`);
      console.log(`     Created: ${new Date(customer.created * 1000).toISOString()}`);
      
      // Get payment intents for this customer
      const customerPIs = await stripe.paymentIntents.list({
        customer: customer.id,
        limit: 10,
      });
      console.log(`     Payment Intents: ${customerPIs.data.length}`);
      for (const pi of customerPIs.data) {
        console.log(`       - ${pi.id}: ${pi.status} ($${((pi.amount || 0) / 100).toFixed(2)})`);
      }
    }

    // Search for charges by amount
    console.log(`\n3. Searching Charges by amount (${amount} cents)...`);
    const charges = await stripe.charges.list({
      limit: 100,
    });
    const matchingCharges = charges.data.filter(c => c.amount === amount);
    console.log(`   Found ${matchingCharges.length} charge(s) with amount ${amount} cents:`);
    for (const charge of matchingCharges) {
      console.log(`   - ${charge.id}: ${charge.status} (created: ${new Date(charge.created * 1000).toISOString()})`);
      console.log(`     Payment Intent: ${charge.payment_intent || 'None'}`);
      console.log(`     Customer Email: ${charge.billing_details?.email || 'None'}`);
      if (charge.metadata?.email || charge.metadata?.registrationId) {
        console.log(`     Metadata:`, charge.metadata);
      }
    }

    // Search for checkout sessions (recent ones)
    console.log(`\n4. Searching recent Checkout Sessions...`);
    const sessions = await stripe.checkout.sessions.list({
      limit: 100,
    });
    const matchingSessions = sessions.data.filter(s => 
      s.customer_email === email || 
      s.metadata?.email === email ||
      (s.amount_total === amount && s.payment_status === 'paid')
    );
    console.log(`   Found ${matchingSessions.length} session(s) matching criteria:`);
    for (const session of matchingSessions) {
      console.log(`   - ${session.id}: ${session.payment_status} ($${((session.amount_total || 0) / 100).toFixed(2)})`);
      console.log(`     Created: ${new Date(session.created * 1000).toISOString()}`);
      console.log(`     Customer Email: ${session.customer_email || 'None'}`);
      if (session.metadata) {
        console.log(`     Metadata:`, session.metadata);
      }
      if (session.payment_intent) {
        console.log(`     Payment Intent: ${session.payment_intent}`);
      }
    }

    console.log(`\n✅ Search complete`);

  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

const email = process.argv[2];
const amountInCents = process.argv[3] ? parseInt(process.argv[3]) : null;

if (!email) {
  console.error('Usage: npx tsx scripts/search-stripe-records.ts <email> [amountInCents]');
  console.error('Example: npx tsx scripts/search-stripe-records.ts paula.rby@gmail.com 13560');
  process.exit(1);
}

// If amount not provided, use 13560 (135.60 in cents) as default for this investigation
const amount = amountInCents || 13560;

searchStripeRecords(email, amount)
  .then(() => {
    console.log('\n✅ Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });

