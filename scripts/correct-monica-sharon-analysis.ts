import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function correctAnalysis() {
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
  });

  // Filter to MIXED only
  const mixedLineups = allLineups.filter(le => le.slot === 'MIXED_1' || le.slot === 'MIXED_2');

  console.log(`\nTotal MIXED lineup entries: ${mixedLineups.length}\n`);

  // Group by match (round + team + bracket)
  const matches = new Map<string, {
    roundId: string;
    roundIdx: number;
    bracketType: string;
    teamId: string;
    teamName: string;
    monicaEntry: typeof mixedLineups[0] | null;
    sharonEntry: typeof mixedLineups[0] | null;
  }>();

  for (const entry of mixedLineups) {
    const matchKey = `${entry.lineup.roundId}-${entry.lineup.team.id}`;
    
    if (!matches.has(matchKey)) {
      matches.set(matchKey, {
        roundId: entry.lineup.round.id,
        roundIdx: entry.lineup.round.idx,
        bracketType: entry.lineup.round.bracketType || 'UNKNOWN',
        teamId: entry.lineup.team.id,
        teamName: entry.lineup.team.name,
        monicaEntry: null,
        sharonEntry: null,
      });
    }

    const match = matches.get(matchKey)!;
    if (entry.player1Id === monica.id || entry.player2Id === monica.id) {
      match.monicaEntry = entry;
    }
    if (entry.player1Id === sharon.id || entry.player2Id === sharon.id) {
      match.sharonEntry = entry;
    }
  }

  console.log(`Unique matches: ${matches.size}\n`);

  // Show matches where both played
  const matchesToSwap = Array.from(matches.values()).filter(m => m.monicaEntry && m.sharonEntry);

  console.log(`Matches where both Monica and Sharon played: ${matchesToSwap.length}\n`);

  matchesToSwap.forEach((match, idx) => {
    console.log(`\nMatch ${idx + 1}:`);
    console.log(`  Round: ${match.roundIdx} (${match.bracketType})`);
    console.log(`  Team: ${match.teamName}`);
    
    if (match.monicaEntry) {
      const partner = match.monicaEntry.player1Id === monica.id ? match.monicaEntry.player2 : match.monicaEntry.player1;
      const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
      console.log(`  Monica: ${match.monicaEntry.slot} with ${partnerName}`);
    }
    
    if (match.sharonEntry) {
      const partner = match.sharonEntry.player1Id === sharon.id ? match.sharonEntry.player2 : match.sharonEntry.player1;
      const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
      console.log(`  Sharon: ${match.sharonEntry.slot} with ${partnerName}`);
    }
    
    if (match.monicaEntry && match.sharonEntry) {
      console.log(`  → SWAP: Monica to ${match.sharonEntry.slot}, Sharon to ${match.monicaEntry.slot}`);
    }
  });

  // Count unique games (not matches)
  console.log(`\n\nSummary:`);
  console.log(`  Monica lineup entries: ${mixedLineups.filter(le => le.player1Id === monica.id || le.player2Id === monica.id).length}`);
  console.log(`  Sharon lineup entries: ${mixedLineups.filter(le => le.player1Id === sharon.id || le.player2Id === sharon.id).length}`);
  console.log(`  Matches where both played: ${matchesToSwap.length}`);
  console.log(`  Lineup entries to swap: ${matchesToSwap.length * 2} (${matchesToSwap.length} matches × 2 entries each)`);
}

correctAnalysis()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

