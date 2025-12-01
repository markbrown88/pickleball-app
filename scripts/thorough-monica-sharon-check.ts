import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function thoroughCheck() {
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

  console.log(`\nTournament: ${tournament.name}\n`);

  // Get ALL lineup entries for both players (all slots)
  const allMonicaLineups = await prisma.lineupEntry.findMany({
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
          team: { select: { name: true, id: true } },
        },
      },
      player1: { select: { name: true, firstName: true, lastName: true } },
      player2: { select: { name: true, firstName: true, lastName: true } },
    },
    orderBy: [
      { lineup: { round: { idx: 'asc' } } },
      { slot: 'asc' },
    ],
  });

  const allSharonLineups = await prisma.lineupEntry.findMany({
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
          team: { select: { name: true, id: true } },
        },
      },
      player1: { select: { name: true, firstName: true, lastName: true } },
      player2: { select: { name: true, firstName: true, lastName: true } },
    },
    orderBy: [
      { lineup: { round: { idx: 'asc' } } },
      { slot: 'asc' },
    ],
  });

  console.log(`Monica total lineup entries: ${allMonicaLineups.length}`);
  console.log(`Sharon total lineup entries: ${allSharonLineups.length}\n`);

  // Filter to MIXED only
  const monicaMixed = allMonicaLineups.filter(le => le.slot === 'MIXED_1' || le.slot === 'MIXED_2');
  const sharonMixed = allSharonLineups.filter(le => le.slot === 'MIXED_1' || le.slot === 'MIXED_2');

  console.log(`Monica MIXED lineup entries: ${monicaMixed.length}`);
  console.log(`Sharon MIXED lineup entries: ${sharonMixed.length}\n`);

  // Show all Monica MIXED entries
  console.log('='.repeat(80));
  console.log('MONICA LIN - ALL MIXED GAMES');
  console.log('='.repeat(80));
  monicaMixed.forEach((entry, idx) => {
    const partner = entry.player1Id === monica.id ? entry.player2 : entry.player1;
    const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
    const bracket = entry.lineup.round.bracketType || 'UNKNOWN';
    console.log(`${idx + 1}. Round ${entry.lineup.round.idx} (${bracket}) - ${entry.slot}`);
    console.log(`   Team: ${entry.lineup.team.name}`);
    console.log(`   Partner: ${partnerName}`);
    console.log(`   Lineup Entry ID: ${entry.id}`);
    console.log(`   Round ID: ${entry.lineup.roundId}`);
    console.log();
  });

  // Show all Sharon MIXED entries
  console.log('='.repeat(80));
  console.log('SHARON SCARFONE - ALL MIXED GAMES');
  console.log('='.repeat(80));
  sharonMixed.forEach((entry, idx) => {
    const partner = entry.player1Id === sharon.id ? entry.player2 : entry.player1;
    const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
    const bracket = entry.lineup.round.bracketType || 'UNKNOWN';
    console.log(`${idx + 1}. Round ${entry.lineup.round.idx} (${bracket}) - ${entry.slot}`);
    console.log(`   Team: ${entry.lineup.team.name}`);
    console.log(`   Partner: ${partnerName}`);
    console.log(`   Lineup Entry ID: ${entry.id}`);
    console.log(`   Round ID: ${entry.lineup.roundId}`);
    console.log();
  });

  // Now check for games - get all MIXED games in the tournament
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

  console.log('='.repeat(80));
  console.log('FINDING GAMES WHERE MONICA OR SHARON PLAYED');
  console.log('='.repeat(80));

  const gamesWithMonicaOrSharon: Array<{
    game: typeof allMixedGames[0];
    monicaEntry: typeof monicaMixed[0] | null;
    sharonEntry: typeof sharonMixed[0] | null;
  }> = [];

  for (const game of allMixedGames) {
    const roundId = game.match.round.id;
    const slot = game.slot;
    
    const monicaEntry = monicaMixed.find(le => 
      le.lineup.roundId === roundId && le.slot === slot
    ) || null;

    const sharonEntry = sharonMixed.find(le => 
      le.lineup.roundId === roundId && le.slot === slot
    ) || null;

    if (monicaEntry || sharonEntry) {
      gamesWithMonicaOrSharon.push({
        game,
        monicaEntry,
        sharonEntry,
      });
    }
  }

  console.log(`\nTotal games where Monica or Sharon played: ${gamesWithMonicaOrSharon.length}\n`);

  gamesWithMonicaOrSharon.forEach((item, idx) => {
    const game = item.game;
    const match = game.match;
    console.log(`Game ${idx + 1}: ${game.id}`);
    console.log(`  Round: ${match.round.idx} (${match.round.bracketType || 'UNKNOWN'})`);
    console.log(`  Slot: ${game.slot}`);
    console.log(`  Bracket: ${game.bracket?.name || 'No Bracket'}`);
    console.log(`  Teams: ${match.teamA?.name || 'TBD'} vs ${match.teamB?.name || 'TBD'}`);
    if (item.monicaEntry) {
      const partner = item.monicaEntry.player1Id === monica.id ? item.monicaEntry.player2 : item.monicaEntry.player1;
      const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
      console.log(`  ✅ Monica Lin - Partner: ${partnerName}`);
    }
    if (item.sharonEntry) {
      const partner = item.sharonEntry.player1Id === sharon.id ? item.sharonEntry.player2 : item.sharonEntry.player1;
      const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
      console.log(`  ✅ Sharon Scarfone - Partner: ${partnerName}`);
    }
    console.log();
  });

  // Group by match to see swap opportunities
  const matchGroups = new Map<string, typeof gamesWithMonicaOrSharon>();
  for (const item of gamesWithMonicaOrSharon) {
    const matchId = item.game.matchId;
    if (!matchGroups.has(matchId)) {
      matchGroups.set(matchId, []);
    }
    matchGroups.get(matchId)!.push(item);
  }

  console.log('='.repeat(80));
  console.log('MATCHES WHERE SWAP IS NEEDED');
  console.log('='.repeat(80));

  const swapsNeeded: Array<{
    matchId: string;
    roundIdx: number;
    bracketType: string;
    mixed1: typeof gamesWithMonicaOrSharon[0] | null;
    mixed2: typeof gamesWithMonicaOrSharon[0] | null;
  }> = [];

  for (const [matchId, games] of matchGroups.entries()) {
    const mixed1 = games.find(g => g.game.slot === 'MIXED_1') || null;
    const mixed2 = games.find(g => g.game.slot === 'MIXED_2') || null;

    if (mixed1 || mixed2) {
      swapsNeeded.push({
        matchId,
        roundIdx: games[0].game.match.round.idx,
        bracketType: games[0].game.match.round.bracketType || 'UNKNOWN',
        mixed1,
        mixed2,
      });
    }
  }

  swapsNeeded.forEach((match, idx) => {
    console.log(`\nMatch ${idx + 1}: Round ${match.roundIdx} (${match.bracketType})`);
    if (match.mixed1) {
      if (match.mixed1.monicaEntry) {
        const partner = match.mixed1.monicaEntry.player1Id === monica.id ? match.mixed1.monicaEntry.player2 : match.mixed1.monicaEntry.player1;
        const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
        console.log(`  MIXED_1: Monica Lin with ${partnerName}`);
      }
      if (match.mixed1.sharonEntry) {
        const partner = match.mixed1.sharonEntry.player1Id === sharon.id ? match.mixed1.sharonEntry.player2 : match.mixed1.sharonEntry.player1;
        const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
        console.log(`  MIXED_1: Sharon Scarfone with ${partnerName}`);
      }
    }
    if (match.mixed2) {
      if (match.mixed2.monicaEntry) {
        const partner = match.mixed2.monicaEntry.player1Id === monica.id ? match.mixed2.monicaEntry.player2 : match.mixed2.monicaEntry.player1;
        const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
        console.log(`  MIXED_2: Monica Lin with ${partnerName}`);
      }
      if (match.mixed2.sharonEntry) {
        const partner = match.mixed2.sharonEntry.player1Id === sharon.id ? match.mixed2.sharonEntry.player2 : match.mixed2.sharonEntry.player1;
        const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
        console.log(`  MIXED_2: Sharon Scarfone with ${partnerName}`);
      }
    }
  });

  console.log(`\n\nTotal matches: ${swapsNeeded.length}`);
  console.log(`Total games: ${gamesWithMonicaOrSharon.length}`);
}

thoroughCheck()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

