import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Creating Lineups for Stop 1 ===\n');
  console.log('Preserving all existing games, scores, and winners\n');

  // Get Stop 1
  const stop1 = await prisma.stop.findFirst({
    where: { name: 'Stop 1' },
    select: { id: true, name: true }
  });

  if (!stop1) {
    console.log('❌ Stop 1 not found');
    return;
  }

  // Get all matches in Stop 1
  const matches = await prisma.match.findMany({
    where: {
      round: { stopId: stop1.id }
    },
    include: {
      teamA: { select: { id: true, name: true } },
      teamB: { select: { id: true, name: true } },
      round: { select: { idx: true } },
      games: {
        where: {
          slot: { in: ['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_1', 'MIXED_2'] }
        },
        select: {
          id: true,
          slot: true,
          teamAScore: true,
          teamBScore: true,
          isComplete: true,
          teamALineup: true,
          teamBLineup: true
        },
        orderBy: { slot: 'asc' }
      }
    },
    orderBy: { round: { idx: 'asc' } }
  });

  console.log(`Found ${matches.length} matches in Stop 1`);

  let processedMatches = 0;
  let createdLineups = 0;

  for (const match of matches) {
    console.log(`\n=== Round ${match.round.idx + 1}: ${match.teamA?.name} vs ${match.teamB?.name} ===`);
    
    // Skip if match is a bye or forfeit
    if (match.isBye || match.forfeitTeam) {
      console.log(`  Skipping ${match.isBye ? 'bye' : 'forfeit'} match`);
      continue;
    }

    // Get team rosters
    const [teamARoster, teamBRoster] = await Promise.all([
      prisma.stopTeamPlayer.findMany({
        where: {
          stopId: stop1.id,
          teamId: match.teamAId!
        },
        include: {
          player: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              gender: true
            }
          }
        }
      }),
      prisma.stopTeamPlayer.findMany({
        where: {
          stopId: stop1.id,
          teamId: match.teamBId!
        },
        include: {
          player: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              gender: true
            }
          }
        }
      })
    ]);

    // Check if we have enough players
    const teamAMales = teamARoster.filter(p => p.player.gender === 'MALE');
    const teamAFemales = teamARoster.filter(p => p.player.gender === 'FEMALE');
    const teamBMales = teamBRoster.filter(p => p.player.gender === 'MALE');
    const teamBFemales = teamBRoster.filter(p => p.player.gender === 'FEMALE');

    if (teamAMales.length < 2 || teamAFemales.length < 2 || teamBMales.length < 2 || teamBFemales.length < 2) {
      console.log(`  ❌ Insufficient players for lineups`);
      continue;
    }

    // Select players for lineups (first 2 males, first 2 females)
    const teamALineup = [
      teamAMales[0].player,
      teamAMales[1].player,
      teamAFemales[0].player,
      teamAFemales[1].player
    ];

    const teamBLineup = [
      teamBMales[0].player,
      teamBMales[1].player,
      teamBFemales[0].player,
      teamBFemales[1].player
    ];

    console.log(`  Team A lineup: ${teamALineup.map(p => p.name || `${p.firstName} ${p.lastName}`).join(', ')}`);
    console.log(`  Team B lineup: ${teamBLineup.map(p => p.name || `${p.firstName} ${p.lastName}`).join(', ')}`);

    // Update games with lineups
    for (const game of match.games) {
      let teamALineupForGame, teamBLineupForGame;

      switch (game.slot) {
        case 'MENS_DOUBLES':
          teamALineupForGame = [{ player1Id: teamALineup[0].id, player2Id: teamALineup[1].id }];
          teamBLineupForGame = [{ player1Id: teamBLineup[0].id, player2Id: teamBLineup[1].id }];
          break;
        case 'WOMENS_DOUBLES':
          teamALineupForGame = [{ player1Id: teamALineup[2].id, player2Id: teamALineup[3].id }];
          teamBLineupForGame = [{ player1Id: teamBLineup[2].id, player2Id: teamBLineup[3].id }];
          break;
        case 'MIXED_1':
          teamALineupForGame = [{ player1Id: teamALineup[0].id, player2Id: teamALineup[2].id }];
          teamBLineupForGame = [{ player1Id: teamBLineup[0].id, player2Id: teamBLineup[2].id }];
          break;
        case 'MIXED_2':
          teamALineupForGame = [{ player1Id: teamALineup[1].id, player2Id: teamALineup[3].id }];
          teamBLineupForGame = [{ player1Id: teamBLineup[1].id, player2Id: teamBLineup[3].id }];
          break;
        default:
          continue;
      }

      // Update the game with lineups (preserving all other data)
      await prisma.game.update({
        where: { id: game.id },
        data: {
          teamALineup: teamALineupForGame,
          teamBLineup: teamBLineupForGame
          // Note: NOT updating scores, isComplete, or any other fields
        }
      });

      console.log(`    ${game.slot}: ${game.teamAScore} - ${game.teamBScore} (Complete: ${game.isComplete})`);
    }

    processedMatches++;
    createdLineups += match.games.length;
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`✅ Processed ${processedMatches} matches`);
  console.log(`✅ Created lineups for ${createdLineups} games`);
  console.log(`✅ Preserved all existing scores and game statuses`);
  console.log(`✅ Stop 1 should now show players and scores in the UI`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
