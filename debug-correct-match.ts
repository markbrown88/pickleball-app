import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Debugging Blue Zone Advanced vs 4 Fathers Advanced in Stop 2 ===\n');

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

  // Find Round 2 in Stop 2
  const rounds = await prisma.round.findMany({
    where: { stopId: stop2.id },
    orderBy: { idx: 'asc' },
    select: { id: true, idx: true }
  });

  if (rounds.length < 2) {
    console.log('❌ Round 2 not found');
    return;
  }

  const round2 = rounds[1];
  console.log(`✅ Round 2: Round ${round2.idx + 1} (${round2.id})\n`);

  // Find the specific match in Stop 2, Round 2
  const match = await prisma.match.findFirst({
    where: {
      roundId: round2.id,
      teamA: { name: { contains: 'Blue Zone Advanced' } },
      teamB: { name: { contains: '4 Fathers Advanced' } }
    },
    include: {
      teamA: { select: { id: true, name: true } },
      teamB: { select: { id: true, name: true } }
    }
  });

  if (!match) {
    console.log('❌ Match not found in Stop 2, Round 2');
    return;
  }

  console.log(`✅ Match found: ${match.teamA?.name} vs ${match.teamB?.name}`);
  console.log(`Match ID: ${match.id}\n`);

  // Check if this is a BYE match
  if (match.isBye) {
    console.log('❌ This is a BYE match - no lineup selection needed');
    return;
  }

  // Check for stop team players (roster)
  console.log('=== Checking Team Rosters ===');
  
  const stopTeamPlayersA = await prisma.stopTeamPlayer.findMany({
    where: {
      stopId: stop2.id,
      teamId: match.teamAId!
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
      teamId: match.teamBId!
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

  console.log(`Team A (${match.teamA?.name}) roster: ${stopTeamPlayersA.length} players`);
  stopTeamPlayersA.forEach((stp, index) => {
    const playerName = stp.player.name || `${stp.player.firstName || ''} ${stp.player.lastName || ''}`.trim();
    console.log(`  ${index + 1}. ${playerName} (${stp.player.gender}) - ID: ${stp.player.id}`);
  });

  console.log(`\nTeam B (${match.teamB?.name}) roster: ${stopTeamPlayersB.length} players`);
  stopTeamPlayersB.forEach((stp, index) => {
    const playerName = stp.player.name || `${stp.player.firstName || ''} ${stp.player.lastName || ''}`.trim();
    console.log(`  ${index + 1}. ${playerName} (${stp.player.gender}) - ID: ${stp.player.id}`);
  });

  // Check if teams are properly linked to stops
  console.log('\n=== Checking Stop Team Links ===');
  
  const stopTeamLinksA = await prisma.stopTeam.findMany({
    where: {
      stopId: stop2.id,
      teamId: match.teamAId!
    }
  });

  const stopTeamLinksB = await prisma.stopTeam.findMany({
    where: {
      stopId: stop2.id,
      teamId: match.teamBId!
    }
  });

  console.log(`Team A stop links: ${stopTeamLinksA.length}`);
  console.log(`Team B stop links: ${stopTeamLinksB.length}`);

  // Check games for this match
  console.log('\n=== Checking Games ===');
  
  const games = await prisma.game.findMany({
    where: { matchId: match.id },
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
  console.log(`Team A stop links: ${stopTeamLinksA.length}`);
  console.log(`Team B stop links: ${stopTeamLinksB.length}`);
  console.log(`Games: ${games.length}`);
  
  if (stopTeamPlayersA.length === 0) {
    console.log('❌ Team A has no players in the roster - this is the problem!');
  }
  if (stopTeamPlayersB.length === 0) {
    console.log('❌ Team B has no players in the roster - this is the problem!');
  }
  if (stopTeamLinksA.length === 0) {
    console.log('❌ Team A is not linked to this stop - this could be the problem!');
  }
  if (stopTeamLinksB.length === 0) {
    console.log('❌ Team B is not linked to this stop - this could be the problem!');
  }
  if (stopTeamPlayersA.length > 0 && stopTeamPlayersB.length > 0 && stopTeamLinksA.length > 0 && stopTeamLinksB.length > 0) {
    console.log('✅ Both teams have players and are properly linked - lineup selection should work');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
