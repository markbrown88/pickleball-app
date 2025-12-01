import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function checkRound4Detailed() {
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

  const greenhillsTeam = await prisma.team.findFirst({
    where: {
      name: { contains: 'Greenhills Intermediate', mode: 'insensitive' },
      tournamentId: tournament.id,
    },
    select: { id: true },
  });

  if (!greenhillsTeam) return;

  // Get the two Round 4 matches
  const match1 = await prisma.match.findUnique({
    where: { id: 'cmij643wz004fl5042enopesp' }, // Round 4 vs One Health
    include: {
      round: { select: { idx: true, id: true } },
      teamA: { select: { name: true } },
      teamB: { select: { name: true } },
    },
  });

  const match2 = await prisma.match.findUnique({
    where: { id: 'cmij6438y003xl504y6x0dwu1' }, // Round 4 vs 4 Fathers
    include: {
      round: { select: { idx: true, id: true } },
      teamA: { select: { name: true } },
      teamB: { select: { name: true } },
    },
  });

  console.log(`\n${'='.repeat(80)}`);
  console.log('ROUND 4 MATCHES - DETAILED LINEUP CHECK');
  console.log('='.repeat(80));

  for (const [matchNum, match] of [[1, match1], [2, match2]] as const) {
    if (!match) continue;

    const opponent = match.teamAId === greenhillsTeam.id ? match.teamB : match.teamA;
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Match ${matchNum}: vs ${opponent?.name || 'TBD'}`);
    console.log(`Match ID: ${match.id}`);
    console.log(`Round ID: ${match.round.id}`);
    console.log(`Round Index: ${match.round.idx}`);

    // Get ALL lineups for Greenhills in this round
    const allLineups = await prisma.lineup.findMany({
      where: {
        roundId: match.round.id,
        teamId: greenhillsTeam.id,
      },
      include: {
        bracket: { select: { name: true, id: true } },
        entries: {
          where: {
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
        },
      },
    });

    console.log(`\nTotal lineups found for Greenhills in Round ${match.round.idx}: ${allLineups.length}`);

    for (const lineup of allLineups) {
      console.log(`\n  Lineup ID: ${lineup.id}`);
      console.log(`  Bracket ID: ${lineup.bracketId || 'NULL'}`);
      console.log(`  Bracket Name: ${lineup.bracket?.name || 'N/A'}`);
      console.log(`  MIXED entries: ${lineup.entries.filter(e => e.slot === 'MIXED_1' || e.slot === 'MIXED_2').length}`);

      const monicaEntries = lineup.entries.filter(
        e => (e.player1Id === monica.id || e.player2Id === monica.id) &&
             (e.slot === 'MIXED_1' || e.slot === 'MIXED_2')
      );
      const sharonEntries = lineup.entries.filter(
        e => (e.player1Id === sharon.id || e.player2Id === sharon.id) &&
             (e.slot === 'MIXED_1' || e.slot === 'MIXED_2')
      );

      monicaEntries.forEach(entry => {
        const partner = entry.player1Id === monica.id ? entry.player2 : entry.player1;
        const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
        console.log(`    Monica: ${entry.slot} with ${partnerName} (Entry ID: ${entry.id})`);
      });

      sharonEntries.forEach(entry => {
        const partner = entry.player1Id === sharon.id ? entry.player2 : entry.player1;
        const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
        console.log(`    Sharon: ${entry.slot} with ${partnerName} (Entry ID: ${entry.id})`);
      });
    }

    // Also check which games in this match reference which lineup entries
    const games = await prisma.game.findMany({
      where: {
        matchId: match.id,
        OR: [
          { slot: 'MIXED_1' },
          { slot: 'MIXED_2' },
        ],
      },
      include: {
        bracket: { select: { name: true, id: true } },
      },
    });

    console.log(`\n  Games in this match:`);
    games.forEach(game => {
      console.log(`    Game ID: ${game.id}, Slot: ${game.slot}, Bracket: ${game.bracket?.name || 'N/A'} (${game.bracketId || 'NULL'})`);
    });
  }

  // Now check if the matches are in the same round
  if (match1 && match2) {
    console.log(`\n\n${'='.repeat(80)}`);
    console.log('COMPARISON');
    console.log('='.repeat(80));
    console.log(`Same Round ID? ${match1.round.id === match2.round.id}`);
    console.log(`Same Round Index? ${match1.round.idx === match2.round.idx}`);
    
    if (match1.round.id === match2.round.id) {
      console.log(`\n⚠️  Both matches are in the same round, so they MIGHT share lineups.`);
      console.log(`   However, in DE Clubs tournaments, each match might have its own lineup via bracketId.`);
    }
  }
}

checkRound4Detailed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

