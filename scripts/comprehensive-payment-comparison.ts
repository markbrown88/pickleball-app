import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

// Use STRIPE_SECRET_KEY from environment
const stripeKey = process.env.STRIPE_SECRET_KEY;

if (!stripeKey) {
  console.error('STRIPE_SECRET_KEY not found in environment variables');
  process.exit(1);
}

const stripe = new Stripe(stripeKey, {
  apiVersion: '2024-12-18.acacia',
});

interface PaymentComparison {
  registrationId: string;
  playerEmail: string;
  playerName: string;
  tournamentName: string;
  stripePaymentIntentId: string | null;
  stripeAmount: number | null;
  stripeStatus: string | null;
  stripeCreated: Date | null;
  appAmount: number | null;
  appPaymentStatus: string;
  appRegisteredAt: Date;
  difference: number | null;
  statusMismatch: boolean;
  amountMismatch: boolean;
  notes: any;
}

interface StripeOnlyPayment {
  paymentIntentId: string;
  amount: number;
  status: string;
  created: Date;
  customer: string | null;
  metadata: any;
}

interface AppOnlyRegistration {
  registrationId: string;
  playerEmail: string;
  playerName: string;
  tournamentName: string;
  paymentId: string;
  amountPaid: number;
  paymentStatus: string;
}

