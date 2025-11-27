import Stripe from 'stripe';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' })
  : null;

async function checkStripeMode() {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`CHECKING STRIPE ACCOUNT MODE`);
    console.log('='.repeat(80));

    if (!stripe) {
      console.log(`\n❌ STRIPE_SECRET_KEY not configured`);
      return;
    }

    const key = process.env.STRIPE_SECRET_KEY || '';
    const isTest = key.startsWith('sk_test_');
    const isLive = key.startsWith('sk_live_');

    console.log(`\n🔑 API Key Mode:`);
    if (isTest) {
      console.log(`   ✅ TEST MODE (sk_test_...)`);
    } else if (isLive) {
      console.log(`   ✅ LIVE MODE (sk_live_...)`);
    } else {
      console.log(`   ⚠️  Unknown format: ${key.substring(0, 10)}...`);
    }

    // Get account info
    try {
      const account = await stripe.accounts.retrieve();
      console.log(`\n📊 Account Info:`);
      console.log(`   ID: ${account.id}`);
      console.log(`   Type: ${account.type}`);
      console.log(`   Country: ${account.country || 'N/A'}`);
      console.log(`   Email: ${account.email || 'N/A'}`);
    } catch (e: any) {
      console.log(`\n   ⚠️  Could not retrieve account: ${e.message}`);
    }

    // Check a sample payment intent to see its format
    try {
      const pis = await stripe.paymentIntents.list({ limit: 1 });
      if (pis.data.length > 0) {
        const samplePI = pis.data[0];
        console.log(`\n📝 Sample Payment Intent:`);
        console.log(`   ID: ${samplePI.id}`);
        console.log(`   Format: ${samplePI.id.startsWith('pi_') ? 'Standard' : 'Unknown'}`);
        console.log(`   Amount: $${(samplePI.amount / 100).toFixed(2)}`);
        console.log(`   Status: ${samplePI.status}`);
      }
    } catch (e: any) {
      console.log(`\n   ⚠️  Could not list payment intents: ${e.message}`);
    }

    // The payment intent the user is looking for
    const userPI = 'pi_3SUt72DnHE5trALU43BuIzik';
    console.log(`\n🔍 User's Payment Intent: ${userPI}`);
    console.log(`   Format check: ${userPI.startsWith('pi_') ? 'Valid format' : 'Invalid format'}`);
    
    // Try to determine if it's test vs live based on the ID pattern
    // Test mode payment intents often have different prefixes or patterns
    // But actually, both test and live use pi_ prefix, so we can't tell from the ID alone
    
    console.log(`\n💡 Analysis:`);
    console.log(`   - Your API key is in ${isTest ? 'TEST' : isLive ? 'LIVE' : 'UNKNOWN'} mode`);
    console.log(`   - The payment intent ${userPI} cannot be retrieved`);
    console.log(`   - This suggests the payment is in ${isTest ? 'LIVE' : 'TEST'} mode (opposite of your key)`);
    console.log(`\n   Recommendation:`);
    console.log(`   - Check if you have both test and live keys`);
    console.log(`   - Verify which mode the payment was made in`);
    console.log(`   - Use the matching key to retrieve the payment intent`);

  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message);
  }
}

checkStripeMode();

