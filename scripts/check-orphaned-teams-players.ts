import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TOURNAMENT_ID = 'cmi7gs5xf0000le04k8mie9oa'; // KLYNG CUP-GRAND FINALE

async function main() {
  console.log('\n=== Checking Orphaned Teams for Players ===\n');

  // Get orphaned teams (teams without bracketId)
  const orphanedTeams = await prisma.team.findMany({
    where: {
      tournamentId: TOURNAMENT_ID,
      bracketId: null
    },
    include: {
      club: true,
      playerLinks: {
        include: {
          player: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              name: true
            }
          }
        }
      },
      stopRosterLinks: {
        include: {
          player: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              name: true
            }
          },
          stop: {
            select: {
              name: true
            }
          }
        }
      }
    },
    orderBy: [
      { clubId: 'asc' },
      { name: 'asc' }
    ]
  });

  console.log(`Found ${orphanedTeams.length} orphaned teams\n`);

  let totalPlayersInOrphanedTeams = 0;
  let totalStopRosterEntries = 0;

  orphanedTeams.forEach((team, idx) => {
    console.log(`${idx + 1}. Team: "${team.name}" (${team.club?.name || 'No club'})`);
    console.log(`   Team ID: ${team.id}`);
    console.log(`   Players in TeamPlayer: ${team.playerLinks.length}`);
    console.log(`   Players in StopTeamPlayer: ${team.stopRosterLinks.length}`);

    if (team.playerLinks.length > 0) {
      console.log(`   ⚠️  WARNING: This team has players in TeamPlayer:`);
      team.playerLinks.forEach(link => {
        const player = link.player;
        const name = `${player.firstName || ''} ${player.lastName || ''}`.trim() || player.name || 'Unknown';
        console.log(`      - ${name} (ID: ${player.id})`);
      });
      totalPlayersInOrphanedTeams += team.playerLinks.length;
    }

    if (team.stopRosterLinks.length > 0) {
      console.log(`   ⚠️  WARNING: This team has players in StopTeamPlayer:`);
      team.stopRosterLinks.forEach(link => {
        const player = link.player;
        const name = `${player.firstName || ''} ${player.lastName || ''}`.trim() || player.name || 'Unknown';
        console.log(`      - ${name} (Stop: ${link.stop.name})`);
      });
      totalStopRosterEntries += team.stopRosterLinks.length;
    }

    if (team.playerLinks.length === 0 && team.stopRosterLinks.length === 0) {
      console.log(`   ✅ Safe to delete (no players)`);
    }

    console.log();
  });

  console.log('═══════════════════════════════════════');
  console.log('📊 SUMMARY:');
  console.log('═══════════════════════════════════════\n');
  console.log(`Total orphaned teams: ${orphanedTeams.length}`);
  console.log(`Teams with players in TeamPlayer: ${orphanedTeams.filter(t => t.playerLinks.length > 0).length}`);
  console.log(`Teams with players in StopTeamPlayer: ${orphanedTeams.filter(t => t.stopRosterLinks.length > 0).length}`);
  console.log(`Teams safe to delete: ${orphanedTeams.filter(t => t.playerLinks.length === 0 && t.stopRosterLinks.length === 0).length}`);
  console.log(`Total player entries in orphaned teams: ${totalPlayersInOrphanedTeams}`);
  console.log(`Total stop roster entries in orphaned teams: ${totalStopRosterEntries}`);

  if (totalPlayersInOrphanedTeams === 0 && totalStopRosterEntries === 0) {
    console.log('\n✅ All orphaned teams are empty and safe to delete!');
  } else {
    console.log('\n⚠️  WARNING: Some orphaned teams have players. Need to reassign before deleting.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
