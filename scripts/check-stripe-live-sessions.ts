import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables (but we'll override with live key)
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Get live key from command line argument or environment variable
const liveKey = process.argv[2] || process.env.STRIPE_LIVE_SECRET_KEY;

if (!liveKey) {
  console.error('Error: Stripe live secret key required');
  console.error('Usage: npx tsx scripts/check-stripe-live-sessions.ts <sk_live_...>');
  console.error('   OR set STRIPE_LIVE_SECRET_KEY environment variable');
  process.exit(1);
}

if (!liveKey.startsWith('sk_live_')) {
  console.error('Error: Key must start with sk_live_');
  console.error('Received:', liveKey.substring(0, 20) + '...');
  process.exit(1);
}

const stripe = new Stripe(liveKey, {
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

const emailMap: Record<string, string> = {
  'cs_live_b1Z0Eysh1IwlNqnghitl39bnHz8AlqLDDUOCU3hkaotWOAs5xLpwF5S5PQ': 'ccooke11@cogeco.ca',
  'cs_live_b1ookJnByRVoIQ75z2wzNT7gjNpFaJnif1xRcMCGSJktP1NOgfrIyzsV3C': 'pattyoliveira7333@gmail.com',
  'cs_live_b1CU2ynymRyGdMxrDQYJh2zfJQh7w4LilnvlnNdtZN1yaZsArehFPUxWex': 'dtoppi3@gmail.com',
  'cs_live_b1XZUcBQnIZhyMa2ViUdmeyWrYSU7FELn7Zl62ln3KIUtIBY9OH33zDi7N': 'joeyinfinity@gmail.com',
  'cs_live_b1IM9GkXWj4w0LZ0t5gnNqqniJIIQMKJzOgGBYjgZcewF6FZGK6Z1jXjGX': 'lourdesvillamor@gmail.com',
  'cs_live_b1KkfjOeilsGuylG7PCkXEeTqRP6IeOF8ZVbB0Gidf3VSCr15bflB6FKw5': 'llukis@cogeco.ca',
  'cs_live_b1Nikac8qVyR4WQjVZLdY2xKDoKqpkqGtcuv0NNMFn96nXwrhGWgi039uc': 'udayanramesh2506@gmail.com',
  'cs_live_b1sitjsGC41nLxTGD20W8EuocfbhW27RXfYfHbT2D3XSzxmBQvWbwM1Vto': 'ratnamsn2@gmail.com',
};

async function checkSession(sessionId: string) {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent', 'customer', 'line_items'],
    });

    const email = emailMap[sessionId] || session.customer_details?.email || session.customer_email || 'Unknown';
    
    return {
      id: sessionId,
      email,
      status: session.status,
      payment_status: session.payment_status,
      payment_intent: session.payment_intent
        ? (typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id)
        : null,
      payment_intent_status: session.payment_intent && typeof session.payment_intent !== 'string'
        ? session.payment_intent.status
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
      mode: session.mode,
      line_items_count: session.line_items?.data?.length || 0,
      line_items: session.line_items?.data?.map(item => ({
        description: item.description,
        amount: item.amount_total,
        quantity: item.quantity,
      })) || [],
    };
  } catch (error: any) {
    return {
      id: sessionId,
      email: emailMap[sessionId] || 'Unknown',
      error: error.message,
      error_type: error.type,
      error_code: error.code,
    };
  }
}

