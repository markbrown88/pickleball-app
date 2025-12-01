import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function checkByMatch() {
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

  // Get all matches with Greenhills Intermediate
  const greenhillsTeam = await prisma.team.findFirst({
    where: {
      name: { contains: 'Greenhills Intermediate', mode: 'insensitive' },
      tournamentId: tournament.id,
    },
    select: { id: true, name: true },
  });

  if (!greenhillsTeam) return;

  // Get all matches where Greenhills played
  const matches = await prisma.match.findMany({
    where: {
      round: {
        stop: {
          tournamentId: tournament.id,
        },
      },
      OR: [
        { teamAId: greenhillsTeam.id },
        { teamBId: greenhillsTeam.id },
      ],
    },
    include: {
      round: { select: { idx: true, bracketType: true } },
      teamA: { select: { name: true } },
      teamB: { select: { name: true } },
    },
    orderBy: [
      { round: { idx: 'asc' } },
    ],
  });

  console.log(`\n${'='.repeat(80)}`);
  console.log('ALL MATCHES WHERE GREENHILLS INTERMEDIATE PLAYED');
  console.log('='.repeat(80));

  for (const match of matches) {
    const opponent = match.teamAId === greenhillsTeam.id ? match.teamB : match.teamA;
    
    console.log(`\nRound ${match.round.idx} (${match.round.bracketType || 'UNKNOWN'})`);
    console.log(`  Greenhills Intermediate vs ${opponent?.name || 'TBD'}`);
    console.log(`  Match ID: ${match.id}`);

    // Get lineup entries for this specific round
    const lineups = await prisma.lineupEntry.findMany({
      where: {
        lineup: {
          roundId: match.round.id,
          teamId: greenhillsTeam.id,
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

    const monicaLineups = lineups.filter(
      le => (le.player1Id === monica.id || le.player2Id === monica.id) &&
            (le.slot === 'MIXED_1' || le.slot === 'MIXED_2')
    );

    const sharonLineups = lineups.filter(
      le => (le.player1Id === sharon.id || le.player2Id === sharon.id) &&
            (le.slot === 'MIXED_1' || le.slot === 'MIXED_2')
    );

    if (monicaLineups.length > 0 || sharonLineups.length > 0) {
      console.log(`  MIXED lineup entries:`);
      monicaLineups.forEach(le => {
        const partner = le.player1Id === monica.id ? le.player2 : le.player1;
        const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
        console.log(`    Monica: ${le.slot} with ${partnerName} (Lineup ID: ${le.id})`);
      });
      sharonLineups.forEach(le => {
        const partner = le.player1Id === sharon.id ? le.player2 : le.player1;
        const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
        console.log(`    Sharon: ${le.slot} with ${partnerName} (Lineup ID: ${le.id})`);
      });
    } else {
      console.log(`  No MIXED lineup entries found for Monica/Sharon`);
    }
  }

  // Now check specifically for the 4 matchups
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('THE 4 MATCHUPS - LINEUP ENTRIES');
  console.log('='.repeat(80));

  // Matchup 1: Round 0 vs 4 Fathers
  const round0Match = matches.find(m => 
    m.round.idx === 0 && 
    (m.teamA?.name?.includes('4 Fathers') || m.teamB?.name?.includes('4 Fathers'))
  );

  if (round0Match) {
    const round0Lineups = await prisma.lineupEntry.findMany({
      where: {
        lineup: {
          roundId: round0Match.round.id,
          teamId: greenhillsTeam.id,
        },
        OR: [
          { player1Id: monica.id },
          { player2Id: monica.id },
          { player1Id: sharon.id },
          { player2Id: sharon.id },
        ],
      },
    });

    const monicaEntry = round0Lineups.find(le => 
      (le.player1Id === monica.id || le.player2Id === monica.id) &&
      (le.slot === 'MIXED_1' || le.slot === 'MIXED_2')
    );
    const sharonEntry = round0Lineups.find(le => 
      (le.player1Id === sharon.id || le.player2Id === sharon.id) &&
      (le.slot === 'MIXED_1' || le.slot === 'MIXED_2')
    );

    console.log(`\n1. Round 0 vs 4 Fathers Intermediate`);
    console.log(`   Monica Entry ID: ${monicaEntry?.id} (${monicaEntry?.slot})`);
    console.log(`   Sharon Entry ID: ${sharonEntry?.id} (${sharonEntry?.slot})`);
  }

  // Matchup 2: Round 3 vs Pickleplex Barrie
  const round3Match = matches.find(m => 
    m.round.idx === 3 && 
    (m.teamA?.name?.includes('Pickleplex') || m.teamB?.name?.includes('Pickleplex'))
  );

  if (round3Match) {
    const round3Lineups = await prisma.lineupEntry.findMany({
      where: {
        lineup: {
          roundId: round3Match.round.id,
          teamId: greenhillsTeam.id,
        },
        OR: [
          { player1Id: monica.id },
          { player2Id: monica.id },
          { player1Id: sharon.id },
          { player2Id: sharon.id },
        ],
      },
    });

    const monicaEntry = round3Lineups.find(le => 
      (le.player1Id === monica.id || le.player2Id === monica.id) &&
      (le.slot === 'MIXED_1' || le.slot === 'MIXED_2')
    );
    const sharonEntry = round3Lineups.find(le => 
      (le.player1Id === sharon.id || le.player2Id === sharon.id) &&
      (le.slot === 'MIXED_1' || le.slot === 'MIXED_2')
    );

    console.log(`\n2. Round 3 vs Pickleplex Barrie Intermediate`);
    console.log(`   Monica Entry ID: ${monicaEntry?.id} (${monicaEntry?.slot})`);
    console.log(`   Sharon Entry ID: ${sharonEntry?.id} (${sharonEntry?.slot})`);
  }

  // Matchup 3: Round 4 vs One Health
  const round4OneHealthMatch = matches.find(m => 
    m.round.idx === 4 && 
    (m.teamA?.name?.includes('One Health') || m.teamB?.name?.includes('One Health'))
  );

  if (round4OneHealthMatch) {
    const round4OneHealthLineups = await prisma.lineupEntry.findMany({
      where: {
        lineup: {
          roundId: round4OneHealthMatch.round.id,
          teamId: greenhillsTeam.id,
        },
        OR: [
          { player1Id: monica.id },
          { player2Id: monica.id },
          { player1Id: sharon.id },
          { player2Id: sharon.id },
        ],
      },
    });

    const monicaEntry = round4OneHealthLineups.find(le => 
      (le.player1Id === monica.id || le.player2Id === monica.id) &&
      (le.slot === 'MIXED_1' || le.slot === 'MIXED_2')
    );
    const sharonEntry = round4OneHealthLineups.find(le => 
      (le.player1Id === sharon.id || le.player2Id === sharon.id) &&
      (le.slot === 'MIXED_1' || le.slot === 'MIXED_2')
    );

    console.log(`\n3. Round 4 vs One Health Intermediate`);
    console.log(`   Monica Entry ID: ${monicaEntry?.id} (${monicaEntry?.slot})`);
    console.log(`   Sharon Entry ID: ${sharonEntry?.id} (${sharonEntry?.slot})`);
  }

  // Matchup 4: Round 4 vs 4 Fathers (again)
  const round4FourFathersMatch = matches.find(m => 
    m.round.idx === 4 && 
    (m.teamA?.name?.includes('4 Fathers') || m.teamB?.name?.includes('4 Fathers'))
  );

  if (round4FourFathersMatch) {
    const round4FourFathersLineups = await prisma.lineupEntry.findMany({
      where: {
        lineup: {
          roundId: round4FourFathersMatch.round.id,
          teamId: greenhillsTeam.id,
        },
        OR: [
          { player1Id: monica.id },
          { player2Id: monica.id },
          { player1Id: sharon.id },
          { player2Id: sharon.id },
        ],
      },
    });

    const monicaEntry = round4FourFathersLineups.find(le => 
      (le.player1Id === monica.id || le.player2Id === monica.id) &&
      (le.slot === 'MIXED_1' || le.slot === 'MIXED_2')
    );
    const sharonEntry = round4FourFathersLineups.find(le => 
      (le.player1Id === sharon.id || le.player2Id === sharon.id) &&
      (le.slot === 'MIXED_1' || le.slot === 'MIXED_2')
    );

    console.log(`\n4. Round 4 vs 4 Fathers Intermediate (again)`);
    console.log(`   Monica Entry ID: ${monicaEntry?.id} (${monicaEntry?.slot})`);
    console.log(`   Sharon Entry ID: ${sharonEntry?.id} (${sharonEntry?.slot})`);
    console.log(`   Match ID: ${round4FourFathersMatch.id}`);
    
    // Check if this is a different match than the One Health match
    if (round4OneHealthMatch) {
      console.log(`   Is this a different match than One Health? ${round4FourFathersMatch.id !== round4OneHealthMatch.id}`);
    }
  }
}

checkByMatch()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

