import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function analyzeMonicaSharonSwap() {
  console.log('\n' + '='.repeat(80));
  console.log('ANALYZING MONICA LIN & SHARON SCARFONE GAMES FOR SWAP');
  console.log('='.repeat(80));

  // Find the tournament
  const tournament = await prisma.tournament.findFirst({
    where: {
      name: {
        contains: 'Klyng Cup - Grand Finale',
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!tournament) {
    console.log('❌ Tournament not found');
    return;
  }

  console.log(`\n✅ Tournament: ${tournament.name} (${tournament.id})\n`);

  // Find Monica Lin and Sharon Scarfone
  const monica = await prisma.player.findFirst({
    where: {
      OR: [
        { firstName: { contains: 'Monica', mode: 'insensitive' }, lastName: { contains: 'Lin', mode: 'insensitive' } },
        { name: { contains: 'Monica Lin', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      name: true,
    },
  });

  const sharon = await prisma.player.findFirst({
    where: {
      OR: [
        { firstName: { contains: 'Sharon', mode: 'insensitive' }, lastName: { contains: 'Scarfone', mode: 'insensitive' } },
        { name: { contains: 'Sharon Scarfone', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      name: true,
    },
  });

  if (!monica) {
    console.log('❌ Monica Lin not found');
    return;
  }
  if (!sharon) {
    console.log('❌ Sharon Scarfone not found');
    return;
  }

  console.log(`✅ Monica Lin: ${monica.id} (${monica.name || `${monica.firstName} ${monica.lastName}`})`);
  console.log(`✅ Sharon Scarfone: ${sharon.id} (${sharon.name || `${sharon.firstName} ${sharon.lastName}`})\n`);

  // Get all lineup entries for Mixed 1 and Mixed 2 in this tournament
  const lineupEntries = await prisma.lineupEntry.findMany({
    where: {
      lineup: {
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
          firstName: true,
          lastName: true,
          name: true,
        },
      },
      player2: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          name: true,
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
                },
              },
              matches: {
                include: {
                  games: {
                    where: {
                      OR: [
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

  console.log(`📊 Found ${lineupEntries.length} lineup entries\n`);

  // Group by game
  const gamesToSwap: Array<{
    gameId: string;
    matchId: string;
    roundId: string;
    roundIdx: number;
    bracketType: string;
    stopName: string;
    bracketName: string;
    teamName: string;
    currentSlot: 'MIXED_1' | 'MIXED_2';
    monicaEntry: typeof lineupEntries[0] | null;
    sharonEntry: typeof lineupEntries[0] | null;
    malePartner: { id: string; name: string } | null;
  }> = [];

  // Get all games for this tournament
  const allGames = await prisma.game.findMany({
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
              stop: {
                select: {
                  name: true,
                },
              },
            },
          },
          teamA: {
            select: {
              id: true,
              name: true,
            },
          },
          teamB: {
            select: {
              id: true,
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

  // For each game, find if Monica or Sharon played
  for (const game of allGames) {
    const match = game.match;
    const round = match.round;

    // Find lineup entries for this round and slot
    const relevantEntries = lineupEntries.filter(
      entry => entry.lineup.roundId === round.id && entry.slot === game.slot
    );

    const monicaEntry = relevantEntries.find(
      entry => entry.player1Id === monica.id || entry.player2Id === monica.id
    ) || null;

    const sharonEntry = relevantEntries.find(
      entry => entry.player1Id === sharon.id || entry.player2Id === sharon.id
    ) || null;

    if (monicaEntry || sharonEntry) {
      // Determine which team they played for
      const monicaTeam = monicaEntry ? monicaEntry.lineup.team : null;
      const sharonTeam = sharonEntry ? sharonEntry.lineup.team : null;
      const team = monicaTeam || sharonTeam;

      // Get the male partner
      let malePartner: { id: string; name: string } | null = null;
      if (monicaEntry) {
        const partner = monicaEntry.player1Id === monica.id ? monicaEntry.player2 : monicaEntry.player1;
        malePartner = partner ? {
          id: partner.id,
          name: partner.name || `${partner.firstName} ${partner.lastName}`,
        } : null;
      } else if (sharonEntry) {
        const partner = sharonEntry.player1Id === sharon.id ? sharonEntry.player2 : sharonEntry.player1;
        malePartner = partner ? {
          id: partner.id,
          name: partner.name || `${partner.firstName} ${partner.lastName}`,
        } : null;
      }

      gamesToSwap.push({
        gameId: game.id,
        matchId: match.id,
        roundId: round.id,
        roundIdx: round.idx,
        bracketType: round.bracketType || 'UNKNOWN',
        stopName: round.stop.name,
        bracketName: game.bracket?.name || 'No Bracket',
        teamName: team?.name || 'Unknown',
        currentSlot: game.slot as 'MIXED_1' | 'MIXED_2',
        monicaEntry,
        sharonEntry,
        malePartner,
      });
    }
  }

  console.log(`\n🎮 Games to Swap: ${gamesToSwap.length}\n`);

  // Display games
  gamesToSwap.forEach((gameInfo, idx) => {
    console.log(`\n${idx + 1}. Game ${gameInfo.gameId}`);
    console.log(`   Round: ${gameInfo.roundIdx} (${gameInfo.bracketType}) - ${gameInfo.stopName}`);
    console.log(`   Bracket: ${gameInfo.bracketName}`);
    console.log(`   Team: ${gameInfo.teamName}`);
    console.log(`   Current Slot: ${gameInfo.currentSlot}`);
    console.log(`   Male Partner: ${gameInfo.malePartner?.name || 'Unknown'}`);
    if (gameInfo.monicaEntry) {
      console.log(`   ✅ Monica Lin currently in ${gameInfo.currentSlot}`);
    }
    if (gameInfo.sharonEntry) {
      console.log(`   ✅ Sharon Scarfone currently in ${gameInfo.currentSlot}`);
    }
    console.log(`   → Should swap: Monica to ${gameInfo.currentSlot === 'MIXED_1' ? 'MIXED_2' : 'MIXED_1'}, Sharon to ${gameInfo.currentSlot === 'MIXED_1' ? 'MIXED_2' : 'MIXED_1'}`);
  });

  // Create swap plan
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('SWAP PLAN');
  console.log('='.repeat(80));

  const monicaGames = gamesToSwap.filter(g => g.monicaEntry);
  const sharonGames = gamesToSwap.filter(g => g.sharonEntry);

  console.log(`\n📋 Summary:`);
  console.log(`   Monica Lin games: ${monicaGames.length}`);
  console.log(`   Sharon Scarfone games: ${sharonGames.length}`);
  console.log(`   Total games to modify: ${gamesToSwap.length}`);

  console.log(`\n📝 Plan:`);
  console.log(`   1. For each game where Monica Lin is in MIXED_1:`);
  console.log(`      - Find the corresponding MIXED_2 game in the same match`);
  console.log(`      - Swap Monica's lineup entry from MIXED_1 to MIXED_2`);
  console.log(`      - Swap Sharon's lineup entry from MIXED_2 to MIXED_1`);
  console.log(`      - Update the game slot references if needed`);
  console.log(`\n   2. For each game where Monica Lin is in MIXED_2:`);
  console.log(`      - Find the corresponding MIXED_1 game in the same match`);
  console.log(`      - Swap Monica's lineup entry from MIXED_2 to MIXED_1`);
  console.log(`      - Swap Sharon's lineup entry from MIXED_1 to MIXED_2`);
  console.log(`      - Update the game slot references if needed`);

  console.log(`\n\n${'='.repeat(80)}`);
  console.log('RISKS & CONSIDERATIONS');
  console.log('='.repeat(80));

  console.log(`\n⚠️  RISKS:`);
  console.log(`\n   1. DATA INTEGRITY:`);
  console.log(`      - Lineup entries are linked to specific games via round + slot`);
  console.log(`      - Games have slot field that must match lineup entry slot`);
  console.log(`      - Need to ensure both lineup entries and games are updated consistently`);

  console.log(`\n   2. MISSING GAMES:`);
  console.log(`      - If Monica is in MIXED_1 but no MIXED_2 game exists in that match, swap cannot happen`);
  console.log(`      - If Sharon is in MIXED_2 but no MIXED_1 game exists in that match, swap cannot happen`);
  console.log(`      - Need to verify all matches have both MIXED_1 and MIXED_2 games`);

  console.log(`\n   3. SCORE CONSISTENCY:`);
  console.log(`      - Game scores are tied to the game, not the players`);
  console.log(`      - Scores should remain with the game (not swap with players)`);
  console.log(`      - Need to verify scores are correctly associated after swap`);

  console.log(`\n   4. TEAM CONSISTENCY:`);
  console.log(`      - Both players must be on the same team for the swap to make sense`);
  console.log(`      - Need to verify Monica and Sharon are always on the same team in these games`);

  console.log(`\n   5. MALE PARTNER CONSISTENCY:`);
  console.log(`      - The male partner should remain the same`);
  console.log(`      - Need to verify the male partner is consistent across MIXED_1 and MIXED_2`);

  console.log(`\n   6. TRANSACTION SAFETY:`);
  console.log(`      - All updates should be in a single database transaction`);
  console.log(`      - If any update fails, all changes should be rolled back`);

  console.log(`\n   7. VALIDATION:`);
  console.log(`      - After swap, verify lineup entries point to correct games`);
  console.log(`      - Verify games have correct slot assignments`);
  console.log(`      - Verify no duplicate lineup entries exist`);

  // Check for potential issues
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('VALIDATION CHECKS');
  console.log('='.repeat(80));

  // Check if all games have corresponding pairs
  const matchesWithGames = new Map<string, { mixed1?: typeof allGames[0]; mixed2?: typeof allGames[0] }>();
  for (const game of allGames) {
    if (!matchesWithGames.has(game.matchId)) {
      matchesWithGames.set(game.matchId, {});
    }
    const matchGames = matchesWithGames.get(game.matchId)!;
    if (game.slot === 'MIXED_1') {
      matchGames.mixed1 = game;
    } else if (game.slot === 'MIXED_2') {
      matchGames.mixed2 = game;
    }
  }

  const incompleteMatches = Array.from(matchesWithGames.entries()).filter(
    ([_, games]) => !games.mixed1 || !games.mixed2
  );

  if (incompleteMatches.length > 0) {
    console.log(`\n⚠️  WARNING: ${incompleteMatches.length} matches missing MIXED_1 or MIXED_2 games:`);
    incompleteMatches.forEach(([matchId, games]) => {
      console.log(`   Match ${matchId}: MIXED_1=${!!games.mixed1}, MIXED_2=${!!games.mixed2}`);
    });
  } else {
    console.log(`\n✅ All matches have both MIXED_1 and MIXED_2 games`);
  }

  // Check if Monica and Sharon are always on the same team
  const teamMismatches: Array<{ matchId: string; monicaTeam: string; sharonTeam: string }> = [];
  for (const gameInfo of gamesToSwap) {
    if (gameInfo.monicaEntry && gameInfo.sharonEntry) {
      const monicaTeam = gameInfo.monicaEntry.lineup.team.name;
      const sharonTeam = gameInfo.sharonEntry.lineup.team.name;
      if (monicaTeam !== sharonTeam) {
        teamMismatches.push({
          matchId: gameInfo.matchId,
          monicaTeam,
          sharonTeam,
        });
      }
    }
  }

  if (teamMismatches.length > 0) {
    console.log(`\n⚠️  WARNING: ${teamMismatches.length} matches where Monica and Sharon are on different teams:`);
    teamMismatches.forEach(m => {
      console.log(`   Match ${m.matchId}: Monica=${m.monicaTeam}, Sharon=${m.sharonTeam}`);
    });
  } else {
    console.log(`\n✅ Monica and Sharon are always on the same team`);
  }
}

analyzeMonicaSharonSwap()
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

