import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' })
  : null;

async function searchChargesByPaymentMethod(paymentMethodId: string) {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`SEARCHING CHARGES FOR PAYMENT METHOD: ${paymentMethodId}`);
    console.log('='.repeat(80));

    if (!stripe) {
      console.log(`\n❌ STRIPE_SECRET_KEY not configured`);
      return;
    }

    // First, try to retrieve the payment method directly
    console.log(`\n🔍 Attempting to retrieve payment method directly...`);
    try {
      const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
      console.log(`   ✅ Found payment method:`);
      console.log(`      Type: ${pm.type}`);
      console.log(`      Created: ${new Date(pm.created * 1000).toISOString()}`);
      if (pm.card) {
        console.log(`      Card: ${pm.card.brand} ****${pm.card.last4}`);
      }
      if (pm.customer) {
        const customerId = typeof pm.customer === 'string' ? pm.customer : pm.customer.id;
        console.log(`      Customer: ${customerId}`);
      }
    } catch (e: any) {
      console.log(`   ⚠️  Could not retrieve payment method: ${e.message}`);
    }

    // Search all charges
    console.log(`\n🔍 Searching all charges for payment method ${paymentMethodId}...`);
    
    let allCharges: Stripe.Charge[] = [];
    let hasMore = true;
    let startingAfter: string | undefined = undefined;

    while (hasMore) {
      const params: Stripe.ChargeListParams = {
        limit: 100,
      };
      if (startingAfter) {
        params.starting_after = startingAfter;
      }

      try {
        const response = await stripe.charges.list(params);
        allCharges = allCharges.concat(response.data);
        
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

    console.log(`   Found ${allCharges.length} total charges`);

    // Filter charges by payment method
    const matchingCharges = allCharges.filter(charge => {
      return charge.payment_method === paymentMethodId;
    });

    if (matchingCharges.length > 0) {
      console.log(`\n✅ Found ${matchingCharges.length} charge(s) with payment method ${paymentMethodId}:\n`);

      for (let i = 0; i < matchingCharges.length; i++) {
        const charge = matchingCharges[i];
        
        console.log(`${'─'.repeat(80)}`);
        console.log(`CHARGE ${i + 1}/${matchingCharges.length}: ${charge.id}`);
        console.log('─'.repeat(80));
        
        console.log(`\n💳 Charge Details:`);
        console.log(`   Amount: $${(charge.amount / 100).toFixed(2)} ${charge.currency.toUpperCase()}`);
        console.log(`   Status: ${charge.status}`);
        console.log(`   Created: ${new Date(charge.created * 1000).toISOString()}`);
        console.log(`   Payment Method: ${charge.payment_method || 'N/A'}`);
        console.log(`   Payment Intent: ${charge.payment_intent || 'N/A'}`);
        console.log(`   Customer: ${charge.customer || 'N/A'}`);
        
        if (charge.billing_details) {
          console.log(`\n   Billing Details:`);
          console.log(`      Email: ${charge.billing_details.email || 'N/A'}`);
          console.log(`      Name: ${charge.billing_details.name || 'N/A'}`);
          console.log(`      Phone: ${charge.billing_details.phone || 'N/A'}`);
        }
        
        if (charge.receipt_url) {
          console.log(`   Receipt URL: ${charge.receipt_url}`);
        }
        
        if (charge.receipt_email) {
          console.log(`   Receipt Email: ${charge.receipt_email}`);
        }

        // Get the payment intent
        if (charge.payment_intent) {
          const piId = typeof charge.payment_intent === 'string' 
            ? charge.payment_intent 
            : charge.payment_intent.id;
          
          console.log(`\n   🔍 Retrieving Payment Intent: ${piId}`);
          try {
            const pi = await stripe.paymentIntents.retrieve(piId, {
              expand: ['charges'],
            });
            
            console.log(`      Status: ${pi.status}`);
            console.log(`      Amount: $${(pi.amount / 100).toFixed(2)} ${pi.currency.toUpperCase()}`);
            console.log(`      Created: ${new Date(pi.created * 1000).toISOString()}`);
            console.log(`      Customer: ${pi.customer || 'N/A'}`);
            console.log(`      Receipt Email: ${pi.receipt_email || 'N/A'}`);
            
            if (pi.metadata) {
              console.log(`\n      Metadata:`);
              Object.entries(pi.metadata).forEach(([key, value]) => {
                console.log(`         ${key}: ${value}`);
              });
            }

            // Check database
            console.log(`\n      🔍 Database Registration:`);
            const registration = await prisma.tournamentRegistration.findFirst({
              where: {
                paymentId: pi.id,
              },
              include: {
                player: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
                tournament: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            });

            if (registration) {
              console.log(`         ✅ Found: ${registration.id}`);
              console.log(`            Player: ${registration.player.firstName || ''} ${registration.player.lastName || ''}`.trim() || 'N/A');
              console.log(`            Email: ${registration.player.email || 'No email'}`);
              console.log(`            Tournament: ${registration.tournament.name}`);
              console.log(`            Status: ${registration.status}`);
              console.log(`            Payment Status: ${registration.paymentStatus}`);
              console.log(`            Amount Paid: $${((registration.amountPaid || 0) / 100).toFixed(2)}`);
            } else {
              // Check notes
              const inNotes = await prisma.tournamentRegistration.findMany({
                where: {
                  notes: {
                    contains: pi.id,
                  },
                },
                include: {
                  player: {
                    select: {
                      email: true,
                    },
                  },
                  tournament: {
                    select: {
                      name: true,
                    },
                  },
                },
                take: 3,
              });

              if (inNotes.length > 0) {
                console.log(`         ⚠️  Found in notes (${inNotes.length}):`);
                inNotes.forEach(reg => {
                  console.log(`            - ${reg.id} - ${reg.player.email || 'No email'} - ${reg.tournament.name}`);
                });
              } else {
                console.log(`         ❌ Not found in database`);
              }
            }
          } catch (e: any) {
            console.log(`      ⚠️  Error retrieving payment intent: ${e.message}`);
          }
        }
      }
    } else {
      console.log(`\n❌ No charges found with payment method ${paymentMethodId}`);
      
      // List recent charges for reference
      console.log(`\n   Recent charges (first 20) for reference:`);
      for (let i = 0; i < Math.min(allCharges.length, 20); i++) {
        const charge = allCharges[i];
        console.log(`   ${i + 1}. ${charge.id} - $${(charge.amount / 100).toFixed(2)} - ${charge.status} - PM: ${charge.payment_method || 'N/A'}`);
      }
    }

  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: npx tsx scripts/search-charges-by-pm.ts <paymentMethodId>');
  process.exit(1);
}

searchChargesByPaymentMethod(args[0]);

