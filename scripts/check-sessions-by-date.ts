import Stripe from 'stripe';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

async function checkSessionsByDate(startDate: string, endDate: string, email?: string) {
  try {
    const start = new Date(startDate).getTime() / 1000;
    const end = new Date(endDate).getTime() / 1000;
    
    console.log(`\n=== Checking Checkout Sessions ===`);
    console.log(`Date Range: ${startDate} to ${endDate}`);
    if (email) console.log(`Email Filter: ${email}`);
    console.log(``);

    const sessions = await stripe.checkout.sessions.list({
      limit: 100,
    });

    const matchingSessions = sessions.data.filter(session => {
      const sessionTime = session.created;
      const inDateRange = sessionTime >= start && sessionTime <= end;
      const emailMatch = !email || session.customer_email?.toLowerCase() === email.toLowerCase();
      return inDateRange && emailMatch;
    });

    console.log(`Found ${matchingSessions.length} session(s) in date range:\n`);

    for (const session of matchingSessions) {
      console.log(`Session: ${session.id}`);
      console.log(`  Status: ${session.status}`);
      console.log(`  Payment Status: ${session.payment_status}`);
      console.log(`  Amount: $${session.amount_total ? (session.amount_total / 100).toFixed(2) : 'N/A'} ${session.currency?.toUpperCase() || ''}`);
      console.log(`  Customer Email: ${session.customer_email || 'N/A'}`);
      console.log(`  Created: ${new Date(session.created * 1000).toISOString()}`);
      console.log(`  Metadata:`, JSON.stringify(session.metadata, null, 2));
      console.log(`  Client Reference ID: ${session.client_reference_id || 'N/A'}`);
      console.log(``);
    }

  } catch (error: any) {
    console.error(`❌ Error:`, error.message);
  }
}

const startDate = process.argv[2] || '2025-11-17';
const endDate = process.argv[3] || '2025-11-18';
const email = process.argv[4];

checkSessionsByDate(startDate, endDate, email)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });

