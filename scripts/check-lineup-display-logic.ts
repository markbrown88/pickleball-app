import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function checkDisplayLogic() {
  const tournament = await prisma.tournament.findFirst({
    where: {
      name: { equals: 'KLYNG CUP - GRAND FINALE' },
    },
    select: { id: true, type: true },
  });

  if (!tournament) return;

  console.log(`\n${'='.repeat(80)}`);
  console.log('CHECKING LINEUP DISPLAY LOGIC');
  console.log(`Tournament Type: ${tournament.type}`);
  console.log('='.repeat(80));

  // Get Round 0 lineup for Greenhills
  const round0 = await prisma.round.findFirst({
    where: {
      stop: { tournamentId: tournament.id },
      idx: 0,
    },
    include: {
      matches: {
        include: {
          teamA: { select: { name: true } },
          teamB: { select: { name: true } },
        },
      },
    },
  });

  if (!round0) return;

  const greenhillsMatch = round0.matches.find(m => 
    m.teamA?.name?.includes('Greenhills') || m.teamB?.name?.includes('Greenhills')
  );

  if (!greenhillsMatch) return;

  const greenhillsTeamId = greenhillsMatch.teamA?.name?.includes('Greenhills') 
    ? greenhillsMatch.teamAId 
    : greenhillsMatch.teamBId;

  if (!greenhillsTeamId) return;

  const lineup = await prisma.lineup.findFirst({
    where: {
      roundId: round0.id,
      teamId: greenhillsTeamId,
    },
    include: {
      entries: {
        include: {
          player1: { select: { name: true, gender: true } },
          player2: { select: { name: true, gender: true } },
        },
      },
    },
  });

  if (!lineup) {
    console.log('\nNo lineup found for Round 0');
    return;
  }

  console.log(`\nLineup ID: ${lineup.id}`);
  console.log(`Bracket ID: ${lineup.bracketId || 'NULL'}`);
  console.log(`\nAll Lineup Entries:`);
  
  lineup.entries.forEach(entry => {
    console.log(`  ${entry.slot}: ${entry.player1?.name || 'N/A'} & ${entry.player2?.name || 'N/A'}`);
  });

  // Check how extractCoreLineupFromEntries would build the array
  const mensDoubles = lineup.entries.find(e => e.slot === 'MENS_DOUBLES');
  const womensDoubles = lineup.entries.find(e => e.slot === 'WOMENS_DOUBLES');
  const mixed1 = lineup.entries.find(e => e.slot === 'MIXED_1');
  const mixed2 = lineup.entries.find(e => e.slot === 'MIXED_2');

  console.log(`\nHow display logic builds the 4-player array:`);
  if (mensDoubles && womensDoubles) {
    const coreLineup = [
      mensDoubles.player1,
      mensDoubles.player2,
      womensDoubles.player1,
      womensDoubles.player2,
    ];
    console.log(`  [0] Man1: ${coreLineup[0]?.name || 'N/A'}`);
    console.log(`  [1] Man2: ${coreLineup[1]?.name || 'N/A'}`);
    console.log(`  [2] Woman1: ${coreLineup[2]?.name || 'N/A'}`);
    console.log(`  [3] Woman2: ${coreLineup[3]?.name || 'N/A'}`);
    console.log(`\n  Derived MIXED_1: ${coreLineup[0]?.name} & ${coreLineup[2]?.name}`);
    console.log(`  Derived MIXED_2: ${coreLineup[1]?.name} & ${coreLineup[3]?.name}`);
  }

  console.log(`\nActual MIXED entries in database:`);
  if (mixed1) {
    console.log(`  MIXED_1: ${mixed1.player1?.name} & ${mixed1.player2?.name}`);
  }
  if (mixed2) {
    console.log(`  MIXED_2: ${mixed2.player1?.name} & ${mixed2.player2?.name}`);
  }

  console.log(`\n⚠️  ISSUE: The display uses MENS_DOUBLES/WOMENS_DOUBLES to build the array,`);
  console.log(`   then derives MIXED slots from that array. It does NOT use the MIXED entries directly!`);
}

checkDisplayLogic()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

