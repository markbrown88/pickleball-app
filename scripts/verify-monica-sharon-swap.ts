import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function verifySwap() {
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

  const tournament = await prisma.tournament.findFirst({
    where: {
      name: { equals: 'KLYNG CUP - GRAND FINALE' },
    },
    select: { id: true },
  });

  if (!monica || !sharon || !tournament) {
    console.log('Could not find players or tournament');
    return;
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('VERIFICATION: MONICA LIN & SHARON SCARFONE SLOTS');
  console.log('Tournament: "KLYNG CUP - GRAND FINALE"');
  console.log('='.repeat(80));

  const expectedSwaps = [
    {
      round: 0,
      matchup: 'vs 4 Fathers Intermediate',
      monicaExpectedSlot: 'MIXED_1',
      sharonExpectedSlot: 'MIXED_2',
    },
    {
      round: 3,
      matchup: 'vs Pickleplex Barrie Intermediate',
      monicaExpectedSlot: 'MIXED_1',
      sharonExpectedSlot: 'MIXED_2',
    },
    {
      round: 4,
      matchup: 'vs One Health Intermediate & 4 Fathers Intermediate',
      monicaExpectedSlot: 'MIXED_2',
      sharonExpectedSlot: 'MIXED_1',
    },
  ];

  for (const expected of expectedSwaps) {
    const round = await prisma.round.findFirst({
      where: {
        stop: { tournamentId: tournament.id },
        idx: expected.round,
      },
      include: {
        matches: {
          include: {
            teamA: { select: { name: true } },
            teamB: { select: { name: true } },
          },
        },
      },
    });

    if (!round) {
      console.log(`\n❌ Round ${expected.round} not found`);
      continue;
    }

    // Get lineup entries for this round
    const lineups = await prisma.lineupEntry.findMany({
      where: {
        lineup: {
          roundId: round.id,
        },
        OR: [
          { player1Id: monica.id },
          { player2Id: monica.id },
          { player1Id: sharon.id },
          { player2Id: sharon.id },
        ],
      },
      include: {
        lineup: {
          include: {
            team: { select: { name: true } },
          },
        },
        player1: { select: { name: true } },
        player2: { select: { name: true } },
      },
    });

    const monicaMixed = lineups.filter(
      le => (le.player1Id === monica.id || le.player2Id === monica.id) &&
            (le.slot === 'MIXED_1' || le.slot === 'MIXED_2')
    );

    const sharonMixed = lineups.filter(
      le => (le.player1Id === sharon.id || le.player2Id === sharon.id) &&
            (le.slot === 'MIXED_1' || le.slot === 'MIXED_2')
    );

    console.log(`\nRound ${expected.round} ${expected.matchup}:`);
    
    if (monicaMixed.length > 0 && sharonMixed.length > 0) {
      const monicaEntry = monicaMixed[0];
      const sharonEntry = sharonMixed[0];
      
      const monicaCorrect = monicaEntry.slot === expected.monicaExpectedSlot;
      const sharonCorrect = sharonEntry.slot === expected.sharonExpectedSlot;
      const status = monicaCorrect && sharonCorrect ? '✅' : '❌';

      console.log(`  ${status} Monica: ${monicaEntry.slot} (expected: ${expected.monicaExpectedSlot})`);
      console.log(`  ${status} Sharon: ${sharonEntry.slot} (expected: ${expected.sharonExpectedSlot})`);
      
      if (monicaCorrect && sharonCorrect) {
        const partner = monicaEntry.player1Id === monica.id ? monicaEntry.player2 : monicaEntry.player1;
        const partnerName = partner?.name || 'Unknown';
        console.log(`     Monica playing with: ${partnerName}`);
      }
    } else {
      console.log(`  ❌ Could not find lineup entries`);
      console.log(`     Monica entries found: ${monicaMixed.length}`);
      console.log(`     Sharon entries found: ${sharonMixed.length}`);
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('VERIFICATION COMPLETE');
  console.log('='.repeat(80));
}

verifySwap()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

