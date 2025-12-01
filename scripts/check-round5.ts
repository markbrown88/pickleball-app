import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function checkRound5() {
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
      name: { contains: 'Klyng Cup - Grand Finale', mode: 'insensitive' },
    },
    select: { id: true },
  });

  if (!monica || !sharon || !tournament) return;

  // Get Round 5
  const round5 = await prisma.round.findFirst({
    where: {
      stop: {
        tournamentId: tournament.id,
      },
      idx: 5,
    },
    include: {
      matches: {
        include: {
          teamA: { select: { name: true, id: true } },
          teamB: { select: { name: true, id: true } },
        },
      },
    },
  });

  if (!round5) {
    console.log('Round 5 not found');
    return;
  }

  console.log(`\nRound 5 (${round5.bracketType || 'UNKNOWN'}):\n`);

  const match = round5.matches.find(m => 
    m.teamA?.name === 'Greenhills Intermediate' || m.teamB?.name === 'Greenhills Intermediate'
  );

  if (match) {
    const opponent = match.teamA?.name === 'Greenhills Intermediate' ? match.teamB?.name : match.teamA?.name;
    const greenhillsTeamId = match.teamA?.name === 'Greenhills Intermediate' ? match.teamA.id : match.teamB?.id;

    console.log(`Match: Greenhills Intermediate vs ${opponent}`);
    console.log(`  Match ID: ${match.id}\n`);

    // Check for lineup entries
    const allLineups = await prisma.lineupEntry.findMany({
      where: {
        lineup: {
          roundId: round5.id,
          teamId: greenhillsTeamId,
        },
        OR: [
          { player1Id: monica.id },
          { player2Id: monica.id },
          { player1Id: sharon.id },
          { player2Id: sharon.id },
        ],
      },
      include: {
        player1: { select: { name: true, firstName: true, lastName: true } },
        player2: { select: { name: true, firstName: true, lastName: true } },
      },
    });

    const monicaLineups = allLineups.filter(le => le.player1Id === monica.id || le.player2Id === monica.id);
    const sharonLineups = allLineups.filter(le => le.player1Id === sharon.id || le.player2Id === sharon.id);

    const monicaMixed = monicaLineups.filter(le => le.slot === 'MIXED_1' || le.slot === 'MIXED_2');
    const sharonMixed = sharonLineups.filter(le => le.slot === 'MIXED_1' || le.slot === 'MIXED_2');

    console.log(`Monica lineup entries: ${monicaLineups.length}`);
    monicaLineups.forEach(le => {
      const partner = le.player1Id === monica.id ? le.player2 : le.player1;
      const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
      console.log(`  - ${le.slot} with ${partnerName} (ID: ${le.id})`);
    });

    console.log(`\nSharon lineup entries: ${sharonLineups.length}`);
    sharonLineups.forEach(le => {
      const partner = le.player1Id === sharon.id ? le.player2 : le.player1;
      const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
      console.log(`  - ${le.slot} with ${partnerName} (ID: ${le.id})`);
    });

    console.log(`\nMonica MIXED entries: ${monicaMixed.length}`);
    console.log(`Sharon MIXED entries: ${sharonMixed.length}`);

    if (monicaMixed.length > 0 || sharonMixed.length > 0) {
      console.log(`\n✅ FOUND THE MISSING GAME!`);
    }
  } else {
    console.log('No match with Greenhills Intermediate found in Round 5');
  }
}

checkRound5()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

