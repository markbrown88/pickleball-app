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

  console.log(`\nTournaments found: ${tournaments.map(t => t.name).join(', ')}`);

  // Get all lineup entries for these players in these tournaments (same as main stats script)
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
            include: {
              stop: {
                select: {
                  name: true,
                  tournament: { select: { name: true } },
                },
              },
              matches: {
                include: {
                  games: {
                    where: {
                      OR: [
                        { slot: 'MENS_DOUBLES' },
                        { slot: 'WOMENS_DOUBLES' },
                        { slot: 'MIXED_1' },
                        { slot: 'MIXED_2' },
                      ],
                    },
                    include: {
                      bracket: {
                        select: {
                          name: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // Get all games for these tournaments (same as main stats script)
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
            include: {
              stop: { select: { name: true, tournament: { select: { name: true } } } },
            },
          },
          teamA: { select: { name: true } },
          teamB: { select: { name: true } },
        },
      },
      bracket: { select: { name: true } },
    },
  });

  console.log(`\n${'='.repeat(80)}`);
  console.log('MONICA LIN & SHARON SCARFONE STATISTICS');
  console.log('Tournaments: KLYNG CUP-GRAND, KLYNG CUP - GRAND FINALE');
  console.log('='.repeat(80));

  // Match lineup entries to games (same logic as main stats script)
  const lineupEntryToGames = new Map<string, Array<{ game: typeof allGames[0]; won: boolean; teamName: string }>>();

  for (const entry of allLineupEntries) {
    const round = entry.lineup.round;
    const teamId = entry.lineup.teamId;
    const teamName = entry.lineup.team.name;

    // Find games in this round that match this entry's slot
    for (const match of round.matches) {
      for (const game of match.games) {
        if (game.slot === entry.slot && game.isComplete && game.teamAScore !== null && game.teamBScore !== null) {
          const isTeamA = match.teamAId === teamId;
          const won = isTeamA 
            ? game.teamAScore > game.teamBScore
            : game.teamBScore > game.teamAScore;

          // Add to both players' game lists
          const player1Key = `${entry.player1Id}-${entry.slot}`;
          const player2Key = `${entry.player2Id}-${entry.slot}`;

          if (!lineupEntryToGames.has(player1Key)) {
            lineupEntryToGames.set(player1Key, []);
          }
          if (!lineupEntryToGames.has(player2Key)) {
            lineupEntryToGames.set(player2Key, []);
          }

          lineupEntryToGames.get(player1Key)!.push({ game, won, teamName });
          lineupEntryToGames.get(player2Key)!.push({ game, won, teamName });
        }
      }
    }
  }

  // Build Monica and Sharon's game lists
  const monicaGames: Array<{ game: typeof allGames[0]; won: boolean; partner: string; slot: string }> = [];
  const sharonGames: Array<{ game: typeof allGames[0]; won: boolean; partner: string; slot: string }> = [];

  for (const entry of allLineupEntries) {
    const isMonica = entry.player1Id === monica.id || entry.player2Id === monica.id;
    const isSharon = entry.player1Id === sharon.id || entry.player2Id === sharon.id;

    if (isMonica || isSharon) {
      const playerKey = (isMonica ? monica.id : sharon.id) === entry.player1Id
        ? `${entry.player1Id}-${entry.slot}`
        : `${entry.player2Id}-${entry.slot}`;

      const games = lineupEntryToGames.get(playerKey) || [];
      const partner = entry.player1Id === (isMonica ? monica.id : sharon.id) 
        ? entry.player2 
        : entry.player1;
      const partnerName = partner?.name || 'Unknown';

      for (const { game, won } of games) {
        if (isMonica) {
          monicaGames.push({ game, won, partner: partnerName, slot: entry.slot });
        }
        if (isSharon) {
          sharonGames.push({ game, won, partner: partnerName, slot: entry.slot });
        }
      }
    }
  }

  // Deduplicate games (a player might appear in multiple lineup entries for the same game)
  const monicaGamesDeduped = new Map<string, typeof monicaGames[0]>();
  for (const gameData of monicaGames) {
    const key = `${gameData.game.id}-${gameData.partner}`;
    if (!monicaGamesDeduped.has(key)) {
      monicaGamesDeduped.set(key, gameData);
    }
  }

  const sharonGamesDeduped = new Map<string, typeof sharonGames[0]>();
  for (const gameData of sharonGames) {
    const key = `${gameData.game.id}-${gameData.partner}`;
    if (!sharonGamesDeduped.has(key)) {
      sharonGamesDeduped.set(key, gameData);
    }
  }

  const monicaGamesFinal = Array.from(monicaGamesDeduped.values());
  const sharonGamesFinal = Array.from(sharonGamesDeduped.values());

  // Calculate Monica's stats
  const monicaBySlot = new Map<string, { played: number; won: number; lost: number }>();
  const monicaByPartner = new Map<string, { played: number; won: number; lost: number }>();

  for (const { game, won, partner, slot } of monicaGamesFinal) {
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

  for (const { game, won, partner, slot } of sharonGamesFinal) {
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
  console.log(`  Total Games: ${monicaGamesFinal.length}`);
  const monicaWon = monicaGamesFinal.filter(g => g.won).length;
  const monicaLost = monicaGamesFinal.filter(g => !g.won).length;
  const monicaWinPct = monicaGamesFinal.length > 0 ? (monicaWon / monicaGamesFinal.length) * 100 : 0;
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
  console.log(`  Total Games: ${sharonGamesFinal.length}`);
  const sharonWon = sharonGamesFinal.filter(g => g.won).length;
  const sharonLost = sharonGamesFinal.filter(g => !g.won).length;
  const sharonWinPct = sharonGamesFinal.length > 0 ? (sharonWon / sharonGamesFinal.length) * 100 : 0;
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
  const monicaTylerGames = monicaGamesFinal.filter(g => g.partner === tyler.name);
  const sharonAdamGames = sharonGamesFinal.filter(g => g.partner === adam.name);
  const monicaAdamGames = monicaGamesFinal.filter(g => g.partner === adam.name);
  const sharonTylerGames = sharonGamesFinal.filter(g => g.partner === tyler.name);

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

