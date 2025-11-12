const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteIncorrectCompletions() {
  try {
    const tournament = await prisma.tournament.findFirst({
      where: { name: { contains: 'Bracket Test 4' } },
      include: {
        stops: {
          include: {
            rounds: {
              include: {
                matches: {
                  include: {
                    round: { select: { bracketType: true, idx: true } },
                    teamA: { select: { name: true, id: true } },
                    teamB: { select: { name: true } },
                    games: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!tournament || !tournament.stops[0]) {
      console.error('Tournament not found');
      return;
    }

    const rounds = tournament.stops[0].rounds.sort((a, b) => {
      const bracketOrder = { 'WINNER': 0, 'LOSER': 1, 'FINALS': 2 };
      const orderA = bracketOrder[a.bracketType] ?? 99;
      const orderB = bracketOrder[b.bracketType] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.idx - b.idx;
    });

    console.log('🔄 Finding matches with empty games...\n');

    const pickleringId = 'cmhpat4an000gr02obwwvmcmv';
    let matchNumber = 1;
    let fixedMatches = [];

    for (const round of rounds) {
      for (const match of round.matches) {
        // Find matches that:
        // 1. Are NOT BYE matches
        // 2. Have a winner set
        // 3. Have games with all null scores
        if (!match.isBye && match.winnerId && match.games.length > 0) {
          const allScoresNull = match.games.every(g => g.teamAScore === null && g.teamBScore === null);

          if (allScoresNull) {
            console.log(`Match ${matchNumber} (Round ${match.round?.idx}, ${match.round?.bracketType}):`);
            console.log(`  ID: ${match.id.slice(0, 8)}`);
            console.log(`  Teams: ${match.teamA?.name || 'null'} vs ${match.teamB?.name || 'null'}`);
            console.log(`  Winner: ${match.winnerId.slice(0, 8)}`);
            console.log(`  Games: ${match.games.length} (all null scores)`);

            fixedMatches.push({
              matchNumber,
              matchId: match.id,
              round: match.round,
              teamAId: match.teamAId,
              winnerId: match.winnerId,
            });
          }
        }
        matchNumber++;
      }
    }

    if (fixedMatches.length === 0) {
      console.log('✅ No matches with empty games found\n');
      return;
    }

    console.log(`\n❗ Found ${fixedMatches.length} matches to fix\n`);

    // Delete games from these matches
    for (const m of fixedMatches) {
      // Delete all games
      await prisma.game.deleteMany({
        where: { matchId: m.matchId },
      });
      console.log(`  Deleted games from match ${m.matchId.slice(0, 8)}`);

      // Clear winner
      await prisma.match.update({
        where: { id: m.matchId },
        data: { winnerId: null },
      });
      console.log(`  Cleared winnerId from match ${m.matchId.slice(0, 8)}`);
    }

    console.log(`\n✅ Fixed ${fixedMatches.length} matches`);

    // Now clear Pickleplex Pickering from all subsequent matches (since those completions were invalid)
    console.log('\n🔄 Clearing incorrectly advanced teams...\n');

    const allMatches = rounds.flatMap(r => r.matches);
    let cleared = 0;

    for (const match of allMatches) {
      let needsUpdate = false;
      const updates = {};

      if (match.teamAId === pickleringId && !match.isBye && !match.winnerId) {
        updates.teamAId = null;
        needsUpdate = true;
      }

      if (match.teamBId === pickleringId && !match.isBye && !match.winnerId) {
        updates.teamBId = null;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await prisma.match.update({
          where: { id: match.id },
          data: updates,
        });
        console.log(`  Cleared Pickleplex Pickering from match ${match.id.slice(0, 8)}`);
        cleared++;
      }
    }

    console.log(`\n✅ Cleared ${cleared} incorrectly advanced teams\n`);

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

deleteIncorrectCompletions();