async function main() {
  console.log('Checking Stripe LIVE Checkout Sessions\n');
  console.log('='.repeat(80));
  console.log(`Using Stripe key: ${liveKey.substring(0, 20)}...`);
  console.log('='.repeat(80));

  const results = await Promise.all(sessionIds.map(checkSession));

  let expiredCount = 0;
  let openCount = 0;
  let completedCount = 0;
  let errorCount = 0;
  let incompleteCount = 0;

  console.log('\n');
  for (const result of results) {
    if ('error' in result) {
      errorCount++;
      console.log(`\n❌ Session ${result.id.substring(0, 30)}...`);
      console.log(`   Email: ${result.email}`);
      console.log(`   Error: ${result.error}`);
      console.log(`   Error Type: ${result.error_type}`);
      console.log(`   Error Code: ${result.error_code}`);
      continue;
    }

    const statusIcon = result.status === 'complete' ? '✅' : result.status === 'open' ? '🟡' : result.is_expired ? '⏰' : '❓';
    
    console.log(`\n${statusIcon} Session: ${result.id.substring(0, 30)}...`);
    console.log(`   Email: ${result.email}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Payment Status: ${result.payment_status}`);
    console.log(`   Payment Intent: ${result.payment_intent || 'NONE'}`);
    if (result.payment_intent_status) {
      console.log(`   Payment Intent Status: ${result.payment_intent_status}`);
    }
    console.log(`   Amount: $${((result.amount_total || 0) / 100).toFixed(2)} ${result.currency?.toUpperCase()}`);
    console.log(`   Created: ${result.created}`);
    console.log(`   Expires At: ${result.expires_at || 'N/A'}`);
    console.log(`   Is Expired: ${result.is_expired ? 'YES ⚠️' : 'NO ✅'}`);
    console.log(`   Mode: ${result.mode}`);
    console.log(`   Line Items: ${result.line_items_count}`);
    
    if (result.line_items.length > 0) {
      console.log(`   Line Item Details:`);
      result.line_items.forEach((item, idx) => {
        console.log(`     ${idx + 1}. ${item.description || 'N/A'}`);
        console.log(`        Amount: $${((item.amount || 0) / 100).toFixed(2)} x ${item.quantity || 1}`);
      });
    }
    
    console.log(`   URL: ${result.url ? 'Available' : 'N/A'}`);
    console.log(`   Metadata: ${JSON.stringify(result.metadata || {})}`);

    if (result.is_expired) {
      expiredCount++;
    } else if (result.status === 'open') {
      openCount++;
    } else if (result.status === 'complete') {
      completedCount++;
    } else {
      incompleteCount++;
    }
  }

  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Sessions: ${sessionIds.length}`);
  console.log(`✅ Completed Sessions: ${completedCount}`);
  console.log(`🟡 Open Sessions: ${openCount}`);
  console.log(`⏰ Expired Sessions: ${expiredCount}`);
  console.log(`❓ Other Status: ${incompleteCount}`);
  console.log(`❌ Error Sessions: ${errorCount}`);

  // Analysis
  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('ANALYSIS');
  console.log('='.repeat(80));

  if (expiredCount > 0) {
    console.log('\n⚠️  EXPIRED SESSIONS DETECTED');
    console.log(`   ${expiredCount} session(s) have expired`);
    console.log('   Stripe checkout sessions expire after 24 hours');
    console.log('   Users need to retry payment');
  }

  if (openCount > 0) {
    console.log('\n🟡 OPEN SESSIONS DETECTED');
    console.log(`   ${openCount} session(s) are still open`);
    console.log('   These users may still be able to complete payment');
    console.log('   Check if URLs are still valid');
  }

  if (completedCount > 0) {
    console.log('\n✅ COMPLETED SESSIONS');
    console.log(`   ${completedCount} session(s) were completed`);
    console.log('   These payments were successful');
    console.log('   Check if webhook processed them correctly');
  }

  if (errorCount > 0) {
    console.log('\n❌ ERRORS');
    console.log(`   ${errorCount} session(s) had errors`);
    console.log('   Sessions may have been deleted or key mismatch');
  }

  // Check for patterns
  const expiredSessions = results.filter(r => !('error' in r) && r.is_expired);
  if (expiredSessions.length > 0) {
    console.log('\n\n');
    console.log('='.repeat(80));
    console.log('EXPIRED SESSIONS DETAILS');
    console.log('='.repeat(80));
    expiredSessions.forEach(session => {
      if (!('error' in session)) {
        const hoursSinceCreation = (Date.now() - new Date(session.created).getTime()) / (1000 * 60 * 60);
        console.log(`\n${session.email}:`);
        console.log(`  Created: ${session.created} (${hoursSinceCreation.toFixed(1)} hours ago)`);
        console.log(`  Expired: ${session.expires_at}`);
        console.log(`  Status: ${session.status}`);
        console.log(`  Payment Status: ${session.payment_status}`);
      }
    });
  }

  console.log('\n');
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});

