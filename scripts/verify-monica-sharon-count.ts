import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function verifyCount() {
  // Find players
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

  if (!monica || !sharon) {
    console.log('Players not found');
    return;
  }

  // Find tournament
  const tournament = await prisma.tournament.findFirst({
    where: {
      name: { contains: 'Klyng Cup - Grand Finale', mode: 'insensitive' },
    },
    select: { id: true, name: true },
  });

  if (!tournament) {
    console.log('Tournament not found');
    return;
  }

  // Get all lineup entries for Monica and Sharon in MIXED_1 and MIXED_2
  const monicaLineups = await prisma.lineupEntry.findMany({
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
      ],
    },
    include: {
      lineup: {
        include: {
          round: {
            include: {
              stop: { select: { name: true } },
            },
          },
          team: { select: { name: true } },
        },
      },
      player1: { select: { name: true, firstName: true, lastName: true } },
      player2: { select: { name: true, firstName: true, lastName: true } },
    },
  });

  const sharonLineups = await prisma.lineupEntry.findMany({
    where: {
      lineup: {
        round: {
          stop: {
            tournamentId: tournament.id,
          },
        },
      },
      OR: [
        { player1Id: sharon.id },
        { player2Id: sharon.id },
      ],
    },
    include: {
      lineup: {
        include: {
          round: {
            include: {
              stop: { select: { name: true } },
            },
          },
          team: { select: { name: true } },
        },
      },
      player1: { select: { name: true, firstName: true, lastName: true } },
      player2: { select: { name: true, firstName: true, lastName: true } },
    },
  });

  // Filter to only MIXED_1 and MIXED_2
  const monicaMixed = monicaLineups.filter(le => le.slot === 'MIXED_1' || le.slot === 'MIXED_2');
  const sharonMixed = sharonLineups.filter(le => le.slot === 'MIXED_1' || le.slot === 'MIXED_2');

  console.log(`\nMonica Lin lineup entries (all): ${monicaLineups.length}`);
  console.log(`Monica Lin lineup entries (MIXED only): ${monicaMixed.length}`);
  console.log(`Sharon Scarfone lineup entries (all): ${sharonLineups.length}`);
  console.log(`Sharon Scarfone lineup entries (MIXED only): ${sharonMixed.length}\n`);

  // Group by match (round + team)
  const monicaByMatch = new Map<string, typeof monicaMixed>();
  for (const entry of monicaMixed) {
    const matchKey = `${entry.lineup.roundId}-${entry.lineup.team.id}`;
    if (!monicaByMatch.has(matchKey)) {
      monicaByMatch.set(matchKey, []);
    }
    monicaByMatch.get(matchKey)!.push(entry);
  }

  const sharonByMatch = new Map<string, typeof sharonMixed>();
  for (const entry of sharonMixed) {
    const matchKey = `${entry.lineup.roundId}-${entry.lineup.team.id}`;
    if (!sharonByMatch.has(matchKey)) {
      sharonByMatch.set(matchKey, []);
    }
    sharonByMatch.get(matchKey)!.push(entry);
  }

  console.log(`Monica unique matches: ${monicaByMatch.size}`);
  console.log(`Sharon unique matches: ${sharonByMatch.size}\n`);

  // Show details
  console.log('Monica Lin lineup entries (MIXED only):');
  monicaMixed.forEach((entry, idx) => {
    const partner = entry.player1Id === monica.id ? entry.player2 : entry.player1;
    const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
    console.log(`  ${idx + 1}. Round ${entry.lineup.round.idx} (${entry.lineup.round.bracketType}), ${entry.slot}, Partner: ${partnerName}, Team: ${entry.lineup.team.name}`);
  });

  console.log('\nSharon Scarfone lineup entries (MIXED only):');
  sharonMixed.forEach((entry, idx) => {
    const partner = entry.player1Id === sharon.id ? entry.player2 : entry.player1;
    const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
    console.log(`  ${idx + 1}. Round ${entry.lineup.round.idx} (${entry.lineup.round.bracketType}), ${entry.slot}, Partner: ${partnerName}, Team: ${entry.lineup.team.name}`);
  });

  // Get actual games
  const monicaGames = await prisma.game.findMany({
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
          round: {
            include: {
              stop: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  // Find games where Monica or Sharon actually played
  const gamesWithMonicaOrSharon: typeof monicaGames = [];
  
  for (const game of monicaGames) {
    const roundId = game.match.round.id;
    const slot = game.slot;
    
    const hasMonica = monicaMixed.some(le => 
      le.lineup.roundId === roundId && le.slot === slot
    );
    
    const hasSharon = sharonMixed.some(le => 
      le.lineup.roundId === roundId && le.slot === slot
    );
    
    if (hasMonica || hasSharon) {
      gamesWithMonicaOrSharon.push(game);
    }
  }

  console.log(`\n\nTotal games where Monica or Sharon played: ${gamesWithMonicaOrSharon.length}`);
  console.log(`Unique matches: ${new Set(gamesWithMonicaOrSharon.map(g => g.matchId)).size}`);
}

verifyCount()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

