import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

// Initialize Stripe - use STRIPE_SECRET_KEY from environment
const stripeKey = process.env.STRIPE_SECRET_KEY;

if (!stripeKey) {
  console.error('STRIPE_SECRET_KEY not found in environment variables');
  process.exit(1);
}

const isLiveKey = stripeKey.startsWith('sk_live_');
console.log(`Using ${isLiveKey ? 'LIVE' : 'TEST'} Stripe key: ${stripeKey.substring(0, 20)}...`);

const stripe = new Stripe(stripeKey, {
  apiVersion: '2024-12-18.acacia',
});

interface PaymentComparison {
  registrationId: string;
  playerEmail: string;
  playerName: string;
  tournamentName: string;
  stripePaymentIntentId: string | null;
  stripeAmount: number | null; // in cents
  appAmount: number | null; // in cents (amountPaid)
  difference: number | null;
  stripeStatus: string | null;
  appPaymentStatus: string;
  stripeCreated: Date | null;
  appRegisteredAt: Date;
  notes: any;
}

async function comparePayments() {
  console.log('\n' + '='.repeat(80));
  console.log('COMPARING STRIPE PAYMENTS WITH APP PAYMENT RECORDS');
  console.log('='.repeat(80));

  try {
    // Fetch all paid registrations from the app
    const registrations = await prisma.tournamentRegistration.findMany({
      where: {
        paymentStatus: {
          in: ['PAID', 'COMPLETED'],
        },
        paymentId: {
          not: null,
        },
      },
      include: {
        player: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        tournament: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        registeredAt: 'desc',
      },
    });

    console.log(`\nFound ${registrations.length} paid registrations in the app\n`);

    const comparisons: PaymentComparison[] = [];
    const errors: Array<{ registrationId: string; error: string }> = [];

    // Process each registration
    for (const reg of registrations) {
      const paymentIntentId = reg.paymentId;
      
      if (!paymentIntentId) {
        continue;
      }

      try {
        // Fetch payment intent from Stripe
        let stripePayment: Stripe.PaymentIntent | null = null;
        try {
          stripePayment = await stripe.paymentIntents.retrieve(paymentIntentId);
        } catch (stripeError: any) {
          if (stripeError.code === 'resource_missing') {
            errors.push({
              registrationId: reg.id,
              error: `Payment intent ${paymentIntentId} not found in Stripe`,
            });
            continue;
          }
          throw stripeError;
        }

        const playerName = reg.player.firstName && reg.player.lastName
          ? `${reg.player.firstName} ${reg.player.lastName}`
          : reg.player.email || 'Unknown';

        // Parse notes if available
        let notes: any = {};
        if (reg.notes) {
          try {
            notes = JSON.parse(reg.notes);
          } catch (e) {
            // Ignore parse errors
          }
        }

        const comparison: PaymentComparison = {
          registrationId: reg.id,
          playerEmail: reg.player.email || 'No email',
          playerName,
          tournamentName: reg.tournament.name,
          stripePaymentIntentId: paymentIntentId,
          stripeAmount: stripePayment.amount,
          appAmount: reg.amountPaid,
          difference: reg.amountPaid !== null && stripePayment.amount !== null
            ? reg.amountPaid - stripePayment.amount
            : null,
          stripeStatus: stripePayment.status,
          appPaymentStatus: reg.paymentStatus,
          stripeCreated: new Date(stripePayment.created * 1000),
          appRegisteredAt: reg.registeredAt,
          notes,
        };

        comparisons.push(comparison);
      } catch (error: any) {
        errors.push({
          registrationId: reg.id,
          error: error.message || 'Unknown error',
        });
      }
    }

    // Report results
    console.log('\n' + '='.repeat(80));
    console.log('PAYMENT COMPARISON RESULTS');
    console.log('='.repeat(80));

    // Find discrepancies
    const discrepancies = comparisons.filter(c => {
      if (c.difference === null) return false;
      return Math.abs(c.difference) > 0; // Any difference
    });

    if (discrepancies.length > 0) {
      console.log(`\n⚠️  Found ${discrepancies.length} payment discrepancies:\n`);
      
      discrepancies.forEach((c, idx) => {
        console.log(`\n${idx + 1}. DISCREPANCY FOUND:`);
        console.log(`   Registration ID: ${c.registrationId}`);
        console.log(`   Player: ${c.playerName} (${c.playerEmail})`);
        console.log(`   Tournament: ${c.tournamentName}`);
        console.log(`   Payment Intent: ${c.stripePaymentIntentId}`);
        console.log(`   Stripe Amount: $${((c.stripeAmount || 0) / 100).toFixed(2)} (${c.stripeAmount} cents)`);
        console.log(`   App Amount: $${((c.appAmount || 0) / 100).toFixed(2)} (${c.appAmount} cents)`);
        console.log(`   Difference: $${((c.difference || 0) / 100).toFixed(2)} (${c.difference} cents)`);
        console.log(`   Stripe Status: ${c.stripeStatus}`);
        console.log(`   App Status: ${c.appPaymentStatus}`);
        console.log(`   Stripe Created: ${c.stripeCreated?.toISOString()}`);
        console.log(`   App Registered: ${c.appRegisteredAt.toISOString()}`);
        
        if (c.notes.stopIds) {
          console.log(`   Stops in Registration: ${JSON.stringify(c.notes.stopIds)}`);
        }
        if (c.notes.newlySelectedStopIds) {
          console.log(`   Newly Selected Stops: ${JSON.stringify(c.notes.newlySelectedStopIds)}`);
        }
        if (c.notes.expectedAmount) {
          console.log(`   Expected Amount (from notes): $${c.notes.expectedAmount.toFixed(2)}`);
        }
        if (c.notes.newStopsTotal) {
          console.log(`   New Stops Total (from notes): $${c.notes.newStopsTotal.toFixed(2)}`);
        }
        if (c.notes.existingAmountPaid) {
          console.log(`   Existing Amount Paid (from notes): $${(c.notes.existingAmountPaid / 100).toFixed(2)}`);
        }
      });
    } else {
      console.log('\n✅ No payment discrepancies found! All Stripe payments match app records.');
    }

    // Summary statistics
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY STATISTICS');
    console.log('='.repeat(80));
    console.log(`Total registrations checked: ${comparisons.length}`);
    console.log(`Registrations with discrepancies: ${discrepancies.length}`);
    console.log(`Registrations with errors: ${errors.length}`);
    
    if (comparisons.length > 0) {
      const totalStripeAmount = comparisons.reduce((sum, c) => sum + (c.stripeAmount || 0), 0);
      const totalAppAmount = comparisons.reduce((sum, c) => sum + (c.appAmount || 0), 0);
      const totalDifference = totalAppAmount - totalStripeAmount;
      
      console.log(`\nTotal Stripe Amount: $${(totalStripeAmount / 100).toFixed(2)}`);
      console.log(`Total App Amount: $${(totalAppAmount / 100).toFixed(2)}`);
      console.log(`Total Difference: $${(totalDifference / 100).toFixed(2)}`);
    }

    // Report errors
    if (errors.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('ERRORS ENCOUNTERED');
      console.log('='.repeat(80));
      errors.forEach((e, idx) => {
        console.log(`\n${idx + 1}. Registration ${e.registrationId}: ${e.error}`);
      });
    }

    // Export discrepancies to CSV
    if (discrepancies.length > 0) {
      const csvRows = [
        [
          'Registration ID',
          'Player Name',
          'Player Email',
          'Tournament',
          'Payment Intent ID',
          'Stripe Amount (cents)',
          'App Amount (cents)',
          'Difference (cents)',
          'Stripe Status',
          'App Status',
          'Stripe Created',
          'App Registered',
        ].join(','),
        ...discrepancies.map(c => [
          c.registrationId,
          `"${c.playerName}"`,
          c.playerEmail,
          `"${c.tournamentName}"`,
          c.stripePaymentIntentId || '',
          c.stripeAmount?.toString() || '',
          c.appAmount?.toString() || '',
          c.difference?.toString() || '',
          c.stripeStatus || '',
          c.appPaymentStatus,
          c.stripeCreated?.toISOString() || '',
          c.appRegisteredAt.toISOString(),
        ].join(',')),
      ];

      const fs = await import('fs');
      const csvPath = 'payment-discrepancies.csv';
      fs.writeFileSync(csvPath, csvRows.join('\n'));
      console.log(`\n📄 Discrepancies exported to: ${csvPath}`);
    }

  } catch (error: any) {
    console.error('\n❌ Error comparing payments:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

comparePayments();

