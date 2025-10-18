const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Finding the match and game to reset...');

  // 1. Find the Tournament
  const tournament = await prisma.tournament.findFirst({
    where: { name: 'Klyng Cup' },
  });
  if (!tournament) {
    console.error('Error: Klyng Cup tournament not found.');
    return;
  }
  console.log(`Found tournament: Klyng Cup (ID: ${tournament.id})`);

  // 2. Find the Teams
  const blueZoneTeam = await prisma.team.findFirst({
    where: {
      name: 'Blue Zone Advanced',
      tournamentId: tournament.id,
    },
  });
  const wildcardTeam = await prisma.team.findFirst({
    where: {
      name: 'Wildcard Advanced',
      tournamentId: tournament.id,
    },
  });

  if (!blueZoneTeam || !wildcardTeam) {
    console.error('Error: Could not find one or both teams: "Blue Zone Advanced" and "Wildcard Advanced".');
    return;
  }
  console.log(`Found Blue Zone team: ${blueZoneTeam.name} (ID: ${blueZoneTeam.id})`);
  console.log(`Found Wildcard team: ${wildcardTeam.name} (ID: ${wildcardTeam.id})`);

  // 3. Find the Stop
  const stop = await prisma.stop.findFirst({
    where: {
      name: 'Stop 3',
      tournamentId: tournament.id,
    },
  });
  if (!stop) {
    console.error('Error: Stop 3 not found for Klyng Cup.');
    return;
  }
  console.log(`Found stop: Stop 3 (ID: ${stop.id})`);

  // 4. Find the Match in the first round (idx: 0)
  const round = await prisma.round.findFirst({
    where: {
        stopId: stop.id,
        idx: 0, // First round
    }
  });

  if (!round) {
      console.error('Error: First round (idx 0) not found for Stop 3.');
      return;
  }
  console.log(`Found Round 0 (ID: ${round.id})`);

  const match = await prisma.match.findFirst({
    where: {
      roundId: round.id,
      OR: [
        { teamAId: blueZoneTeam.id, teamBId: wildcardTeam.id },
        { teamAId: wildcardTeam.id, teamBId: blueZoneTeam.id },
      ],
    },
  });

  if (!match) {
    console.error('Error: Match between Blue Zone Advanced and Wildcard Advanced not found in the first round of Stop 3.');
    return;
  }
  console.log(`Found match (ID: ${match.id})`);

  // 5. Find the Men's Doubles Game
  const mensDoublesGame = await prisma.game.findFirst({
    where: {
      matchId: match.id,
      slot: 'MENS_DOUBLES',
    },
  });

  if (!mensDoublesGame) {
    console.error("Error: Men's Doubles game not found for this match.");
    return;
  }
  console.log(`Found Men's Doubles game (ID: ${mensDoublesGame.id}) with status isComplete=${mensDoublesGame.isComplete} and startedAt=${mensDoublesGame.startedAt}`);


  // 6. Update the game status
  if (mensDoublesGame.startedAt !== null || mensDoublesGame.isComplete) {
    const updatedGame = await prisma.game.update({
        where: { id: mensDoublesGame.id },
        data: {
            startedAt: null,
            endedAt: null,
            isComplete: false,
            teamAScore: null,
            teamBScore: null,
            teamAScoreSubmitted: false,
            teamBScoreSubmitted: false,
            teamASubmittedScore: null,
            teamBSubmittedScore: null,
        },
    });
    console.log('Game status has been reset to not started.');
    console.log(`New status: isComplete=${updatedGame.isComplete}, startedAt=${updatedGame.startedAt}`);
  } else {
    console.log('Game was already in a "not started" state. No changes made.');
  }

}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
