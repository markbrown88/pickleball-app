import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Finding Real Pickleball vs Blue Zone Advanced Match ===\n');

  // Get all Round 7 matches in Stop 2
  const round7 = await prisma.round.findFirst({
    where: {
      stop: { name: 'Stop 2' },
      idx: 6 // Round 7 (0-based index)
    },
    include: {
      stop: { select: { id: true } },
      matches: {
        include: {
          teamA: { select: { id: true, name: true } },
          teamB: { select: { id: true, name: true } }
        }
      }
    }
  });

  if (!round7) {
    console.log('❌ Round 7 not found');
    return;
  }

  console.log('All Round 7 matches:');
  round7.matches.forEach(match => {
    console.log(`  ${match.teamA?.name} vs ${match.teamB?.name} - ID: ${match.id}`);
  });

  // Find the Real Pickleball vs Blue Zone match
  const realPickleballMatch = round7.matches.find(match => 
    (match.teamA?.name?.includes('Real Pickleball') && match.teamB?.name?.includes('Blue Zone')) ||
    (match.teamB?.name?.includes('Real Pickleball') && match.teamA?.name?.includes('Blue Zone'))
  );

  if (!realPickleballMatch) {
    console.log('❌ Real Pickleball vs Blue Zone match not found');
    return;
  }

  console.log(`\nFound match: ${realPickleballMatch.teamA?.name} vs ${realPickleballMatch.teamB?.name}`);
  console.log(`Match ID: ${realPickleballMatch.id}`);

  // Get all players from this match
  const stopTeamPlayers = await prisma.stopTeamPlayer.findMany({
    where: {
      stopId: round7.stop.id,
      teamId: { in: [realPickleballMatch.teamAId!, realPickleballMatch.teamBId!] }
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
  });

  console.log('\nAll players in this match:');
  stopTeamPlayers.forEach(stp => {
    const teamName = stp.teamId === realPickleballMatch.teamAId ? realPickleballMatch.teamA?.name : realPickleballMatch.teamB?.name;
    console.log(`  ${stp.player.name} (${stp.player.gender}) - ${teamName}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
