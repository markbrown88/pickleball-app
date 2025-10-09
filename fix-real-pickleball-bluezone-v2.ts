import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Fixing Round 7 Lineup ===\n');
  console.log('Real Pickleball Advanced vs Blue Zone Advanced\n');

  const matchId = 'cmgdy816j00e1r0k8ebbiar3d'; // Real Pickleball Advanced vs Blue Zone Advanced

  // Get the match details
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      teamA: { select: { id: true, name: true } },
      teamB: { select: { id: true, name: true } },
      round: {
        select: { stopId: true }
      }
    }
  });

  if (!match) {
    console.log('❌ Match not found');
    return;
  }

  // Get all players from both teams
  const stopTeamPlayers = await prisma.stopTeamPlayer.findMany({
    where: {
      stopId: match.round.stopId,
      teamId: { in: [match.teamAId!, match.teamBId!] }
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

  console.log('All players in this match:');
  stopTeamPlayers.forEach(stp => {
    const teamName = stp.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name;
    console.log(`  ${stp.player.name} (${stp.player.gender}) - ${teamName}`);
  });

  // Find the specific players
  const ryan = stopTeamPlayers.find(stp => 
    stp.player.name === 'Ryan Bilodeau' || 
    (stp.player.firstName === 'Ryan' && stp.player.lastName === 'Bilodeau')
  );
  const troy = stopTeamPlayers.find(stp => 
    stp.player.name === 'Troy Rieck' || 
    (stp.player.firstName === 'Troy' && stp.player.lastName === 'Rieck')
  );
  const leanna = stopTeamPlayers.find(stp => 
    stp.player.name === 'Leanna Macdonnell' || 
    (stp.player.firstName === 'Leanna' && stp.player.lastName === 'Macdonnell')
  );
  const jojo = stopTeamPlayers.find(stp => 
    stp.player.name === 'Jojo Phang' || 
    (stp.player.firstName === 'Jojo' && stp.player.lastName === 'Phang')
  );
  const jamie = stopTeamPlayers.find(stp => 
    stp.player.name === 'Jamie Carmichael' || 
    (stp.player.firstName === 'Jamie' && stp.player.lastName === 'Carmichael')
  );
  const tom = stopTeamPlayers.find(stp => 
    stp.player.name === 'Tom Svoboda' || 
    (stp.player.firstName === 'Tom' && stp.player.lastName === 'Svoboda')
  );
  const reese = stopTeamPlayers.find(stp => 
    stp.player.name === 'Reese George' || 
    (stp.player.firstName === 'Reese' && stp.player.lastName === 'George')
  );
  const steffi = stopTeamPlayers.find(stp => 
    stp.player.name === 'Steffi Ringleberg' || 
    (stp.player.firstName === 'Steffi' && stp.player.lastName === 'Ringleberg')
  );

  console.log('\nFound players:');
  console.log(`Ryan: ${ryan?.player.name} (${ryan?.player.gender}) - ${ryan?.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name}`);
  console.log(`Troy: ${troy?.player.name} (${troy?.player.gender}) - ${troy?.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name}`);
  console.log(`Leanna: ${leanna?.player.name} (${leanna?.player.gender}) - ${leanna?.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name}`);
  console.log(`Jojo: ${jojo?.player.name} (${jojo?.player.gender}) - ${jojo?.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name}`);
  console.log(`Jamie: ${jamie?.player.name} (${jamie?.player.gender}) - ${jamie?.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name}`);
  console.log(`Tom: ${tom?.player.name} (${tom?.player.gender}) - ${tom?.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name}`);
  console.log(`Reese: ${reese?.player.name} (${reese?.player.gender}) - ${reese?.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name}`);
  console.log(`Steffi: ${steffi?.player.name} (${steffi?.player.gender}) - ${steffi?.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name}`);

  if (!ryan || !troy || !leanna || !jojo || !jamie || !tom || !reese || !steffi) {
    console.log('❌ Missing some players');
    return;
  }

  // Get all games for this match
  const games = await prisma.game.findMany({
    where: { matchId },
    select: {
      id: true,
      slot: true,
      teamALineup: true,
      teamBLineup: true,
      lineupConfirmed: true
    },
    orderBy: { slot: 'asc' }
  });

  console.log('\nSetting lineups according to specifications:');
  console.log('MENS_DOUBLES: Ryan & Troy vs Jamie & Tom');
  console.log('WOMENS_DOUBLES: Leanne & Jojo vs Reese & Steffi');
  console.log('MIXED_1: Leanne & Troy vs Jamie & Reese');
  console.log('MIXED_2: Ryan & Jojo vs Tom & Steffi\n');

  // Set lineups for each game
  for (const game of games) {
    let teamALineup, teamBLineup;

    switch (game.slot) {
      case 'MENS_DOUBLES':
        // Ryan & Troy vs Jamie & Tom
        teamALineup = [{ player1Id: ryan.player.id, player2Id: troy.player.id }];
        teamBLineup = [{ player1Id: jamie.player.id, player2Id: tom.player.id }];
        break;
      case 'WOMENS_DOUBLES':
        // Leanne & Jojo vs Reese & Steffi
        teamALineup = [{ player1Id: leanna.player.id, player2Id: jojo.player.id }];
        teamBLineup = [{ player1Id: reese.player.id, player2Id: steffi.player.id }];
        break;
      case 'MIXED_1':
        // Leanne & Troy vs Jamie & Reese
        teamALineup = [{ player1Id: leanna.player.id, player2Id: troy.player.id }];
        teamBLineup = [{ player1Id: jamie.player.id, player2Id: reese.player.id }];
        break;
      case 'MIXED_2':
        // Ryan & Jojo vs Tom & Steffi
        teamALineup = [{ player1Id: ryan.player.id, player2Id: jojo.player.id }];
        teamBLineup = [{ player1Id: tom.player.id, player2Id: steffi.player.id }];
        break;
      case 'TIEBREAKER':
        // Skip tiebreaker
        continue;
      default:
        continue;
    }

    try {
      await prisma.game.update({
        where: { id: game.id },
        data: {
          teamALineup: teamALineup,
          teamBLineup: teamBLineup,
          lineupConfirmed: true
        }
      });

      console.log(`✅ ${game.slot}: Set lineup`);
    } catch (error) {
      console.error(`❌ ${game.slot}: Error setting lineup:`, error);
    }
  }

  console.log('\n✅ All lineups set successfully!');
  console.log('\nFinal lineups:');
  console.log('MENS_DOUBLES: Ryan Bilodeau & Troy Rieck vs Jamie Carmichael & Tom Svoboda');
  console.log('WOMENS_DOUBLES: Leanna Macdonnell & Jojo Phang vs Reese George & Steffi Ringleberg');
  console.log('MIXED_1: Leanna Macdonnell & Troy Rieck vs Jamie Carmichael & Reese George');
  console.log('MIXED_2: Ryan Bilodeau & Jojo Phang vs Tom Svoboda & Steffi Ringleberg');
}

main().catch(console.error).finally(() => prisma.$disconnect());
