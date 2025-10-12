import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testActualApi() {
  try {
    // Get Stop 1
    const stop = await prisma.stop.findFirst({
      where: { name: 'Stop 1' },
      select: { id: true }
    });

    if (!stop) {
      console.log('Stop 1 not found');
      return;
    }

    // Simulate the exact query from the schedule API
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
            isBye: true,
            forfeitTeam: true,
            roundId: true,
            teamAId: true,
            teamBId: true,
            teamA: {
              select: {
                id: true,
                name: true,
                clubId: true,
                bracket: { select: { id: true, name: true } },
                playerLinks: { include: { player: { select: { id: true, firstName: true, lastName: true, name: true, gender: true, dupr: true } } } }
              },
            },
            teamB: {
              select: {
                id: true,
                name: true,
                clubId: true,
                bracket: { select: { id: true, name: true } },
                playerLinks: { include: { player: { select: { id: true, firstName: true, lastName: true, name: true, gender: true, dupr: true } } } }
              },
            },
            games: {
              orderBy: { slot: 'asc' },
              select: {
                id: true,
                slot: true,
                teamAScore: true,
                teamBScore: true,
                courtNumber: true,
                isComplete: true,
                startedAt: true,
                endedAt: true,
                createdAt: true,
                lineupConfirmed: true,
              }
            },
          },
        },
        lineups: {
          include: {
            entries: {
              include: {
                player1: { select: { id: true, name: true, firstName: true, lastName: true, gender: true } },
                player2: { select: { id: true, name: true, firstName: true, lastName: true, gender: true } }
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

    console.log(`Round ${round.idx}`);
    console.log(`Match: ${match.teamA?.name} vs ${match.teamB?.name}`);
    console.log(`\nLineups in round (${round.lineups.length}):`);

    // Build lineup map exactly like the schedule API does
    const lineupMap = new Map<string, any[]>();
    round.lineups.forEach((lineup) => {
      const key = `${round.id}-${lineup.teamId}`;
      const players: any[] = [];

      const mensDoubles = lineup.entries.find(e => e.slot === 'MENS_DOUBLES');
      const womensDoubles = lineup.entries.find(e => e.slot === 'WOMENS_DOUBLES');

      console.log(`\nTeam ${lineup.teamId}:`);
      console.log(`  MENS_DOUBLES:`, mensDoubles ? `${mensDoubles.player1?.name} & ${mensDoubles.player2?.name}` : 'MISSING');
      console.log(`  WOMENS_DOUBLES:`, womensDoubles ? `${womensDoubles.player1?.name} & ${womensDoubles.player2?.name}` : 'MISSING');

      if (mensDoubles) {
        if (mensDoubles.player1) {
          players[0] = {
            id: mensDoubles.player1.id,
            name: mensDoubles.player1.name || `${mensDoubles.player1.firstName || ''} ${mensDoubles.player1.lastName || ''}`.trim(),
            gender: mensDoubles.player1.gender
          };
        }
        if (mensDoubles.player2) {
          players[1] = {
            id: mensDoubles.player2.id,
            name: mensDoubles.player2.name || `${mensDoubles.player2.firstName || ''} ${mensDoubles.player2.lastName || ''}`.trim(),
            gender: mensDoubles.player2.gender
          };
        }
      }

      if (womensDoubles) {
        if (womensDoubles.player1) {
          players[2] = {
            id: womensDoubles.player1.id,
            name: womensDoubles.player1.name || `${womensDoubles.player1.firstName || ''} ${womensDoubles.player1.lastName || ''}`.trim(),
            gender: womensDoubles.player1.gender
          };
        }
        if (womensDoubles.player2) {
          players[3] = {
            id: womensDoubles.player2.id,
            name: womensDoubles.player2.name || `${womensDoubles.player2.firstName || ''} ${womensDoubles.player2.lastName || ''}`.trim(),
            gender: womensDoubles.player2.gender
          };
        }
      }

      console.log(`  Reconstructed array:`, players.map(p => p?.name || 'undefined'));
      console.log(`  Check: [0]=${!!players[0]}, [1]=${!!players[1]}, [2]=${!!players[2]}, [3]=${!!players[3]}`);

      if (players[0] && players[1] && players[2] && players[3]) {
        lineupMap.set(key, players);
        console.log(`  ✓ Added to map`);
      } else {
        console.log(`  ✗ NOT added to map (incomplete)`);
      }
    });

    // Get lineups for this match
    const teamALineupKey = match.teamAId ? `${round.id}-${match.teamAId}` : null;
    const teamBLineupKey = match.teamBId ? `${round.id}-${match.teamBId}` : null;
    const teamALineup = teamALineupKey ? lineupMap.get(teamALineupKey) || null : null;
    const teamBLineup = teamBLineupKey ? lineupMap.get(teamBLineupKey) || null : null;

    console.log(`\n\n=== FINAL RESULT ===`);
    console.log(`TeamA lineup:`, teamALineup?.map(p => `${p.name} (${p.gender})`) || 'NULL');
    console.log(`TeamB lineup:`, teamBLineup?.map(p => `${p.name} (${p.gender})`) || 'NULL');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testActualApi();
