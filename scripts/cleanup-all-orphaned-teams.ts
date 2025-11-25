import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();

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
  console.log('\n=== Cleanup Orphaned Teams Across All Tournaments ===\n');

  // Find all teams without bracketId (orphaned teams)
  const orphanedTeams = await prisma.team.findMany({
    where: {
      bracketId: null
    },
    include: {
      tournament: {
        select: {
          id: true,
          name: true
        }
      },
      club: {
        select: {
          id: true,
          name: true
        }
      },
      playerLinks: true,
      stopRosterLinks: true
    },
    orderBy: [
      { tournament: { name: 'asc' } },
      { clubId: 'asc' },
      { name: 'asc' }
    ]
  });

  if (orphanedTeams.length === 0) {
    console.log('✅ No orphaned teams found! All tournaments are clean.');
    return;
  }

  console.log(`Found ${orphanedTeams.length} orphaned teams:\n`);

  // Group by tournament
  const byTournament = new Map<string, typeof orphanedTeams>();
  orphanedTeams.forEach(team => {
    const tournamentId = team.tournamentId;
    if (!byTournament.has(tournamentId)) {
      byTournament.set(tournamentId, []);
    }
    byTournament.get(tournamentId)!.push(team);
  });

  byTournament.forEach((teams, tournamentId) => {
    const tournamentName = teams[0]?.tournament?.name || 'Unknown';
    console.log(`📋 ${tournamentName} (${teams.length} orphaned teams):`);

    teams.forEach(team => {
      console.log(`   • ${team.name} (${team.club?.name || 'No club'})`);
      console.log(`     Team ID: ${team.id}`);
      console.log(`     Players: ${team.playerLinks.length} (TeamPlayer), ${team.stopRosterLinks.length} (StopTeamPlayer)`);
    });
    console.log();
  });

  console.log('═══════════════════════════════════════\n');

  // Check if any have players (safety check)
  const teamsWithPlayers = orphanedTeams.filter(
    t => t.playerLinks.length > 0 || t.stopRosterLinks.length > 0
  );

  if (teamsWithPlayers.length > 0) {
    console.log('⚠️  WARNING: Some orphaned teams have players assigned:\n');
    teamsWithPlayers.forEach(team => {
      console.log(`   📋 ${team.tournament?.name}`);
      console.log(`      • ${team.name} (${team.club?.name})`);
      console.log(`        Players: ${team.playerLinks.length} (TeamPlayer), ${team.stopRosterLinks.length} (StopTeamPlayer)`);
    });
    console.log('\n❌ Cannot delete teams with players! Please reassign these players first.\n');
    return;
  }

  console.log('✅ All orphaned teams are empty and safe to delete.\n');

  const answer = await askQuestion('Delete all orphaned teams? (yes/no): ');

  if (answer.toLowerCase() !== 'yes') {
    console.log('\n❌ Deletion cancelled.');
    return;
  }

  console.log('\n🗑️  Deleting orphaned teams...\n');

  let deletedCount = 0;
  const errors: Array<{ team: string; error: string }> = [];

  for (const team of orphanedTeams) {
    try {
      await prisma.team.delete({
        where: { id: team.id }
      });

      console.log(`✅ Deleted: ${team.name} (${team.club?.name} - ${team.tournament?.name})`);
      deletedCount++;
    } catch (error: any) {
      const msg = error.message || String(error);
      console.log(`❌ Failed: ${team.name} (${team.club?.name} - ${team.tournament?.name})`);
      console.log(`   Error: ${msg}`);
      errors.push({ team: team.name, error: msg });
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('📊 RESULTS:');
  console.log('═══════════════════════════════════════');
  console.log(`✅ Successfully deleted: ${deletedCount} teams`);
  console.log(`❌ Failed to delete: ${errors.length} teams`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(({ team, error }) => {
      console.log(`   • ${team}: ${error}`);
    });
  }

  // Verify cleanup
  const remainingOrphans = await prisma.team.count({
    where: { bracketId: null }
  });

  console.log(`\nRemaining orphaned teams: ${remainingOrphans}`);

  if (remainingOrphans === 0) {
    console.log('✅ All tournaments are now clean!\n');
  } else {
    console.log('⚠️  Some orphaned teams still remain. Please check the errors above.\n');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
