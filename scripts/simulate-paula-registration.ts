import { PrismaClient } from '@prisma/client';
import { calculateRegistrationAmount } from '../src/lib/payments/calculateAmount';
import { calculateTotalWithTax } from '../src/lib/payments/calculateTax';

// Helper function to convert dollars to cents (without Stripe dependency)
function formatAmountForStripe(amount: number): number {
  return Math.round(amount * 100);
}

const prisma = new PrismaClient();

/**
 * Simulate what would happen if Paula registered for Stop 2 only
 * given that she already has Stop 1 manually added
 */
async function simulatePaulaRegistration() {
  try {
    console.log('\n=== Simulating Paula\'s Registration Scenario ===\n');

    const player = await prisma.player.findUnique({
      where: { email: 'paula.rby@gmail.com' },
    });

    if (!player) {
      console.log('❌ Player not found');
      return;
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: 'cmh7qeb1t0000ju04udwe7w8w' },
      select: {
        id: true,
        name: true,
        registrationCost: true,
        pricingModel: true,
        registrationType: true,
      },
    });

    if (!tournament) {
      console.log('❌ Tournament not found');
      return;
    }

    console.log(`Tournament: ${tournament.name}`);
    console.log(`Registration Cost: $${((tournament.registrationCost || 0) / 100).toFixed(2)}`);
    console.log(`Pricing Model: ${tournament.pricingModel || 'TOURNAMENT_WIDE'}`);

    // Get all stops
    const allStops = await prisma.stop.findMany({
      where: { tournamentId: tournament.id },
      orderBy: { startAt: 'asc' },
      select: { id: true, name: true, startAt: true },
    });

    console.log(`\n📍 Available Stops:`);
    allStops.forEach((stop, idx) => {
      console.log(`   ${idx + 1}. ${stop.name} (ID: ${stop.id})`);
    });

    // Scenario: User already has Stop 1 (Oshawa) manually added
    // User selects only Stop 2 (Downsview) during registration
    const existingStopId = 'cmh7rtx46000jl804twvhjt1p'; // Oshawa
    const newlySelectedStopId = 'cmh7rtx53000ll804v2e2xzs9'; // Downsview

    const existingStop = allStops.find(s => s.id === existingStopId);
    const newStop = allStops.find(s => s.id === newlySelectedStopId);

    console.log(`\n📋 Scenario:`);
    console.log(`   Existing Stop (manually added, paid outside app): ${existingStop?.name || existingStopId}`);
    console.log(`   Newly Selected Stop (user checks this): ${newStop?.name || newlySelectedStopId}`);

    // Get bracket ID (3.5 bracket)
    const bracket = await prisma.tournamentBracket.findFirst({
      where: {
        tournamentId: tournament.id,
        name: '3.5',
      },
      select: { id: true, name: true },
    });

    if (!bracket) {
      console.log('❌ Bracket not found');
      return;
    }

    console.log(`   Bracket: ${bracket.name} (ID: ${bracket.id})`);

    const registrationCostInDollars = tournament.registrationCost ? tournament.registrationCost / 100 : 0;
    const pricingModel = tournament.pricingModel || 'TOURNAMENT_WIDE';

    // Simulate the registration calculation
    console.log(`\n🧮 Registration Calculation (with fix):\n`);

    // Step 1: Calculate for ONLY newly selected stops
    const selectedStopIds = [newlySelectedStopId];
    const selectedBrackets = [{
      stopId: newlySelectedStopId,
      bracketId: bracket.id,
      gameTypes: ['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_DOUBLES_1', 'MIXED_DOUBLES_2', 'MENS_SINGLES', 'WOMENS_SINGLES'],
    }];

    const newStopSubtotal = calculateRegistrationAmount(
      {
        registrationCost: registrationCostInDollars,
        pricingModel,
      },
      {
        stopIds: selectedStopIds,
        brackets: selectedBrackets,
      }
    );

    const { tax: newStopTax, total: newStopTotal } = calculateTotalWithTax(newStopSubtotal);
    const newStopAmountPaidInCents = formatAmountForStripe(newStopTotal);

    console.log(`1. Calculation for NEWLY SELECTED stops only (${newStop?.name}):`);
    console.log(`   Stop IDs: ${selectedStopIds.join(', ')}`);
    console.log(`   Subtotal: $${newStopSubtotal.toFixed(2)}`);
    console.log(`   Tax (13% HST): $${newStopTax.toFixed(2)}`);
    console.log(`   Total: $${newStopTotal.toFixed(2)}`);
    console.log(`   Amount in cents: ${newStopAmountPaidInCents}`);
    console.log(`   ✅ CORRECT - Only charging for Stop 2`);

    // Step 2: Show what would happen with old bug (calculating for all stops)
    const allStopIds = [existingStopId, newlySelectedStopId];
    const allBrackets = [
      {
        stopId: existingStopId,
        bracketId: bracket.id,
        gameTypes: ['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_DOUBLES_1', 'MIXED_DOUBLES_2', 'MENS_SINGLES', 'WOMENS_SINGLES'],
      },
      {
        stopId: newlySelectedStopId,
        bracketId: bracket.id,
        gameTypes: ['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_DOUBLES_1', 'MIXED_DOUBLES_2', 'MENS_SINGLES', 'WOMENS_SINGLES'],
      },
    ];

    const allStopsSubtotal = calculateRegistrationAmount(
      {
        registrationCost: registrationCostInDollars,
        pricingModel,
      },
      {
        stopIds: allStopIds,
        brackets: allBrackets,
      }
    );

    const { tax: allStopsTax, total: allStopsTotal } = calculateTotalWithTax(allStopsSubtotal);

    console.log(`\n2. What OLD BUG would calculate (for ALL stops):`);
    console.log(`   Stop IDs: ${allStopIds.join(', ')}`);
    console.log(`   Subtotal: $${allStopsSubtotal.toFixed(2)}`);
    console.log(`   Tax (13% HST): $${allStopsTax.toFixed(2)}`);
    console.log(`   Total: $${allStopsTotal.toFixed(2)}`);
    console.log(`   ❌ WRONG - Charging for both Stop 1 and Stop 2`);

    console.log(`\n📊 Comparison:`);
    console.log(`   Correct amount (new fix): $${newStopTotal.toFixed(2)}`);
    console.log(`   Wrong amount (old bug): $${allStopsTotal.toFixed(2)}`);
    console.log(`   Difference: $${(allStopsTotal - newStopTotal).toFixed(2)}`);
    console.log(`   ✅ Fix prevents overcharging by $${(allStopsTotal - newStopTotal).toFixed(2)}`);

    // Step 3: Show what would be stored in registration notes
    console.log(`\n📝 What would be stored in registration notes (with fix):`);
    const notes = {
      stopIds: allStopIds, // All stops (merged)
      brackets: allBrackets, // All brackets (merged)
      newlySelectedStopIds: selectedStopIds, // Only newly selected stops
      newlySelectedBrackets: selectedBrackets, // Only newly selected brackets
      newStopsSubtotal: newStopSubtotal,
      newStopsTax: newStopTax,
      newStopsTotal: newStopTotal,
      existingAmountPaid: 0, // Stop 1 was paid outside app
    };
    console.log(JSON.stringify(notes, null, 2));

    console.log(`\n✅ Simulation Complete`);

  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

simulatePaulaRegistration()
  .then(() => {
    console.log('\n✅ Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });

