import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function fixMixedCorrectly() {
  console.log(`\n${'='.repeat(80)}`);
  console.log('FIXING MIXED PAIRINGS CORRECTLY');
  console.log('MIXED_1 should be: Monica & Tyler');
  console.log('MIXED_2 should be: Sharon & Adam');
  console.log('Tournament: "KLYNG CUP - GRAND FINALE"');
  console.log('='.repeat(80));

  const tournament = await prisma.tournament.findFirst({
    where: { name: { equals: 'KLYNG CUP - GRAND FINALE' } },
    select: { id: true },
  });

  if (!tournament) return;

  const monica = await prisma.player.findFirst({
    where: {
      OR: [
        { firstName: { contains: 'Monica', mode: 'insensitive' }, lastName: { contains: 'Lin', mode: 'insensitive' } },
        { name: { contains: 'Monica Lin', mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true },
  });

  const sharon = await prisma.player.findFirst({
    where: {
      OR: [
        { firstName: { contains: 'Sharon', mode: 'insensitive' }, lastName: { contains: 'Scarfone', mode: 'insensitive' } },
        { name: { contains: 'Sharon Scarfone', mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true },
  });

  const tyler = await prisma.player.findFirst({
    where: {
      OR: [
        { firstName: { contains: 'Tyler', mode: 'insensitive' }, lastName: { contains: 'Goldsack', mode: 'insensitive' } },
        { name: { contains: 'Tyler Goldsack', mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true },
  });

  const adam = await prisma.player.findFirst({
    where: {
      OR: [
        { firstName: { contains: 'Adam', mode: 'insensitive' }, lastName: { contains: 'Ewer', mode: 'insensitive' } },
        { name: { contains: 'Adam Ewer', mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true },
  });

  if (!monica || !sharon || !tyler || !adam) {
    console.log('Could not find all players');
    return;
  }

  const greenhillsTeam = await prisma.team.findFirst({
    where: {
      name: { contains: 'Greenhills Intermediate', mode: 'insensitive' },
      tournamentId: tournament.id,
    },
    select: { id: true },
  });

  if (!greenhillsTeam) return;

  // For the display to show:
  // MIXED_1 = Monica & Tyler → Array[0] = Tyler, Array[2] = Monica
  // MIXED_2 = Sharon & Adam → Array[1] = Adam, Array[3] = Sharon
  // So: MENS_DOUBLES = Tyler & Adam, WOMENS_DOUBLES = Monica & Sharon

  const rounds = [0, 3, 4];

  for (const roundIdx of rounds) {
    const round = await prisma.round.findFirst({
      where: {
        stop: { tournamentId: tournament.id },
        idx: roundIdx,
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

    console.log(`\n${'='.repeat(80)}`);
    console.log(`Round ${roundIdx}:`);
    
    const mensEntry = lineup.entries.find(e => e.slot === 'MENS_DOUBLES');
    const womensEntry = lineup.entries.find(e => e.slot === 'WOMENS_DOUBLES');
    const mixed1Entry = lineup.entries.find(e => e.slot === 'MIXED_1');
    const mixed2Entry = lineup.entries.find(e => e.slot === 'MIXED_2');

    console.log(`  Current MENS_DOUBLES: ${mensEntry?.player1?.name} & ${mensEntry?.player2?.name}`);
    console.log(`  Current WOMENS_DOUBLES: ${womensEntry?.player1?.name} & ${womensEntry?.player2?.name}`);
    console.log(`  Current MIXED_1: ${mixed1Entry?.player1?.name} & ${mixed1Entry?.player2?.name}`);
    console.log(`  Current MIXED_2: ${mixed2Entry?.player1?.name} & ${mixed2Entry?.player2?.name}`);

    await prisma.$transaction(async (tx) => {
      // Update MENS_DOUBLES to: Tyler & Adam
      if (mensEntry) {
        await tx.lineupEntry.delete({ where: { id: mensEntry.id } });
        await tx.lineupEntry.create({
          data: {
            lineupId: mensEntry.lineupId,
            player1Id: tyler.id,
            player2Id: adam.id,
            slot: 'MENS_DOUBLES',
          },
        });
        console.log(`  ✅ Updated MENS_DOUBLES: ${tyler.name} & ${adam.name}`);
      }

      // Update WOMENS_DOUBLES to: Monica & Sharon
      if (womensEntry) {
        await tx.lineupEntry.delete({ where: { id: womensEntry.id } });
        await tx.lineupEntry.create({
          data: {
            lineupId: womensEntry.lineupId,
            player1Id: monica.id,
            player2Id: sharon.id,
            slot: 'WOMENS_DOUBLES',
          },
        });
        console.log(`  ✅ Updated WOMENS_DOUBLES: ${monica.name} & ${sharon.name}`);
      }

      // Update MIXED_1 to: Monica & Tyler
      if (mixed1Entry) {
        await tx.lineupEntry.delete({ where: { id: mixed1Entry.id } });
        await tx.lineupEntry.create({
          data: {
            lineupId: mixed1Entry.lineupId,
            player1Id: monica.id,
            player2Id: tyler.id,
            slot: 'MIXED_1',
          },
        });
        console.log(`  ✅ Updated MIXED_1: ${monica.name} & ${tyler.name}`);
      }

      // Update MIXED_2 to: Sharon & Adam
      if (mixed2Entry) {
        await tx.lineupEntry.delete({ where: { id: mixed2Entry.id } });
        await tx.lineupEntry.create({
          data: {
            lineupId: mixed2Entry.lineupId,
            player1Id: sharon.id,
            player2Id: adam.id,
            slot: 'MIXED_2',
          },
        });
        console.log(`  ✅ Updated MIXED_2: ${sharon.name} & ${adam.name}`);
      }
    });

    console.log(`  → Display will show: MIXED_1 = ${monica.name} & ${tyler.name}, MIXED_2 = ${sharon.name} & ${adam.name}`);
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('✅ ALL FIXES COMPLETE');
  console.log('='.repeat(80));
  console.log('\nPlease refresh your browser to see the changes.');
}

fixMixedCorrectly()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

