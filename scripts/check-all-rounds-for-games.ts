import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function checkAllRounds() {
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

  // Get ALL rounds
  const allRounds = await prisma.round.findMany({
    where: {
      stop: {
        tournamentId: tournament.id,
      },
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

  console.log(`\n${'='.repeat(80)}`);
  console.log('CHECKING ALL ROUNDS FOR MONICA AND SHARON MIXED GAMES');
  console.log('='.repeat(80));

  for (const round of allRounds) {
    // Check for any lineup entries in this round
    const allLineups = await prisma.lineupEntry.findMany({
      where: {
        lineup: {
          roundId: round.id,
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
            team: { select: { name: true } },
          },
        },
        player1: { select: { name: true, firstName: true, lastName: true } },
        player2: { select: { name: true, firstName: true, lastName: true } },
      },
    });

    const lineups = allLineups.filter(le => le.slot === 'MIXED_1' || le.slot === 'MIXED_2');
    
    if (lineups.length > 0) {
      console.log(`\nRound ${round.idx} (${round.bracketType || 'UNKNOWN'}):`);
      console.log(`  Matches in round: ${round.matches.length}`);
      
      for (const entry of lineups) {
        const player = entry.player1Id === monica.id || entry.player2Id === monica.id ? 'Monica' : 'Sharon';
        const partner = entry.player1Id === monica.id || entry.player1Id === sharon.id ? entry.player2 : entry.player1;
        const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
        
        // Find the match for this lineup
        const match = round.matches.find(m => 
          m.teamAId === entry.lineup.team.id || m.teamBId === entry.lineup.team.id
        );
        
        const opponent = match 
          ? (match.teamAId === entry.lineup.team.id ? match.teamB?.name : match.teamA?.name)
          : 'Unknown';
        
        console.log(`  ${player}: ${entry.slot} with ${partnerName} vs ${opponent}`);
        console.log(`    Lineup ID: ${entry.id}`);
        console.log(`    Team: ${entry.lineup.team.name}`);
      }
    } else {
      // Still show the round to see if there are matches
      if (round.matches.length > 0) {
        console.log(`\nRound ${round.idx} (${round.bracketType || 'UNKNOWN'}): ${round.matches.length} matches, but no Monica/Sharon lineups`);
        round.matches.forEach(m => {
          console.log(`  Match: ${m.teamA?.name || 'TBD'} vs ${m.teamB?.name || 'TBD'}`);
        });
      }
    }
  }
}

checkAllRounds()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

