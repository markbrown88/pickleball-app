import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function investigate() {
  // Find the tournament
  const tournament = await prisma.tournament.findFirst({
    where: { name: { contains: 'Bracket Test 4' } },
    select: { id: true, name: true, type: true }
  });

  if (!tournament) {
    console.log('Tournament not found');
    return;
  }

  console.log('Tournament:', tournament);

  // Find the match
  const matches = await prisma.match.findMany({
    where: {
      round: {
        stop: {
          tournamentId: tournament.id
        }
      }
    },
    include: {
      teamA: {
        select: {
          id: true,
          name: true,
          bracketId: true,
          club: { select: { name: true } }
        }
      },
      teamB: {
        select: {
          id: true,
          name: true,
          bracketId: true,
          club: { select: { name: true } }
        }
      },
      round: {
        include: {
          stop: { select: { id: true, name: true } }
        }
      },
      games: {
        select: {
          id: true,
          slot: true,
          bracketId: true,
          bracket: { select: { name: true } }
        }
      }
    }
  });

  console.log(`\nFound ${matches.length} matches`);

  // Find Pickleplex Belleville vs Pickleplex Vaughan
  const targetMatch = matches.find(m =>
    m.teamA?.club?.name?.includes('Belleville') &&
    m.teamB?.club?.name?.includes('Vaughan')
  );

  if (!targetMatch) {
    console.log('Target match not found');
    return;
  }

  console.log('\nTarget Match:');
  console.log('  Match ID:', targetMatch.id);
  console.log('  Round ID:', targetMatch.roundId);
  console.log('  Stop ID:', targetMatch.round.stop.id);
  console.log('  Team A:', targetMatch.teamA?.name, '(bracketId:', targetMatch.teamA?.bracketId, ')');
  console.log('  Team B:', targetMatch.teamB?.name, '(bracketId:', targetMatch.teamB?.bracketId, ')');
  console.log('\nGames:');
  targetMatch.games.forEach(g => {
    console.log('  -', g.slot, '| bracketId:', g.bracketId, '| bracket:', g.bracket?.name);
  });

  // Get all lineups for this stop
  const lineups = await prisma.lineup.findMany({
    where: {
      stopId: targetMatch.round.stop.id
    },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          bracketId: true,
          club: { select: { name: true } }
        }
      },
      entries: {
        include: {
          player1: { select: { id: true, name: true } },
          player2: { select: { id: true, name: true } }
        }
      }
    }
  });

  console.log(`\n\nAll lineups for stop ${targetMatch.round.stop.id}:`);
  lineups.forEach(lineup => {
    console.log(`\nLineup ID: ${lineup.id}`);
    console.log(`  Team: ${lineup.team.name} (club: ${lineup.team.club?.name})`);
    console.log(`  Team ID: ${lineup.teamId}`);
    console.log(`  Team bracketId: ${lineup.team.bracketId}`);
    console.log(`  Lineup bracketId: ${lineup.bracketId}`);
    console.log(`  Round ID: ${lineup.roundId}`);
    console.log(`  Entries: ${lineup.entries.length}`);
    lineup.entries.forEach(e => {
      console.log(`    - ${e.slot}: ${e.player1?.name} & ${e.player2?.name}`);
    });
  });

  await prisma.$disconnect();
}

investigate().catch(console.error);
