import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function checkRound5Lineups() {
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

  const round5 = await prisma.round.findFirst({
    where: {
      stop: {
        tournamentId: tournament.id,
      },
      idx: 5,
    },
    select: { id: true, idx: true, bracketType: true },
  });

  if (!round5) {
    console.log('Round 5 not found');
    return;
  }

  // Get Greenhills Intermediate team
  const greenhillsTeam = await prisma.team.findFirst({
    where: {
      name: { contains: 'Greenhills Intermediate', mode: 'insensitive' },
      tournamentId: tournament.id,
    },
    select: { id: true, name: true },
  });

  if (!greenhillsTeam) {
    console.log('Greenhills Intermediate team not found');
    return;
  }

  // Get ALL lineup entries for Greenhills in Round 5
  const allLineups = await prisma.lineupEntry.findMany({
    where: {
      lineup: {
        roundId: round5.id,
        teamId: greenhillsTeam.id,
      },
    },
    include: {
      player1: { select: { id: true, name: true, firstName: true, lastName: true } },
      player2: { select: { id: true, name: true, firstName: true, lastName: true } },
    },
  });

  console.log(`\nRound 5 (${round5.bracketType || 'UNKNOWN'}):`);
  console.log(`All Greenhills Intermediate lineup entries: ${allLineups.length}\n`);

  allLineups.forEach((entry, idx) => {
    const p1Name = entry.player1.name || `${entry.player1.firstName} ${entry.player1.lastName}`;
    const p2Name = entry.player2.name || `${entry.player2.firstName} ${entry.player2.lastName}`;
    const isMonica = entry.player1Id === monica.id || entry.player2Id === monica.id;
    const isSharon = entry.player1Id === sharon.id || entry.player2Id === sharon.id;
    
    console.log(`${idx + 1}. ${entry.slot}: ${p1Name} & ${p2Name}`);
    if (isMonica) console.log(`   ✅ Contains Monica Lin`);
    if (isSharon) console.log(`   ✅ Contains Sharon Scarfone`);
    console.log(`   Lineup ID: ${entry.id}`);
  });

  const monicaLineups = allLineups.filter(le => 
    (le.slot === 'MIXED_1' || le.slot === 'MIXED_2') &&
    (le.player1Id === monica.id || le.player2Id === monica.id)
  );

  const sharonLineups = allLineups.filter(le => 
    (le.slot === 'MIXED_1' || le.slot === 'MIXED_2') &&
    (le.player1Id === sharon.id || le.player2Id === sharon.id)
  );

  console.log(`\nMonica MIXED entries in Round 5: ${monicaLineups.length}`);
  console.log(`Sharon MIXED entries in Round 5: ${sharonLineups.length}`);
}

checkRound5Lineups()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

