const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getAllMatchIds() {
  try {
    const tournament = await prisma.tournament.findFirst({
      where: { name: { contains: 'Bracket Test 4' } },
      include: {
        stops: {
          include: {
            rounds: {
              include: {
                matches: {
                  include: {
                    round: { select: { bracketType: true, idx: true } },
                    teamA: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!tournament || !tournament.stops[0]) {
      console.error('Tournament not found');
      return;
    }

    const rounds = tournament.stops[0].rounds.sort((a, b) => {
      const bracketOrder = { 'WINNER': 0, 'LOSER': 1, 'FINALS': 2 };
      const orderA = bracketOrder[a.bracketType] ?? 99;
      const orderB = bracketOrder[b.bracketType] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.idx - b.idx;
    });

    let matchNumber = 1;
    for (const round of rounds) {
      for (const match of round.matches) {
        if (matchNumber >= 11 && matchNumber <= 13) {
          console.log(`Match ${matchNumber}: ${match.id} (${match.round?.bracketType} Round ${match.round?.idx})`);
          console.log(`  teamAId: ${match.teamAId || 'null'}`);
          console.log(`  teamA name: ${match.teamA?.name || 'null'}`);
          console.log('');
        }
        matchNumber++;
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

getAllMatchIds();
