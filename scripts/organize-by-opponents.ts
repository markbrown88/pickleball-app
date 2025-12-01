import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function organizeByOpponents() {
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
          round: { select: { id: true, idx: true, bracketType: true } },
          team: { select: { id: true, name: true } },
        },
      },
      player1: { select: { name: true, firstName: true, lastName: true } },
      player2: { select: { name: true, firstName: true, lastName: true } },
    },
  });

  // Group by unique match (round + opponent)
  const monicaMatches = new Map<string, Array<{ game: typeof allMixedGames[0]; entry: typeof allLineups[0] }>>();
  const sharonMatches = new Map<string, Array<{ game: typeof allMixedGames[0]; entry: typeof allLineups[0] }>>();

  for (const entry of allLineups) {
    if (entry.slot !== 'MIXED_1' && entry.slot !== 'MIXED_2') continue;
    
    const isMonica = entry.player1Id === monica.id || entry.player2Id === monica.id;
    const isSharon = entry.player1Id === sharon.id || entry.player2Id === sharon.id;
    
    if (!isMonica && !isSharon) continue;

    const games = allMixedGames.filter(
      g => g.match.round.id === entry.lineup.roundId && g.slot === entry.slot
    );

    for (const game of games) {
      const match = game.match;
      const theirTeam = entry.lineup.team;
      const opponentTeam = match.teamAId === theirTeam.id ? match.teamB : match.teamA;
      
      const matchKey = `${entry.lineup.round.idx}-${opponentTeam?.name || 'TBD'}-${entry.slot}`;
      
      if (isMonica) {
        if (!monicaMatches.has(matchKey)) {
          monicaMatches.set(matchKey, []);
        }
        monicaMatches.get(matchKey)!.push({ game, entry });
      }
      
      if (isSharon) {
        if (!sharonMatches.has(matchKey)) {
          sharonMatches.set(matchKey, []);
        }
        sharonMatches.get(matchKey)!.push({ game, entry });
      }
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('MONICA LIN - GAMES BY OPPONENT');
  console.log('='.repeat(80));

  let monicaCount = 0;
  for (const [key, items] of Array.from(monicaMatches.entries()).sort()) {
    const [roundIdx, opponent, slot] = key.split('-');
    const entry = items[0].entry;
    const partner = entry.player1Id === monica.id ? entry.player2 : entry.player1;
    const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
    
    monicaCount++;
    console.log(`\n${monicaCount}. Round ${roundIdx} - ${slot}`);
    console.log(`   Opponent: ${opponent}`);
    console.log(`   Partner: ${partnerName}`);
    console.log(`   Brackets: ${items.map(i => i.game.bracket?.name || 'No Bracket').join(', ')}`);
    console.log(`   Match ID: ${items[0].game.matchId}`);
  }

  console.log(`\n\n${'='.repeat(80)}`);
  console.log('SHARON SCARFONE - GAMES BY OPPONENT');
  console.log('='.repeat(80));

  let sharonCount = 0;
  for (const [key, items] of Array.from(sharonMatches.entries()).sort()) {
    const [roundIdx, opponent, slot] = key.split('-');
    const entry = items[0].entry;
    const partner = entry.player1Id === sharon.id ? entry.player2 : entry.player1;
    const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
    
    sharonCount++;
    console.log(`\n${sharonCount}. Round ${roundIdx} - ${slot}`);
    console.log(`   Opponent: ${opponent}`);
    console.log(`   Partner: ${partnerName}`);
    console.log(`   Brackets: ${items.map(i => i.game.bracket?.name || 'No Bracket').join(', ')}`);
    console.log(`   Match ID: ${items[0].game.matchId}`);
  }

  console.log(`\n\n${'='.repeat(80)}`);
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Monica unique matches: ${monicaCount}`);
  console.log(`Sharon unique matches: ${sharonCount}`);
}

organizeByOpponents()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

