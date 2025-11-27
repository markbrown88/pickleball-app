import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' })
  : null;

async function listAllPaymentsCheckPM(paymentMethodId: string) {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`LISTING ALL PAYMENT INTENTS`);
    console.log(`SEARCHING FOR PAYMENT METHOD: ${paymentMethodId}`);
    console.log('='.repeat(80));

    if (!stripe) {
      console.log(`\n❌ STRIPE_SECRET_KEY not configured`);
      return;
    }

    // Get all payment intents
    console.log(`\n🔍 Fetching all Stripe Payment Intents...`);
    
    let allPaymentIntents: Stripe.PaymentIntent[] = [];
    let hasMore = true;
    let startingAfter: string | undefined = undefined;

    while (hasMore) {
      const params: Stripe.PaymentIntentListParams = {
        limit: 100,
      };
      if (startingAfter) {
        params.starting_after = startingAfter;
      }

      try {
        const response = await stripe.paymentIntents.list(params);
        allPaymentIntents = allPaymentIntents.concat(response.data);
        
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

    console.log(`   Found ${allPaymentIntents.length} total payment intents\n`);

    // Check each payment intent for the payment method
    const matchingPIs: Array<{ pi: Stripe.PaymentIntent; charge?: any }> = [];

    for (const pi of allPaymentIntents) {
      // Expand to get charges
      const fullPI = await stripe.paymentIntents.retrieve(pi.id, {
        expand: ['charges'],
      });

      // Check payment method on payment intent
      if (fullPI.payment_method === paymentMethodId) {
        matchingPIs.push({ pi: fullPI });
        continue;
      }
      if (typeof fullPI.payment_method === 'object' && fullPI.payment_method?.id === paymentMethodId) {
        matchingPIs.push({ pi: fullPI });
        continue;
      }

      // Check charges
      if (fullPI.charges && fullPI.charges.data.length > 0) {
        for (const charge of fullPI.charges.data) {
          if (charge.payment_method === paymentMethodId) {
            matchingPIs.push({ pi: fullPI, charge });
            break;
          }
        }
      }
    }

    if (matchingPIs.length > 0) {
      console.log(`✅ Found ${matchingPIs.length} payment intent(s) with payment method ${paymentMethodId}:\n`);

      for (let i = 0; i < matchingPIs.length; i++) {
        const { pi, charge } = matchingPIs[i];
        
        console.log(`${'─'.repeat(80)}`);
        console.log(`PAYMENT INTENT ${i + 1}/${matchingPIs.length}: ${pi.id}`);
        console.log('─'.repeat(80));
        
        console.log(`\n💳 Payment Intent Details:`);
        console.log(`   Status: ${pi.status}`);
        console.log(`   Amount: $${(pi.amount / 100).toFixed(2)} ${pi.currency.toUpperCase()}`);
        console.log(`   Created: ${new Date(pi.created * 1000).toISOString()}`);
        console.log(`   Customer: ${pi.customer || 'N/A'}`);
        console.log(`   Receipt Email: ${pi.receipt_email || 'N/A'}`);
        console.log(`   Payment Method: ${typeof pi.payment_method === 'string' ? pi.payment_method : pi.payment_method?.id || 'N/A'}`);
        
        if (pi.metadata) {
          console.log(`\n   Metadata:`);
          Object.entries(pi.metadata).forEach(([key, value]) => {
            console.log(`      ${key}: ${value}`);
          });
        }

        if (charge) {
          console.log(`\n   ✅ Matching Charge:`);
          console.log(`      Charge ID: ${charge.id}`);
          console.log(`      Amount: $${(charge.amount / 100).toFixed(2)}`);
          console.log(`      Status: ${charge.status}`);
          console.log(`      Payment Method: ${charge.payment_method}`);
          if (charge.billing_details) {
            console.log(`      Billing Email: ${charge.billing_details.email || 'N/A'}`);
            console.log(`      Billing Name: ${charge.billing_details.name || 'N/A'}`);
          }
          if (charge.receipt_url) {
            console.log(`      Receipt URL: ${charge.receipt_url}`);
          }
        } else if (pi.charges && pi.charges.data.length > 0) {
          console.log(`\n   Charges:`);
          pi.charges.data.forEach((c: any, idx: number) => {
            console.log(`      ${idx + 1}. ${c.id} - $${(c.amount / 100).toFixed(2)} - ${c.status}`);
            console.log(`         Payment Method: ${c.payment_method || 'N/A'}`);
            if (c.billing_details?.email) {
              console.log(`         Email: ${c.billing_details.email}`);
            }
          });
        }

        // Check database
        console.log(`\n   🔍 Database Registration:`);
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
          console.log(`      ✅ Found: ${registration.id}`);
          console.log(`         Player: ${registration.player.firstName || ''} ${registration.player.lastName || ''}`.trim() || 'N/A');
          console.log(`         Email: ${registration.player.email || 'No email'}`);
          console.log(`         Tournament: ${registration.tournament.name}`);
          console.log(`         Status: ${registration.status}`);
          console.log(`         Payment Status: ${registration.paymentStatus}`);
          console.log(`         Amount Paid: $${((registration.amountPaid || 0) / 100).toFixed(2)}`);
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
            console.log(`      ⚠️  Found in notes (${inNotes.length}):`);
            inNotes.forEach(reg => {
              console.log(`         - ${reg.id} - ${reg.player.email || 'No email'} - ${reg.tournament.name}`);
            });
          } else {
            console.log(`      ❌ Not found in database`);
          }
        }
      }
    } else {
      console.log(`❌ No payment intents found with payment method ${paymentMethodId}`);
      console.log(`\n   Listing all ${allPaymentIntents.length} payment intents for reference:\n`);
      
      for (let i = 0; i < Math.min(allPaymentIntents.length, 20); i++) {
        const pi = allPaymentIntents[i];
        console.log(`   ${i + 1}. ${pi.id} - $${(pi.amount / 100).toFixed(2)} - ${pi.status} - ${pi.receipt_email || 'No email'}`);
      }
      if (allPaymentIntents.length > 20) {
        console.log(`   ... and ${allPaymentIntents.length - 20} more`);
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
  console.error('Usage: npx tsx scripts/list-all-payments-check-pm.ts <paymentMethodId>');
  process.exit(1);
}

listAllPaymentsCheckPM(args[0]);

