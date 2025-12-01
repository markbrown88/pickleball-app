import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function finalCheck() {
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

  // Get the exact tournament
  const tournament = await prisma.tournament.findFirst({
    where: {
      name: {
        equals: 'KLYNG CUP - GRAND FINALE',
      },
    },
    select: { id: true, name: true },
  });

  if (!monica || !sharon || !tournament) {
    console.log('Not found');
    return;
  }

  console.log(`\n✅ Tournament: "${tournament.name}" (${tournament.id})\n`);

  // Get ALL rounds
  const allRounds = await prisma.round.findMany({
    where: {
      stop: {
        tournamentId: tournament.id,
      },
    },
    orderBy: { idx: 'asc' },
  });

  console.log(`Total rounds: ${allRounds.length}\n`);

  // Check each round individually
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
      include: {
        lineup: {
          include: {
            team: { select: { name: true } },
          },
        },
        player1: { select: { name: true, firstName: true, lastName: true } },
        player2: { select: { name: true, firstName: true, lastName: true } },
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
      include: {
        lineup: {
          include: {
            team: { select: { name: true } },
          },
        },
        player1: { select: { name: true, firstName: true, lastName: true } },
        player2: { select: { name: true, firstName: true, lastName: true } },
      },
    });

    const monicaMixed = monicaLineups.filter(le => le.slot === 'MIXED_1' || le.slot === 'MIXED_2');
    const sharonMixed = sharonLineups.filter(le => le.slot === 'MIXED_1' || le.slot === 'MIXED_2');

    if (monicaMixed.length > 0 || sharonMixed.length > 0) {
      console.log(`Round ${round.idx} (${round.bracketType || 'UNKNOWN'}):`);
      
      if (monicaMixed.length > 0) {
        console.log(`  Monica MIXED entries: ${monicaMixed.length}`);
        monicaMixed.forEach(le => {
          const partner = le.player1Id === monica.id ? le.player2 : le.player1;
          const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
          console.log(`    - ${le.slot} with ${partnerName} (Team: ${le.lineup.team.name})`);
          console.log(`      Lineup ID: ${le.id}`);
        });
      }
      
      if (sharonMixed.length > 0) {
        console.log(`  Sharon MIXED entries: ${sharonMixed.length}`);
        sharonMixed.forEach(le => {
          const partner = le.player1Id === sharon.id ? le.player2 : le.player1;
          const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
          console.log(`    - ${le.slot} with ${partnerName} (Team: ${le.lineup.team.name})`);
          console.log(`      Lineup ID: ${le.id}`);
        });
      }
      console.log();
    }
  }

  // Final summary
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
    include: {
      lineup: {
        include: {
          round: { select: { idx: true } },
        },
      },
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
    include: {
      lineup: {
        include: {
          round: { select: { idx: true } },
        },
      },
    },
  });

  const monicaCount = allMonicaMixed.filter(le => le.slot === 'MIXED_1' || le.slot === 'MIXED_2').length;
  const sharonCount = allSharonMixed.filter(le => le.slot === 'MIXED_1' || le.slot === 'MIXED_2').length;

  console.log(`\n${'='.repeat(80)}`);
  console.log('FINAL SUMMARY FOR "KLYNG CUP - GRAND FINALE"');
  console.log('='.repeat(80));
  console.log(`Monica MIXED lineup entries: ${monicaCount}`);
  console.log(`Sharon MIXED lineup entries: ${sharonCount}`);
}

finalCheck()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

