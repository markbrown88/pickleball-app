import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Debugging Lineup Selection Issue ===\n');
  console.log('Tournament: Klyng, Stop 2, Round 2, Blue Zone vs Four Fathers\n');

  // Find the tournament
  const tournament = await prisma.tournament.findFirst({
    where: { 
      name: { contains: 'Klyng' },
      NOT: { name: { contains: 'pickleplex' } }
    }
  });

  if (!tournament) {
    console.log('❌ Tournament not found');
    return;
  }

  console.log(`✅ Tournament: ${tournament.name} (${tournament.id})\n`);

  // Find Stop 2
  const stops = await prisma.stop.findMany({
    where: { tournamentId: tournament.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true }
  });

  if (stops.length < 2) {
    console.log('❌ Stop 2 not found');
    return;
  }

  const stop2 = stops[1];
  console.log(`✅ Stop 2: ${stop2.name} (${stop2.id})\n`);

  // Find Round 2
  const rounds = await prisma.round.findMany({
    where: { stopId: stop2.id },
    orderBy: { idx: 'asc' },
    select: { id: true, idx: true }
  });

  if (rounds.length < 2) {
    console.log('❌ Round 2 not found');
    return;
  }

  const round2 = rounds[1]; // Second round (index 1)
  console.log(`✅ Round 2: Round ${round2.idx + 1} (${round2.id})\n`);

  // Find the specific match: Blue Zone vs Four Fathers
  const matches = await prisma.match.findMany({
    where: { roundId: round2.id },
    include: {
      teamA: { select: { id: true, name: true } },
      teamB: { select: { id: true, name: true } }
    }
  });

  console.log('Matches in Round 2:');
  matches.forEach((match, index) => {
    console.log(`  ${index + 1}. ${match.teamA?.name || 'Unknown'} vs ${match.teamB?.name || 'Unknown'} (${match.id})`);
  });

  const targetMatch = matches.find(match => 
    (match.teamA?.name?.includes('Blue Zone') && match.teamB?.name?.includes('Four Fathers')) ||
    (match.teamA?.name?.includes('Four Fathers') && match.teamB?.name?.includes('Blue Zone'))
  );

  if (!targetMatch) {
    console.log('❌ Match "Blue Zone vs Four Fathers" not found');
    console.log('\nAvailable team names:');
    matches.forEach(match => {
      console.log(`  Team A: ${match.teamA?.name || 'Unknown'}`);
      console.log(`  Team B: ${match.teamB?.name || 'Unknown'}`);
    });
    return;
  }

  console.log(`\n✅ Target match found: ${targetMatch.teamA?.name} vs ${targetMatch.teamB?.name} (${targetMatch.id})\n`);

  // Check if this is a BYE match
  if (targetMatch.isBye) {
    console.log('❌ This is a BYE match - no lineup selection needed');
    return;
  }

  // Get team details
  const teamA = await prisma.team.findUnique({
    where: { id: targetMatch.teamAId! },
    include: {
      club: { select: { name: true } },
      bracket: { select: { name: true } }
    }
  });

  const teamB = await prisma.team.findUnique({
    where: { id: targetMatch.teamBId! },
    include: {
      club: { select: { name: true } },
      bracket: { select: { name: true } }
    }
  });

  console.log('Team Details:');
  console.log(`  Team A: ${teamA?.name} (${teamA?.club?.name}) - Bracket: ${teamA?.bracket?.name}`);
  console.log(`  Team B: ${teamB?.name} (${teamB?.club?.name}) - Bracket: ${teamB?.bracket?.name}\n`);

  // Check for stop team players (roster)
  console.log('=== Checking Team Rosters ===');
  
  const stopTeamPlayersA = await prisma.stopTeamPlayer.findMany({
    where: {
      stopId: stop2.id,
      teamId: targetMatch.teamAId!
    },
    include: {
      player: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          gender: true
        }
      }
    }
  });

  const stopTeamPlayersB = await prisma.stopTeamPlayer.findMany({
    where: {
      stopId: stop2.id,
      teamId: targetMatch.teamBId!
    },
    include: {
      player: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          gender: true
        }
      }
    }
  });

  console.log(`Team A (${targetMatch.teamA?.name}) roster: ${stopTeamPlayersA.length} players`);
  stopTeamPlayersA.forEach((stp, index) => {
    const playerName = stp.player.name || `${stp.player.firstName || ''} ${stp.player.lastName || ''}`.trim();
    console.log(`  ${index + 1}. ${playerName} (${stp.player.gender}) - ID: ${stp.player.id}`);
  });

  console.log(`\nTeam B (${targetMatch.teamB?.name}) roster: ${stopTeamPlayersB.length} players`);
  stopTeamPlayersB.forEach((stp, index) => {
    const playerName = stp.player.name || `${stp.player.firstName || ''} ${stp.player.lastName || ''}`.trim();
    console.log(`  ${index + 1}. ${playerName} (${stp.player.gender}) - ID: ${stp.player.id}`);
  });

  // Check if there are any existing lineups
  console.log('\n=== Checking Existing Lineups ===');
  
  const existingLineups = await prisma.lineup.findMany({
    where: {
      roundId: round2.id,
      teamId: { in: [targetMatch.teamAId!, targetMatch.teamBId!] }
    },
    include: {
      entries: {
        include: {
          player1: { select: { id: true, name: true, firstName: true, lastName: true } },
          player2: { select: { id: true, name: true, firstName: true, lastName: true } }
        }
      }
    }
  });

  console.log(`Existing lineups: ${existingLineups.length}`);
  existingLineups.forEach((lineup, index) => {
    const teamName = lineup.teamId === targetMatch.teamAId ? targetMatch.teamA?.name : targetMatch.teamB?.name;
    console.log(`  ${index + 1}. ${teamName} lineup (${lineup.entries.length} entries):`);
    lineup.entries.forEach(entry => {
      const player1Name = entry.player1.name || `${entry.player1.firstName || ''} ${entry.player1.lastName || ''}`.trim();
      const player2Name = entry.player2.name || `${entry.player2.firstName || ''} ${entry.player2.lastName || ''}`.trim();
      console.log(`     ${entry.slot}: ${player1Name} & ${player2Name}`);
    });
  });

  // Check games for this match
  console.log('\n=== Checking Games ===');
  
  const games = await prisma.game.findMany({
    where: { matchId: targetMatch.id },
    select: {
      id: true,
      slot: true,
      teamAScore: true,
      teamBScore: true,
      isComplete: true,
      teamALineup: true,
      teamBLineup: true,
      lineupConfirmed: true
    },
    orderBy: { slot: 'asc' }
  });

  console.log(`Games for this match: ${games.length}`);
  games.forEach((game, index) => {
    console.log(`  ${index + 1}. ${game.slot}:`);
    console.log(`     Team A Score: ${game.teamAScore}, Team B Score: ${game.teamBScore}`);
    console.log(`     Complete: ${game.isComplete}, Lineup Confirmed: ${game.lineupConfirmed}`);
    console.log(`     Team A Lineup: ${game.teamALineup ? JSON.stringify(game.teamALineup) : 'null'}`);
    console.log(`     Team B Lineup: ${game.teamBLineup ? JSON.stringify(game.teamBLineup) : 'null'}`);
  });

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Team A roster size: ${stopTeamPlayersA.length}`);
  console.log(`Team B roster size: ${stopTeamPlayersB.length}`);
  console.log(`Existing lineups: ${existingLineups.length}`);
  console.log(`Games: ${games.length}`);
  
  if (stopTeamPlayersA.length === 0) {
    console.log('❌ Team A has no players in the roster - this is the problem!');
  }
  if (stopTeamPlayersB.length === 0) {
    console.log('❌ Team B has no players in the roster - this is the problem!');
  }
  if (stopTeamPlayersA.length > 0 && stopTeamPlayersB.length > 0) {
    console.log('✅ Both teams have players in roster - lineup selection should work');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
