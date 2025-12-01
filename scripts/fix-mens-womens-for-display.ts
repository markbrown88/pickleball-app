import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function fixMensWomens() {
  console.log(`\n${'='.repeat(80)}`);
  console.log('FIXING MENS_DOUBLES/WOMENS_DOUBLES TO MATCH MIXED DISPLAY');
  console.log('Tournament: "KLYNG CUP - GRAND FINALE"');
  console.log('='.repeat(80));

  const tournament = await prisma.tournament.findFirst({
    where: { name: { equals: 'KLYNG CUP - GRAND FINALE' } },
    select: { id: true },
  });

  if (!tournament) return;

  const greenhillsTeam = await prisma.team.findFirst({
    where: {
      name: { contains: 'Greenhills Intermediate', mode: 'insensitive' },
      tournamentId: tournament.id,
    },
    select: { id: true },
  });

  if (!greenhillsTeam) return;

  // Round 0 & 3: Need MIXED_1 = Adam & Monica, MIXED_2 = Tyler & Sharon
  // So array should be [Adam, Tyler, Monica, Sharon]
  // MENS_DOUBLES should be: Adam & Tyler
  // WOMENS_DOUBLES should be: Monica & Sharon

  // Round 4: Need MIXED_1 = Tyler & Monica, MIXED_2 = Adam & Sharon  
  // So array should be [Tyler, Adam, Sharon, Monica]
  // MENS_DOUBLES should be: Tyler & Adam (current)
  // WOMENS_DOUBLES should be: Sharon & Monica

  const fixes = [
    {
      roundIdx: 0,
      mensEntryId: 'cmikkl5xt0003l4045bjj6exj', // Need to find actual ID
      swapMens: true, // Swap to Adam & Tyler
    },
    {
      roundIdx: 3,
      mensEntryId: 'cmilyy2iw0013l104cbjtr5wo', // Need to find actual ID
      swapMens: true, // Swap to Adam & Tyler
    },
    {
      roundIdx: 4,
      womensEntryId: 'cmim24pyz002fl1044xrp6xl8', // Need to find actual ID
      swapWomens: true, // Swap to Sharon & Monica
    },
  ];

  for (const fix of fixes) {
    const round = await prisma.round.findFirst({
      where: {
        stop: { tournamentId: tournament.id },
        idx: fix.roundIdx,
      },
    });

    if (!round) continue;

    const lineup = await prisma.lineup.findFirst({
      where: {
        roundId: round.id,
        teamId: greenhillsTeam.id,
      },
      include: {
        entries: {
          include: {
            player1: { select: { name: true } },
            player2: { select: { name: true } },
          },
        },
      },
    });

    if (!lineup) continue;

    if (fix.swapMens) {
      const mensEntry = lineup.entries.find(e => e.slot === 'MENS_DOUBLES');
      if (mensEntry) {
        console.log(`\nRound ${fix.roundIdx}: Swapping MENS_DOUBLES`);
        console.log(`  Current: ${mensEntry.player1?.name} & ${mensEntry.player2?.name}`);
        console.log(`  New: ${mensEntry.player2?.name} & ${mensEntry.player1?.name}`);

        await prisma.$transaction(async (tx) => {
          await tx.lineupEntry.delete({ where: { id: mensEntry.id } });
          await tx.lineupEntry.create({
            data: {
              lineupId: mensEntry.lineupId,
              player1Id: mensEntry.player2Id,
              player2Id: mensEntry.player1Id,
              slot: 'MENS_DOUBLES',
            },
          });
        });
        console.log(`  ✅ Swapped`);
      }
    }

    if (fix.swapWomens) {
      const womensEntry = lineup.entries.find(e => e.slot === 'WOMENS_DOUBLES');
      if (womensEntry) {
        console.log(`\nRound ${fix.roundIdx}: Swapping WOMENS_DOUBLES`);
        console.log(`  Current: ${womensEntry.player1?.name} & ${womensEntry.player2?.name}`);
        console.log(`  New: ${womensEntry.player2?.name} & ${womensEntry.player1?.name}`);

        await prisma.$transaction(async (tx) => {
          await tx.lineupEntry.delete({ where: { id: womensEntry.id } });
          await tx.lineupEntry.create({
            data: {
              lineupId: womensEntry.lineupId,
              player1Id: womensEntry.player2Id,
              player2Id: womensEntry.player1Id,
              slot: 'WOMENS_DOUBLES',
            },
          });
        });
        console.log(`  ✅ Swapped`);
      }
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('✅ ALL FIXES COMPLETE');
  console.log('='.repeat(80));
  console.log('\nThe display should now show the correct MIXED pairings.');
  console.log('Please refresh your browser to see the changes.');
}

fixMensWomens()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

