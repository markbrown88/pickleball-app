import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const playerIdToDelete = 'cmh822aue004br0j4lrp6nuic';

async function deletePlayer() {
  try {
    console.log(`Deleting player ID: ${playerIdToDelete}\n`);

    // First, get player info for confirmation
    const player = await prisma.player.findUnique({
      where: { id: playerIdToDelete },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        name: true,
      },
    });

    if (!player) {
      console.log('Player not found.');
      return;
    }

    const playerName = [player.firstName, player.lastName].filter(Boolean).join(' ') || player.name || 'Unknown';
    console.log(`Player: ${playerName}`);
    console.log(`Email: ${player.email || 'N/A'}`);
    console.log(`ID: ${player.id}\n`);

    // Check for stop roster entry (will cascade delete)
    const stopRoster = await prisma.stopTeamPlayer.findMany({
      where: { playerId: playerIdToDelete },
      include: {
        stop: {
          select: {
            name: true,
            tournament: {
              select: {
                name: true,
              },
            },
          },
        },
        team: {
          select: {
            name: true,
          },
        },
      },
    });

    if (stopRoster.length > 0) {
      console.log('⚠️  This will also delete the following stop roster entry(ies):');
      stopRoster.forEach((entry) => {
        console.log(`  - ${entry.stop.tournament.name} / ${entry.stop.name} / ${entry.team.name}`);
      });
      console.log('');
    }

    // Delete the player (cascade will handle related records)
    console.log('Deleting player...');
    await prisma.player.delete({
      where: { id: playerIdToDelete },
    });

    console.log('✓ Player deleted successfully.');

    // Verify deletion
    const verify = await prisma.player.findUnique({
      where: { id: playerIdToDelete },
    });

    if (!verify) {
      console.log('✓ Deletion verified.');
    } else {
      console.log('⚠️  Warning: Player still exists after deletion attempt.');
    }

  } catch (error) {
    console.error('Error deleting player:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

deletePlayer();

