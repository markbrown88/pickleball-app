import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function swapMonicaSharonSlots() {
  console.log(`\n${'='.repeat(80)}`);
  console.log('SWAPPING MONICA LIN & SHARON SCARFONE SLOTS');
  console.log('Tournament: "KLYNG CUP - GRAND FINALE"');
  console.log('='.repeat(80));

  // Define the swaps
  const swaps = [
    {
      matchup: 'Round 0 vs 4 Fathers Intermediate',
      monicaEntryId: 'cmikkl5xt0005l4045bjj6exk',
      monicaCurrentSlot: 'MIXED_2',
      monicaNewSlot: 'MIXED_1',
      sharonEntryId: 'cmikkl5xt0004l404nv4sy4bg',
      sharonCurrentSlot: 'MIXED_1',
      sharonNewSlot: 'MIXED_2',
    },
    {
      matchup: 'Round 3 vs Pickleplex Barrie Intermediate',
      monicaEntryId: 'cmilyy2iw0015l104cbjtr5wp',
      monicaCurrentSlot: 'MIXED_2',
      monicaNewSlot: 'MIXED_1',
      sharonEntryId: 'cmilyy2iw0014l10412l4kksr',
      sharonCurrentSlot: 'MIXED_1',
      sharonNewSlot: 'MIXED_2',
    },
    {
      matchup: 'Round 4 vs One Health Intermediate & 4 Fathers Intermediate',
      monicaEntryId: 'cmim24pyz002gl1044xrp6xl9',
      monicaCurrentSlot: 'MIXED_1',
      monicaNewSlot: 'MIXED_2',
      sharonEntryId: 'cmim24pyz002hl104b0rxymk2',
      sharonCurrentSlot: 'MIXED_2',
      sharonNewSlot: 'MIXED_1',
    },
  ];

  // Verify current state
  console.log(`\nVerifying current state...\n`);
  for (const swap of swaps) {
    const monicaEntry = await prisma.lineupEntry.findUnique({
      where: { id: swap.monicaEntryId },
      include: {
        player1: { select: { name: true } },
        player2: { select: { name: true } },
      },
    });

    const sharonEntry = await prisma.lineupEntry.findUnique({
      where: { id: swap.sharonEntryId },
      include: {
        player1: { select: { name: true } },
        player2: { select: { name: true } },
      },
    });

    if (!monicaEntry || !sharonEntry) {
      console.error(`❌ ERROR: Could not find lineup entries for ${swap.matchup}`);
      console.error(`   Monica Entry: ${monicaEntry ? 'Found' : 'NOT FOUND'}`);
      console.error(`   Sharon Entry: ${sharonEntry ? 'Found' : 'NOT FOUND'}`);
      return;
    }

    console.log(`${swap.matchup}:`);
    console.log(`  Monica: ${monicaEntry.slot} (expected: ${swap.monicaCurrentSlot})`);
    console.log(`  Sharon: ${sharonEntry.slot} (expected: ${swap.sharonCurrentSlot})`);

    if (monicaEntry.slot !== swap.monicaCurrentSlot || sharonEntry.slot !== swap.sharonCurrentSlot) {
      console.error(`❌ ERROR: Current slots don't match expected values!`);
      console.error(`   Monica: Found ${monicaEntry.slot}, Expected ${swap.monicaCurrentSlot}`);
      console.error(`   Sharon: Found ${sharonEntry.slot}, Expected ${swap.sharonCurrentSlot}`);
      return;
    }
  }

  console.log(`\n✅ All entries verified. Current state matches expectations.\n`);

  // Perform the swap
  console.log(`Performing swaps in transaction...\n`);

  try {
    await prisma.$transaction(async (tx) => {
      for (const swap of swaps) {
        // Update Monica's entry
        await tx.lineupEntry.update({
          where: { id: swap.monicaEntryId },
          data: { slot: swap.monicaNewSlot as any },
        });
        console.log(`✅ Updated Monica entry ${swap.monicaEntryId}: ${swap.monicaCurrentSlot} → ${swap.monicaNewSlot}`);

        // Update Sharon's entry
        await tx.lineupEntry.update({
          where: { id: swap.sharonEntryId },
          data: { slot: swap.sharonNewSlot as any },
        });
        console.log(`✅ Updated Sharon entry ${swap.sharonEntryId}: ${swap.sharonCurrentSlot} → ${swap.sharonNewSlot}`);
      }
    });

    console.log(`\n${'='.repeat(80)}`);
    console.log('✅ ALL SWAPS COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));

    // Verify final state
    console.log(`\nVerifying final state...\n`);
    for (const swap of swaps) {
      const monicaEntry = await prisma.lineupEntry.findUnique({
        where: { id: swap.monicaEntryId },
      });

      const sharonEntry = await prisma.lineupEntry.findUnique({
        where: { id: swap.sharonEntryId },
      });

      if (monicaEntry && sharonEntry) {
        const monicaCorrect = monicaEntry.slot === swap.monicaNewSlot;
        const sharonCorrect = sharonEntry.slot === swap.sharonNewSlot;
        const status = monicaCorrect && sharonCorrect ? '✅' : '❌';

        console.log(`${status} ${swap.matchup}:`);
        console.log(`  Monica: ${monicaEntry.slot} (expected: ${swap.monicaNewSlot})`);
        console.log(`  Sharon: ${sharonEntry.slot} (expected: ${swap.sharonNewSlot})`);
      }
    }

  } catch (error) {
    console.error(`\n❌ ERROR during swap:`);
    console.error(error);
    throw error;
  }
}

swapMonicaSharonSlots()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

