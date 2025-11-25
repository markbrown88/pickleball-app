import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== Checking Klyng Cup Grand Finale Tournament ===\n');

  // Find the tournament
  const tournament = await prisma.tournament.findFirst({
    where: {
      name: {
        contains: 'Klyng Cup Grand',
        mode: 'insensitive'
      }
    },
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

  console.log(`✅ Found tournament: ${tournament.name}`);
  console.log(`   ID: ${tournament.id}\n`);

  // Show brackets
  console.log('📊 BRACKETS:');
  if (tournament.brackets.length === 0) {
    console.log('   ⚠️  No brackets found!');
  } else {
    tournament.brackets.forEach((bracket, idx) => {
      console.log(`   ${idx + 1}. ${bracket.name} (ID: ${bracket.id}, idx: ${bracket.idx})`);
    });
  }
  console.log();

  // Show clubs
  console.log('🏢 CLUBS:');
  if (tournament.clubs.length === 0) {
    console.log('   ⚠️  No clubs linked!');
  } else {
    tournament.clubs.forEach((link, idx) => {
      console.log(`   ${idx + 1}. ${link.club.name} (ID: ${link.clubId})`);
    });
  }
  console.log();

  // Show stops
  console.log('📍 STOPS:');
  tournament.stops.forEach((stop, idx) => {
    console.log(`   ${idx + 1}. ${stop.name} (ID: ${stop.id})`);
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
      { bracket: { idx: 'asc' } }
    ]
  });

  console.log('👥 TEAMS:');
  if (teams.length === 0) {
    console.log('   ⚠️  No teams found!');
  } else {
    console.log(`   Total teams: ${teams.length}\n`);

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
      console.log(`   📁 ${clubName} (${clubId}):`);
      clubTeams.forEach(team => {
        const bracketInfo = team.bracket
          ? `${team.bracket.name} (${team.bracket.id})`
          : '❌ NO BRACKET';
        const bracketIdInfo = team.bracketId ? `bracketId: ${team.bracketId}` : '❌ bracketId: NULL';
        console.log(`      - Team: "${team.name}" | ID: ${team.id}`);
        console.log(`        Bracket: ${bracketInfo} | ${bracketIdInfo}`);
      });
      console.log();
    });
  }

  // Check for teams without brackets
  const teamsWithoutBrackets = teams.filter(t => !t.bracketId);
  if (teamsWithoutBrackets.length > 0) {
    console.log('⚠️  TEAMS WITHOUT BRACKETS:');
    teamsWithoutBrackets.forEach(team => {
      console.log(`   - ${team.name} (ID: ${team.id}, Club: ${team.club?.name || 'Unknown'})`);
    });
    console.log();
  }

  // Check for brackets with null/empty names
  const bracketsWithBadNames = tournament.brackets.filter(b => !b.name || b.name.trim() === '');
  if (bracketsWithBadNames.length > 0) {
    console.log('⚠️  BRACKETS WITH NULL/EMPTY NAMES:');
    bracketsWithBadNames.forEach(bracket => {
      console.log(`   - Bracket ID: ${bracket.id}, Name: "${bracket.name}"`);
      const teamsInBracket = teams.filter(t => t.bracketId === bracket.id);
      console.log(`     Teams using this bracket: ${teamsInBracket.length}`);
      teamsInBracket.forEach(t => {
        console.log(`       * ${t.name} (${t.club?.name || 'No club'})`);
      });
    });
    console.log();
  }

  console.log('\n=== Summary ===');
  console.log(`Brackets: ${tournament.brackets.length}`);
  console.log(`Teams: ${teams.length}`);
  console.log(`Teams without brackets: ${teamsWithoutBrackets.length}`);
  console.log(`Brackets with bad names: ${bracketsWithBadNames.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
