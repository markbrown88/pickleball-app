import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Setting Correct Lineups for Round 5 ===\n');
  console.log('Real Pickleball Advanced vs Greenhills Advanced\n');

  const matchId = 'cmgdy7w6j009pr0k88zi7qn8v';

  // Get all games for this match
  const games = await prisma.game.findMany({
    where: { matchId },
    select: {
      id: true,
      slot: true,
      teamALineup: true,
      teamBLineup: true,
      lineupConfirmed: true
    },
    orderBy: { slot: 'asc' }
  });

  console.log('Setting lineups according to specifications:');
  console.log('MENS_DOUBLES: Ryan + Troy vs Josh + Gene');
  console.log('WOMENS_DOUBLES: Ashley + Leanne vs Una + Thea');
  console.log('MIXED_1: Troy + Leanne vs Gene + Una');
  console.log('MIXED_2: Ashley + Ryan vs Josh + Thea\n');

  // Player IDs
  const ryanId = 'cmfpbp8xs003prdn03fe4qs86'; // Ryan Bilodeau
  const troyId = 'cmg2pzitz0001rdjo7dylay4d'; // Troy Rieck
  const ashleyId = 'cmg1cxym000a0rdlbidyzm9ds'; // Ashley Stewart
  const leannaId = 'cmfpbp87k002drdn0yln7mvny'; // Leanna Macdonnell (Leanne)
  const joshId = 'cmfpbp7zj0021rdn0rccmp09l'; // Josh Hazenbuhler
  const geneId = 'cmfosyyfk0003rdkf16xmvibe'; // Gene Liang
  const unaId = 'cmfpbp9gm004lrdn0yyonoxcx'; // Una Pandurevic
  const theaId = 'cmg07da5x001jrddcz4lhzgso'; // Thea Rifol

  // Set lineups for each game
  for (const game of games) {
    let teamALineup, teamBLineup;

    switch (game.slot) {
      case 'MENS_DOUBLES':
        // Ryan + Troy vs Josh + Gene
        teamALineup = [{ player1Id: ryanId, player2Id: troyId }];
        teamBLineup = [{ player1Id: joshId, player2Id: geneId }];
        break;
      case 'WOMENS_DOUBLES':
        // Ashley + Leanne vs Una + Thea
        teamALineup = [{ player1Id: ashleyId, player2Id: leannaId }];
        teamBLineup = [{ player1Id: unaId, player2Id: theaId }];
        break;
      case 'MIXED_1':
        // Troy + Leanne vs Gene + Una
        teamALineup = [{ player1Id: troyId, player2Id: leannaId }];
        teamBLineup = [{ player1Id: geneId, player2Id: unaId }];
        break;
      case 'MIXED_2':
        // Ashley + Ryan vs Josh + Thea
        teamALineup = [{ player1Id: ashleyId, player2Id: ryanId }];
        teamBLineup = [{ player1Id: joshId, player2Id: theaId }];
        break;
      case 'TIEBREAKER':
        // Skip tiebreaker
        continue;
      default:
        continue;
    }

    try {
      await prisma.game.update({
        where: { id: game.id },
        data: {
          teamALineup: teamALineup,
          teamBLineup: teamBLineup,
          lineupConfirmed: true
        }
      });

      console.log(`✅ ${game.slot}: Set lineup`);
    } catch (error) {
      console.error(`❌ ${game.slot}: Error setting lineup:`, error);
    }
  }

  console.log('\n✅ All lineups set successfully!');
  console.log('\nFinal lineups:');
  console.log('MENS_DOUBLES: Ryan Bilodeau & Troy Rieck vs Josh Hazenbuhler & Gene Liang');
  console.log('WOMENS_DOUBLES: Ashley Stewart & Leanna Macdonnell vs Una Pandurevic & Thea Rifol');
  console.log('MIXED_1: Troy Rieck & Leanna Macdonnell vs Gene Liang & Una Pandurevic');
  console.log('MIXED_2: Ashley Stewart & Ryan Bilodeau vs Josh Hazenbuhler & Thea Rifol');
}

main().catch(console.error).finally(() => prisma.$disconnect());
