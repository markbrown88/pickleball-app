import Stripe from 'stripe';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' })
  : null;

async function listAllPaymentMethods(searchId?: string) {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`LISTING ALL PAYMENT METHODS`);
    if (searchId) {
      console.log(`SEARCHING FOR: ${searchId}`);
    }
    console.log('='.repeat(80));

    if (!stripe) {
      console.log(`\n❌ STRIPE_SECRET_KEY not configured`);
      return;
    }

    // List all payment methods
    console.log(`\n🔍 Fetching all payment methods...`);
    
    let allPaymentMethods: Stripe.PaymentMethod[] = [];
    let hasMore = true;
    let startingAfter: string | undefined = undefined;

    while (hasMore) {
      const params: Stripe.PaymentMethodListParams = {
        limit: 100,
      };
      if (startingAfter) {
        params.starting_after = startingAfter;
      }

      try {
        const response = await stripe.paymentMethods.list(params);
        allPaymentMethods = allPaymentMethods.concat(response.data);
        
        hasMore = response.has_more;
        if (hasMore && response.data.length > 0) {
          startingAfter = response.data[response.data.length - 1].id;
        } else {
          hasMore = false;
        }
      } catch (e: any) {
        console.log(`   ⚠️  Error: ${e.message}`);
        hasMore = false;
      }
    }

    console.log(`   Found ${allPaymentMethods.length} total payment methods\n`);

    if (searchId) {
      const matching = allPaymentMethods.filter(pm => pm.id === searchId || pm.id.includes(searchId));
      if (matching.length > 0) {
        console.log(`✅ Found ${matching.length} matching payment method(s):\n`);
        matching.forEach((pm, idx) => {
          console.log(`   ${idx + 1}. ${pm.id}`);
          console.log(`      Type: ${pm.type}`);
          console.log(`      Created: ${new Date(pm.created * 1000).toISOString()}`);
          if (pm.card) {
            console.log(`      Card: ${pm.card.brand} ****${pm.card.last4}`);
          }
        });
      } else {
        console.log(`❌ Payment method ${searchId} not found in list`);
        console.log(`\n   Showing first 20 payment methods for reference:\n`);
        for (let i = 0; i < Math.min(allPaymentMethods.length, 20); i++) {
          const pm = allPaymentMethods[i];
          console.log(`   ${i + 1}. ${pm.id} - ${pm.type} - Created: ${new Date(pm.created * 1000).toISOString()}`);
        }
      }
    } else {
      console.log(`Showing first 50 payment methods:\n`);
      for (let i = 0; i < Math.min(allPaymentMethods.length, 50); i++) {
        const pm = allPaymentMethods[i];
        console.log(`   ${i + 1}. ${pm.id} - ${pm.type} - Created: ${new Date(pm.created * 1000).toISOString()}`);
      }
      if (allPaymentMethods.length > 50) {
        console.log(`   ... and ${allPaymentMethods.length - 50} more`);
      }
    }

  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message);
    console.error(error.stack);
  }
}

const args = process.argv.slice(2);
listAllPaymentMethods(args[0]);

