import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-10-29.clover',
});

const sessionIds = [
  'cs_live_b1Z0Eysh1IwlNqnghitl39bnHz8AlqLDDUOCU3hkaotWOAs5xLpwF5S5PQ', // ccooke11@cogeco.ca
  'cs_live_b1ookJnByRVoIQ75z2wzNT7gjNpFaJnif1xRcMCGSJktP1NOgfrIyzsV3C', // pattyoliveira7333@gmail.com
  'cs_live_b1CU2ynymRyGdMxrDQYJh2zfJQh7w4LilnvlnNdtZN1yaZsArehFPUxWex', // dtoppi3@gmail.com
  'cs_live_b1XZUcBQnIZhyMa2ViUdmeyWrYSU7FELn7Zl62ln3KIUtIBY9OH33zDi7N', // joeyinfinity@gmail.com
  'cs_live_b1IM9GkXWj4w0LZ0t5gnNqqniJIIQMKJzOgGBYjgZcewF6FZGK6Z1jXjGX', // lourdesvillamor@gmail.com
  'cs_live_b1KkfjOeilsGuylG7PCkXEeTqRP6IeOF8ZVbB0Gidf3VSCr15bflB6FKw5', // llukis@cogeco.ca
  'cs_live_b1Nikac8qVyR4WQjVZLdY2xKDoKqpkqGtcuv0NNMFn96nXwrhGWgi039uc', // udayanramesh2506@gmail.com
  'cs_live_b1sitjsGC41nLxTGD20W8EuocfbhW27RXfYfHbT2D3XSzxmBQvWbwM1Vto', // ratnamsn2@gmail.com
];

async function checkSession(sessionId: string) {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent', 'customer'],
    });

    return {
      id: sessionId,
      status: session.status,
      payment_status: session.payment_status,
      payment_intent: session.payment_intent
        ? (typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id)
        : null,
      amount_total: session.amount_total,
      currency: session.currency,
      created: new Date(session.created * 1000).toISOString(),
      expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
      is_expired: session.expires_at ? Date.now() > session.expires_at * 1000 : false,
      customer_email: session.customer_details?.email || session.customer_email || null,
      url: session.url,
      cancel_url: session.cancel_url,
      success_url: session.success_url,
      metadata: session.metadata,
    };
  } catch (error: any) {
    return {
      id: sessionId,
      error: error.message,
      error_type: error.type,
    };
  }
}

async function main() {
  console.log('Checking Stripe Checkout Sessions...\n');
  console.log('='.repeat(80));

  const results = await Promise.all(sessionIds.map(checkSession));

  let expiredCount = 0;
  let openCount = 0;
  let completedCount = 0;
  let errorCount = 0;

  for (const result of results) {
    if ('error' in result) {
      errorCount++;
      console.log(`\n❌ Session ${result.id}`);
      console.log(`   Error: ${result.error}`);
      console.log(`   Error Type: ${result.error_type}`);
      continue;
    }

    console.log(`\n📋 Session: ${result.id}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Payment Status: ${result.payment_status}`);
    console.log(`   Payment Intent: ${result.payment_intent || 'NONE'}`);
    console.log(`   Amount: $${((result.amount_total || 0) / 100).toFixed(2)} ${result.currency?.toUpperCase()}`);
    console.log(`   Created: ${result.created}`);
    console.log(`   Expires At: ${result.expires_at || 'N/A'}`);
    console.log(`   Is Expired: ${result.is_expired ? 'YES ⚠️' : 'NO ✅'}`);
    console.log(`   Customer Email: ${result.customer_email || 'N/A'}`);
    console.log(`   URL: ${result.url || 'N/A'}`);
    console.log(`   Metadata: ${JSON.stringify(result.metadata || {})}`);

    if (result.is_expired) {
      expiredCount++;
    } else if (result.status === 'open') {
      openCount++;
    } else if (result.status === 'complete') {
      completedCount++;
    }
  }

  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Sessions: ${sessionIds.length}`);
  console.log(`Expired Sessions: ${expiredCount} ⚠️`);
  console.log(`Open Sessions: ${openCount}`);
  console.log(`Completed Sessions: ${completedCount}`);
  console.log(`Error Sessions: ${errorCount}`);

  if (expiredCount > 0) {
    console.log('\n⚠️  ISSUE IDENTIFIED: Expired Sessions');
    console.log('These users created checkout sessions but did not complete payment before the session expired.');
    console.log('Stripe checkout sessions expire after 24 hours by default.');
    console.log('\nPossible causes:');
    console.log('1. Users started checkout but abandoned it');
    console.log('2. Users encountered errors during checkout');
    console.log('3. Users were redirected away and never returned');
    console.log('4. Browser/network issues prevented completion');
    console.log('\nRecommendation: Implement a "Retry Payment" flow for expired sessions.');
  }
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});

