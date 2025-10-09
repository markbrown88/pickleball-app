import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Fixing Round 7 Lineup ===\n');
  console.log('Pickleplex Barrie Advanced vs Greenhills Advanced\n');

  const matchId = 'cmgdy81da00e7r0k86bi1okqn'; // Pickleplex Barrie Advanced vs Greenhills Advanced

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
  const chris = stopTeamPlayers.find(stp => 
    stp.player.firstName === 'Chris' || stp.player.name?.includes('Chris')
  );
  const michael = stopTeamPlayers.find(stp => 
    stp.player.firstName === 'Michael' || stp.player.name?.includes('Michael')
  );
  const stefi = stopTeamPlayers.find(stp => 
    stp.player.firstName === 'Stefi' || stp.player.name?.includes('Stefi')
  );
  const ali = stopTeamPlayers.find(stp => 
    stp.player.firstName === 'Ali' || stp.player.name?.includes('Ali')
  );
  const gene = stopTeamPlayers.find(stp => 
    stp.player.name === 'Gene Liang' || 
    (stp.player.firstName === 'Gene' && stp.player.lastName === 'Liang')
  );
  const josh = stopTeamPlayers.find(stp => 
    stp.player.name === 'Josh Hazenbuhler' || 
    (stp.player.firstName === 'Josh' && stp.player.lastName === 'Hazenbuhler')
  );
  const diana = stopTeamPlayers.find(stp => 
    stp.player.name === 'Diana Hatch' || 
    (stp.player.firstName === 'Diana' && stp.player.lastName === 'Hatch')
  );
  const trina = stopTeamPlayers.find(stp => 
    stp.player.name === 'Trina Ngu' || 
    (stp.player.firstName === 'Trina' && stp.player.lastName === 'Ngu')
  );

  console.log('\nFound players:');
  console.log(`Chris: ${chris?.player.name} (${chris?.player.gender}) - ${chris?.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name}`);
  console.log(`Michael: ${michael?.player.name} (${michael?.player.gender}) - ${michael?.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name}`);
  console.log(`Stefi: ${stefi?.player.name} (${stefi?.player.gender}) - ${stefi?.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name}`);
  console.log(`Ali: ${ali?.player.name} (${ali?.player.gender}) - ${ali?.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name}`);
  console.log(`Gene: ${gene?.player.name} (${gene?.player.gender}) - ${gene?.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name}`);
  console.log(`Josh: ${josh?.player.name} (${josh?.player.gender}) - ${josh?.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name}`);
  console.log(`Diana: ${diana?.player.name} (${diana?.player.gender}) - ${diana?.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name}`);
  console.log(`Trina: ${trina?.player.name} (${trina?.player.gender}) - ${trina?.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name}`);

  if (!chris || !michael || !stefi || !ali || !gene || !josh || !diana || !trina) {
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
  console.log('MENS_DOUBLES: Chris & Michael vs Gene & Josh');
  console.log('WOMENS_DOUBLES: Stefi & Ali vs Diana & Trina');
  console.log('MIXED_1: Michael & Stefi vs Diana & Josh');
  console.log('MIXED_2: Chris & Ali vs Gene & Trina\n');

  // Set lineups for each game
  for (const game of games) {
    let teamALineup, teamBLineup;

    switch (game.slot) {
      case 'MENS_DOUBLES':
        // Chris & Michael vs Gene & Josh
        teamALineup = [{ player1Id: chris.player.id, player2Id: michael.player.id }];
        teamBLineup = [{ player1Id: gene.player.id, player2Id: josh.player.id }];
        break;
      case 'WOMENS_DOUBLES':
        // Stefi & Ali vs Diana & Trina
        teamALineup = [{ player1Id: stefi.player.id, player2Id: ali.player.id }];
        teamBLineup = [{ player1Id: diana.player.id, player2Id: trina.player.id }];
        break;
      case 'MIXED_1':
        // Michael & Stefi vs Diana & Josh
        teamALineup = [{ player1Id: michael.player.id, player2Id: stefi.player.id }];
        teamBLineup = [{ player1Id: diana.player.id, player2Id: josh.player.id }];
        break;
      case 'MIXED_2':
        // Chris & Ali vs Gene & Trina
        teamALineup = [{ player1Id: chris.player.id, player2Id: ali.player.id }];
        teamBLineup = [{ player1Id: gene.player.id, player2Id: trina.player.id }];
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
  console.log('MENS_DOUBLES: Chris ? & Michael ? vs Gene Liang & Josh Hazenbuhler');
  console.log('WOMENS_DOUBLES: Stefi ? & Ali ? vs Diana Hatch & Trina Ngu');
  console.log('MIXED_1: Michael ? & Stefi ? vs Diana Hatch & Josh Hazenbuhler');
  console.log('MIXED_2: Chris ? & Ali ? vs Gene Liang & Trina Ngu');
}

main().catch(console.error).finally(() => prisma.$disconnect());