async function comprehensiveComparison() {
  console.log('\n' + '='.repeat(80));
  console.log('COMPREHENSIVE STRIPE vs APP PAYMENT COMPARISON');
  console.log('='.repeat(80));

  try {
    // Step 1: Fetch all Stripe payment intents
    console.log('\n📥 Fetching all Stripe payment intents...');
    const stripePayments: StripeOnlyPayment[] = [];
    let hasMore = true;
    let startingAfter: string | undefined = undefined;

    while (hasMore) {
      const listParams: Stripe.PaymentIntentListParams = {
        limit: 100,
      };
      if (startingAfter) {
        listParams.starting_after = startingAfter;
      }

      const paymentIntents = await stripe.paymentIntents.list(listParams);
      
      for (const pi of paymentIntents.data) {
        // Only include payments related to registrations (check metadata or amount > 0)
        if (pi.amount > 0) {
          stripePayments.push({
            paymentIntentId: pi.id,
            amount: pi.amount,
            status: pi.status,
            created: new Date(pi.created * 1000),
            customer: typeof pi.customer === 'string' ? pi.customer : null,
            metadata: pi.metadata,
          });
        }
      }

      hasMore = paymentIntents.has_more;
      if (hasMore && paymentIntents.data.length > 0) {
        startingAfter = paymentIntents.data[paymentIntents.data.length - 1].id;
      } else {
        hasMore = false;
      }
    }

    console.log(`   Found ${stripePayments.length} Stripe payment intents`);

    // Step 2: Fetch all app registrations with payments
    console.log('\n📥 Fetching all app registrations with payments...');
    const registrations = await prisma.tournamentRegistration.findMany({
      where: {
        OR: [
          { paymentId: { not: null } },
          { paymentStatus: { in: ['PAID', 'FAILED', 'PENDING', 'COMPLETED'] } },
        ],
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

    console.log(`   Found ${registrations.length} app registrations with payments`);

    // Step 3: Build comparison map
    console.log('\n🔍 Comparing payments...');
    const comparisons: PaymentComparison[] = [];
    const stripeOnlyPayments: StripeOnlyPayment[] = [];
    const appOnlyRegistrations: AppOnlyRegistration[] = [];
    const stripePaymentMap = new Map<string, StripeOnlyPayment>();

    // Map Stripe payments by ID
    for (const sp of stripePayments) {
      stripePaymentMap.set(sp.paymentIntentId, sp);
    }

    // Compare app registrations with Stripe
    for (const reg of registrations) {
      const paymentId = reg.paymentId;
      if (!paymentId) {
        // App registration without payment ID - might be manual or free
        continue;
      }

      const stripePayment = stripePaymentMap.get(paymentId);
      const playerName = reg.player.firstName && reg.player.lastName
        ? `${reg.player.firstName} ${reg.player.lastName}`
        : reg.player.email || 'Unknown';

      // Parse notes
      let notes: any = {};
      if (reg.notes) {
        try {
          notes = JSON.parse(reg.notes);
        } catch (e) {
          // Ignore parse errors
        }
      }

      if (stripePayment) {
        // Found matching payment in Stripe
        const difference = reg.amountPaid !== null && stripePayment.amount !== null
          ? reg.amountPaid - stripePayment.amount
          : null;

        const statusMismatch = 
          (stripePayment.status === 'succeeded' && reg.paymentStatus !== 'PAID' && reg.paymentStatus !== 'COMPLETED') ||
          (stripePayment.status === 'requires_payment_method' && reg.paymentStatus === 'PAID') ||
          (stripePayment.status === 'canceled' && reg.paymentStatus === 'PAID');

        const amountMismatch = difference !== null && Math.abs(difference) > 0;

        comparisons.push({
          registrationId: reg.id,
          playerEmail: reg.player.email || 'No email',
          playerName,
          tournamentName: reg.tournament.name,
          stripePaymentIntentId: paymentId,
          stripeAmount: stripePayment.amount,
          stripeStatus: stripePayment.status,
          stripeCreated: stripePayment.created,
          appAmount: reg.amountPaid,
          appPaymentStatus: reg.paymentStatus,
          appRegisteredAt: reg.registeredAt,
          difference,
          statusMismatch,
          amountMismatch,
          notes,
        });

        // Remove from map so we can track Stripe-only payments later
        stripePaymentMap.delete(paymentId);
      } else {
        // App registration with payment ID but not found in Stripe
        appOnlyRegistrations.push({
          registrationId: reg.id,
          playerEmail: reg.player.email || 'No email',
          playerName,
          tournamentName: reg.tournament.name,
          paymentId,
          amountPaid: reg.amountPaid || 0,
          paymentStatus: reg.paymentStatus,
        });
      }
    }

    // Remaining Stripe payments are Stripe-only (not in app)
    for (const [paymentId, payment] of stripePaymentMap.entries()) {
      // Check if this payment might be for a registration (check metadata)
      const registrationId = payment.metadata?.registrationId || payment.metadata?.client_reference_id;
      if (!registrationId) {
        // Might be a test payment or unrelated payment
        continue;
      }
      stripeOnlyPayments.push(payment);
    }

    // Step 4: Report results
    console.log('\n' + '='.repeat(80));
    console.log('COMPARISON RESULTS');
    console.log('='.repeat(80));

    // Status mismatches
    const statusMismatches = comparisons.filter(c => c.statusMismatch);
    console.log(`\n⚠️  STATUS MISMATCHES: ${statusMismatches.length}`);
    if (statusMismatches.length > 0) {
      statusMismatches.forEach((c, idx) => {
        console.log(`\n${idx + 1}. ${c.playerName} (${c.playerEmail})`);
        console.log(`   Registration: ${c.registrationId}`);
        console.log(`   Payment Intent: ${c.stripePaymentIntentId}`);
        console.log(`   Stripe Status: ${c.stripeStatus}`);
        console.log(`   App Status: ${c.appPaymentStatus}`);
        console.log(`   Tournament: ${c.tournamentName}`);
      });
    }

    // Amount mismatches
    const amountMismatches = comparisons.filter(c => c.amountMismatch);
    console.log(`\n💰 AMOUNT MISMATCHES: ${amountMismatches.length}`);
    if (amountMismatches.length > 0) {
      amountMismatches.forEach((c, idx) => {
        console.log(`\n${idx + 1}. ${c.playerName} (${c.playerEmail})`);
        console.log(`   Registration: ${c.registrationId}`);
        console.log(`   Payment Intent: ${c.stripePaymentIntentId}`);
        console.log(`   Stripe Amount: $${((c.stripeAmount || 0) / 100).toFixed(2)} (${c.stripeAmount} cents)`);
        console.log(`   App Amount: $${((c.appAmount || 0) / 100).toFixed(2)} (${c.appAmount} cents)`);
        console.log(`   Difference: $${((c.difference || 0) / 100).toFixed(2)} (${c.difference} cents)`);
        console.log(`   Stripe Status: ${c.stripeStatus}`);
        console.log(`   App Status: ${c.appPaymentStatus}`);
        if (c.notes.existingAmountPaid) {
          console.log(`   Existing Amount (from notes): $${(c.notes.existingAmountPaid / 100).toFixed(2)}`);
        }
        if (c.notes.newStopsTotal) {
          console.log(`   New Stops Total (from notes): $${c.notes.newStopsTotal.toFixed(2)}`);
        }
      });
    }

    // Both status and amount mismatches
    const bothMismatches = comparisons.filter(c => c.statusMismatch && c.amountMismatch);
    console.log(`\n🔴 BOTH STATUS AND AMOUNT MISMATCHES: ${bothMismatches.length}`);
    if (bothMismatches.length > 0) {
      bothMismatches.forEach((c, idx) => {
        console.log(`\n${idx + 1}. ${c.playerName} (${c.playerEmail})`);
        console.log(`   Registration: ${c.registrationId}`);
        console.log(`   Payment Intent: ${c.stripePaymentIntentId}`);
        console.log(`   Stripe: ${c.stripeStatus} - $${((c.stripeAmount || 0) / 100).toFixed(2)}`);
        console.log(`   App: ${c.appPaymentStatus} - $${((c.appAmount || 0) / 100).toFixed(2)}`);
        console.log(`   Difference: $${((c.difference || 0) / 100).toFixed(2)}`);
      });
    }

    // App-only registrations (have payment ID but not in Stripe)
    console.log(`\n📱 APP-ONLY REGISTRATIONS: ${appOnlyRegistrations.length}`);
    if (appOnlyRegistrations.length > 0) {
      console.log(`   (These have payment IDs but payments not found in Stripe)`);
      appOnlyRegistrations.slice(0, 10).forEach((r, idx) => {
        console.log(`\n${idx + 1}. ${r.playerName} (${r.playerEmail})`);
        console.log(`   Registration: ${r.registrationId}`);
        console.log(`   Payment ID: ${r.paymentId}`);
        console.log(`   Status: ${r.paymentStatus}`);
        console.log(`   Amount: $${(r.amountPaid / 100).toFixed(2)}`);
      });
      if (appOnlyRegistrations.length > 10) {
        console.log(`\n   ... and ${appOnlyRegistrations.length - 10} more`);
      }
    }

    // Stripe-only payments (in Stripe but not in app)
    console.log(`\n💳 STRIPE-ONLY PAYMENTS: ${stripeOnlyPayments.length}`);
    if (stripeOnlyPayments.length > 0) {
      console.log(`   (These are in Stripe but not linked to app registrations)`);
      stripeOnlyPayments.slice(0, 10).forEach((p, idx) => {
        console.log(`\n${idx + 1}. Payment Intent: ${p.paymentIntentId}`);
        console.log(`   Amount: $${(p.amount / 100).toFixed(2)}`);
        console.log(`   Status: ${p.status}`);
        console.log(`   Created: ${p.created.toISOString()}`);
        if (p.metadata?.registrationId) {
          console.log(`   Metadata Registration ID: ${p.metadata.registrationId}`);
        }
      });
      if (stripeOnlyPayments.length > 10) {
        console.log(`\n   ... and ${stripeOnlyPayments.length - 10} more`);
      }
    }

    // Summary statistics
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY STATISTICS');
    console.log('='.repeat(80));
    console.log(`Total Stripe payments: ${stripePayments.length}`);
    console.log(`Total app registrations with payments: ${registrations.length}`);
    console.log(`Matched payments: ${comparisons.length}`);
    console.log(`Status mismatches: ${statusMismatches.length}`);
    console.log(`Amount mismatches: ${amountMismatches.length}`);
    console.log(`Both mismatches: ${bothMismatches.length}`);
    console.log(`App-only registrations: ${appOnlyRegistrations.length}`);
    console.log(`Stripe-only payments: ${stripeOnlyPayments.length}`);

    if (comparisons.length > 0) {
      const totalStripeAmount = comparisons.reduce((sum, c) => sum + (c.stripeAmount || 0), 0);
      const totalAppAmount = comparisons.reduce((sum, c) => sum + (c.appAmount || 0), 0);
      const totalDifference = totalAppAmount - totalStripeAmount;
      
      console.log(`\n💰 Total Amounts:`);
      console.log(`   Total Stripe Amount: $${(totalStripeAmount / 100).toFixed(2)}`);
      console.log(`   Total App Amount: $${(totalAppAmount / 100).toFixed(2)}`);
      console.log(`   Total Difference: $${(totalDifference / 100).toFixed(2)}`);
    }

    // Export to CSV
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
        'Status Mismatch',
        'Amount Mismatch',
        'Stripe Created',
        'App Registered',
      ].join(','),
      ...comparisons.map(c => [
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
        c.statusMismatch ? 'YES' : 'NO',
        c.amountMismatch ? 'YES' : 'NO',
        c.stripeCreated?.toISOString() || '',
        c.appRegisteredAt.toISOString(),
      ].join(',')),
    ];

    const csvPath = 'comprehensive-payment-comparison.csv';
    fs.writeFileSync(csvPath, csvRows.join('\n'));
    console.log(`\n📄 Full comparison exported to: ${csvPath}`);

    // Export mismatches only
    const mismatchRows = [
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
        'Issue Type',
      ].join(','),
      ...comparisons
        .filter(c => c.statusMismatch || c.amountMismatch)
        .map(c => {
          const issues = [];
          if (c.statusMismatch) issues.push('STATUS');
          if (c.amountMismatch) issues.push('AMOUNT');
          return [
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
            issues.join(' + '),
          ].join(',');
        }),
    ];

    const mismatchPath = 'payment-mismatches-only.csv';
    fs.writeFileSync(mismatchPath, mismatchRows.join('\n'));
    console.log(`📄 Mismatches only exported to: ${mismatchPath}`);

  } catch (error: any) {
    console.error('\n❌ Error during comparison:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

comprehensiveComparison();

