import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TOURNAMENT_ID = 'cmi7gs5xf0000le04k8mie9oa'; // KLYNG CUP-GRAND FINALE

async function main() {
  console.log('\n=== Fixing Missing Roster Entries for KLYNG CUP-GRAND FINALE ===\n');

  // Get all COMPLETED registrations
  const registrations = await prisma.tournamentRegistration.findMany({
    where: {
      tournamentId: TOURNAMENT_ID,
      paymentStatus: 'COMPLETED'
    },
    include: {
      player: true
    }
  });

  console.log(`Found ${registrations.length} completed registrations\n`);

  if (registrations.length === 0) {
    console.log('No completed registrations to process.');
    return;
  }

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const reg of registrations) {
    const playerName = `${reg.player.firstName || ''} ${reg.player.lastName || ''}`.trim()
      || reg.player.name
      || 'Unknown';

    console.log(`Processing: ${playerName}`);

    try {
      // Parse registration notes
      if (!reg.notes) {
        console.log(`  ⚠️  Skipped: No notes found`);
        skipped++;
        continue;
      }

      const notes = JSON.parse(reg.notes);
      const { stopIds, clubId, brackets } = notes;

      if (!stopIds || !Array.isArray(stopIds) || stopIds.length === 0) {
        console.log(`  ⚠️  Skipped: No stop IDs found`);
        skipped++;
        continue;
      }

      if (!clubId) {
        console.log(`  ⚠️  Skipped: No club ID found`);
        skipped++;
        continue;
      }

      if (!brackets || !Array.isArray(brackets) || brackets.length === 0) {
        console.log(`  ⚠️  Skipped: No brackets found`);
        skipped++;
        continue;
      }

      // Process each stop
      for (const stopId of stopIds) {
        // Find the bracket selection for this stop
        const bracketSelection = brackets.find((b: any) => b.stopId === stopId);

        if (!bracketSelection || !bracketSelection.bracketId) {
          console.log(`  ⚠️  Skipped stop ${stopId}: No bracket selection`);
          continue;
        }

        const bracketId = bracketSelection.bracketId;

        // Find the team for this club + bracket
        const team = await prisma.team.findFirst({
          where: {
            tournamentId: TOURNAMENT_ID,
            clubId: clubId,
            bracketId: bracketId
          },
          include: {
            bracket: true,
            club: true
          }
        });

        if (!team) {
          console.log(`  ❌ Error: No team found for club ${clubId} and bracket ${bracketId}`);
          errors++;
          continue;
        }

        // Check if roster entry already exists
        const existing = await prisma.stopTeamPlayer.findUnique({
          where: {
            stopId_teamId_playerId: {
              stopId: stopId,
              teamId: team.id,
              playerId: reg.playerId
            }
          }
        });

        if (existing) {
          console.log(`  ✓ Already exists: ${team.club?.name} ${team.bracket?.name} (Stop: ${stopId})`);
          continue;
        }

        // Create roster entry
        await prisma.stopTeamPlayer.create({
          data: {
            stopId: stopId,
            teamId: team.id,
            playerId: reg.playerId,
            paymentMethod: 'STRIPE' // They paid via Stripe
          }
        });

        console.log(`  ✅ Created: ${team.club?.name} ${team.bracket?.name} (Stop: ${stopId})`);
        created++;
      }
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
      errors++;
    }

    console.log();
  }

  console.log('═══════════════════════════════════════');
  console.log('📊 SUMMARY:');
  console.log('═══════════════════════════════════════');
  console.log(`Roster entries created: ${created}`);
  console.log(`Registrations skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log();

  // Verify
  const stops = await prisma.stop.findMany({
    where: { tournamentId: TOURNAMENT_ID },
    select: { id: true }
  });

  const totalRosterEntries = await prisma.stopTeamPlayer.count({
    where: {
      stopId: { in: stops.map(s => s.id) }
    }
  });

  console.log(`✅ Total roster entries now: ${totalRosterEntries}\n`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
