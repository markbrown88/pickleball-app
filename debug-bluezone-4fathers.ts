import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Debugging Blue Zone Advanced vs 4 Fathers Advanced ===\n');
  console.log('Tournament: Klyng, Stop 2, Round 2\n');

  // Find the specific match
  const match = await prisma.match.findFirst({
    where: {
      teamA: { name: { contains: 'Blue Zone Advanced' } },
      teamB: { name: { contains: '4 Fathers Advanced' } },
      round: {
        stop: {
          tournament: {
            name: { contains: 'Klyng' },
            NOT: { name: { contains: 'pickleplex' } }
          }
        }
      }
    },
    include: {
      teamA: { select: { id: true, name: true } },
      teamB: { select: { id: true, name: true } },
      round: {
        include: {
          stop: { select: { name: true } }
        }
      }
    }
  });

  if (!match) {
    console.log('❌ Match not found');
    return;
  }

  console.log(`✅ Match found: ${match.teamA?.name} vs ${match.teamB?.name}`);
  console.log(`Stop: ${match.round.stop.name}`);
  console.log(`Match ID: ${match.id}\n`);

  // Check if this is a BYE match
  if (match.isBye) {
    console.log('❌ This is a BYE match - no lineup selection needed');
    return;
  }

  // Get team details
  const teamA = await prisma.team.findUnique({
    where: { id: match.teamAId! },
    include: {
      club: { select: { name: true } },
      bracket: { select: { name: true } }
    }
  });

  const teamB = await prisma.team.findUnique({
    where: { id: match.teamBId! },
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
      stopId: match.round.stopId,
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
      stopId: match.round.stopId,
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

  // Check if there are any existing lineups
  console.log('\n=== Checking Existing Lineups ===');
  
  const existingLineups = await prisma.lineup.findMany({
    where: {
      roundId: match.roundId,
      teamId: { in: [match.teamAId!, match.teamBId!] }
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
    const teamName = lineup.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name;
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

  // Check if teams are properly linked to stops
  console.log('\n=== Checking Stop Team Links ===');
  
  const stopTeamLinksA = await prisma.stopTeam.findMany({
    where: {
      stopId: match.round.stopId,
      teamId: match.teamAId!
    }
  });

  const stopTeamLinksB = await prisma.stopTeam.findMany({
    where: {
      stopId: match.round.stopId,
      teamId: match.teamBId!
    }
  });

  console.log(`Team A stop links: ${stopTeamLinksA.length}`);
  console.log(`Team B stop links: ${stopTeamLinksB.length}`);

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Team A roster size: ${stopTeamPlayersA.length}`);
  console.log(`Team B roster size: ${stopTeamPlayersB.length}`);
  console.log(`Team A stop links: ${stopTeamLinksA.length}`);
  console.log(`Team B stop links: ${stopTeamLinksB.length}`);
  console.log(`Existing lineups: ${existingLineups.length}`);
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
