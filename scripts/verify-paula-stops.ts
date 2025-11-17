import { PrismaClient } from '@prisma/client';
import { calculateRegistrationAmount } from '../src/lib/payments/calculateAmount';
import { calculateTotalWithTax } from '../src/lib/payments/calculateTax';

const prisma = new PrismaClient();

async function verifyPaulaStops() {
  try {
    console.log('\n=== Verifying Paula\'s Stops and Payment Calculation ===\n');

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
      },
    });

    if (!tournament) {
      console.log('❌ Tournament not found');
      return;
    }

    // Get all stops in order
    const allStops = await prisma.stop.findMany({
      where: { tournamentId: tournament.id },
      orderBy: { startAt: 'asc' },
      select: { id: true, name: true, startAt: true },
    });

    console.log(`📍 All Tournament Stops (in order):`);
    allStops.forEach((stop, idx) => {
      console.log(`   ${idx + 1}. ${stop.name} (ID: ${stop.id})`);
    });

    // Get Paula's registration
    const registration = await prisma.tournamentRegistration.findFirst({
      where: { playerId: player.id },
    });

    if (!registration) {
      console.log('❌ Registration not found');
      return;
    }

    let notes: any = {};
    if (registration.notes) {
      try {
        notes = JSON.parse(registration.notes);
      } catch (e) {
        console.log('❌ Failed to parse notes');
        return;
      }
    }

    console.log(`\n📋 Paula's Current Registration:`);
    console.log(`   Registration ID: ${registration.id}`);
    console.log(`   Stop IDs in registration: ${notes.stopIds ? notes.stopIds.join(', ') : 'None'}`);

    // Map stop IDs to names
    const registeredStops = allStops.filter(s => notes.stopIds?.includes(s.id));
    console.log(`   Registered Stops: ${registeredStops.map(s => s.name).join(', ')}`);

    // Check if Vaughn is in the registration
    const vaughnStop = allStops.find(s => s.name.toLowerCase().includes('vaughn'));
    const oshawaStop = allStops.find(s => s.name.toLowerCase().includes('oshawa'));
    const downsviewStop = allStops.find(s => s.name.toLowerCase().includes('downsview'));

    console.log(`\n🔍 Stop Analysis:`);
    console.log(`   Stop 1 (Vaughn): ${vaughnStop?.name || 'Not found'} (ID: ${vaughnStop?.id || 'N/A'})`);
    console.log(`   Stop 2 (Oshawa): ${oshawaStop?.name || 'Not found'} (ID: ${oshawaStop?.id || 'N/A'})`);
    console.log(`   Stop 3 (Downsview): ${downsviewStop?.name || 'Not found'} (ID: ${downsviewStop?.id || 'N/A'})`);

    const hasVaughn = vaughnStop && notes.stopIds?.includes(vaughnStop.id);
    const hasOshawa = oshawaStop && notes.stopIds?.includes(oshawaStop.id);
    const hasDownsview = downsviewStop && notes.stopIds?.includes(downsviewStop.id);

    console.log(`\n📊 Paula's Registration Status:`);
    console.log(`   Has Vaughn (Stop 1): ${hasVaughn ? '✅ YES' : '❌ NO'}`);
    console.log(`   Has Oshawa (Stop 2): ${hasOshawa ? '✅ YES' : '❌ NO'}`);
    console.log(`   Has Downsview (Stop 3): ${hasDownsview ? '✅ YES' : '❌ NO'}`);

    // Scenario: Vaughn was manually added (paid outside app)
    // User selected Oshawa and Downsview during registration
    // So newlySelectedStopIds should be: [Oshawa, Downsview]
    
    const registrationCostInDollars = tournament.registrationCost ? tournament.registrationCost / 100 : 0;
    const pricingModel = tournament.pricingModel || 'TOURNAMENT_WIDE';

    console.log(`\n🧮 Payment Calculation Scenarios:\n`);

    // Scenario 1: If Vaughn was manually added, and user selected Oshawa + Downsview
    // What SHOULD be charged (with fix)
    const newlySelectedStopIds = [oshawaStop?.id, downsviewStop?.id].filter(Boolean) as string[];
    
    if (newlySelectedStopIds.length > 0) {
      const newStopsSubtotal = calculateRegistrationAmount(
        {
          registrationCost: registrationCostInDollars,
          pricingModel,
        },
        {
          stopIds: newlySelectedStopIds,
          brackets: notes.brackets?.filter((b: any) => newlySelectedStopIds.includes(b.stopId)) || [],
        }
      );
      const { tax: newStopsTax, total: newStopsTotal } = calculateTotalWithTax(newStopsSubtotal);

      console.log(`1. CORRECT Calculation (with fix) - Only newly selected stops:`);
      console.log(`   Newly Selected Stops: ${newlySelectedStopIds.map(id => {
        const stop = allStops.find(s => s.id === id);
        return stop?.name || id;
      }).join(', ')}`);
      console.log(`   Subtotal: $${newStopsSubtotal.toFixed(2)}`);
      console.log(`   Tax (13% HST): $${newStopsTax.toFixed(2)}`);
      console.log(`   Total: $${newStopsTotal.toFixed(2)}`);
      console.log(`   ✅ Should charge for Stop 2 (Oshawa) + Stop 3 (Downsview) = $${newStopsTotal.toFixed(2)}`);

      // Compare with what's currently stored
      console.log(`\n2. Current Registration Amount:`);
      console.log(`   Expected Amount: $${notes.expectedAmount ? notes.expectedAmount.toFixed(2) : 'None'}`);
      console.log(`   New Stops Total: $${notes.newStopsTotal ? notes.newStopsTotal.toFixed(2) : 'None'}`);
      
      if (notes.expectedAmount) {
        const match = Math.abs(newStopsTotal - notes.expectedAmount) < 0.01;
        console.log(`   ${match ? '✅ MATCHES expected amount' : '❌ DOES NOT MATCH expected amount'}`);
      }
    }

    // Scenario 2: What would happen if all stops were included
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
      const { tax: allStopsTax, total: allStopsTotal } = calculateTotalWithTax(allStopsSubtotal);

      console.log(`\n3. What OLD BUG would calculate (all stops in registration):`);
      console.log(`   All Stops: ${registeredStops.map(s => s.name).join(', ')}`);
      console.log(`   Subtotal: $${allStopsSubtotal.toFixed(2)}`);
      console.log(`   Tax (13% HST): $${allStopsTax.toFixed(2)}`);
      console.log(`   Total: $${allStopsTotal.toFixed(2)}`);
      
      if (hasVaughn) {
        console.log(`   ❌ WRONG - Would charge for Stop 1 (Vaughn) which was already paid`);
      } else {
        console.log(`   ℹ️  This matches what should be charged (no Vaughn in registration)`);
      }
    }

    // Check what the code would actually do
    console.log(`\n🔧 What the REVISED CODE would do:`);
    console.log(`   Has newlySelectedStopIds: ${notes.newlySelectedStopIds ? 'YES' : 'NO'}`);
    if (notes.newlySelectedStopIds) {
      console.log(`   Newly Selected Stop IDs: ${notes.newlySelectedStopIds.join(', ')}`);
      const newStopNames = notes.newlySelectedStopIds.map((id: string) => {
        const stop = allStops.find(s => s.id === id);
        return stop?.name || id;
      });
      console.log(`   Newly Selected Stops: ${newStopNames.join(', ')}`);
      console.log(`   ✅ Would charge ONLY for: ${newStopNames.join(', ')}`);
    } else {
      console.log(`   ⚠️  Registration created before fix - no newlySelectedStopIds stored`);
      console.log(`   Would fall back to calculating for all stops in registration`);
      console.log(`   Current stops in registration: ${registeredStops.map(s => s.name).join(', ')}`);
    }

    console.log(`\n✅ Verification Complete`);

  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

verifyPaulaStops()
  .then(() => {
    console.log('\n✅ Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });

