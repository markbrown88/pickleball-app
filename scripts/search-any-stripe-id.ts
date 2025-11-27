import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' })
  : null;

async function searchAnyStripeId(stripeId: string) {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`SEARCHING STRIPE FOR: ${stripeId}`);
    console.log('='.repeat(80));

    if (!stripe) {
      console.log(`\n❌ STRIPE_SECRET_KEY not configured`);
      return;
    }

    const prefix = stripeId.substring(0, 3);

    // Try as Payment Intent
    if (prefix === 'pi_') {
      console.log(`\n🔍 Trying as Payment Intent...`);
      try {
        const pi = await stripe.paymentIntents.retrieve(stripeId, {
          expand: ['charges', 'payment_method'],
        });
        
        console.log(`   ✅ Found Payment Intent:`);
        console.log(`      ID: ${pi.id}`);
        console.log(`      Status: ${pi.status}`);
        console.log(`      Amount: $${(pi.amount / 100).toFixed(2)} ${pi.currency.toUpperCase()}`);
        console.log(`      Created: ${new Date(pi.created * 1000).toISOString()}`);
        console.log(`      Customer: ${pi.customer || 'N/A'}`);
        console.log(`      Receipt Email: ${pi.receipt_email || 'N/A'}`);
        console.log(`      Payment Method: ${typeof pi.payment_method === 'string' ? pi.payment_method : pi.payment_method?.id || 'N/A'}`);
        
        if (pi.metadata) {
          console.log(`\n      Metadata:`);
          Object.entries(pi.metadata).forEach(([key, value]) => {
            console.log(`         ${key}: ${value}`);
          });
        }

        if (pi.charges && pi.charges.data.length > 0) {
          console.log(`\n      Charges:`);
          pi.charges.data.forEach((charge: any, idx: number) => {
            console.log(`         ${idx + 1}. ${charge.id}`);
            console.log(`            Amount: $${(charge.amount / 100).toFixed(2)}`);
            console.log(`            Status: ${charge.status}`);
            console.log(`            Payment Method: ${charge.payment_method || 'N/A'}`);
            if (charge.billing_details?.email) {
              console.log(`            Email: ${charge.billing_details.email}`);
            }
            if (charge.receipt_url) {
              console.log(`            Receipt: ${charge.receipt_url}`);
            }
          });
        }

        // Check database
        const registration = await prisma.tournamentRegistration.findFirst({
          where: { paymentId: pi.id },
          include: {
            player: { select: { email: true, firstName: true, lastName: true } },
            tournament: { select: { name: true } },
          },
        });

        if (registration) {
          console.log(`\n      ✅ Database Registration:`);
          console.log(`         ID: ${registration.id}`);
          console.log(`         Player: ${registration.player.firstName || ''} ${registration.player.lastName || ''}`.trim());
          console.log(`         Email: ${registration.player.email || 'No email'}`);
          console.log(`         Tournament: ${registration.tournament.name}`);
          console.log(`         Amount Paid: $${((registration.amountPaid || 0) / 100).toFixed(2)}`);
        }

        return;
      } catch (e: any) {
        console.log(`   ❌ Not a Payment Intent: ${e.message}`);
      }
    }

    // Try as Charge
    if (prefix === 'ch_') {
      console.log(`\n🔍 Trying as Charge...`);
      try {
        const charge = await stripe.charges.retrieve(stripeId);
        
        console.log(`   ✅ Found Charge:`);
        console.log(`      ID: ${charge.id}`);
        console.log(`      Amount: $${(charge.amount / 100).toFixed(2)} ${charge.currency.toUpperCase()}`);
        console.log(`      Status: ${charge.status}`);
        console.log(`      Created: ${new Date(charge.created * 1000).toISOString()}`);
        console.log(`      Payment Method: ${charge.payment_method || 'N/A'}`);
        console.log(`      Payment Intent: ${charge.payment_intent || 'N/A'}`);
        console.log(`      Customer: ${charge.customer || 'N/A'}`);
        
        if (charge.billing_details) {
          console.log(`\n      Billing Details:`);
          console.log(`         Email: ${charge.billing_details.email || 'N/A'}`);
          console.log(`         Name: ${charge.billing_details.name || 'N/A'}`);
        }
        
        if (charge.receipt_url) {
          console.log(`      Receipt URL: ${charge.receipt_url}`);
        }

        // Get payment intent
        if (charge.payment_intent) {
          const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent.id;
          const pi = await stripe.paymentIntents.retrieve(piId);
          console.log(`\n      Payment Intent: ${pi.id} - Status: ${pi.status}`);
        }

        return;
      } catch (e: any) {
        console.log(`   ❌ Not a Charge: ${e.message}`);
      }
    }

    // Try as Payment Method
    if (prefix === 'pm_') {
      console.log(`\n🔍 Trying as Payment Method...`);
      try {
        const pm = await stripe.paymentMethods.retrieve(stripeId);
        
        console.log(`   ✅ Found Payment Method:`);
        console.log(`      ID: ${pm.id}`);
        console.log(`      Type: ${pm.type}`);
        console.log(`      Created: ${new Date(pm.created * 1000).toISOString()}`);
        if (pm.card) {
          console.log(`      Card: ${pm.card.brand} ****${pm.card.last4}`);
        }
        if (pm.customer) {
          const customerId = typeof pm.customer === 'string' ? pm.customer : pm.customer.id;
          console.log(`      Customer: ${customerId}`);
          
          // Get customer details
          try {
            const customer = await stripe.customers.retrieve(customerId);
            if (typeof customer !== 'string' && !customer.deleted) {
              console.log(`\n      Customer Details:`);
              console.log(`         Email: ${customer.email || 'N/A'}`);
              console.log(`         Name: ${customer.name || 'N/A'}`);
            }
          } catch (e) {
            // Ignore
          }
        }

        // Search for charges using this payment method
        console.log(`\n      🔍 Searching for charges using this payment method...`);
        const charges = await stripe.charges.list({
          limit: 100,
        });
        
        const matchingCharges = charges.data.filter(c => c.payment_method === pm.id);
        if (matchingCharges.length > 0) {
          console.log(`         ✅ Found ${matchingCharges.length} charge(s):`);
          matchingCharges.forEach((charge, idx) => {
            console.log(`            ${idx + 1}. ${charge.id} - $${(charge.amount / 100).toFixed(2)} - ${charge.status}`);
            if (charge.payment_intent) {
              const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent.id;
              console.log(`               Payment Intent: ${piId}`);
            }
          });
        } else {
          console.log(`         ❌ No charges found`);
        }

        return;
      } catch (e: any) {
        console.log(`   ❌ Not a Payment Method: ${e.message}`);
      }
    }

    console.log(`\n❌ Could not identify or retrieve Stripe object with ID: ${stripeId}`);
    console.log(`   Supported prefixes: pi_ (Payment Intent), ch_ (Charge), pm_ (Payment Method)`);

  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: npx tsx scripts/search-any-stripe-id.ts <stripeId>');
  process.exit(1);
}

searchAnyStripeId(args[0]);

