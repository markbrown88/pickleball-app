import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function finalSwapPlan() {
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

  const allMixedGames = await prisma.game.findMany({
    where: {
      match: {
        round: {
          stop: {
            tournamentId: tournament.id,
          },
        },
      },
      OR: [
        { slot: 'MIXED_1' },
        { slot: 'MIXED_2' },
      ],
    },
    include: {
      match: {
        include: {
          round: { select: { id: true, idx: true, bracketType: true } },
          teamA: { select: { id: true, name: true } },
          teamB: { select: { id: true, name: true } },
        },
      },
      bracket: { select: { name: true } },
    },
  });

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
          round: { select: { id: true, idx: true } },
          team: { select: { id: true, name: true } },
        },
      },
      player1: { select: { name: true, firstName: true, lastName: true } },
      player2: { select: { name: true, firstName: true, lastName: true } },
    },
  });

  // Group by unique matchup (round + opponent, ignoring bracket)
  const matchups = new Map<string, {
    roundIdx: number;
    bracketType: string;
    opponent: string;
    matchId: string;
    monicaEntry: typeof allLineups[0] | null;
    sharonEntry: typeof allLineups[0] | null;
  }>();

  for (const game of allMixedGames) {
    const roundId = game.match.round.id;
    const slot = game.slot;
    const relevantLineups = allLineups.filter(
      le => le.lineup.roundId === roundId && le.slot === slot
    );

    for (const entry of relevantLineups) {
      const match = game.match;
      const theirTeam = entry.lineup.team;
      const opponentTeam = match.teamAId === theirTeam.id ? match.teamB : match.teamA;
      const opponent = opponentTeam?.name || 'TBD';
      
      // Key by round + opponent (not bracket)
      const matchupKey = `${match.round.idx}-${opponent}`;
      
      if (!matchups.has(matchupKey)) {
        matchups.set(matchupKey, {
          roundIdx: match.round.idx,
          bracketType: match.round.bracketType || 'UNKNOWN',
          opponent,
          matchId: match.id,
          monicaEntry: null,
          sharonEntry: null,
        });
      }

      const matchup = matchups.get(matchupKey)!;
      if (entry.player1Id === monica.id || entry.player2Id === monica.id) {
        if (!matchup.monicaEntry || matchup.monicaEntry.slot !== slot) {
          matchup.monicaEntry = entry;
        }
      }
      if (entry.player1Id === sharon.id || entry.player2Id === sharon.id) {
        if (!matchup.sharonEntry || matchup.sharonEntry.slot !== slot) {
          matchup.sharonEntry = entry;
        }
      }
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('MONICA LIN & SHARON SCARFONE - 4 MATCHUPS IN "KLYNG CUP - GRAND FINALE"');
  console.log('='.repeat(80));

  const sortedMatchups = Array.from(matchups.values()).sort((a, b) => {
    if (a.roundIdx !== b.roundIdx) return a.roundIdx - b.roundIdx;
    return a.opponent.localeCompare(b.opponent);
  });

  sortedMatchups.forEach((matchup, idx) => {
    console.log(`\n${idx + 1}. Round ${matchup.roundIdx} (${matchup.bracketType}) vs ${matchup.opponent}`);
    console.log(`   Match ID: ${matchup.matchId}`);
    
    if (matchup.monicaEntry) {
      const partner = matchup.monicaEntry.player1Id === monica.id ? matchup.monicaEntry.player2 : matchup.monicaEntry.player1;
      const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
      console.log(`   Monica: ${matchup.monicaEntry.slot} with ${partnerName}`);
      console.log(`     Lineup Entry ID: ${matchup.monicaEntry.id}`);
    }
    
    if (matchup.sharonEntry) {
      const partner = matchup.sharonEntry.player1Id === sharon.id ? matchup.sharonEntry.player2 : matchup.sharonEntry.player1;
      const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
      console.log(`   Sharon: ${matchup.sharonEntry.slot} with ${partnerName}`);
      console.log(`     Lineup Entry ID: ${matchup.sharonEntry.id}`);
    }
    
    if (matchup.monicaEntry && matchup.sharonEntry) {
      console.log(`   → SWAP: Monica to ${matchup.sharonEntry.slot}, Sharon to ${matchup.monicaEntry.slot}`);
    }
  });

  console.log(`\n\n${'='.repeat(80)}`);
  console.log('SWAP PLAN');
  console.log('='.repeat(80));

  const swapsNeeded = sortedMatchups.filter(m => m.monicaEntry && m.sharonEntry);

  console.log(`\nTotal matchups to swap: ${swapsNeeded.length}\n`);

  swapsNeeded.forEach((matchup, idx) => {
    console.log(`Matchup ${idx + 1}: Round ${matchup.roundIdx} vs ${matchup.opponent}`);
    console.log(`  Current:`);
    console.log(`    Monica: ${matchup.monicaEntry!.slot} (Lineup ID: ${matchup.monicaEntry!.id})`);
    console.log(`    Sharon: ${matchup.sharonEntry!.slot} (Lineup ID: ${matchup.sharonEntry!.id})`);
    console.log(`  After swap:`);
    console.log(`    Monica: ${matchup.sharonEntry!.slot} (Lineup ID: ${matchup.monicaEntry!.id} - UPDATE slot)`);
    console.log(`    Sharon: ${matchup.monicaEntry!.slot} (Lineup ID: ${matchup.sharonEntry!.id} - UPDATE slot)`);
    console.log();
  });

  console.log(`\n${'='.repeat(80)}`);
  console.log('DATABASE CHANGES REQUIRED');
  console.log('='.repeat(80));
  console.log(`\nTotal lineup entries to update: ${swapsNeeded.length * 2}\n`);

  swapsNeeded.forEach((matchup, idx) => {
    console.log(`${idx + 1}. Update LineupEntry ${matchup.monicaEntry!.id}:`);
    console.log(`   Change slot from "${matchup.monicaEntry!.slot}" to "${matchup.sharonEntry!.slot}"`);
    console.log(`   (Monica's entry moves to Sharon's slot)`);
    console.log();
    console.log(`${idx + 1}. Update LineupEntry ${matchup.sharonEntry!.id}:`);
    console.log(`   Change slot from "${matchup.sharonEntry!.slot}" to "${matchup.monicaEntry!.slot}"`);
    console.log(`   (Sharon's entry moves to Monica's slot)`);
    console.log();
  });
}

finalSwapPlan()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

