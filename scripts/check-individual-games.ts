import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function checkIndividual() {
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

  // Get ALL lineup entries for both, including all slots
  const allMonica = await prisma.lineupEntry.findMany({
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
          team: { select: { name: true } },
        },
      },
      player1: { select: { name: true, firstName: true, lastName: true } },
      player2: { select: { name: true, firstName: true, lastName: true } },
    },
    orderBy: [
      { lineup: { round: { idx: 'asc' } } },
      { slot: 'asc' },
    ],
  });

  const allSharon = await prisma.lineupEntry.findMany({
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
          team: { select: { name: true } },
        },
      },
      player1: { select: { name: true, firstName: true, lastName: true } },
      player2: { select: { name: true, firstName: true, lastName: true } },
    },
    orderBy: [
      { lineup: { round: { idx: 'asc' } } },
      { slot: 'asc' },
    ],
  });

  console.log(`\n${'='.repeat(80)}`);
  console.log('ALL MONICA LIN LINEUP ENTRIES (ALL SLOTS)');
  console.log('='.repeat(80));
  allMonica.forEach((entry, idx) => {
    const partner = entry.player1Id === monica.id ? entry.player2 : entry.player1;
    const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
    console.log(`${idx + 1}. Round ${entry.lineup.round.idx} (${entry.lineup.round.bracketType || 'UNKNOWN'}) - ${entry.slot}`);
    console.log(`   Team: ${entry.lineup.team.name}`);
    console.log(`   Partner: ${partnerName}`);
    console.log(`   Lineup ID: ${entry.id}`);
  });

  console.log(`\n${'='.repeat(80)}`);
  console.log('ALL SHARON SCARFONE LINEUP ENTRIES (ALL SLOTS)');
  console.log('='.repeat(80));
  allSharon.forEach((entry, idx) => {
    const partner = entry.player1Id === sharon.id ? entry.player2 : entry.player1;
    const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
    console.log(`${idx + 1}. Round ${entry.lineup.round.idx} (${entry.lineup.round.bracketType || 'UNKNOWN'}) - ${entry.slot}`);
    console.log(`   Team: ${entry.lineup.team.name}`);
    console.log(`   Partner: ${partnerName}`);
    console.log(`   Lineup ID: ${entry.id}`);
  });

  // Count MIXED only
  const monicaMixed = allMonica.filter(le => le.slot === 'MIXED_1' || le.slot === 'MIXED_2');
  const sharonMixed = allSharon.filter(le => le.slot === 'MIXED_1' || le.slot === 'MIXED_2');

  console.log(`\n${'='.repeat(80)}`);
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Monica total entries: ${allMonica.length}`);
  console.log(`Monica MIXED entries: ${monicaMixed.length}`);
  console.log(`Sharon total entries: ${allSharon.length}`);
  console.log(`Sharon MIXED entries: ${sharonMixed.length}`);

  // Check if there are rounds where only one played
  const monicaRounds = new Set(monicaMixed.map(le => le.lineup.round.idx));
  const sharonRounds = new Set(sharonMixed.map(le => le.lineup.round.idx));

  console.log(`\nMonica played in rounds: ${Array.from(monicaRounds).sort().join(', ')}`);
  console.log(`Sharon played in rounds: ${Array.from(sharonRounds).sort().join(', ')}`);

  const onlyMonica = Array.from(monicaRounds).filter(r => !sharonRounds.has(r));
  const onlySharon = Array.from(sharonRounds).filter(r => !monicaRounds.has(r));

  if (onlyMonica.length > 0) {
    console.log(`\n⚠️  Monica played in rounds without Sharon: ${onlyMonica.join(', ')}`);
  }
  if (onlySharon.length > 0) {
    console.log(`\n⚠️  Sharon played in rounds without Monica: ${onlySharon.join(', ')}`);
  }
}

checkIndividual()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

