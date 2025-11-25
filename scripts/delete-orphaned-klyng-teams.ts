import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();

const TOURNAMENT_ID = 'cmi7gs5xf0000le04k8mie9oa'; // KLYNG CUP-GRAND FINALE

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    })
  );
}

async function main() {
  console.log('\n=== Delete Orphaned Teams from KLYNG CUP-GRAND FINALE ===\n');

  // Get orphaned teams (teams without bracketId)
  const orphanedTeams = await prisma.team.findMany({
    where: {
      tournamentId: TOURNAMENT_ID,
      bracketId: null
    },
    include: {
      club: true,
      playerLinks: true,
      stopRosterLinks: true
    },
    orderBy: [
      { clubId: 'asc' },
      { name: 'asc' }
    ]
  });

  if (orphanedTeams.length === 0) {
    console.log('✅ No orphaned teams found! Tournament is clean.');
    return;
  }

  console.log(`Found ${orphanedTeams.length} orphaned teams to delete:\n`);

  orphanedTeams.forEach((team, idx) => {
    console.log(`${idx + 1}. "${team.name}" (${team.club?.name || 'No club'})`);
    console.log(`   ID: ${team.id}`);
    console.log(`   Players: ${team.playerLinks.length} (TeamPlayer), ${team.stopRosterLinks.length} (StopTeamPlayer)`);
  });

  console.log('\n═══════════════════════════════════════\n');

  // Check if any have players (safety check)
  const teamsWithPlayers = orphanedTeams.filter(
    t => t.playerLinks.length > 0 || t.stopRosterLinks.length > 0
  );

  if (teamsWithPlayers.length > 0) {
    console.log('❌ ERROR: Cannot delete! Some teams have players:');
    teamsWithPlayers.forEach(team => {
      console.log(`   - ${team.name} (${team.club?.name})`);
      console.log(`     Players: ${team.playerLinks.length} (TeamPlayer), ${team.stopRosterLinks.length} (StopTeamPlayer)`);
    });
    console.log('\nPlease reassign or remove these players before deleting teams.');
    return;
  }

  console.log('All teams are empty and safe to delete.\n');

  const answer = await askQuestion('Are you sure you want to DELETE these teams? (yes/no): ');

  if (answer.toLowerCase() !== 'yes') {
    console.log('\n❌ Deletion cancelled.');
    return;
  }

  console.log('\n🗑️  Deleting teams...\n');

  let deletedCount = 0;

  for (const team of orphanedTeams) {
    try {
      // Delete the team
      // Note: StopTeam links will be automatically deleted due to CASCADE
      await prisma.team.delete({
        where: { id: team.id }
      });

      console.log(`✅ Deleted: ${team.name} (${team.club?.name})`);
      deletedCount++;
    } catch (error: any) {
      console.log(`❌ Failed to delete: ${team.name} (${team.club?.name})`);
      console.log(`   Error: ${error.message}`);
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log(`✅ Successfully deleted ${deletedCount} out of ${orphanedTeams.length} teams\n`);

  // Verify the cleanup
  const remainingOrphans = await prisma.team.count({
    where: {
      tournamentId: TOURNAMENT_ID,
      bracketId: null
    }
  });

  if (remainingOrphans === 0) {
    console.log('✅ Tournament is now clean! No orphaned teams remain.');
  } else {
    console.log(`⚠️  ${remainingOrphans} orphaned teams still remain.`);
  }

  // Show final team count
  const totalTeams = await prisma.team.count({
    where: { tournamentId: TOURNAMENT_ID }
  });

  console.log(`\nFinal team count: ${totalTeams} (should be 14: 7 clubs × 2 brackets)\n`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
