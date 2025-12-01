import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function checkAllRounds() {
  const monica = await prisma.player.findFirst({
    where: {
      OR: [
        { firstName: { contains: 'Monica', mode: 'insensitive' }, lastName: { contains: 'Lin', mode: 'insensitive' } },
        { name: { contains: 'Monica Lin', mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });

  const sharon = await prisma.player.findFirst({
    where: {
      OR: [
        { firstName: { contains: 'Sharon', mode: 'insensitive' }, lastName: { contains: 'Scarfone', mode: 'insensitive' } },
        { name: { contains: 'Sharon Scarfone', mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });

  const tournament = await prisma.tournament.findFirst({
    where: {
      name: { contains: 'Klyng Cup - Grand Finale', mode: 'insensitive' },
    },
    select: { id: true },
  });

  if (!monica || !sharon || !tournament) return;

  const allRounds = await prisma.round.findMany({
    where: {
      stop: {
        tournamentId: tournament.id,
      },
    },
    orderBy: { idx: 'asc' },
  });

  console.log(`\nChecking all ${allRounds.length} rounds for Monica and Sharon MIXED games:\n`);

  for (const round of allRounds) {
    const monicaLineups = await prisma.lineupEntry.findMany({
      where: {
        lineup: {
          roundId: round.id,
        },
        OR: [
          { player1Id: monica.id },
          { player2Id: monica.id },
        ],
      },
    });

    const sharonLineups = await prisma.lineupEntry.findMany({
      where: {
        lineup: {
          roundId: round.id,
        },
        OR: [
          { player1Id: sharon.id },
          { player2Id: sharon.id },
        ],
      },
    });

    const monicaMixed = monicaLineups.filter(le => le.slot === 'MIXED_1' || le.slot === 'MIXED_2');
    const sharonMixed = sharonLineups.filter(le => le.slot === 'MIXED_1' || le.slot === 'MIXED_2');

    if (monicaMixed.length > 0 || sharonMixed.length > 0) {
      console.log(`Round ${round.idx} (${round.bracketType || 'UNKNOWN'}):`);
      if (monicaMixed.length > 0) {
        console.log(`  Monica: ${monicaMixed.length} MIXED entries`);
        monicaMixed.forEach(le => console.log(`    - ${le.slot} (ID: ${le.id})`));
      }
      if (sharonMixed.length > 0) {
        console.log(`  Sharon: ${sharonMixed.length} MIXED entries`);
        sharonMixed.forEach(le => console.log(`    - ${le.slot} (ID: ${le.id})`));
      }
      if (monicaMixed.length > 0 && sharonMixed.length === 0) {
        console.log(`  ⚠️  Monica played without Sharon!`);
      }
      if (sharonMixed.length > 0 && monicaMixed.length === 0) {
        console.log(`  ⚠️  Sharon played without Monica!`);
      }
      console.log();
    }
  }

  // Final count
  const allMonicaMixed = await prisma.lineupEntry.findMany({
    where: {
      lineup: {
        round: {
          stop: {
            tournamentId: tournament.id,
          },
        },
      },
      OR: [
        { player1Id: monica.id },
        { player2Id: monica.id },
      ],
    },
  });

  const allSharonMixed = await prisma.lineupEntry.findMany({
    where: {
      lineup: {
        round: {
          stop: {
            tournamentId: tournament.id,
          },
        },
      },
      OR: [
        { player1Id: sharon.id },
        { player2Id: sharon.id },
      ],
    },
  });

  const monicaCount = allMonicaMixed.filter(le => le.slot === 'MIXED_1' || le.slot === 'MIXED_2').length;
  const sharonCount = allSharonMixed.filter(le => le.slot === 'MIXED_1' || le.slot === 'MIXED_2').length;

  console.log(`\n${'='.repeat(80)}`);
  console.log('FINAL COUNT');
  console.log('='.repeat(80));
  console.log(`Monica MIXED lineup entries: ${monicaCount}`);
  console.log(`Sharon MIXED lineup entries: ${sharonCount}`);
}

checkAllRounds()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

