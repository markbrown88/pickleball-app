const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tournamentName = 'Klyng Cup';
  const stopName = 'Stop 3';
  const teamName = 'Blue Zone Intermediate';
  const playerName = { firstName: 'Daniel', lastName: 'Rasquin' };
  const roundIndexes = [5, 6]; // Corresponds to rounds 6 and 7

  console.log(`Investigating lineup status for ${playerName.firstName} ${playerName.lastName} on team "${teamName}" in "${stopName}" of "${tournamentName}" for rounds 6 and 7.`);

  // 1. Find the Tournament
  const tournament = await prisma.tournament.findFirst({
    where: { name: tournamentName },
    select: { id: true },
  });
  if (!tournament) {
    console.error(`Error: Tournament "${tournamentName}" not found.`);
    return;
  }

  // 2. Find the Team
  const team = await prisma.team.findFirst({
    where: { name: teamName, tournamentId: tournament.id },
    select: { id: true },
  });
  if (!team) {
    console.error(`Error: Team "${teamName}" not found.`);
    return;
  }

  // 3. Find the Player
  const player = await prisma.player.findFirst({
    where: { firstName: playerName.firstName, lastName: playerName.lastName },
    select: { id: true },
  });
  if (!player) {
    console.error(`Error: Player "${playerName.firstName} ${playerName.lastName}" not found.`);
    return;
  }
  
  // 4. Find the Stop
  const stop = await prisma.stop.findFirst({
      where: { name: stopName, tournamentId: tournament.id },
      select: { id: true },
  });
  if (!stop) {
      console.error(`Error: Stop "${stopName}" not found.`);
      return;
  }

  // 5. Find the specific rounds
  const rounds = await prisma.round.findMany({
    where: {
      stopId: stop.id,
      idx: { in: roundIndexes },
    },
    select: { id: true, idx: true },
  });

  if (rounds.length === 0) {
    console.error(`Error: Could not find rounds 6 or 7 (indexes ${roundIndexes.join(', ')}) for this stop.`);
    return;
  }
  
  const roundIds = rounds.map(r => r.id);

  // 6. Check for lineup entries for the player in these rounds for this team
  const lineupEntries = await prisma.lineupEntry.findMany({
    where: {
      lineup: {
        teamId: team.id,
        roundId: { in: roundIds },
      },
      OR: [
        { player1Id: player.id },
        { player2Id: player.id },
      ],
    },
    include: {
      lineup: {
        include: {
            round: {
                select: { idx: true }
            }
        }
      }
    }
  });

  if (lineupEntries.length > 0) {
    console.log(`\nConfirmed: ${playerName.firstName} ${playerName.lastName} is already in a lineup for the following game(s):`);
    lineupEntries.forEach(entry => {
      console.log(`- Round ${entry.lineup.round.idx + 1}, in the "${entry.slot}" game slot.`);
    });
    console.log('\nThis is why he is not appearing in the dropdown for other games in those rounds.');
  } else {
    console.log(`\nInvestigation complete: ${playerName.firstName} ${playerName.lastName} is NOT in any lineup for rounds 6 or 7 for this team.`);
    console.log('This suggests the issue may be with the frontend component or the API providing the player list.');
  }
}

main()
  .catch((e) => {
    console.error('An error occurred during the investigation:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
