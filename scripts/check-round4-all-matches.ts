import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function checkRound4() {
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

  // Get Round 4
  const round4 = await prisma.round.findFirst({
    where: {
      stop: {
        tournamentId: tournament.id,
      },
      idx: 4,
    },
    include: {
      matches: {
        include: {
          teamA: { select: { name: true, id: true } },
          teamB: { select: { name: true, id: true } },
          games: {
            where: {
              OR: [
                { slot: 'MIXED_1' },
                { slot: 'MIXED_2' },
              ],
            },
            include: {
              bracket: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!round4) {
    console.log('Round 4 not found');
    return;
  }

  console.log(`\nRound 4 has ${round4.matches.length} matches:\n`);

  for (const match of round4.matches) {
    const hasGreenhills = match.teamA?.name === 'Greenhills Intermediate' || match.teamB?.name === 'Greenhills Intermediate';
    const opponent = match.teamA?.name === 'Greenhills Intermediate' ? match.teamB?.name : match.teamA?.name;

    console.log(`Match: ${match.teamA?.name || 'TBD'} vs ${match.teamB?.name || 'TBD'}`);
    console.log(`  Match ID: ${match.id}`);
    console.log(`  Has Greenhills: ${hasGreenhills}`);
    if (hasGreenhills) {
      console.log(`  Opponent: ${opponent}`);
    }

    // Check for Monica/Sharon lineup entries in this match
    const monicaLineups = await prisma.lineupEntry.findMany({
      where: {
        lineup: {
          roundId: round4.id,
          teamId: hasGreenhills ? (match.teamA?.name === 'Greenhills Intermediate' ? match.teamA.id : match.teamB?.id) : undefined,
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
          roundId: round4.id,
          teamId: hasGreenhills ? (match.teamA?.name === 'Greenhills Intermediate' ? match.teamA.id : match.teamB?.id) : undefined,
        },
        OR: [
          { player1Id: sharon.id },
          { player2Id: sharon.id },
        ],
      },
    });

    const monicaMixed = monicaLineups.filter(le => le.slot === 'MIXED_1' || le.slot === 'MIXED_2');
    const sharonMixed = sharonLineups.filter(le => le.slot === 'MIXED_1' || le.slot === 'MIXED_2');

    if (hasGreenhills) {
      console.log(`  Monica MIXED entries: ${monicaMixed.length}`);
      monicaMixed.forEach(le => console.log(`    - ${le.slot} (ID: ${le.id})`));
      console.log(`  Sharon MIXED entries: ${sharonMixed.length}`);
      sharonMixed.forEach(le => console.log(`    - ${le.slot} (ID: ${le.id})`));
    }

    console.log(`  Games in this match:`);
    for (const game of match.games) {
      console.log(`    ${game.slot} - ${game.bracket?.name || 'No Bracket'} (Game ID: ${game.id})`);
    }
    console.log();
  }

  // Also check all rounds to see all opponents
  console.log(`\n${'='.repeat(80)}`);
  console.log('ALL ROUNDS - ALL OPPONENTS');
  console.log('='.repeat(80));

  const allRounds = await prisma.round.findMany({
    where: {
      stop: {
        tournamentId: tournament.id,
      },
      idx: { in: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
    },
    include: {
      matches: {
        include: {
          teamA: { select: { name: true } },
          teamB: { select: { name: true } },
        },
      },
    },
    orderBy: { idx: 'asc' },
  });

  for (const round of allRounds) {
    const matchesWithGreenhills = round.matches.filter(m => 
      m.teamA?.name === 'Greenhills Intermediate' || m.teamB?.name === 'Greenhills Intermediate'
    );

    if (matchesWithGreenhills.length > 0) {
      console.log(`\nRound ${round.idx} (${round.bracketType || 'UNKNOWN'}):`);
      for (const match of matchesWithGreenhills) {
        const opponent = match.teamA?.name === 'Greenhills Intermediate' ? match.teamB?.name : match.teamA?.name;
        console.log(`  vs ${opponent} (Match ID: ${match.id})`);
      }
    }
  }
}

checkRound4()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

