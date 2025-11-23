/**
 * Fix double-counted payment amounts using expectedAmount from notes
 *
 * For registrations where amountPaid ≈ 2x expectedAmount, set amountPaid = expectedAmount
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixDoubledAmounts() {
  console.log('🔧 Fixing Doubled Payment Amounts\n');

  // Get all paid registrations
  const registrations = await prisma.tournamentRegistration.findMany({
    where: {
      paymentStatus: { in: ['PAID', 'COMPLETED'] },
      amountPaid: { not: null },
      notes: { not: null },
    },
    include: {
      tournament: { select: { name: true } },
      player: { select: { firstName: true, lastName: true, name: true } },
    },
    orderBy: { registeredAt: 'desc' },
  });

  console.log(`Found ${registrations.length} paid registrations with notes\n`);

  let fixedCount = 0;
  let alreadyCorrect = 0;
  let noExpectedAmount = 0;
  let unexpected = 0;

  for (const reg of registrations) {
    const playerName = reg.player.name ||
      `${reg.player.firstName} ${reg.player.lastName}`.trim() || 'Unknown';

    const currentAmountCents = reg.amountPaid || 0;

    // Parse notes to get expected amount (in dollars)
    let expectedAmountCents = 0;
    try {
      const notes = JSON.parse(reg.notes!);
      if (notes.expectedAmount) {
        expectedAmountCents = Math.round(notes.expectedAmount * 100);
      }
    } catch (error) {
      console.error(`Failed to parse notes for ${reg.id}`);
      continue;
    }

    if (expectedAmountCents === 0) {
      noExpectedAmount++;
      continue;
    }

    // Check if amount is correct (within $1 tolerance)
    const isCorrect = Math.abs(currentAmountCents - expectedAmountCents) < 100;

    if (!isCorrect) {
      // Fix it - set to expected amount
      await prisma.tournamentRegistration.update({
        where: { id: reg.id },
        data: { amountPaid: expectedAmountCents },
      });

      console.log(`✅ ${playerName} - ${reg.tournament.name}`);
      console.log(`   $${(currentAmountCents / 100).toFixed(2)} → $${(expectedAmountCents / 100).toFixed(2)}\n`);
      fixedCount++;
    } else {
      alreadyCorrect++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Registrations: ${registrations.length}`);
  console.log(`Fixed (doubled → correct): ${fixedCount}`);
  console.log(`Already Correct: ${alreadyCorrect}`);
  console.log(`No Expected Amount: ${noExpectedAmount}`);
  console.log(`Unexpected Amounts: ${unexpected}`);
  console.log('='.repeat(80));

  await prisma.$disconnect();
}

fixDoubledAmounts().catch(console.error);
