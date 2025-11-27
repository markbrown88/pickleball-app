import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' })
  : null;

async function searchPaymentByMethod(paymentMethodId: string, userEmail: string) {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`SEARCHING FOR PAYMENTS`);
    console.log(`Payment Method ID: ${paymentMethodId}`);
    console.log(`User Email: ${userEmail}`);
    console.log('='.repeat(80));

    if (!stripe) {
      console.log(`\n❌ STRIPE_SECRET_KEY not configured`);
      return;
    }

    // First, find the player in database
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
    console.log(`   Player ID: ${player.id}`);

    // Search all payment intents for this email
    console.log(`\n🔍 Searching Stripe Payment Intents for email: ${userEmail}...`);
    
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
        console.log(`   ⚠️  Error fetching payment intents: ${e.message}`);
        hasMore = false;
      }
    }

    console.log(`   Found ${allPaymentIntents.length} total payment intents in Stripe`);

    // Filter payment intents by email or payment method
    const matchingPIs = allPaymentIntents.filter(pi => {
      // Check receipt email
      if (pi.receipt_email === userEmail) return true;
      
      // Check metadata for email
      if (pi.metadata) {
        const metadataValues = Object.values(pi.metadata);
        if (metadataValues.some(v => typeof v === 'string' && v.toLowerCase().includes(userEmail.toLowerCase()))) {
          return true;
        }
      }

      // Check payment method
      if (pi.payment_method === paymentMethodId) return true;
      if (typeof pi.payment_method === 'object' && pi.payment_method?.id === paymentMethodId) return true;

      // Check charges
      if (pi.charges?.data) {
        return pi.charges.data.some((charge: any) => {
          if (charge.payment_method === paymentMethodId) return true;
          if (charge.billing_details?.email === userEmail) return true;
          return false;
        });
      }

      return false;
    });

    console.log(`\n✅ Found ${matchingPIs.length} matching payment intent(s):\n`);

    for (let i = 0; i < matchingPIs.length; i++) {
      const pi = matchingPIs[i];
      console.log(`${'─'.repeat(80)}`);
      console.log(`PAYMENT INTENT ${i + 1}/${matchingPIs.length}: ${pi.id}`);
      console.log('─'.repeat(80));
      
      console.log(`\n💳 Stripe Details:`);
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

      // Get charges with full details
      if (pi.charges && pi.charges.data.length > 0) {
        console.log(`\n   Charges:`);
        for (const charge of pi.charges.data) {
          console.log(`      - ${charge.id}`);
          console.log(`        Amount: $${(charge.amount / 100).toFixed(2)}`);
          console.log(`        Status: ${charge.status}`);
          console.log(`        Payment Method: ${charge.payment_method || 'N/A'}`);
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

      // Search database
      console.log(`\n   🔍 Database Search:`);
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
        console.log(`      ✅ Found registration: ${registration.id}`);
        console.log(`         Player: ${registration.player.firstName || ''} ${registration.player.lastName || ''}`.trim() || 'N/A');
        console.log(`         Email: ${registration.player.email || 'No email'}`);
        console.log(`         Tournament: ${registration.tournament.name}`);
        console.log(`         Status: ${registration.status}`);
        console.log(`         Payment Status: ${registration.paymentStatus}`);
        console.log(`         Amount Paid: $${((registration.amountPaid || 0) / 100).toFixed(2)}`);
        console.log(`         Registered At: ${registration.registeredAt.toISOString()}`);
        if (registration.paidAt) {
          console.log(`         Paid At: ${registration.paidAt.toISOString()}`);
        }
      } else {
        // Search in notes
        const registrationsInNotes = await prisma.tournamentRegistration.findMany({
          where: {
            notes: {
              contains: pi.id,
            },
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
          take: 5,
        });

        if (registrationsInNotes.length > 0) {
          console.log(`      ⚠️  Found ${registrationsInNotes.length} registration(s) with this payment intent in notes:`);
          registrationsInNotes.forEach((reg, idx) => {
            console.log(`         ${idx + 1}. ${reg.id}`);
            console.log(`            Player: ${reg.player.firstName || ''} ${reg.player.lastName || ''}`.trim() || 'N/A');
            console.log(`            Email: ${reg.player.email || 'No email'}`);
            console.log(`            Tournament: ${reg.tournament.name}`);
            console.log(`            Payment Status: ${reg.paymentStatus}`);
            console.log(`            Amount Paid: $${((reg.amountPaid || 0) / 100).toFixed(2)}`);
          });
        } else {
          console.log(`      ❌ No registration found in database`);
          console.log(`      ⚠️  This payment intent exists in Stripe but is not linked to any registration!`);
        }
      }
    }

    // Also search database for any references to the payment method ID
    console.log(`\n${'='.repeat(80)}`);
    console.log(`DATABASE SEARCH FOR PAYMENT METHOD ID`);
    console.log('='.repeat(80));
    
    const registrationsWithPM = await prisma.tournamentRegistration.findMany({
      where: {
        OR: [
          { paymentId: { contains: paymentMethodId } },
          { notes: { contains: paymentMethodId } },
        ],
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
      take: 10,
    });

    if (registrationsWithPM.length > 0) {
      console.log(`\n✅ Found ${registrationsWithPM.length} registration(s) with payment method ID in database:`);
      registrationsWithPM.forEach((reg, idx) => {
        console.log(`\n   ${idx + 1}. Registration: ${reg.id}`);
        console.log(`      Player: ${reg.player.firstName || ''} ${reg.player.lastName || ''}`.trim() || 'N/A');
        console.log(`      Email: ${reg.player.email || 'No email'}`);
        console.log(`      Tournament: ${reg.tournament.name}`);
        console.log(`      Payment ID: ${reg.paymentId || 'None'}`);
        console.log(`      Amount Paid: $${((reg.amountPaid || 0) / 100).toFixed(2)}`);
      });
    } else {
      console.log(`\n❌ No registrations found with payment method ID in database`);
    }

  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: npx tsx scripts/search-payment-by-method.ts <paymentMethodId> <userEmail>');
  process.exit(1);
}

searchPaymentByMethod(args[0], args[1]);

