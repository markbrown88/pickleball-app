import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const stopId = 'cmh7rtx46000jl804twvhjt1p';

  // Get stop info
  const stop = await prisma.stop.findUnique({
    where: { id: stopId },
    include: {
      tournament: {
        select: {
          id: true,
          name: true,
          type: true
        }
      }
    }
  });

  console.log('\n=== STOP INFO ===');
  console.log(`Stop: ${stop?.name}`);
  console.log(`Tournament: ${stop?.tournament.name}`);
  console.log(`Type: ${stop?.tournament.type}`);

  // Check if games have bracketIds
  const games = await prisma.game.findMany({
    where: {
      match: {
        round: { stopId }
      }
    },
    select: {
      id: true,
      bracketId: true,
      bracket: {
        select: {
          id: true,
          name: true
        }
      },
      match: {
        select: {
          id: true,
          teamA: {
            select: {
              id: true,
              name: true,
              clubId: true,
              bracketId: true
            }
          },
          teamB: {
            select: {
              id: true,
              name: true,
              clubId: true,
              bracketId: true
            }
          }
        }
      }
    },
    take: 10
  });

  console.log('\n=== SAMPLE GAMES ===');
  games.forEach(game => {
    console.log(`Game ${game.id}:`);
    console.log(`  bracketId: ${game.bracketId || 'NULL'}`);
    console.log(`  bracket: ${game.bracket?.name || 'NULL'}`);
    console.log(`  teamA: ${game.match.teamA?.name} (clubId: ${game.match.teamA?.clubId}, bracketId: ${game.match.teamA?.bracketId})`);
    console.log(`  teamB: ${game.match.teamB?.name} (clubId: ${game.match.teamB?.clubId}, bracketId: ${game.match.teamB?.bracketId})`);
  });

  // Check lineups
  const lineups = await prisma.lineup.findMany({
    where: { stopId },
    select: {
      id: true,
      bracketId: true,
      teamId: true,
      team: {
        select: {
          name: true,
          clubId: true,
          bracketId: true
        }
      }
    },
    take: 20
  });

  console.log('\n=== SAMPLE LINEUPS ===');
  lineups.forEach(lineup => {
    console.log(`Lineup ${lineup.id}:`);
    console.log(`  lineup.bracketId: ${lineup.bracketId || 'NULL'}`);
    console.log(`  team: ${lineup.team.name}`);
    console.log(`  team.bracketId: ${lineup.team.bracketId || 'NULL'}`);
    console.log(`  team.clubId: ${lineup.team.clubId || 'NULL'}`);
  });

  // Count lineups by bracketId
  const lineupCounts = await prisma.lineup.groupBy({
    by: ['bracketId'],
    where: { stopId },
    _count: true
  });

  console.log('\n=== LINEUP COUNTS BY BRACKETID ===');
  lineupCounts.forEach(count => {
    console.log(`bracketId ${count.bracketId || 'NULL'}: ${count._count} lineups`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
