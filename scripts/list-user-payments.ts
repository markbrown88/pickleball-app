import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' })
  : null;

async function listUserPayments(userEmail: string, paymentMethodId?: string) {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`LISTING ALL PAYMENTS FOR: ${userEmail}`);
    if (paymentMethodId) {
      console.log(`SEARCHING FOR PAYMENT METHOD: ${paymentMethodId}`);
    }
    console.log('='.repeat(80));

    if (!stripe) {
      console.log(`\n❌ STRIPE_SECRET_KEY not configured`);
      return;
    }

    // Find player
    const player = await prisma.player.findFirst({
      where: { email: userEmail },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    if (!player) {
      console.log(`\n❌ No player found with email: ${userEmail}`);
      return;
    }

    console.log(`\n👤 Player: ${player.firstName || ''} ${player.lastName || ''}`.trim() || 'N/A');
    console.log(`   Email: ${player.email}`);

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

    console.log(`   Found ${allPaymentIntents.length} total payment intents`);

    // Filter by email
    const userPIs = allPaymentIntents.filter(pi => {
      if (pi.receipt_email === userEmail) return true;
      if (pi.metadata && Object.values(pi.metadata).some(v => 
        typeof v === 'string' && v.toLowerCase().includes(userEmail.toLowerCase())
      )) return true;
      
      // Check charges
      if (pi.charges?.data) {
        return pi.charges.data.some((charge: any) => {
          if (charge.billing_details?.email === userEmail) return true;
          if (charge.receipt_email === userEmail) return true;
          return false;
        });
      }
      return false;
    });

    console.log(`\n✅ Found ${userPIs.length} payment intent(s) for ${userEmail}:\n`);

    for (let i = 0; i < userPIs.length; i++) {
      const pi = userPIs[i];
      
      // Expand charges to get full details
      const fullPI = await stripe.paymentIntents.retrieve(pi.id, {
        expand: ['charges'],
      });

      console.log(`${'─'.repeat(80)}`);
      console.log(`PAYMENT INTENT ${i + 1}/${userPIs.length}: ${fullPI.id}`);
      console.log('─'.repeat(80));
      
      console.log(`\n💳 Payment Intent Details:`);
      console.log(`   Status: ${fullPI.status}`);
      console.log(`   Amount: $${(fullPI.amount / 100).toFixed(2)} ${fullPI.currency.toUpperCase()}`);
      console.log(`   Created: ${new Date(fullPI.created * 1000).toISOString()}`);
      console.log(`   Customer: ${fullPI.customer || 'N/A'}`);
      console.log(`   Receipt Email: ${fullPI.receipt_email || 'N/A'}`);
      console.log(`   Payment Method: ${typeof fullPI.payment_method === 'string' ? fullPI.payment_method : fullPI.payment_method?.id || 'N/A'}`);
      
      if (fullPI.metadata) {
        console.log(`\n   Metadata:`);
        Object.entries(fullPI.metadata).forEach(([key, value]) => {
          console.log(`      ${key}: ${value}`);
        });
      }

      // Check charges
      if (fullPI.charges && fullPI.charges.data.length > 0) {
        console.log(`\n   Charges (${fullPI.charges.data.length}):`);
        for (const charge of fullPI.charges.data) {
          console.log(`      - Charge ID: ${charge.id}`);
          console.log(`        Amount: $${(charge.amount / 100).toFixed(2)}`);
          console.log(`        Status: ${charge.status}`);
          console.log(`        Payment Method: ${charge.payment_method || 'N/A'}`);
          
          if (paymentMethodId && charge.payment_method === paymentMethodId) {
            console.log(`        ✅ MATCHES PAYMENT METHOD ID!`);
          }
          
          if (charge.billing_details) {
            console.log(`        Billing Email: ${charge.billing_details.email || 'N/A'}`);
            console.log(`        Billing Name: ${charge.billing_details.name || 'N/A'}`);
          }
          if (charge.receipt_url) {
            console.log(`        Receipt URL: ${charge.receipt_url}`);
          }
          if (charge.receipt_email) {
            console.log(`        Receipt Email: ${charge.receipt_email}`);
          }
        }
      }

      // Check database
      console.log(`\n   🔍 Database Registration:`);
      const registration = await prisma.tournamentRegistration.findFirst({
        where: {
          paymentId: fullPI.id,
        },
        include: {
          tournament: {
            select: {
              name: true,
            },
          },
        },
      });

      if (registration) {
        console.log(`      ✅ Found: ${registration.id}`);
        console.log(`         Tournament: ${registration.tournament.name}`);
        console.log(`         Status: ${registration.status}`);
        console.log(`         Payment Status: ${registration.paymentStatus}`);
        console.log(`         Amount Paid: $${((registration.amountPaid || 0) / 100).toFixed(2)}`);
      } else {
        // Check notes
        const inNotes = await prisma.tournamentRegistration.findMany({
          where: {
            notes: {
              contains: fullPI.id,
            },
          },
          include: {
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
            console.log(`         - ${reg.id} - ${reg.tournament.name}`);
          });
        } else {
          console.log(`      ❌ Not found in database`);
        }
      }
    }

    // Summary
    console.log(`\n${'='.repeat(80)}`);
    console.log(`SUMMARY`);
    console.log('='.repeat(80));
    console.log(`Total Payment Intents Found: ${userPIs.length}`);
    
    if (paymentMethodId) {
      const matchingPM = userPIs.filter(pi => {
        if (pi.payment_method === paymentMethodId) return true;
        if (typeof pi.payment_method === 'object' && pi.payment_method?.id === paymentMethodId) return true;
        if (pi.charges?.data.some((c: any) => c.payment_method === paymentMethodId)) return true;
        return false;
      });
      console.log(`Payment Intents with Payment Method ${paymentMethodId}: ${matchingPM.length}`);
      if (matchingPM.length === 0) {
        console.log(`\n⚠️  Payment Method ID ${paymentMethodId} not found in any payment intents for this user.`);
        console.log(`   This could mean:`);
        console.log(`   - The payment method is from a different Stripe account (test vs live)`);
        console.log(`   - The payment method ID is incorrect`);
        console.log(`   - The payment was made through a different method`);
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
  console.error('Usage: npx tsx scripts/list-user-payments.ts <userEmail> [paymentMethodId]');
  process.exit(1);
}

listUserPayments(args[0], args[1]);

