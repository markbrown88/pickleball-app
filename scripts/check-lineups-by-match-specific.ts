import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function checkByMatchSpecific() {
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

  // Get the specific matches
  const matchIds = [
    'cmij63yw4000nl504nq51of0b', // Round 0 vs 4 Fathers
    'cmij642il003dl504qq3ayyxk', // Round 3 vs Pickleplex
    'cmij643wz004fl5042enopesp', // Round 4 vs One Health
    'cmij6438y003xl504y6x0dwu1', // Round 4 vs 4 Fathers
  ];

  console.log(`\n${'='.repeat(80)}`);
  console.log('CHECKING LINEUP ENTRIES BY SPECIFIC MATCH');
  console.log('='.repeat(80));

  for (const matchId of matchIds) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        round: { select: { idx: true, bracketType: true, id: true } },
        teamA: { select: { name: true } },
        teamB: { select: { name: true } },
        games: {
          where: {
            OR: [
              { slot: 'MIXED_1' },
              { slot: 'MIXED_2' },
            ],
          },
          include: {
            lineupEntries: {
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
        },
      },
    });

    if (!match) continue;

    const opponent = match.teamAId === greenhillsTeam.id ? match.teamB : match.teamA;
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Match: Round ${match.round.idx} vs ${opponent?.name || 'TBD'}`);
    console.log(`Match ID: ${match.id}`);
    console.log(`Round ID: ${match.round.id}`);
    console.log(`Number of MIXED games: ${match.games.length}`);

    // Check lineup entries via games
    const allLineupEntries = new Set<string>();
    const lineupEntryDetails: Array<{
      entryId: string;
      slot: string;
      player: string;
      partner: string;
      gameId: string;
    }> = [];

    for (const game of match.games) {
      for (const entry of game.lineupEntries) {
        if (!allLineupEntries.has(entry.id)) {
          allLineupEntries.add(entry.id);
          
          const isMonica = entry.player1Id === monica.id || entry.player2Id === monica.id;
          const isSharon = entry.player1Id === sharon.id || entry.player2Id === sharon.id;
          
          if (isMonica || isSharon) {
            const player = isMonica ? 'Monica' : 'Sharon';
            const partner = entry.player1Id === (isMonica ? monica.id : sharon.id) 
              ? entry.player2 
              : entry.player1;
            const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
            
            lineupEntryDetails.push({
              entryId: entry.id,
              slot: entry.slot,
              player,
              partner: partnerName,
              gameId: game.id,
            });
          }
        }
      }
    }

    console.log(`\nLineup entries found via games: ${lineupEntryDetails.length}`);
    lineupEntryDetails.forEach(detail => {
      console.log(`  ${detail.player}: ${detail.slot} with ${detail.partner}`);
      console.log(`    Entry ID: ${detail.entryId}`);
      console.log(`    Game ID: ${detail.gameId}`);
    });

    // Also check lineup entries directly for this round and team
    const directLineups = await prisma.lineupEntry.findMany({
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
        lineup: {
          include: {
            matches: {
              where: { id: matchId },
              select: { id: true },
            },
          },
        },
        player1: { select: { name: true } },
        player2: { select: { name: true } },
      },
    });

    const monicaDirect = directLineups.filter(
      le => (le.player1Id === monica.id || le.player2Id === monica.id) &&
            (le.slot === 'MIXED_1' || le.slot === 'MIXED_2')
    );
    const sharonDirect = directLineups.filter(
      le => (le.player1Id === sharon.id || le.player2Id === sharon.id) &&
            (le.slot === 'MIXED_1' || le.slot === 'MIXED_2')
    );

    console.log(`\nDirect lineup entries for Round ${match.round.idx}, Team Greenhills:`);
    console.log(`  Total: ${directLineups.length}`);
    console.log(`  Monica MIXED: ${monicaDirect.length}`);
    console.log(`  Sharon MIXED: ${sharonDirect.length}`);
    
    monicaDirect.forEach(le => {
      const partner = le.player1Id === monica.id ? le.player2 : le.player1;
      const partnerName = partner?.name || 'Unknown';
      console.log(`    Monica: ${le.slot} with ${partnerName} (Entry ID: ${le.id})`);
      console.log(`      Lineup has ${le.lineup.matches.length} match(es) with this match ID`);
    });
    
    sharonDirect.forEach(le => {
      const partner = le.player1Id === sharon.id ? le.player2 : le.player1;
      const partnerName = partner?.name || 'Unknown';
      console.log(`    Sharon: ${le.slot} with ${partnerName} (Entry ID: ${le.id})`);
      console.log(`      Lineup has ${le.lineup.matches.length} match(es) with this match ID`);
    });
  }
}

checkByMatchSpecific()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

