import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TOURNAMENT_ID = 'cmi7gs5xf0000le04k8mie9oa'; // KLYNG CUP-GRAND FINALE

async function main() {
  console.log('\n=== KLYNG CUP-GRAND FINALE Diagnostic ===\n');

  const tournament = await prisma.tournament.findUnique({
    where: { id: TOURNAMENT_ID },
    include: {
      brackets: {
        orderBy: { idx: 'asc' }
      },
      clubs: {
        include: {
          club: true
        }
      },
      stops: {
        orderBy: { startAt: 'asc' }
      }
    }
  });

  if (!tournament) {
    console.log('❌ Tournament not found');
    return;
  }

  console.log(`✅ Tournament: ${tournament.name}`);
  console.log(`   Type: ${tournament.type}\n`);

  // Show brackets
  console.log('📊 BRACKETS:');
  tournament.brackets.forEach((bracket, idx) => {
    console.log(`   ${idx + 1}. Name: "${bracket.name}" | ID: ${bracket.id} | idx: ${bracket.idx}`);
  });
  console.log();

  // Show clubs
  console.log('🏢 CLUBS:');
  tournament.clubs.forEach((link, idx) => {
    console.log(`   ${idx + 1}. ${link.club.name} (ID: ${link.clubId})`);
  });
  console.log();

  // Get all teams for this tournament
  const teams = await prisma.team.findMany({
    where: {
      tournamentId: tournament.id
    },
    include: {
      bracket: true,
      club: true
    },
    orderBy: [
      { clubId: 'asc' },
      { bracket: { idx: 'asc' } },
      { name: 'asc' }
    ]
  });

  console.log('👥 TEAMS:');
  console.log(`   Total teams: ${teams.length}\n`);

  // Group teams by club
  const clubGroups = new Map<string, typeof teams>();
  teams.forEach(team => {
    const clubId = team.clubId || 'NO_CLUB';
    if (!clubGroups.has(clubId)) {
      clubGroups.set(clubId, []);
    }
    clubGroups.get(clubId)!.push(team);
  });

  clubGroups.forEach((clubTeams, clubId) => {
    const clubName = clubTeams[0]?.club?.name || 'Unknown Club';
    console.log(`   📁 ${clubName}:`);
    clubTeams.forEach(team => {
      const bracketName = team.bracket?.name || '❌ NULL';
      const bracketIdStatus = team.bracketId ? `✅ ${team.bracketId}` : '❌ NULL';
      console.log(`      • "${team.name}"`);
      console.log(`        Team ID: ${team.id}`);
      console.log(`        Bracket Name: ${bracketName}`);
      console.log(`        Bracket ID: ${bracketIdStatus}`);
    });
    console.log();
  });

  // Analysis
  console.log('═══════════════════════════════════════');
  console.log('📋 ANALYSIS:');
  console.log('═══════════════════════════════════════\n');

  const teamsWithoutBracketId = teams.filter(t => !t.bracketId);
  const teamsWithNullBracketName = teams.filter(t => t.bracket && (!t.bracket.name || t.bracket.name.trim() === ''));
  const teamsWithBracketButNoName = teams.filter(t => t.bracketId && (!t.bracket || !t.bracket.name || t.bracket.name.trim() === ''));

  console.log(`Total Brackets: ${tournament.brackets.length}`);
  console.log(`Total Teams: ${teams.length}`);
  console.log(`Total Clubs: ${tournament.clubs.length}\n`);

  if (teamsWithoutBracketId.length > 0) {
    console.log(`⚠️  Teams WITHOUT bracketId: ${teamsWithoutBracketId.length}`);
    teamsWithoutBracketId.forEach(team => {
      console.log(`   - ${team.name} (Club: ${team.club?.name || 'Unknown'})`);
    });
    console.log();
  }

  if (teamsWithNullBracketName.length > 0) {
    console.log(`⚠️  Brackets with NULL/empty names: ${teamsWithNullBracketName.length}`);
    teamsWithNullBracketName.forEach(team => {
      console.log(`   - Team: ${team.name}, Bracket ID: ${team.bracketId}`);
    });
    console.log();
  }

  if (teamsWithBracketButNoName.length > 0) {
    console.log(`⚠️  Teams with bracketId but no bracket name: ${teamsWithBracketButNoName.length}`);
    teamsWithBracketButNoName.forEach(team => {
      console.log(`   - ${team.name} (Bracket ID: ${team.bracketId}, Club: ${team.club?.name || 'Unknown'})`);
    });
    console.log();
  }

  // Check what the rosters would show
  console.log('═══════════════════════════════════════');
  console.log('🔍 WHAT YOU SEE IN ROSTERS PAGE:');
  console.log('═══════════════════════════════════════\n');

  clubGroups.forEach((clubTeams, clubId) => {
    const clubName = clubTeams[0]?.club?.name || 'Unknown Club';
    console.log(`   ${clubName}:`);
    clubTeams.forEach(team => {
      const displayName = team.bracket?.name ?? 'roster'; // This is what shows in the UI
      console.log(`      → "${displayName}" (Team: ${team.name})`);
    });
    console.log();
  });

  console.log('\n💡 EXPLANATION:');
  console.log('When bracket.name is null, the roster page displays "roster" as the default name.');
  console.log('This is why you see extra entries labeled "roster" instead of bracket names.\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
