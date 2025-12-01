import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function checkSpecificMatchLineups() {
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
      name: { equals: 'KLYNG CUP - GRAND FINALE' },
    },
    select: { id: true },
  });

  if (!monica || !sharon || !tournament) return;

  // Get the specific matches
  const match1 = await prisma.match.findFirst({
    where: {
      id: 'cmij63yw4000nl504nq51of0b', // Round 0 vs 4 Fathers
    },
    include: {
      round: { select: { idx: true, bracketType: true, id: true } },
      teamA: { select: { name: true } },
      teamB: { select: { name: true } },
    },
  });

  const match2 = await prisma.match.findFirst({
    where: {
      id: 'cmij642il003dl504qq3ayyxk', // Round 3 vs Pickleplex
    },
    include: {
      round: { select: { idx: true, bracketType: true, id: true } },
      teamA: { select: { name: true } },
      teamB: { select: { name: true } },
    },
  });

  const match3 = await prisma.match.findFirst({
    where: {
      id: 'cmij643wz004fl5042enopesp', // Round 4 vs One Health
    },
    include: {
      round: { select: { idx: true, bracketType: true, id: true } },
      teamA: { select: { name: true } },
      teamB: { select: { name: true } },
    },
  });

  const match4 = await prisma.match.findFirst({
    where: {
      id: 'cmij6438y003xl504y6x0dwu1', // Round 4 vs 4 Fathers
    },
    include: {
      round: { select: { idx: true, bracketType: true, id: true } },
      teamA: { select: { name: true } },
      teamB: { select: { name: true } },
    },
  });

  const matches = [match1, match2, match3, match4].filter(Boolean);

  console.log(`\n${'='.repeat(80)}`);
  console.log('4 MATCHUPS - SPECIFIC LINEUP ENTRIES');
  console.log('='.repeat(80));

  for (const match of matches) {
    if (!match) continue;

    const opponent = match.teamA?.name?.includes('Greenhills') ? match.teamB : match.teamA;
    
    console.log(`\nMatch: Round ${match.round.idx} vs ${opponent?.name || 'TBD'}`);
    console.log(`  Match ID: ${match.id}`);
    console.log(`  Round ID: ${match.round.id}`);

    // Get lineup entries for THIS specific round
    const lineups = await prisma.lineupEntry.findMany({
      where: {
        lineup: {
          roundId: match.round.id, // Use the specific round ID
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
            round: { select: { idx: true } },
          },
        },
        player1: { select: { name: true, firstName: true, lastName: true } },
        player2: { select: { name: true, firstName: true, lastName: true } },
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

    console.log(`  Lineup entries found: ${lineups.length} total, ${monicaMixed.length} Monica MIXED, ${sharonMixed.length} Sharon MIXED`);

    monicaMixed.forEach(le => {
      const partner = le.player1Id === monica.id ? le.player2 : le.player1;
      const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
      console.log(`    Monica: ${le.slot} with ${partnerName} (Lineup ID: ${le.id}, Round: ${le.lineup.round.idx})`);
    });

    sharonMixed.forEach(le => {
      const partner = le.player1Id === sharon.id ? le.player2 : le.player1;
      const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
      console.log(`    Sharon: ${le.slot} with ${partnerName} (Lineup ID: ${le.id}, Round: ${le.lineup.round.idx})`);
    });
  }
}

checkSpecificMatchLineups()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

