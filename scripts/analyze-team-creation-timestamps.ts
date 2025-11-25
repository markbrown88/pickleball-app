import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TOURNAMENT_ID = 'cmi7gs5xf0000le04k8mie9oa'; // KLYNG CUP-GRAND FINALE

async function main() {
  console.log('\n=== Analyzing Team Creation Timestamps ===\n');

  // Get all teams with their creation timestamps
  const teams = await prisma.team.findMany({
    where: {
      tournamentId: TOURNAMENT_ID
    },
    include: {
      bracket: true,
      club: true
    },
    orderBy: [
      { createdAt: 'asc' }
    ]
  });

  console.log(`Total teams: ${teams.length}\n`);

  console.log('📅 ALL TEAMS IN CREATION ORDER:\n');

  teams.forEach((team, idx) => {
    const bracketInfo = team.bracketId
      ? `${team.bracket?.name || 'Unknown'} (${team.bracketId})`
      : '❌ NO BRACKET';
    const timeDiff = idx > 0
      ? `(+${((team.createdAt.getTime() - teams[0].createdAt.getTime()) / 1000).toFixed(1)}s)`
      : '';

    console.log(`${idx + 1}. ${team.club?.name || 'Unknown'} - ${team.name}`);
    console.log(`   Bracket: ${bracketInfo}`);
    console.log(`   Created: ${team.createdAt.toISOString()} ${timeDiff}`);
    console.log();
  });

  // Check club by club
  console.log('═══════════════════════════════════════');
  console.log('🏢 TEAMS BY CLUB:');
  console.log('═══════════════════════════════════════\n');

  const clubGroups = new Map<string, typeof teams>();
  teams.forEach(team => {
    const clubName = team.club?.name || 'Unknown';
    if (!clubGroups.has(clubName)) {
      clubGroups.set(clubName, []);
    }
    clubGroups.get(clubName)!.push(team);
  });

  clubGroups.forEach((clubTeams, clubName) => {
    const sorted = clubTeams.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    console.log(`${clubName} (${sorted.length} teams):`);
    sorted.forEach((team, idx) => {
      const timeDiff = idx > 0
        ? `(+${((team.createdAt.getTime() - sorted[0].createdAt.getTime()) / 1000).toFixed(1)}s)`
        : '';

      console.log(`  ${idx + 1}. ${team.name}`);
      console.log(`     Bracket: ${team.bracket?.name || '❌ NULL'}`);
      console.log(`     BracketId: ${team.bracketId || 'NULL'}`);
      console.log(`     Created: ${team.createdAt.toISOString()} ${timeDiff}`);
    });
    console.log();
  });

  // Check bracket history
  console.log('═══════════════════════════════════════');
  console.log('📊 CURRENT BRACKETS:');
  console.log('═══════════════════════════════════════\n');

  const brackets = await prisma.tournamentBracket.findMany({
    where: { tournamentId: TOURNAMENT_ID },
    orderBy: { idx: 'asc' }
  });

  brackets.forEach((bracket, idx) => {
    const teamsInBracket = teams.filter(t => t.bracketId === bracket.id);
    console.log(`${idx + 1}. ${bracket.name} (${bracket.id})`);
    console.log(`   Teams using this bracket: ${teamsInBracket.length}`);
  });

  console.log('\n💡 ANALYSIS:');
  console.log('═══════════════════════════════════════');

  const firstTeam = teams[0];
  const lastTeam = teams[teams.length - 1];
  const timeSpan = (lastTeam.createdAt.getTime() - firstTeam.createdAt.getTime()) / 1000;

  console.log(`First team created: ${firstTeam.createdAt.toISOString()}`);
  console.log(`Last team created: ${lastTeam.createdAt.toISOString()}`);
  console.log(`Time span: ${timeSpan.toFixed(1)} seconds`);
  console.log(`\nTeams with brackets: ${teams.filter(t => t.bracketId).length}`);
  console.log(`Teams without brackets: ${teams.filter(t => !t.bracketId).length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
