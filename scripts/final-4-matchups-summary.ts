import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function finalSummary() {
  console.log(`\n${'='.repeat(80)}`);
  console.log('4 MATCHUPS - COMPLETE LINEUP ENTRY SUMMARY');
  console.log('='.repeat(80));

  const matchups = [
    {
      name: 'Round 0 vs 4 Fathers Intermediate',
      matchId: 'cmij63yw4000nl504nq51of0b',
      roundId: 'cmij63y240001l504th8py50g',
      monicaEntryId: 'cmikkl5xt0005l4045bjj6exk',
      monicaSlot: 'MIXED_2',
      sharonEntryId: 'cmikkl5xt0004l404nv4sy4bg',
      sharonSlot: 'MIXED_1',
    },
    {
      name: 'Round 3 vs Pickleplex Barrie Intermediate',
      matchId: 'cmij642il003dl504qq3ayyxk',
      roundId: 'cmij642dt0039l5046kslosny',
      monicaEntryId: 'cmilyy2iw0015l104cbjtr5wp',
      monicaSlot: 'MIXED_2',
      sharonEntryId: 'cmilyy2iw0014l10412l4kksr',
      sharonSlot: 'MIXED_1',
    },
    {
      name: 'Round 4 vs One Health Intermediate',
      matchId: 'cmij643wz004fl5042enopesp',
      roundId: 'cmij6436j003vl5046x11oomj',
      monicaEntryId: 'cmim24pyz002gl1044xrp6xl9',
      monicaSlot: 'MIXED_1',
      sharonEntryId: 'cmim24pyz002hl104b0rxymk2',
      sharonSlot: 'MIXED_2',
    },
    {
      name: 'Round 4 vs 4 Fathers Intermediate (again)',
      matchId: 'cmij6438y003xl504y6x0dwu1',
      roundId: 'cmij6436j003vl5046x11oomj', // Same round as One Health
      monicaEntryId: 'cmim24pyz002gl1044xrp6xl9', // Same entry as One Health
      monicaSlot: 'MIXED_1',
      sharonEntryId: 'cmim24pyz002hl104b0rxymk2', // Same entry as One Health
      sharonSlot: 'MIXED_2',
    },
  ];

  matchups.forEach((matchup, idx) => {
    console.log(`\n${idx + 1}. ${matchup.name}`);
    console.log(`   Match ID: ${matchup.matchId}`);
    console.log(`   Round ID: ${matchup.roundId}`);
    console.log(`   Monica: ${matchup.monicaSlot} (Entry ID: ${matchup.monicaEntryId})`);
    console.log(`   Sharon: ${matchup.sharonSlot} (Entry ID: ${matchup.sharonEntryId})`);
  });

  console.log(`\n\n${'='.repeat(80)}`);
  console.log('UNIQUE LINEUP ENTRIES TO UPDATE');
  console.log('='.repeat(80));

  const uniqueEntries = new Map<string, { matchup: string; player: string; currentSlot: string; newSlot: string }>();

  matchups.forEach(matchup => {
    // Monica entry
    const monicaKey = `${matchup.monicaEntryId}-Monica`;
    if (!uniqueEntries.has(monicaKey)) {
      uniqueEntries.set(monicaKey, {
        matchup: matchup.name,
        player: 'Monica',
        currentSlot: matchup.monicaSlot,
        newSlot: matchup.sharonSlot, // Swap to Sharon's slot
      });
    }

    // Sharon entry
    const sharonKey = `${matchup.sharonEntryId}-Sharon`;
    if (!uniqueEntries.has(sharonKey)) {
      uniqueEntries.set(sharonKey, {
        matchup: matchup.name,
        player: 'Sharon',
        currentSlot: matchup.sharonSlot,
        newSlot: matchup.monicaSlot, // Swap to Monica's slot
      });
    }
  });

  console.log(`\nTotal unique lineup entries to update: ${uniqueEntries.size}\n`);

  let idx = 1;
  uniqueEntries.forEach((details, key) => {
    const entryId = key.split('-')[0];
    console.log(`${idx}. ${details.player} - Entry ID: ${entryId}`);
    console.log(`   From matchup: ${details.matchup}`);
    console.log(`   Change slot: ${details.currentSlot} → ${details.newSlot}`);
    console.log();
    idx++;
  });

  console.log(`\n${'='.repeat(80)}`);
  console.log('SWAP OPERATIONS');
  console.log('='.repeat(80));
  console.log(`\nTotal lineup entries to update: ${uniqueEntries.size}\n`);

  idx = 1;
  uniqueEntries.forEach((details, key) => {
    const entryId = key.split('-')[0];
    console.log(`UPDATE LineupEntry ${entryId}:`);
    console.log(`  SET slot = '${details.newSlot}'`);
    console.log(`  WHERE id = '${entryId}'`);
    console.log(`  -- ${details.player} in ${details.matchup}`);
    console.log();
    idx++;
  });
}

finalSummary()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

