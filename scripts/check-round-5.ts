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

  if (!round5) {
    console.log('Round 5 not found');
    return;
  }

  console.log(`\nRound 5 (${round5.bracketType || 'UNKNOWN'}):`);
  console.log(`Matches: ${round5.matches.length}\n`);

  for (const match of round5.matches) {
    console.log(`Match: ${match.teamA?.name || 'TBD'} vs ${match.teamB?.name || 'TBD'}`);
    console.log(`  Match ID: ${match.id}`);
    console.log(`  Games: ${match.games.length}`);
    
    // Check for lineup entries for this match
    const lineups = await prisma.lineupEntry.findMany({
      where: {
        lineup: {
          roundId: round5.id,
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
            team: { select: { name: true, id: true } },
          },
        },
        player1: { select: { name: true, firstName: true, lastName: true } },
        player2: { select: { name: true, firstName: true, lastName: true } },
      },
    });

    const mixedLineups = lineups.filter(le => le.slot === 'MIXED_1' || le.slot === 'MIXED_2');
    
    if (mixedLineups.length > 0) {
      console.log(`  ✅ Found ${mixedLineups.length} MIXED lineup entries:`);
      for (const entry of mixedLineups) {
        const player = entry.player1Id === monica.id || entry.player2Id === monica.id ? 'Monica' : 'Sharon';
        const partner = entry.player1Id === monica.id || entry.player1Id === sharon.id ? entry.player2 : entry.player1;
        const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
        console.log(`    ${player}: ${entry.slot} with ${partnerName}`);
        console.log(`    Team: ${entry.lineup.team.name}`);
        console.log(`    Lineup ID: ${entry.id}`);
      }
    } else {
      console.log(`  No MIXED lineup entries found for Monica/Sharon`);
    }
    console.log();
  }
}

checkRound5()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

