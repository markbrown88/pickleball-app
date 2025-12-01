import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function present4Matchups() {
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
      name: { equals: 'KLYNG CUP - GRAND FINALE' },
    },
    select: { id: true },
  });

  if (!monica || !sharon || !tournament) return;

  const allLineups = await prisma.lineupEntry.findMany({
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
        { player1Id: sharon.id },
        { player2Id: sharon.id },
      ],
    },
    include: {
      lineup: {
        include: {
          round: { select: { id: true, idx: true, bracketType: true } },
          team: { select: { id: true, name: true } },
        },
      },
      player1: { select: { name: true, firstName: true, lastName: true } },
      player2: { select: { name: true, firstName: true, lastName: true } },
    },
  });

  const monicaMixed = allLineups.filter(
    le => (le.player1Id === monica.id || le.player2Id === monica.id) && 
          (le.slot === 'MIXED_1' || le.slot === 'MIXED_2')
  );

  const sharonMixed = allLineups.filter(
    le => (le.player1Id === sharon.id || le.player2Id === sharon.id) && 
          (le.slot === 'MIXED_1' || le.slot === 'MIXED_2')
  );

  // Get matches to find opponents
  const allMatches = await prisma.match.findMany({
    where: {
      round: {
        stop: {
          tournamentId: tournament.id,
        },
      },
    },
    include: {
      round: { select: { idx: true, bracketType: true } },
      teamA: { select: { name: true } },
      teamB: { select: { name: true } },
    },
  });

  console.log(`\n${'='.repeat(80)}`);
  console.log('4 MATCHUPS FOR MONICA LIN & SHARON SCARFONE');
  console.log('Tournament: "KLYNG CUP - GRAND FINALE"');
  console.log('='.repeat(80));

  // Matchup 1: Round 0 vs 4 Fathers (first time)
  const round0Monica = monicaMixed.find(le => le.lineup.round.idx === 0);
  const round0Sharon = sharonMixed.find(le => le.lineup.round.idx === 0);
  const round0Match = allMatches.find(m => 
    m.round.idx === 0 && 
    (m.teamA?.name?.includes('4 Fathers') || m.teamB?.name?.includes('4 Fathers')) &&
    (m.teamA?.name?.includes('Greenhills') || m.teamB?.name?.includes('Greenhills'))
  );

  console.log(`\n1. Round 0 (WINNER) vs 4 Fathers Intermediate`);
  if (round0Monica) {
    const partner = round0Monica.player1Id === monica.id ? round0Monica.player2 : round0Monica.player1;
    const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
    console.log(`   Monica: ${round0Monica.slot} with ${partnerName}`);
    console.log(`   Lineup Entry ID: ${round0Monica.id}`);
  }
  if (round0Sharon) {
    const partner = round0Sharon.player1Id === sharon.id ? round0Sharon.player2 : round0Sharon.player1;
    const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
    console.log(`   Sharon: ${round0Sharon.slot} with ${partnerName}`);
    console.log(`   Lineup Entry ID: ${round0Sharon.id}`);
  }
  console.log(`   → SWAP: Monica to MIXED_1, Sharon to MIXED_2`);

  // Matchup 2: Round 3 vs Pickleplex Barrie
  const round3Monica = monicaMixed.find(le => le.lineup.round.idx === 3);
  const round3Sharon = sharonMixed.find(le => le.lineup.round.idx === 3);

  console.log(`\n2. Round 3 (LOSER) vs Pickleplex Barrie Intermediate`);
  if (round3Monica) {
    const partner = round3Monica.player1Id === monica.id ? round3Monica.player2 : round3Monica.player1;
    const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
    console.log(`   Monica: ${round3Monica.slot} with ${partnerName}`);
    console.log(`   Lineup Entry ID: ${round3Monica.id}`);
  }
  if (round3Sharon) {
    const partner = round3Sharon.player1Id === sharon.id ? round3Sharon.player2 : round3Sharon.player1;
    const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
    console.log(`   Sharon: ${round3Sharon.slot} with ${partnerName}`);
    console.log(`   Lineup Entry ID: ${round3Sharon.id}`);
  }
  console.log(`   → SWAP: Monica to MIXED_1, Sharon to MIXED_2`);

  // Matchup 3: Round 4 vs One Health
  const round4Monica = monicaMixed.find(le => le.lineup.round.idx === 4);
  const round4Sharon = sharonMixed.find(le => le.lineup.round.idx === 4);
  const round4OneHealthMatch = allMatches.find(m => 
    m.round.idx === 4 && 
    (m.teamA?.name?.includes('One Health') || m.teamB?.name?.includes('One Health')) &&
    (m.teamA?.name?.includes('Greenhills') || m.teamB?.name?.includes('Greenhills'))
  );

  console.log(`\n3. Round 4 (LOSER) vs One Health Intermediate`);
  if (round4Monica) {
    const partner = round4Monica.player1Id === monica.id ? round4Monica.player2 : round4Monica.player1;
    const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
    console.log(`   Monica: ${round4Monica.slot} with ${partnerName}`);
    console.log(`   Lineup Entry ID: ${round4Monica.id}`);
  }
  if (round4Sharon) {
    const partner = round4Sharon.player1Id === sharon.id ? round4Sharon.player2 : round4Sharon.player1;
    const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
    console.log(`   Sharon: ${round4Sharon.slot} with ${partnerName}`);
    console.log(`   Lineup Entry ID: ${round4Sharon.id}`);
  }
  console.log(`   → SWAP: Monica to MIXED_2, Sharon to MIXED_1`);

  // Matchup 4: Round 4 vs 4 Fathers (again)
  const round4FourFathersMatch = allMatches.find(m => 
    m.round.idx === 4 && 
    (m.teamA?.name?.includes('4 Fathers') || m.teamB?.name?.includes('4 Fathers')) &&
    (m.teamA?.name?.includes('Greenhills') || m.teamB?.name?.includes('Greenhills'))
  );

  console.log(`\n4. Round 4 (LOSER) vs 4 Fathers Intermediate (again)`);
  if (round4Monica) {
    const partner = round4Monica.player1Id === monica.id ? round4Monica.player2 : round4Monica.player1;
    const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
    console.log(`   Monica: ${round4Monica.slot} with ${partnerName}`);
    console.log(`   Lineup Entry ID: ${round4Monica.id} (same as matchup 3)`);
  }
  if (round4Sharon) {
    const partner = round4Sharon.player1Id === sharon.id ? round4Sharon.player2 : round4Sharon.player1;
    const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
    console.log(`   Sharon: ${round4Sharon.slot} with ${partnerName}`);
    console.log(`   Lineup Entry ID: ${round4Sharon.id} (same as matchup 3)`);
  }
  console.log(`   → SWAP: Monica to MIXED_2, Sharon to MIXED_1`);

  console.log(`\n\n${'='.repeat(80)}`);
  console.log('SWAP PLAN SUMMARY');
  console.log('='.repeat(80));
  console.log(`\nTotal lineup entries to update: 3 (not 6, because Round 0 and Round 4 each have one lineup entry per player)`);
  console.log(`\n1. Round 0 lineup entries (applies to all Round 0 opponents):`);
  console.log(`   - Update Monica's entry (${round0Monica?.id}): MIXED_2 → MIXED_1`);
  console.log(`   - Update Sharon's entry (${round0Sharon?.id}): MIXED_1 → MIXED_2`);
  console.log(`\n2. Round 3 lineup entries:`);
  console.log(`   - Update Monica's entry (${round3Monica?.id}): MIXED_2 → MIXED_1`);
  console.log(`   - Update Sharon's entry (${round3Sharon?.id}): MIXED_1 → MIXED_2`);
  console.log(`\n3. Round 4 lineup entries (applies to both One Health and 4 Fathers matches):`);
  console.log(`   - Update Monica's entry (${round4Monica?.id}): MIXED_1 → MIXED_2`);
  console.log(`   - Update Sharon's entry (${round4Sharon?.id}): MIXED_2 → MIXED_1`);
}

present4Matchups()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

