import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function investigatePlayer() {
  try {
    console.log('Investigating player: paula.rby@gmail.com\n');

    // Find the player
    const player = await prisma.player.findFirst({
      where: {
        email: 'paula.rby@gmail.com'
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      }
    });

    if (!player) {
      console.log('❌ Player not found');
      return;
    }

    console.log('✓ Player found:', player);
    console.log();

    // Find the tournament
    const tournament = await prisma.tournament.findFirst({
      where: {
        name: {
          contains: 'Klyng Cup',
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        name: true,
        stops: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    if (!tournament) {
      console.log('❌ Tournament not found');
      return;
    }

    console.log('✓ Tournament found:', tournament.name);
    console.log('  Tournament ID:', tournament.id);
    console.log('  Stops:', tournament.stops.map(s => `${s.name} (${s.id})`).join(', '));
    console.log();

    // Find all registrations for this player in this tournament
    const registrations = await prisma.tournamentRegistration.findMany({
      where: {
        playerId: player.id,
        tournamentId: tournament.id,
      },
      include: {
        tournament: {
          select: {
            name: true,
          }
        },
        player: {
          select: {
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    console.log(`✓ Found ${registrations.length} tournament registration(s):`);
    registrations.forEach((reg, idx) => {
      console.log(`\n  Registration ${idx + 1}:`);
      console.log(`    ID: ${reg.id}`);
      console.log(`    Status: ${reg.status}`);
      console.log(`    Payment Status: ${reg.paymentStatus}`);
      console.log(`    Amount Paid: ${reg.amountPaid ? `$${(reg.amountPaid / 100).toFixed(2)}` : 'N/A'}`);
      console.log(`    Registered At: ${reg.registeredAt}`);
    });

    // Find StopTeamPlayer records for this player in this tournament
    const stopTeamPlayers = await prisma.stopTeamPlayer.findMany({
      where: {
        playerId: player.id,
        stop: {
          tournamentId: tournament.id,
        }
      },
      include: {
        stop: {
          select: {
            id: true,
            name: true,
          }
        },
        team: {
          select: {
            id: true,
            name: true,
            captainId: true,
          }
        }
      }
    });

    console.log(`\n✓ Found ${stopTeamPlayers.length} StopTeamPlayer record(s):`);
    stopTeamPlayers.forEach((stp, idx) => {
      console.log(`\n  StopTeamPlayer ${idx + 1}:`);
      console.log(`    Stop: ${stp.stop.name} (${stp.stopId})`);
      console.log(`    Team: ${stp.team.name} (${stp.teamId})`);
      console.log(`    Payment Method: ${stp.paymentMethod}`);
      console.log(`    Created At: ${stp.createdAt}`);
    });

    console.log('\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

investigatePlayer();
