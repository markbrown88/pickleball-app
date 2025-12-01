import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function verifyTournament() {
  // Search for all tournaments with "Grand Finale" or similar
  const tournaments = await prisma.tournament.findMany({
    where: {
      OR: [
        { name: { contains: 'Grand Finale', mode: 'insensitive' } },
        { name: { contains: 'Finale', mode: 'insensitive' } },
        { name: { contains: 'Klyng', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      type: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log('\nTournaments found:\n');
  tournaments.forEach((t, idx) => {
    console.log(`${idx + 1}. "${t.name}"`);
    console.log(`   ID: ${t.id}`);
    console.log(`   Type: ${t.type}`);
    console.log(`   Created: ${t.createdAt}`);
    console.log();
  });

  // Now check Monica and Sharon in each
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

  if (!monica || !sharon) {
    console.log('Players not found');
    return;
  }

  for (const tournament of tournaments) {
    const monicaLineups = await prisma.lineupEntry.findMany({
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

    const sharonLineups = await prisma.lineupEntry.findMany({
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

    const monicaMixed = monicaLineups.filter(le => le.slot === 'MIXED_1' || le.slot === 'MIXED_2');
    const sharonMixed = sharonLineups.filter(le => le.slot === 'MIXED_1' || le.slot === 'MIXED_2');

    if (monicaMixed.length > 0 || sharonMixed.length > 0) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`Tournament: "${tournament.name}"`);
      console.log('='.repeat(80));
      console.log(`Monica MIXED entries: ${monicaMixed.length}`);
      console.log(`Sharon MIXED entries: ${sharonMixed.length}`);
      
      if (monicaMixed.length > 0) {
        console.log('\nMonica games:');
        monicaMixed.forEach(le => {
          console.log(`  Round ${le.lineup.round.idx} - ${le.slot}`);
        });
      }
      
      if (sharonMixed.length > 0) {
        console.log('\nSharon games:');
        sharonMixed.forEach(le => {
          console.log(`  Round ${le.lineup.round.idx} - ${le.slot}`);
        });
      }
    }
  }
}

verifyTournament()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

