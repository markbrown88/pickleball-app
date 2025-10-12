import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testScheduleApi() {
  try {
    // Get the first stop
    const stop = await prisma.stop.findFirst({
      where: { name: 'Stop 1' },
      select: { id: true, name: true }
    });

    if (!stop) {
      console.log('No stop found');
      return;
    }

    console.log(`Testing schedule for: ${stop.name} (${stop.id})\n`);

    // Simulate what the schedule API does
    const roundsRaw = await prisma.round.findMany({
      where: { stopId: stop.id },
      orderBy: { idx: 'asc' },
      take: 1,
      include: {
        matches: {
          orderBy: { id: 'asc' },
          take: 1,
          select: {
            id: true,
            teamAId: true,
            teamBId: true,
            teamA: { select: { id: true, name: true } },
            teamB: { select: { id: true, name: true } },
            games: {
              orderBy: { slot: 'asc' },
              select: { id: true, slot: true }
            },
          },
        },
        lineups: {
          include: {
            entries: {
              include: {
                player1: { select: { id: true, name: true, gender: true } },
                player2: { select: { id: true, name: true, gender: true } }
              }
            }
          }
        }
      },
    });

    if (roundsRaw.length === 0) {
      console.log('No rounds found');
      return;
    }

    const round = roundsRaw[0];
    const match = round.matches[0];

    if (!match) {
      console.log('No matches found');
      return;
    }

    console.log(`Round ${round.idx}, Match: ${match.teamA?.name} vs ${match.teamB?.name}\n`);

    // Build lineup map like the schedule API does
    const lineupMap = new Map<string, any[]>();
    round.lineups.forEach((lineup) => {
      const key = `${round.id}-${lineup.teamId}`;
      const players: any[] = [];

      const mensDoubles = lineup.entries.find(e => e.slot === 'MENS_DOUBLES');
      const womensDoubles = lineup.entries.find(e => e.slot === 'WOMENS_DOUBLES');

      if (mensDoubles) {
        if (mensDoubles.player1) players[0] = { id: mensDoubles.player1.id, name: mensDoubles.player1.name, gender: mensDoubles.player1.gender };
        if (mensDoubles.player2) players[1] = { id: mensDoubles.player2.id, name: mensDoubles.player2.name, gender: mensDoubles.player2.gender };
      }

      if (womensDoubles) {
        if (womensDoubles.player1) players[2] = { id: womensDoubles.player1.id, name: womensDoubles.player1.name, gender: womensDoubles.player1.gender };
        if (womensDoubles.player2) players[3] = { id: womensDoubles.player2.id, name: womensDoubles.player2.name, gender: womensDoubles.player2.gender };
      }

      console.log(`Lineup for team ${lineup.teamId}:`);
      console.log(`  players array:`, players);
      console.log(`  players.length:`, players.length);
      console.log(`  Check: [0]=${!!players[0]}, [1]=${!!players[1]}, [2]=${!!players[2]}, [3]=${!!players[3]}`);

      if (players[0] && players[1] && players[2] && players[3]) {
        lineupMap.set(key, players);
        console.log(`  ✓ Added to map (complete lineup)\n`);
      } else {
        console.log(`  ✗ NOT added to map (incomplete lineup)\n`);
      }
    });

    // Get lineups from map
    const teamALineupKey = match.teamAId ? `${round.id}-${match.teamAId}` : null;
    const teamBLineupKey = match.teamBId ? `${round.id}-${match.teamBId}` : null;
    const teamALineup = teamALineupKey ? lineupMap.get(teamALineupKey) || null : null;
    const teamBLineup = teamBLineupKey ? lineupMap.get(teamBLineupKey) || null : null;

    console.log(`TeamA lineup from map:`, teamALineup);
    console.log(`TeamB lineup from map:`, teamBLineup);

    console.log(`\nGames (${match.games.length}):`);
    match.games.forEach(game => {
      console.log(`  ${game.slot}: teamALineup=${teamALineup?.length || 0} players, teamBLineup=${teamBLineup?.length || 0} players`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testScheduleApi();
