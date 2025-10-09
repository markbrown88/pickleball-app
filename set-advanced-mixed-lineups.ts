import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Setting Mixed Doubles Lineups for Real Pickleball Advanced vs One Health Advanced ===\n');

  const matchId = 'cmgdy7txq007rr0k8tgjzbt2p';

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

  console.log('Current games and lineups:');
  games.forEach(game => {
    console.log(`${game.slot}:`);
    console.log(`  Team A: ${game.teamALineup ? JSON.stringify(game.teamALineup) : 'null'}`);
    console.log(`  Team B: ${game.teamBLineup ? JSON.stringify(game.teamBLineup) : 'null'}`);
    console.log(`  Confirmed: ${game.lineupConfirmed}`);
    console.log('');
  });

  // Find the games we need
  const mensDoubles = games.find(g => g.slot === 'MENS_DOUBLES');
  const womensDoubles = games.find(g => g.slot === 'WOMENS_DOUBLES');
  const mixed1 = games.find(g => g.slot === 'MIXED_1');
  const mixed2 = games.find(g => g.slot === 'MIXED_2');

  if (!mensDoubles || !womensDoubles || !mixed1 || !mixed2) {
    console.log('❌ Could not find all required games');
    return;
  }

  if (!mensDoubles.teamALineup || !mensDoubles.teamBLineup || 
      !womensDoubles.teamALineup || !womensDoubles.teamBLineup) {
    console.log('❌ MENS_DOUBLES or WOMENS_DOUBLES lineups are missing');
    return;
  }

  // Extract player IDs from existing lineups
  const mensTeamA = (mensDoubles.teamALineup as any[])[0];
  const mensTeamB = (mensDoubles.teamBLineup as any[])[0];
  const womensTeamA = (womensDoubles.teamALineup as any[])[0];
  const womensTeamB = (womensDoubles.teamBLineup as any[])[0];

  console.log('Extracted players:');
  console.log(`  MENS Team A: ${mensTeamA.player1Id} & ${mensTeamA.player2Id}`);
  console.log(`  MENS Team B: ${mensTeamB.player1Id} & ${mensTeamB.player2Id}`);
  console.log(`  WOMENS Team A: ${womensTeamA.player1Id} & ${womensTeamA.player2Id}`);
  console.log(`  WOMENS Team B: ${womensTeamB.player1Id} & ${womensTeamB.player2Id}`);

  // Set MIXED_1 lineup (Man1 + Woman1 vs Man2 + Woman2)
  const mixed1TeamA = {
    player1Id: mensTeamA.player1Id, // First man from men's doubles
    player2Id: womensTeamA.player1Id // First woman from women's doubles
  };
  
  const mixed1TeamB = {
    player1Id: mensTeamB.player1Id, // First man from men's doubles
    player2Id: womensTeamB.player1Id // First woman from women's doubles
  };

  // Set MIXED_2 lineup (Man2 + Woman2 vs Man1 + Woman1)
  const mixed2TeamA = {
    player1Id: mensTeamA.player2Id, // Second man from men's doubles
    player2Id: womensTeamA.player2Id // Second woman from women's doubles
  };
  
  const mixed2TeamB = {
    player1Id: mensTeamB.player2Id, // Second man from men's doubles
    player2Id: womensTeamB.player2Id // Second woman from women's doubles
  };

  try {
    // Update MIXED_1
    await prisma.game.update({
      where: { id: mixed1.id },
      data: {
        teamALineup: [mixed1TeamA],
        teamBLineup: [mixed1TeamB],
        lineupConfirmed: true
      }
    });

    console.log('✅ Updated MIXED_1 lineup');

    // Update MIXED_2
    await prisma.game.update({
      where: { id: mixed2.id },
      data: {
        teamALineup: [mixed2TeamA],
        teamBLineup: [mixed2TeamB],
        lineupConfirmed: true
      }
    });

    console.log('✅ Updated MIXED_2 lineup');

    console.log('\n✅ Successfully set both mixed doubles lineups!');
    console.log('MIXED_1: Man1 + Woman1 vs Man1 + Woman1');
    console.log('MIXED_2: Man2 + Woman2 vs Man2 + Woman2');

  } catch (error) {
    console.error('❌ Error setting lineups:', error);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
