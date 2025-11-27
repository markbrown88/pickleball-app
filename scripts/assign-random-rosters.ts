/**
 * Randomly assign players to team rosters for testing
 *
 * Usage:
 *   npx tsx scripts/assign-random-rosters.ts "Tournament Name"
 *   npx tsx scripts/assign-random-rosters.ts "Tournament Name" --males=2 --females=2
 *   npx tsx scripts/assign-random-rosters.ts --tournamentId=clxxx --males=3 --females=3
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Config {
  tournamentName?: string;
  tournamentId?: string;
  malesPerTeam: number;
  femalesPerTeam: number;
  clearExisting: boolean;
}

function parseArgs(): Config {
  const args = process.argv.slice(2);

  const config: Config = {
    malesPerTeam: 2,
    femalesPerTeam: 2,
    clearExisting: true,
  };

  // First non-flag argument is tournament name
  const tournamentName = args.find(arg => !arg.startsWith('--'));
  if (tournamentName) {
    config.tournamentName = tournamentName;
  }

  // Parse flags
  args.forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');

      if (key === 'tournamentId') {
        config.tournamentId = value;
      } else if (key === 'males') {
        config.malesPerTeam = parseInt(value, 10);
      } else if (key === 'females') {
        config.femalesPerTeam = parseInt(value, 10);
      } else if (key === 'keep-existing') {
        config.clearExisting = false;
      }
    }
  });

  return config;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

async function main() {
  const config = parseArgs();

  console.log('🎾 Random Roster Assignment Script');
  console.log('================================\n');

  // Find tournament
  let tournament;
  if (config.tournamentId) {
    tournament = await prisma.tournament.findUnique({
      where: { id: config.tournamentId },
      include: { stops: true }
    });
    if (!tournament) {
      console.error(`❌ Tournament with ID "${config.tournamentId}" not found`);
      process.exit(1);
    }
  } else if (config.tournamentName) {
    tournament = await prisma.tournament.findFirst({
      where: { name: config.tournamentName },
      include: { stops: true }
    });
    if (!tournament) {
      console.error(`❌ Tournament "${config.tournamentName}" not found`);
      process.exit(1);
    }
  } else {
    console.error('❌ Please provide tournament name or --tournamentId');
    console.log('\nUsage:');
    console.log('  npx tsx scripts/assign-random-rosters.ts "Tournament Name"');
    console.log('  npx tsx scripts/assign-random-rosters.ts --tournamentId=clxxx');
    process.exit(1);
  }

  console.log(`📋 Tournament: ${tournament.name}`);
  console.log(`🎯 Target: ${config.malesPerTeam} males + ${config.femalesPerTeam} females per team\n`);

  // Get all stops
  const stops = tournament.stops;
  if (stops.length === 0) {
    console.error('❌ No stops found in this tournament');
    process.exit(1);
  }

  console.log(`📍 Found ${stops.length} stop(s)\n`);

  // Get all teams in the tournament
  const teams = await prisma.team.findMany({
    where: { tournamentId: tournament.id },
    include: { club: true }
  });

  if (teams.length === 0) {
    console.error('❌ No teams found in this tournament');
    process.exit(1);
  }

  console.log(`👥 Found ${teams.length} team(s)\n`);

  // Get all available players by gender
  const malePlayers = await prisma.player.findMany({
    where: { gender: 'MALE' },
    select: { id: true, name: true, gender: true }
  });

  const femalePlayers = await prisma.player.findMany({
    where: { gender: 'FEMALE' },
    select: { id: true, name: true, gender: true }
  });

  console.log(`🚹 Available male players: ${malePlayers.length}`);
  console.log(`🚺 Available female players: ${femalePlayers.length}\n`);

  // Validate we have enough players
  const totalMalesNeeded = teams.length * config.malesPerTeam;
  const totalFemalesNeeded = teams.length * config.femalesPerTeam;

  if (malePlayers.length < totalMalesNeeded) {
    console.error(`❌ Not enough male players! Need ${totalMalesNeeded}, have ${malePlayers.length}`);
    process.exit(1);
  }

  if (femalePlayers.length < totalFemalesNeeded) {
    console.error(`❌ Not enough female players! Need ${totalFemalesNeeded}, have ${femalePlayers.length}`);
    process.exit(1);
  }

  // Shuffle players to randomize selection
  const shuffledMales = shuffleArray(malePlayers);
  const shuffledFemales = shuffleArray(femalePlayers);

  let maleIndex = 0;
  let femaleIndex = 0;
  let totalAssigned = 0;

  // Process each stop
  for (const stop of stops) {
    console.log(`\n📍 Processing Stop: ${stop.name || 'Default'}`);
    console.log('─'.repeat(60));

    // Clear existing rosters if requested
    if (config.clearExisting) {
      const deleted = await prisma.stopTeamPlayer.deleteMany({
        where: { stopId: stop.id }
      });
      console.log(`  🗑️  Cleared ${deleted.count} existing roster entries`);
    }

    // Assign players to each team
    for (const team of teams) {
      const roster: { playerId: string; stopId: string; teamId: string }[] = [];

      // Assign males
      for (let i = 0; i < config.malesPerTeam; i++) {
        if (maleIndex >= shuffledMales.length) {
          maleIndex = 0; // Wrap around if needed
        }
        roster.push({
          playerId: shuffledMales[maleIndex].id,
          stopId: stop.id,
          teamId: team.id
        });
        maleIndex++;
      }

      // Assign females
      for (let i = 0; i < config.femalesPerTeam; i++) {
        if (femaleIndex >= shuffledFemales.length) {
          femaleIndex = 0; // Wrap around if needed
        }
        roster.push({
          playerId: shuffledFemales[femaleIndex].id,
          stopId: stop.id,
          teamId: team.id
        });
        femaleIndex++;
      }

      // Create roster entries
      await prisma.stopTeamPlayer.createMany({
        data: roster,
        skipDuplicates: true
      });

      totalAssigned += roster.length;
      const clubName = team.club?.name || 'Unknown';
      console.log(`  ✅ ${team.name} (${clubName}): ${config.malesPerTeam}M + ${config.femalesPerTeam}F`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n🎉 SUCCESS! Assigned ${totalAssigned} player slots across ${teams.length} teams`);
  console.log(`   ${config.malesPerTeam} males + ${config.femalesPerTeam} females per team\n`);
}

main()
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
