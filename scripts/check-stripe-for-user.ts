import Stripe from 'stripe';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

async function checkStripe(email: string, amount?: number) {
  try {
    console.log(`\n=== Checking Stripe for: ${email} ===\n`);

    // Search customers
    const customers = await stripe.customers.list({
      email: email.toLowerCase(),
      limit: 100,
    });

    console.log(`Found ${customers.data.length} customer(s) with email ${email}\n`);

    if (customers.data.length === 0) {
      console.log('No Stripe customer found. Searching all payment intents...\n');
      
      // Search all payment intents by email
      const allPIs = await stripe.paymentIntents.list({
        limit: 100,
      });

      const matchingByEmail = allPIs.data.filter(pi => 
        pi.receipt_email?.toLowerCase() === email.toLowerCase()
      );

      if (matchingByEmail.length > 0) {
        console.log(`Found ${matchingByEmail.length} payment intent(s) with receipt_email ${email}:`);
        matchingByEmail.forEach(pi => {
          console.log(`  - ${pi.id}: $${(pi.amount / 100).toFixed(2)} - Status: ${pi.status} - Created: ${new Date(pi.created * 1000).toISOString()}`);
          if (pi.metadata?.registrationId) {
            console.log(`    Registration ID: ${pi.metadata.registrationId}`);
          }
        });
      }

      // Search checkout sessions
      const allSessions = await stripe.checkout.sessions.list({
        limit: 100,
      });

      const matchingSessions = allSessions.data.filter(session => 
        session.customer_email?.toLowerCase() === email.toLowerCase()
      );

      if (matchingSessions.length > 0) {
        console.log(`\nFound ${matchingSessions.length} checkout session(s) with customer_email ${email}:`);
        matchingSessions.forEach(session => {
          console.log(`  - ${session.id}: $${session.amount_total ? (session.amount_total / 100).toFixed(2) : 'N/A'} - Status: ${session.status} - Payment: ${session.payment_status}`);
          console.log(`    Created: ${new Date(session.created * 1000).toISOString()}`);
          if (session.metadata?.registrationId || session.client_reference_id) {
            console.log(`    Registration ID: ${session.metadata?.registrationId || session.client_reference_id}`);
          }
        });
      }

      if (amount) {
        const amountInCents = Math.round(amount * 100);
        console.log(`\nSearching for amount: $${amount.toFixed(2)} (${amountInCents} cents)...`);
        
        const matchingByAmount = allPIs.data.filter(pi => pi.amount === amountInCents);
        if (matchingByAmount.length > 0) {
          console.log(`Found ${matchingByAmount.length} payment intent(s) with amount $${amount.toFixed(2)}:`);
          matchingByAmount.forEach(pi => {
            console.log(`  - ${pi.id}: Status: ${pi.status} - Email: ${pi.receipt_email || 'N/A'}`);
            if (pi.metadata?.registrationId) {
              console.log(`    Registration ID: ${pi.metadata.registrationId}`);
            }
          });
        }
      }
    } else {
      for (const customer of customers.data) {
        console.log(`Customer: ${customer.id}`);
        console.log(`  Email: ${customer.email}`);
        console.log(`  Created: ${new Date(customer.created * 1000).toISOString()}\n`);

        // Get payment intents
        const paymentIntents = await stripe.paymentIntents.list({
          customer: customer.id,
          limit: 100,
        });

        if (paymentIntents.data.length > 0) {
          console.log(`  Payment Intents (${paymentIntents.data.length}):`);
          paymentIntents.data.forEach(pi => {
            console.log(`    - ${pi.id}`);
            console.log(`      Amount: $${(pi.amount / 100).toFixed(2)} ${pi.currency.toUpperCase()}`);
            console.log(`      Status: ${pi.status}`);
            console.log(`      Created: ${new Date(pi.created * 1000).toISOString()}`);
            if (pi.metadata?.registrationId) {
              console.log(`      Registration ID: ${pi.metadata.registrationId}`);
            }
            console.log(``);
          });
        }

        // Get checkout sessions
        const sessions = await stripe.checkout.sessions.list({
          customer: customer.id,
          limit: 100,
        });

        if (sessions.data.length > 0) {
          console.log(`  Checkout Sessions (${sessions.data.length}):`);
          sessions.data.forEach(session => {
            console.log(`    - ${session.id}`);
            console.log(`      Amount: $${session.amount_total ? (session.amount_total / 100).toFixed(2) : 'N/A'} ${session.currency?.toUpperCase() || ''}`);
            console.log(`      Status: ${session.status}`);
            console.log(`      Payment Status: ${session.payment_status}`);
            console.log(`      Created: ${new Date(session.created * 1000).toISOString()}`);
            if (session.metadata?.registrationId || session.client_reference_id) {
              console.log(`      Registration ID: ${session.metadata?.registrationId || session.client_reference_id}`);
            }
            console.log(``);
          });
        }
      }
    }

  } catch (error: any) {
    console.error(`❌ Error:`, error.message);
  }
}

const email = process.argv[2];
const amount = process.argv[3] ? parseFloat(process.argv[3]) : undefined;

if (!email) {
  console.error('Usage: npx tsx scripts/check-stripe-for-user.ts <email> [amount]');
  process.exit(1);
}

checkStripe(email, amount)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });

