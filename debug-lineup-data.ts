import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugLineups() {
  try {
    // Get recent lineups with their entries
    const lineups = await prisma.lineup.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        entries: {
          include: {
            player1: { select: { id: true, name: true, gender: true } },
            player2: { select: { id: true, name: true, gender: true } }
          }
        },
        team: { select: { id: true, name: true } },
        round: { select: { id: true, idx: true } }
      }
    });

    console.log('Recent lineups:\n');
    lineups.forEach(lineup => {
      console.log(`Lineup ID: ${lineup.id}`);
      console.log(`  Team: ${lineup.team.name}`);
      console.log(`  Round: ${lineup.round.idx}`);
      console.log(`  Created: ${lineup.createdAt}`);
      console.log(`  Entries (${lineup.entries.length}):`);

      lineup.entries.forEach(entry => {
        console.log(`    Slot: ${entry.slot}`);
        console.log(`      Player1: ${entry.player1?.name} (${entry.player1?.gender})`);
        console.log(`      Player2: ${entry.player2?.name} (${entry.player2?.gender})`);
      });
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugLineups();
