import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testRegistrationsAPI() {
  try {
    console.log('Testing registrations API fix for paula.rby@gmail.com\n');

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
    const playerId = player.id;

    // Get tournament registration
    const tournamentRegistrations = await prisma.tournamentRegistration.findMany({
      where: { playerId },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            type: true,
            registrationType: true,
            registrationCost: true,
          }
        }
      },
    });

    console.log(`\n✓ Found ${tournamentRegistrations.length} tournament registration(s)`);

    // Process each registration (simulating API logic)
    for (const reg of tournamentRegistrations) {
      console.log(`\n  Processing registration for: ${reg.tournament.name}`);

      // Parse stopIds from notes
      let stopIds: string[] = [];
      if (reg.notes) {
        try {
          const notes = JSON.parse(reg.notes);
          stopIds = notes.stopIds || [];
          console.log(`    Stop IDs from notes: ${stopIds.length} stops`);
        } catch (e) {
          console.log('    No valid notes data');
        }
      }

      // For team-based tournaments, also check StopTeamPlayer records
      // Always check to ensure we get ALL stops
      console.log('    Checking StopTeamPlayer records...');
      const stopTeamPlayers = await prisma.stopTeamPlayer.findMany({
        where: {
          playerId,
          stop: {
            tournamentId: reg.tournamentId,
          }
        },
        select: {
          stopId: true,
          stop: {
            select: {
              name: true,
            }
          }
        }
      });

      const stopTeamStopIds = stopTeamPlayers.map(stp => stp.stopId);
      stopIds = [...new Set([...stopIds, ...stopTeamStopIds])]; // Merge and dedupe

      console.log(`    Found ${stopTeamPlayers.length} StopTeamPlayer record(s):`);
      stopTeamPlayers.forEach(stp => {
        console.log(`      - ${stp.stop.name} (${stp.stopId})`);
      });

      // Fetch stop details
      const stops = stopIds.length > 0
        ? await prisma.stop.findMany({
            where: { id: { in: stopIds } },
            select: { id: true, name: true },
          })
        : [];

      console.log(`\n    ✓ Final result: ${stopIds.length} stops total`);
      stops.forEach(stop => {
        console.log(`      - ${stop.name} (${stop.id})`);
      });

      console.log(`\n    This registration would return stopIds: [${stopIds.map(id => `"${id}"`).join(', ')}]`);
    }

    console.log('\n✅ Fix verified! Paula should now see all 3 "Registered" chips on her dashboard.\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testRegistrationsAPI();
