/**
 * Test Stop 2 API response
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STOP_2_ID = 'cmfot1xzy0008rd6a1kvvmvta';

async function testScheduleAPI() {
  console.log('Testing /api/admin/stops/[stopId]/schedule endpoint\n');

  // This simulates what the API endpoint does
  const roundsRaw = await prisma.round.findMany({
    where: { stopId: STOP_2_ID },
    orderBy: { idx: 'asc' },
    include: {
      matches: {
        orderBy: { id: 'asc' },
        select: {
          id: true,
          isBye: true,
          forfeitTeam: true,
          teamA: {
            select: {
              id: true,
              name: true,
              clubId: true,
              bracket: { select: { id: true, name: true } }
            }
          },
          teamB: {
            select: {
              id: true,
              name: true,
              clubId: true,
              bracket: { select: { id: true, name: true } }
            }
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
              teamALineup: true,
              teamBLineup: true,
              lineupConfirmed: true
            }
          }
        }
      }
    }
  });

  const rounds = roundsRaw.map((r) => {
    const matches = r.matches.map((match) => {
      const inferredBracketId = match.teamA?.bracket?.id ?? match.teamB?.bracket?.id ?? null;
      const inferredBracketName = match.teamA?.bracket?.name ?? match.teamB?.bracket?.name ?? null;

      return {
        id: match.id,
        teamA: match.teamA,
        teamB: match.teamB,
        isBye: match.isBye,
        forfeitTeam: match.forfeitTeam,
        bracketId: inferredBracketId,
        bracketName: inferredBracketName,
        games: match.games?.map((game) => ({
          id: game.id,
          slot: game.slot,
          teamAScore: game.teamAScore,
          teamBScore: game.teamBScore,
          courtNumber: game.courtNumber,
          isComplete: game.isComplete,
          startedAt: game.startedAt,
          endedAt: game.endedAt,
          teamALineup: game.teamALineup,
          teamBLineup: game.teamBLineup,
          lineupConfirmed: game.lineupConfirmed,
          createdAt: game.createdAt
        })) || []
      };
    });

    return { ...r, matches };
  });

  console.log('API Response Summary:');
  console.log('====================');
  console.log('Total Rounds:', rounds.length);

  if (rounds[0]) {
    console.log('\nRound 1:');
    console.log('  Matches:', rounds[0].matches.length);

    if (rounds[0].matches[0]) {
      const match = rounds[0].matches[0];
      console.log('\n  Match 1:');
      console.log('    Match ID:', match.id);
      console.log('    Team A:', match.teamA?.name);
      console.log('    Team B:', match.teamB?.name);
      console.log('    Games in response:', match.games.length);

      if (match.games[0]) {
        const game = match.games[0];
        console.log('\n    First Game:');
        console.log('      ID:', game.id);
        console.log('      Slot:', game.slot);
        console.log('      Score:', game.teamAScore, '-', game.teamBScore);
        console.log('      Started:', game.startedAt ? 'Yes' : 'No');
        console.log('      Complete:', game.isComplete);
        console.log('      Lineup A:', game.teamALineup ? 'Present' : 'Missing');
        console.log('      Lineup B:', game.teamBLineup ? 'Present' : 'Missing');
        console.log('\n      Full game object:');
        console.log(JSON.stringify(game, null, 2));
      }
    }
  }

  // Now test the games extraction logic from EventManagerTab
  console.log('\n\nTesting Game Extraction Logic:');
  console.log('================================');
  const gamesMap: Record<string, any[]> = {};
  rounds.forEach((round: any) => {
    round.matches?.forEach((match: any) => {
      if (match.games && match.games.length > 0) {
        gamesMap[match.id] = match.games;
        console.log(`Match ${match.id}: ${match.games.length} games`);
      }
    });
  });

  console.log('\nTotal matches with games:', Object.keys(gamesMap).length);
  console.log('Sample gamesMap entry:');
  const firstMatchId = Object.keys(gamesMap)[0];
  console.log(`  Match ID: ${firstMatchId}`);
  console.log(`  Games: ${gamesMap[firstMatchId].length}`);
  console.log(`  First game slot: ${gamesMap[firstMatchId][0].slot}`);
  console.log(`  First game score: ${gamesMap[firstMatchId][0].teamAScore}-${gamesMap[firstMatchId][0].teamBScore}`);

  await prisma.$disconnect();
}

testScheduleAPI().catch(console.error);
