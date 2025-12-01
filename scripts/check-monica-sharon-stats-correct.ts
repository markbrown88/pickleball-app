import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function checkMonicaSharonStats() {
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

  const tyler = await prisma.player.findFirst({
    where: {
      OR: [
        { firstName: { contains: 'Tyler', mode: 'insensitive' }, lastName: { contains: 'Goldsack', mode: 'insensitive' } },
        { name: { contains: 'Tyler Goldsack', mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true },
  });

  const adam = await prisma.player.findFirst({
    where: {
      OR: [
        { firstName: { contains: 'Adam', mode: 'insensitive' }, lastName: { contains: 'Ewer', mode: 'insensitive' } },
        { name: { contains: 'Adam Ewer', mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true },
  });

  if (!monica || !sharon || !tyler || !adam) {
    console.log('Could not find all players');
    return;
  }

  // Find tournaments (same as main stats script)
  const tournaments = await prisma.tournament.findMany({
    where: {
      OR: [
        { name: { contains: 'KLYNG CUP-GRAND', mode: 'insensitive' } },
        { name: { contains: 'KLYNG CUP - GRAND FINALE', mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true },
  });

  const tournamentIds = tournaments.map(t => t.id);

  console.log(`\n${'='.repeat(80)}`);
  console.log('MONICA LIN & SHARON SCARFONE STATISTICS');
  console.log(`Tournaments: ${tournaments.map(t => t.name).join(', ')}`);
  console.log('='.repeat(80));

  // Get all lineup entries (same as main stats script)
  const allLineupEntries = await prisma.lineupEntry.findMany({
    where: {
      lineup: {
        round: {
          stop: {
            tournamentId: { in: tournamentIds },
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
      player1: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
        },
      },
      player2: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
        },
      },
      lineup: {
        include: {
          team: {
            select: {
              id: true,
              name: true,
            },
          },
          round: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  // Get all games (same as main stats script)
  const allGames = await prisma.game.findMany({
    where: {
      match: {
        round: {
          stop: {
            tournamentId: { in: tournamentIds },
          },
        },
      },
      OR: [
        { slot: 'MENS_DOUBLES' },
        { slot: 'WOMENS_DOUBLES' },
        { slot: 'MIXED_1' },
        { slot: 'MIXED_2' },
      ],
    },
    include: {
      match: {
        include: {
          round: {
            select: {
              id: true,
            },
          },
          teamA: {
            select: {
              name: true,
            },
          },
          teamB: {
            select: {
              name: true,
            },
          },
        },
      },
      bracket: {
        select: {
          name: true,
        },
      },
    },
  });

  // Build map of lineup entries to games (same logic as main stats script)
  const lineupEntryToGames = new Map<string, Array<{
    game: typeof allGames[0];
    won: boolean;
    teamName: string;
    partner: string;
    slot: string;
  }>>();

  // For each game, find the lineup entries that participated
  for (const game of allGames) {
    if (!game.isComplete || game.teamAScore === null || game.teamBScore === null) {
      continue;
    }

    const match = game.match;
    const round = match.round;

    // Find lineup entries for this round and slot
    const relevantLineups = allLineupEntries.filter(entry => 
      entry.lineup.roundId === round.id && 
      entry.slot === game.slot
    );

    // Determine which team won
    const teamAWon = game.teamAScore > game.teamBScore;
    const teamBWon = game.teamBScore > game.teamAScore;

    // For each lineup entry, check if their team was in this match
    for (const lineupEntry of relevantLineups) {
      const lineupTeam = lineupEntry.lineup.team;
      
      // Check if this lineup's team matches teamA or teamB
      const isTeamA = match.teamAId === lineupTeam.id;
      const isTeamB = match.teamBId === lineupTeam.id;

      if (isTeamA || isTeamB) {
        const won = isTeamA ? teamAWon : teamBWon;
        const partner1 = lineupEntry.player2;
        const partner2 = lineupEntry.player1;

        // Add to both player1 and player2
        if (!lineupEntryToGames.has(lineupEntry.player1Id)) {
          lineupEntryToGames.set(lineupEntry.player1Id, []);
        }
        if (!lineupEntryToGames.has(lineupEntry.player2Id)) {
          lineupEntryToGames.set(lineupEntry.player2Id, []);
        }

        lineupEntryToGames.get(lineupEntry.player1Id)!.push({ 
          game, 
          won, 
          teamName: lineupTeam.name,
          partner: partner1?.name || 'Unknown',
          slot: game.slot || 'UNKNOWN',
        });
        lineupEntryToGames.get(lineupEntry.player2Id)!.push({ 
          game, 
          won, 
          teamName: lineupTeam.name,
          partner: partner2?.name || 'Unknown',
          slot: game.slot || 'UNKNOWN',
        });
      }
    }
  }

  // Get games for Monica and Sharon
  const monicaGames = lineupEntryToGames.get(monica.id) || [];
  const sharonGames = lineupEntryToGames.get(sharon.id) || [];

  // Calculate Monica's stats
  const monicaBySlot = new Map<string, { played: number; won: number; lost: number }>();
  const monicaByPartner = new Map<string, { played: number; won: number; lost: number }>();

  for (const { game, won, partner, slot } of monicaGames) {
    if (!monicaBySlot.has(slot)) {
      monicaBySlot.set(slot, { played: 0, won: 0, lost: 0 });
    }
    const slotStats = monicaBySlot.get(slot)!;
    slotStats.played++;
    if (won) slotStats.won++;
    else slotStats.lost++;

    if (!monicaByPartner.has(partner)) {
      monicaByPartner.set(partner, { played: 0, won: 0, lost: 0 });
    }
    const partnerStats = monicaByPartner.get(partner)!;
    partnerStats.played++;
    if (won) partnerStats.won++;
    else partnerStats.lost++;
  }

  // Calculate Sharon's stats
  const sharonBySlot = new Map<string, { played: number; won: number; lost: number }>();
  const sharonByPartner = new Map<string, { played: number; won: number; lost: number }>();

  for (const { game, won, partner, slot } of sharonGames) {
    if (!sharonBySlot.has(slot)) {
      sharonBySlot.set(slot, { played: 0, won: 0, lost: 0 });
    }
    const slotStats = sharonBySlot.get(slot)!;
    slotStats.played++;
    if (won) slotStats.won++;
    else slotStats.lost++;

    if (!sharonByPartner.has(partner)) {
      sharonByPartner.set(partner, { played: 0, won: 0, lost: 0 });
    }
    const partnerStats = sharonByPartner.get(partner)!;
    partnerStats.played++;
    if (won) partnerStats.won++;
    else partnerStats.lost++;
  }

  console.log(`\n${monica.name} Statistics:`);
  console.log(`  Total Games: ${monicaGames.length}`);
  const monicaWon = monicaGames.filter(g => g.won).length;
  const monicaLost = monicaGames.filter(g => !g.won).length;
  const monicaWinPct = monicaGames.length > 0 ? (monicaWon / monicaGames.length) * 100 : 0;
  console.log(`  Overall: ${monicaWon}W - ${monicaLost}L (${monicaWinPct.toFixed(1)}%)`);
  console.log(`  By Slot:`);
  for (const [slot, stats] of Array.from(monicaBySlot.entries()).sort()) {
    const winPct = stats.played > 0 ? (stats.won / stats.played) * 100 : 0;
    console.log(`    ${slot}: ${stats.won}W - ${stats.lost}L (${winPct.toFixed(1)}%) - ${stats.played} games`);
  }
  console.log(`  By Partner:`);
  for (const [partner, stats] of Array.from(monicaByPartner.entries()).sort((a, b) => b[1].played - a[1].played)) {
    const winPct = stats.played > 0 ? (stats.won / stats.played) * 100 : 0;
    console.log(`    ${partner}: ${stats.won}W - ${stats.lost}L (${winPct.toFixed(1)}%) - ${stats.played} games`);
  }

  console.log(`\n${sharon.name} Statistics:`);
  console.log(`  Total Games: ${sharonGames.length}`);
  const sharonWon = sharonGames.filter(g => g.won).length;
  const sharonLost = sharonGames.filter(g => !g.won).length;
  const sharonWinPct = sharonGames.length > 0 ? (sharonWon / sharonGames.length) * 100 : 0;
  console.log(`  Overall: ${sharonWon}W - ${sharonLost}L (${sharonWinPct.toFixed(1)}%)`);
  console.log(`  By Slot:`);
  for (const [slot, stats] of Array.from(sharonBySlot.entries()).sort()) {
    const winPct = stats.played > 0 ? (stats.won / stats.played) * 100 : 0;
    console.log(`    ${slot}: ${stats.won}W - ${stats.lost}L (${winPct.toFixed(1)}%) - ${stats.played} games`);
  }
  console.log(`  By Partner:`);
  for (const [partner, stats] of Array.from(sharonByPartner.entries()).sort((a, b) => b[1].played - a[1].played)) {
    const winPct = stats.played > 0 ? (stats.won / stats.played) * 100 : 0;
    console.log(`    ${partner}: ${stats.won}W - ${stats.lost}L (${winPct.toFixed(1)}%) - ${stats.played} games`);
  }

  // Check pair stats
  const monicaTylerGames = monicaGames.filter(g => g.partner === tyler.name);
  const sharonAdamGames = sharonGames.filter(g => g.partner === adam.name);
  const monicaAdamGames = monicaGames.filter(g => g.partner === adam.name);
  const sharonTylerGames = sharonGames.filter(g => g.partner === tyler.name);

  console.log(`\n${'='.repeat(80)}`);
  console.log('PAIR STATISTICS (After Lineup Swap):');
  console.log('='.repeat(80));
  
  if (monicaTylerGames.length > 0) {
    const won = monicaTylerGames.filter(g => g.won).length;
    const lost = monicaTylerGames.filter(g => !g.won).length;
    const winPct = (won / monicaTylerGames.length) * 100;
    console.log(`\n${monica.name} & ${tyler.name}: ${won}W - ${lost}L (${winPct.toFixed(1)}%) - ${monicaTylerGames.length} games`);
  }

  if (sharonAdamGames.length > 0) {
    const won = sharonAdamGames.filter(g => g.won).length;
    const lost = sharonAdamGames.filter(g => !g.won).length;
    const winPct = (won / sharonAdamGames.length) * 100;
    console.log(`${sharon.name} & ${adam.name}: ${won}W - ${lost}L (${winPct.toFixed(1)}%) - ${sharonAdamGames.length} games`);
  }

  if (monicaAdamGames.length > 0) {
    const won = monicaAdamGames.filter(g => g.won).length;
    const lost = monicaAdamGames.filter(g => !g.won).length;
    const winPct = (won / monicaAdamGames.length) * 100;
    console.log(`\n${monica.name} & ${adam.name} (OLD PAIRING): ${won}W - ${lost}L (${winPct.toFixed(1)}%) - ${monicaAdamGames.length} games`);
  }

  if (sharonTylerGames.length > 0) {
    const won = sharonTylerGames.filter(g => g.won).length;
    const lost = sharonTylerGames.filter(g => !g.won).length;
    const winPct = (won / sharonTylerGames.length) * 100;
    console.log(`${sharon.name} & ${tyler.name} (OLD PAIRING): ${won}W - ${lost}L (${winPct.toFixed(1)}%) - ${sharonTylerGames.length} games`);
  }
}

checkMonicaSharonStats()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

