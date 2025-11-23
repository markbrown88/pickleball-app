/**
 * Fix double-counted payment amounts in registrations
 *
 * The bug: registrations were created with amountPaid set to the expected amount,
 * then the webhook added the actual Stripe payment amount, resulting in 2x the correct amount.
 *
 * This script:
 * 1. Finds all PAID registrations
 * 2. Gets the actual Stripe payment amount
 * 3. Corrects amountPaid to match the Stripe amount
 */

import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

const prisma = new PrismaClient();

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY not set');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-10-29.clover',
  typescript: true,
});

interface FixResult {
  registrationId: string;
  tournamentName: string;
  playerName: string;
  oldAmount: number;
  newAmount: number;
  stripeAmount: number;
  fixed: boolean;
  error?: string;
}

async function fixDoubleCountedPayments() {
  console.log('🔧 Fixing Double-Counted Payment Amounts\n');

  // Get all paid registrations
  const registrations = await prisma.tournamentRegistration.findMany({
    where: {
      paymentStatus: 'PAID',
      amountPaid: { not: null },
    },
    include: {
      tournament: {
        select: {
          name: true,
          registrationCost: true,
        },
      },
      player: {
        select: {
          firstName: true,
          lastName: true,
          name: true,
        },
      },
    },
    orderBy: {
      registeredAt: 'desc',
    },
  });

  console.log(`Found ${registrations.length} paid registrations\n`);

  const results: FixResult[] = [];
  let fixedCount = 0;
  let errorCount = 0;

  for (const reg of registrations) {
    const playerName =
      reg.player.name ||
      (reg.player.firstName && reg.player.lastName
        ? `${reg.player.firstName} ${reg.player.lastName}`
        : 'Unknown');

    // Try to find Stripe payment intent
    let stripeAmount: number | null = null;
    let stripePaymentIntentId: string | null = null;

    // First check paymentId field
    if (reg.paymentId) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(reg.paymentId);
        stripeAmount = paymentIntent.amount; // in cents
        stripePaymentIntentId = paymentIntent.id;
      } catch (error) {
        console.error(`Failed to retrieve payment intent ${reg.paymentId}:`, error);
      }
    }

    // If no paymentId, try to find it in notes
    if (!stripePaymentIntentId && reg.notes) {
      try {
        const notes = JSON.parse(reg.notes);
        if (notes.paymentIntentId) {
          const paymentIntent = await stripe.paymentIntents.retrieve(notes.paymentIntentId);
          stripeAmount = paymentIntent.amount; // in cents
          stripePaymentIntentId = paymentIntent.id;
        }
      } catch (error) {
        // Ignore
      }
    }

    if (!stripeAmount) {
      results.push({
        registrationId: reg.id,
        tournamentName: reg.tournament.name,
        playerName,
        oldAmount: reg.amountPaid || 0,
        newAmount: reg.amountPaid || 0,
        stripeAmount: 0,
        fixed: false,
        error: 'No Stripe payment found',
      });
      errorCount++;
      continue;
    }

    // Check if amount needs fixing
    // If amountPaid is 2x the Stripe amount (or close to it), fix it
    const currentAmount = reg.amountPaid || 0;
    const needsFix = Math.abs(currentAmount - stripeAmount * 2) < 100; // Within $1.00 difference

    if (needsFix) {
      try {
        // Update to correct amount
        await prisma.tournamentRegistration.update({
          where: { id: reg.id },
          data: {
            amountPaid: stripeAmount,
          },
        });

        results.push({
          registrationId: reg.id,
          tournamentName: reg.tournament.name,
          playerName,
          oldAmount: currentAmount,
          newAmount: stripeAmount,
          stripeAmount,
          fixed: true,
        });

        fixedCount++;
        console.log(`✅ Fixed ${playerName} - ${reg.tournament.name}`);
        console.log(`   Old: $${(currentAmount / 100).toFixed(2)} → New: $${(stripeAmount / 100).toFixed(2)}`);
      } catch (error) {
        results.push({
          registrationId: reg.id,
          tournamentName: reg.tournament.name,
          playerName,
          oldAmount: currentAmount,
          newAmount: stripeAmount,
          stripeAmount,
          fixed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        errorCount++;
        console.log(`❌ Failed to fix ${playerName} - ${reg.tournament.name}: ${error}`);
      }
    } else {
      // Amount is correct, no fix needed
      results.push({
        registrationId: reg.id,
        tournamentName: reg.tournament.name,
        playerName,
        oldAmount: currentAmount,
        newAmount: currentAmount,
        stripeAmount,
        fixed: false,
        error: 'Amount already correct',
      });
    }
  }

  console.log('\n' + '='.repeat(100));
  console.log('SUMMARY');
  console.log('='.repeat(100));
  console.log(`Total Registrations: ${registrations.length}`);
  console.log(`Fixed: ${fixedCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Already Correct: ${registrations.length - fixedCount - errorCount}`);
  console.log('='.repeat(100));

  // Calculate total money corrected
  const totalCorrected = results
    .filter((r) => r.fixed)
    .reduce((sum, r) => sum + (r.oldAmount - r.newAmount), 0);

  console.log(`\nTotal Amount Corrected: $${(totalCorrected / 100).toFixed(2)}`);

  await prisma.$disconnect();
}

fixDoubleCountedPayments().catch((error) => {
  console.error('Error:', error);
  prisma.$disconnect();
  process.exit(1);
});
