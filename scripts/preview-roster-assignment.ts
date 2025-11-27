/**
 * Preview what the roster assignment would do (read-only)
 *
 * Usage: npx tsx scripts/preview-roster-assignment.ts "Bracket Test 4"
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tournamentName = process.argv[2];

  if (!tournamentName) {
    console.error('❌ Please provide tournament name');
    console.log('\nUsage: npx tsx scripts/preview-roster-assignment.ts "Bracket Test 4"');
    process.exit(1);
  }

  console.log('🔍 PREVIEW MODE (Read-Only)\n');
  console.log('='.repeat(70));

  // Find tournament
  const tournament = await prisma.tournament.findFirst({
    where: { name: tournamentName },
    include: {
      stops: true,
      clubs: {
        include: { club: true }
      }
    }
  });

  if (!tournament) {
    console.error(`\n❌ Tournament "${tournamentName}" not found`);
    process.exit(1);
  }

  console.log(`\n✅ Found Tournament: ${tournament.name}`);
  console.log(`   ID: ${tournament.id}`);
  console.log(`   Type: ${tournament.type}`);
  console.log(`   Clubs: ${tournament.clubs.length}`);

  // Get all teams
  const teams = await prisma.team.findMany({
    where: { tournamentId: tournament.id },
    include: {
      club: true,
      bracket: true
    },
    orderBy: [
      { bracket: { name: 'asc' } },
      { name: 'asc' }
    ]
  });

  console.log(`\n📊 TEAMS IN TOURNAMENT: ${teams.length} total`);
  console.log('─'.repeat(70));

  if (teams.length === 0) {
    console.log('   No teams found!');
  } else {
    teams.forEach((team, idx) => {
      const clubName = team.club?.name || 'No Club';
      const bracketName = team.bracket?.name || 'No Bracket';
      console.log(`   ${idx + 1}. ${team.name}`);
      console.log(`      Club: ${clubName}`);
      console.log(`      Bracket: ${bracketName}`);
      console.log(`      Team ID: ${team.id}`);
      console.log('');
    });
  }

  // Get stops
  console.log(`\n📍 STOPS: ${tournament.stops.length} total`);
  console.log('─'.repeat(70));
  tournament.stops.forEach((stop, idx) => {
    console.log(`   ${idx + 1}. ${stop.name || 'Unnamed Stop'} (ID: ${stop.id})`);
  });

  // Get available players
  const malePlayers = await prisma.player.findMany({
    where: { gender: 'MALE' },
    select: { id: true, name: true }
  });

  const femalePlayers = await prisma.player.findMany({
    where: { gender: 'FEMALE' },
    select: { id: true, name: true }
  });

  console.log(`\n👥 AVAILABLE PLAYERS:`);
  console.log('─'.repeat(70));
  console.log(`   🚹 Males: ${malePlayers.length}`);
  console.log(`   🚺 Females: ${femalePlayers.length}`);

  // Calculate what would be needed
  const malesNeeded = teams.length * 2;
  const femalesNeeded = teams.length * 2;

  console.log(`\n📋 ROSTER REQUIREMENTS (2M + 2F per team):`);
  console.log('─'.repeat(70));
  console.log(`   Teams: ${teams.length}`);
  console.log(`   Males needed: ${malesNeeded} (available: ${malePlayers.length}) ${malePlayers.length >= malesNeeded ? '✅' : '❌ NOT ENOUGH'}`);
  console.log(`   Females needed: ${femalesNeeded} (available: ${femalePlayers.length}) ${femalePlayers.length >= femalesNeeded ? '✅' : '❌ NOT ENOUGH'}`);

  // Check existing rosters
  const existingRosters = await prisma.stopTeamPlayer.findMany({
    where: {
      stopId: { in: tournament.stops.map(s => s.id) },
      teamId: { in: teams.map(t => t.id) }
    },
    include: {
      player: { select: { name: true, gender: true } },
      team: { select: { name: true } },
      stop: { select: { name: true } }
    }
  });

  console.log(`\n📝 EXISTING ROSTERS:`);
  console.log('─'.repeat(70));
  if (existingRosters.length === 0) {
    console.log('   No existing roster entries found');
  } else {
    console.log(`   Total entries: ${existingRosters.length}`);

    // Group by team
    const byTeam = existingRosters.reduce((acc, entry) => {
      const teamName = entry.team.name;
      if (!acc[teamName]) acc[teamName] = [];
      acc[teamName].push(entry);
      return acc;
    }, {} as Record<string, typeof existingRosters>);

    Object.entries(byTeam).forEach(([teamName, entries]) => {
      const males = entries.filter(e => e.player.gender === 'MALE').length;
      const females = entries.filter(e => e.player.gender === 'FEMALE').length;
      console.log(`   ${teamName}: ${males}M + ${females}F`);
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n💡 WHAT WOULD HAPPEN IF YOU RUN THE ASSIGNMENT:');
  console.log('─'.repeat(70));
  console.log(`   1. Clear ${existingRosters.length} existing roster entries`);
  console.log(`   2. Randomly assign players to ${teams.length} teams`);
  console.log(`   3. Create ${teams.length * 4} new roster entries (4 per team)`);
  console.log(`   4. Each team gets: 2 random males + 2 random females`);
  console.log('\n✅ Ready to run: npx tsx scripts/assign-random-rosters.ts "Bracket Test 4"\n');
}

main()
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
