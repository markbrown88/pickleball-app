import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function findOpponents() {
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
      name: { contains: 'Klyng Cup - Grand Finale', mode: 'insensitive' },
    },
    select: { id: true },
  });

  if (!monica || !sharon || !tournament) return;

  // Get all MIXED games in the tournament
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
          round: {
            include: {
              stop: { select: { name: true } },
            },
          },
          teamA: { select: { id: true, name: true } },
          teamB: { select: { id: true, name: true } },
        },
      },
      bracket: { select: { name: true } },
    },
    orderBy: [
      { match: { round: { idx: 'asc' } } },
      { slot: 'asc' },
    ],
  });

  // Get all lineup entries
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

  console.log(`\n${'='.repeat(80)}`);
  console.log('MONICA LIN - MIXED GAMES WITH OPPONENTS');
  console.log('='.repeat(80));

  for (const entry of monicaMixed) {
    const partner = entry.player1Id === monica.id ? entry.player2 : entry.player1;
    const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
    
    // Find games for this round and slot
    const games = allMixedGames.filter(
      g => g.match.round.id === entry.lineup.roundId && g.slot === entry.slot
    );

    for (const game of games) {
      const match = game.match;
      const theirTeam = entry.lineup.team;
      const opponentTeam = match.teamAId === theirTeam.id ? match.teamB : match.teamA;
      
      console.log(`\nRound ${entry.lineup.round.idx} (${entry.lineup.round.bracketType || 'UNKNOWN'}) - ${entry.slot}`);
      console.log(`  Bracket: ${game.bracket?.name || 'No Bracket'}`);
      console.log(`  Team: ${theirTeam.name}`);
      console.log(`  Partner: ${partnerName}`);
      console.log(`  Opponent: ${opponentTeam?.name || 'TBD'}`);
      console.log(`  Game ID: ${game.id}`);
      console.log(`  Match ID: ${match.id}`);
    }
  }

  console.log(`\n\n${'='.repeat(80)}`);
  console.log('SHARON SCARFONE - MIXED GAMES WITH OPPONENTS');
  console.log('='.repeat(80));

  for (const entry of sharonMixed) {
    const partner = entry.player1Id === sharon.id ? entry.player2 : entry.player1;
    const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
    
    // Find games for this round and slot
    const games = allMixedGames.filter(
      g => g.match.round.id === entry.lineup.roundId && g.slot === entry.slot
    );

    for (const game of games) {
      const match = game.match;
      const theirTeam = entry.lineup.team;
      const opponentTeam = match.teamAId === theirTeam.id ? match.teamB : match.teamA;
      
      console.log(`\nRound ${entry.lineup.round.idx} (${entry.lineup.round.bracketType || 'UNKNOWN'}) - ${entry.slot}`);
      console.log(`  Bracket: ${game.bracket?.name || 'No Bracket'}`);
      console.log(`  Team: ${theirTeam.name}`);
      console.log(`  Partner: ${partnerName}`);
      console.log(`  Opponent: ${opponentTeam?.name || 'TBD'}`);
      console.log(`  Game ID: ${game.id}`);
      console.log(`  Match ID: ${match.id}`);
    }
  }

  // Summary
  const monicaGameCount = monicaMixed.reduce((sum, entry) => {
    const games = allMixedGames.filter(
      g => g.match.round.id === entry.lineup.roundId && g.slot === entry.slot
    );
    return sum + games.length;
  }, 0);

  const sharonGameCount = sharonMixed.reduce((sum, entry) => {
    const games = allMixedGames.filter(
      g => g.match.round.id === entry.lineup.roundId && g.slot === entry.slot
    );
    return sum + games.length;
  }, 0);

  console.log(`\n\n${'='.repeat(80)}`);
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Monica lineup entries: ${monicaMixed.length}`);
  console.log(`Monica actual games: ${monicaGameCount}`);
  console.log(`Sharon lineup entries: ${sharonMixed.length}`);
  console.log(`Sharon actual games: ${sharonGameCount}`);
}

findOpponents()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
