import { PrismaClient } from '@prisma/client';
import { calculateRegistrationAmount } from '../src/lib/payments/calculateAmount';
import { calculateTotalWithTax } from '../src/lib/payments/calculateTax';

const prisma = new PrismaClient();

/**
 * Test script to verify payment calculation fix
 * Simulates the scenario where a user has an existing registration for Stop 1
 * and tries to register for Stop 2 only
 */
async function testPaymentCalculation() {
  try {
    console.log('\n=== Testing Payment Calculation Fix ===\n');

    // Find Paula's registration
    const player = await prisma.player.findUnique({
      where: { email: 'paula.rby@gmail.com' },
    });

    if (!player) {
      console.log('❌ Player not found');
      return;
    }

    const registration = await prisma.tournamentRegistration.findFirst({
      where: { playerId: player.id },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            registrationCost: true,
            pricingModel: true,
          },
        },
      },
    });

    if (!registration) {
      console.log('❌ Registration not found');
      return;
    }

    console.log(`✅ Found registration: ${registration.id}`);
    console.log(`   Tournament: ${registration.tournament.name}`);
    console.log(`   Registration Cost: $${((registration.tournament.registrationCost || 0) / 100).toFixed(2)}`);
    console.log(`   Pricing Model: ${registration.tournament.pricingModel || 'TOURNAMENT_WIDE'}`);

    // Parse notes
    let notes: any = {};
    if (registration.notes) {
      try {
        notes = JSON.parse(registration.notes);
      } catch (e) {
        console.log('❌ Failed to parse notes');
        return;
      }
    }

    console.log(`\n📋 Current Registration Data:`);
    console.log(`   All Stop IDs: ${notes.stopIds ? notes.stopIds.join(', ') : 'None'}`);
    console.log(`   Newly Selected Stop IDs: ${notes.newlySelectedStopIds ? notes.newlySelectedStopIds.join(', ') : 'None'}`);
    console.log(`   Expected Amount (all stops): $${notes.expectedAmount ? notes.expectedAmount.toFixed(2) : 'None'}`);
    console.log(`   New Stops Total: $${notes.newStopsTotal ? notes.newStopsTotal.toFixed(2) : 'None'}`);
    console.log(`   Existing Amount Paid: $${notes.existingAmountPaid ? (notes.existingAmountPaid / 100).toFixed(2) : 'None'}`);

    // Get stop names
    const allStops = await prisma.stop.findMany({
      where: { id: { in: notes.stopIds || [] } },
      select: { id: true, name: true },
    });

    const newlySelectedStops = await prisma.stop.findMany({
      where: { id: { in: notes.newlySelectedStopIds || [] } },
      select: { id: true, name: true },
    });

    console.log(`\n📍 Stop Details:`);
    console.log(`   All Stops: ${allStops.map(s => s.name).join(', ')}`);
    console.log(`   Newly Selected Stops: ${newlySelectedStops.map(s => s.name).join(', ') || 'None'}`);

    // Test the calculation logic
    const registrationCostInDollars = registration.tournament.registrationCost 
      ? registration.tournament.registrationCost / 100 
      : 0;
    
    const pricingModel = registration.tournament.pricingModel || 'TOURNAMENT_WIDE';

    console.log(`\n🧮 Testing Payment Calculations:\n`);

    // Test 1: Calculate for ALL stops (WRONG - what was happening before)
    if (notes.stopIds && notes.stopIds.length > 0) {
      const allStopsSubtotal = calculateRegistrationAmount(
        {
          registrationCost: registrationCostInDollars,
          pricingModel,
        },
        {
          stopIds: notes.stopIds,
          brackets: notes.brackets || [],
        }
      );
      const allStopsTotal = calculateTotalWithTax(allStopsSubtotal);
      console.log(`1. Calculation for ALL stops (${allStops.map(s => s.name).join(', ')}):`);
      console.log(`   Subtotal: $${allStopsSubtotal.toFixed(2)}`);
      console.log(`   Tax: $${allStopsTotal.tax.toFixed(2)}`);
      console.log(`   Total: $${allStopsTotal.total.toFixed(2)}`);
      console.log(`   ❌ This is WRONG - user should not pay for Stop 1`);
    }

    // Test 2: Calculate for ONLY newly selected stops (CORRECT - what should happen)
    if (notes.newlySelectedStopIds && notes.newlySelectedStopIds.length > 0) {
      const newStopsSubtotal = calculateRegistrationAmount(
        {
          registrationCost: registrationCostInDollars,
          pricingModel,
        },
        {
          stopIds: notes.newlySelectedStopIds,
          brackets: notes.newlySelectedBrackets || notes.brackets?.filter((b: any) => 
            notes.newlySelectedStopIds.includes(b.stopId)
          ) || [],
        }
      );
      const newStopsTotal = calculateTotalWithTax(newStopsSubtotal);
      console.log(`\n2. Calculation for NEWLY SELECTED stops only (${newlySelectedStops.map(s => s.name).join(', ')}):`);
      console.log(`   Subtotal: $${newStopsSubtotal.toFixed(2)}`);
      console.log(`   Tax: $${newStopsTotal.tax.toFixed(2)}`);
      console.log(`   Total: $${newStopsTotal.total.toFixed(2)}`);
      console.log(`   ✅ This is CORRECT - user should only pay for Stop 2`);
      
      // Compare with stored values
      if (notes.newStopsTotal) {
        const match = Math.abs(newStopsTotal.total - notes.newStopsTotal) < 0.01;
        console.log(`\n   Stored newStopsTotal: $${notes.newStopsTotal.toFixed(2)}`);
        console.log(`   Calculated total: $${newStopsTotal.total.toFixed(2)}`);
        console.log(`   ${match ? '✅ MATCH' : '❌ MISMATCH'}`);
      }
    } else {
      console.log(`\n2. No newlySelectedStopIds found in notes`);
      console.log(`   ⚠️  This registration was created before the fix`);
      console.log(`   The fix will work for future registrations`);
    }

    // Test 3: Simulate what the checkout session would calculate
    console.log(`\n3. Simulating Checkout Session Calculation:`);
    
    // This mimics the logic in create-checkout-session/route.ts
    let calculatedAmount: number;
    let stopsUsed: string[];
    
    if (notes.newStopsTotal !== undefined && notes.newStopsSubtotal !== undefined) {
      // Use pre-calculated amount (preferred path)
      calculatedAmount = notes.newStopsTotal;
      stopsUsed = notes.newlySelectedStopIds || notes.stopIds || [];
      console.log(`   Using pre-calculated newStopsTotal: $${calculatedAmount.toFixed(2)}`);
      console.log(`   ✅ CORRECT - Only charging for newly selected stops`);
    } else {
      // Fallback calculation (what we fixed)
      const stopsToCalculate = notes.newlySelectedStopIds && notes.newlySelectedStopIds.length > 0
        ? notes.newlySelectedStopIds
        : notes.stopIds || [];
      
      stopsUsed = stopsToCalculate;
      
      const fallbackSubtotal = calculateRegistrationAmount(
        {
          registrationCost: registrationCostInDollars,
          pricingModel,
        },
        {
          stopIds: stopsToCalculate,
          brackets: notes.newlySelectedBrackets || notes.brackets?.filter((b: any) => 
            stopsToCalculate.includes(b.stopId)
          ) || [],
        }
      );
      const fallbackTotal = calculateTotalWithTax(fallbackSubtotal);
      calculatedAmount = fallbackTotal.total;
      
      console.log(`   Fallback calculation using: ${stopsToCalculate.length > 0 ? stopsToCalculate.map((id: string) => {
        const stop = allStops.find(s => s.id === id);
        return stop?.name || id;
      }).join(', ') : 'no stops'}`);
      console.log(`   Calculated amount: $${calculatedAmount.toFixed(2)}`);
      
      if (notes.newlySelectedStopIds && stopsToCalculate.length === notes.newlySelectedStopIds.length) {
        console.log(`   ✅ CORRECT - Using newlySelectedStopIds (only new stops)`);
      } else if (stopsToCalculate.length === notes.stopIds?.length) {
        console.log(`   ❌ WRONG - Would charge for all stops (old bug)`);
      }
    }

    console.log(`\n✅ Test Complete`);

  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testPaymentCalculation()
  .then(() => {
    console.log('\n✅ Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });

