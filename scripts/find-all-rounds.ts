import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function findAllRounds() {
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

  // Get ALL rounds in the tournament
  const allRounds = await prisma.round.findMany({
    where: {
      stop: {
        tournamentId: tournament.id,
      },
    },
    include: {
      stop: { select: { name: true } },
      matches: {
        include: {
          games: {
            where: {
              OR: [
                { slot: 'MIXED_1' },
                { slot: 'MIXED_2' },
              ],
            },
          },
        },
      },
    },
    orderBy: { idx: 'asc' },
  });

  console.log(`\nAll rounds in tournament: ${allRounds.length}\n`);

  for (const round of allRounds) {
    console.log(`Round ${round.idx} (${round.bracketType || 'UNKNOWN'}):`);
    console.log(`  Matches: ${round.matches.length}`);
    
    // Check for Monica/Sharon in this round
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
      console.log(`  ✅ Monica MIXED entries: ${monicaMixed.length}`);
      console.log(`  ✅ Sharon MIXED entries: ${sharonMixed.length}`);
      
      monicaMixed.forEach(le => {
        console.log(`     Monica: ${le.slot} (Lineup ID: ${le.id})`);
      });
      sharonMixed.forEach(le => {
        console.log(`     Sharon: ${le.slot} (Lineup ID: ${le.id})`);
      });
    }
    console.log();
  }

  // Also check if there are any other lineup entries we missed
  const allMonicaLineups = await prisma.lineupEntry.findMany({
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
    include: {
      lineup: {
        include: {
          round: { select: { idx: true, bracketType: true } },
        },
      },
    },
  });

  const allSharonLineups = await prisma.lineupEntry.findMany({
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
    include: {
      lineup: {
        include: {
          round: { select: { idx: true, bracketType: true } },
        },
      },
    },
  });

  console.log(`\nTotal Monica lineup entries: ${allMonicaLineups.length}`);
  console.log(`Total Sharon lineup entries: ${allSharonLineups.length}`);
  
  const monicaMixedAll = allMonicaLineups.filter(le => le.slot === 'MIXED_1' || le.slot === 'MIXED_2');
  const sharonMixedAll = allSharonLineups.filter(le => le.slot === 'MIXED_1' || le.slot === 'MIXED_2');
  
  console.log(`Monica MIXED entries: ${monicaMixedAll.length}`);
  console.log(`Sharon MIXED entries: ${sharonMixedAll.length}`);
}

findAllRounds()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

