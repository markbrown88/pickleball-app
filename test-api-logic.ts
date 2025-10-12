import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function testAPILogic() {
  try {
    // Get the specific match
    const match = await prisma.match.findFirst({
      where: {
        games: {
          some: {
            teamALineup: { not: Prisma.JsonNull }
          }
        }
      },
      include: {
        teamA: { select: { id: true, name: true } },
        teamB: { select: { id: true, name: true } },
        games: {
          select: {
            id: true,
            slot: true,
            teamALineup: true,
            teamBLineup: true
          }
        }
      }
    });

    if (!match) {
      console.log('No match found');
      return;
    }

    console.log(`\n=== Testing API logic for match: ${match.teamA?.name} vs ${match.teamB?.name} ===`);

    // Get all player IDs from the lineups
    const allPlayerIds = new Set<string>();
    match.games.forEach(game => {
      if (game.teamALineup && Array.isArray(game.teamALineup)) {
        game.teamALineup.forEach((entry: any) => {
          if (entry.player1Id) allPlayerIds.add(entry.player1Id);
          if (entry.player2Id) allPlayerIds.add(entry.player2Id);
        });
      }
      if (game.teamBLineup && Array.isArray(game.teamBLineup)) {
        game.teamBLineup.forEach((entry: any) => {
          if (entry.player1Id) allPlayerIds.add(entry.player1Id);
          if (entry.player2Id) allPlayerIds.add(entry.player2Id);
        });
      }
    });

    console.log('All player IDs:', Array.from(allPlayerIds));

    // Fetch player details
    const players = await prisma.player.findMany({
      where: { id: { in: Array.from(allPlayerIds) } },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        gender: true
      }
    });

    const playerMap = new Map(players.map(p => [p.id, {
      id: p.id,
      name: p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim(),
      gender: p.gender
    }]));

    console.log('Player map:', Array.from(playerMap.entries()));

    // Test the API logic
    const teamALineup: any[] = [];
    const teamBLineup: any[] = [];

    // Find the specific games
    const mensGame = match.games.find(g => g.slot === 'MENS_DOUBLES');
    const womensGame = match.games.find(g => g.slot === 'WOMENS_DOUBLES');

    console.log('\n--- Team A Lineup Extraction ---');
    console.log('MENS_DOUBLES game found:', !!mensGame);
    console.log('WOMENS_DOUBLES game found:', !!womensGame);

    // Extract Team A lineup: Man1, Man2, Woman1, Woman2
    if (mensGame?.teamALineup && Array.isArray(mensGame.teamALineup) && mensGame.teamALineup[0]) {
      const entry = mensGame.teamALineup[0] as any;
      console.log('MENS_DOUBLES Team A entry:', entry);
      if (entry.player1Id) {
        const player = playerMap.get(entry.player1Id);
        if (player) {
          teamALineup.push(player);
          console.log('Added Man1:', player.name, player.gender);
        } else {
          console.log('Player not found for ID:', entry.player1Id);
        }
      }
      if (entry.player2Id) {
        const player = playerMap.get(entry.player2Id);
        if (player) {
          teamALineup.push(player);
          console.log('Added Man2:', player.name, player.gender);
        } else {
          console.log('Player not found for ID:', entry.player2Id);
        }
      }
    }

    if (womensGame?.teamALineup && Array.isArray(womensGame.teamALineup) && womensGame.teamALineup[0]) {
      const entry = womensGame.teamALineup[0] as any;
      console.log('WOMENS_DOUBLES Team A entry:', entry);
      if (entry.player1Id) {
        const player = playerMap.get(entry.player1Id);
        if (player) {
          teamALineup.push(player);
          console.log('Added Woman1:', player.name, player.gender);
        } else {
          console.log('Player not found for ID:', entry.player1Id);
        }
      }
      if (entry.player2Id) {
        const player = playerMap.get(entry.player2Id);
        if (player) {
          teamALineup.push(player);
          console.log('Added Woman2:', player.name, player.gender);
        } else {
          console.log('Player not found for ID:', entry.player2Id);
        }
      }
    }

    console.log('\nFinal Team A lineup:', teamALineup.map(p => `${p.name} (${p.gender})`));
    console.log('Team A lineup length:', teamALineup.length);

  } catch (error) {
    console.error('Error testing API logic:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAPILogic();
