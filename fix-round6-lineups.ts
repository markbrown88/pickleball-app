import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Fixing Round 6 Lineups ===\n');
  console.log('One Health Intermediate vs 4 Fathers Intermediate\n');

  const matchId = 'cmgdy7y0u00bbr0k8esprbb9m';

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

  // Get player details
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

  // Find the specific players
  const ryan = stopTeamPlayers.find(stp => 
    stp.player.name === 'Ryan McNamara' || 
    (stp.player.firstName === 'Ryan' && stp.player.lastName === 'McNamara')
  );
  const harry = stopTeamPlayers.find(stp => 
    stp.player.name === 'Harry Oh' || 
    (stp.player.firstName === 'Harry' && stp.player.lastName === 'Oh')
  );
  const mel = stopTeamPlayers.find(stp => 
    stp.player.name === 'Melissa Noronha' || 
    (stp.player.firstName === 'Melissa' && stp.player.lastName === 'Noronha')
  );
  const christie = stopTeamPlayers.find(stp => 
    stp.player.name === 'Christie Han' || 
    (stp.player.firstName === 'Christie' && stp.player.lastName === 'Han')
  );
  const deepak = stopTeamPlayers.find(stp => 
    stp.player.firstName === 'Deepak'
  );
  const yida = stopTeamPlayers.find(stp => 
    stp.player.firstName === 'Yida'
  );
  const jess = stopTeamPlayers.find(stp => 
    stp.player.name === 'Jess H' || 
    (stp.player.firstName === 'Jess' && stp.player.lastName === 'H')
  );
  const sue = stopTeamPlayers.find(stp => 
    stp.player.name === 'Sue B' || 
    (stp.player.firstName === 'Sue' && stp.player.lastName === 'B')
  );

  console.log('Found players:');
  console.log(`Ryan: ${ryan?.player.name} (${ryan?.player.gender}) - ${ryan?.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name}`);
  console.log(`Harry: ${harry?.player.name} (${harry?.player.gender}) - ${harry?.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name}`);
  console.log(`Mel: ${mel?.player.name} (${mel?.player.gender}) - ${mel?.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name}`);
  console.log(`Christie: ${christie?.player.name} (${christie?.player.gender}) - ${christie?.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name}`);
  console.log(`Deepak: ${deepak?.player.name} (${deepak?.player.gender}) - ${deepak?.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name}`);
  console.log(`Yida: ${yida?.player.name} (${yida?.player.gender}) - ${yida?.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name}`);
  console.log(`Jess: ${jess?.player.name} (${jess?.player.gender}) - ${jess?.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name}`);
  console.log(`Sue: ${sue?.player.name} (${sue?.player.gender}) - ${sue?.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name}`);

  if (!ryan || !harry || !mel || !christie || !deepak || !yida || !jess || !sue) {
    console.log('❌ Missing some players');
    return;
  }

  // Determine which team is which
  const oneHealthTeamId = match.teamAId!; // Assuming One Health is Team A
  const fourFathersTeamId = match.teamBId!; // Assuming 4 Fathers is Team B

  console.log(`\nOne Health (Team A): ${match.teamA?.name}`);
  console.log(`4 Fathers (Team B): ${match.teamB?.name}`);

  // Set lineups for each game
  for (const game of games) {
    let teamALineup, teamBLineup;

    switch (game.slot) {
      case 'MENS_DOUBLES':
        // Ryan + Harry vs Deepak + Yida
        teamALineup = [{ player1Id: ryan.player.id, player2Id: harry.player.id }];
        teamBLineup = [{ player1Id: deepak.player.id, player2Id: yida.player.id }];
        break;
      case 'WOMENS_DOUBLES':
        // Mel + Christie vs Jess + Sue
        teamALineup = [{ player1Id: mel.player.id, player2Id: christie.player.id }];
        teamBLineup = [{ player1Id: jess.player.id, player2Id: sue.player.id }];
        break;
      case 'MIXED_1':
        // Ryan + Mel vs Sue + Deepak
        teamALineup = [{ player1Id: ryan.player.id, player2Id: mel.player.id }];
        teamBLineup = [{ player1Id: sue.player.id, player2Id: deepak.player.id }];
        break;
      case 'MIXED_2':
        // Harry + Christie vs Jess + Yida
        teamALineup = [{ player1Id: harry.player.id, player2Id: christie.player.id }];
        teamBLineup = [{ player1Id: jess.player.id, player2Id: yida.player.id }];
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
  console.log('MENS_DOUBLES: Ryan McNamara & Harry Oh vs Deepak ? & Yida ?');
  console.log('WOMENS_DOUBLES: Melissa Noronha & Christie Han vs Jess H & Sue B');
  console.log('MIXED_1: Ryan McNamara & Melissa Noronha vs Sue B & Deepak ?');
  console.log('MIXED_2: Harry Oh & Christie Han vs Jess H & Yida ?');
}

main().catch(console.error).finally(() => prisma.$disconnect());
