import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkEntries() {
  try {
    // Get a recent lineup with entries
    const lineup = await prisma.lineup.findFirst({
      where: {
        round: {
          stop: { name: 'Stop 1' }
        }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        team: { select: { name: true } },
        entries: true
      }
    });

    if (!lineup) {
      console.log('No lineup found for Stop 1');
      return;
    }

    console.log(`Lineup for team: ${lineup.team.name}`);
    console.log(`Entries (${lineup.entries.length}):\n`);

    for (const entry of lineup.entries) {
      console.log(`Slot: ${entry.slot}`);
      console.log(`  player1Id: ${entry.player1Id}`);
      console.log(`  player2Id: ${entry.player2Id}`);

      // Manually fetch the players
      const player1 = await prisma.player.findUnique({
        where: { id: entry.player1Id },
        select: { id: true, name: true, gender: true }
      });

      const player2 = await prisma.player.findUnique({
        where: { id: entry.player2Id },
        select: { id: true, name: true, gender: true }
      });

      console.log(`  player1: ${player1?.name} (${player1?.gender})`);
      console.log(`  player2: ${player2?.name} (${player2?.gender})`);
      console.log('');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkEntries();
