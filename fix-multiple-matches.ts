import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Fixing Multiple Matches in Stop 2 ===\n');

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

  // Define the matches to fix
  const matchesToFix = [
    { round: 5, teamA: 'Real Pickleball Advanced', teamB: 'Greenhills Advanced' },
    { round: 6, teamA: 'One Health Intermediate', teamB: '4 Fathers Intermediate' },
    { round: 6, teamA: 'One Health Advanced', teamB: '4 Fathers Advanced' },
    { round: 7, teamA: 'Real Pickleball Advanced', teamB: 'Blue Zone Advanced' },
    { round: 7, teamA: 'Pickleplex Barrie Advanced', teamB: 'Greenhills Advanced' }
  ];

  const expectedSlots = ['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_1', 'MIXED_2', 'TIEBREAKER'];

  for (const matchInfo of matchesToFix) {
    console.log(`=== Round ${matchInfo.round}: ${matchInfo.teamA} vs ${matchInfo.teamB} ===`);

    // Find the round
    const rounds = await prisma.round.findMany({
      where: { stopId: stop2.id },
      orderBy: { idx: 'asc' },
      select: { id: true, idx: true }
    });

    const targetRound = rounds[matchInfo.round - 1]; // Convert to 0-based index
    if (!targetRound) {
      console.log(`❌ Round ${matchInfo.round} not found`);
      continue;
    }

    // Find the match
    const match = await prisma.match.findFirst({
      where: {
        roundId: targetRound.id,
        OR: [
          {
            teamA: { name: { contains: matchInfo.teamA } },
            teamB: { name: { contains: matchInfo.teamB } }
          },
          {
            teamA: { name: { contains: matchInfo.teamB } },
            teamB: { name: { contains: matchInfo.teamA } }
          }
        ]
      },
      include: {
        teamA: { select: { id: true, name: true } },
        teamB: { select: { id: true, name: true } },
        games: {
          select: { slot: true },
          orderBy: { slot: 'asc' }
        }
      }
    });

    if (!match) {
      console.log(`❌ Match not found`);
      continue;
    }

    console.log(`Found match: ${match.teamA?.name} vs ${match.teamB?.name} (${match.id})`);

    // Check current games
    const existingSlots = match.games.map(g => g.slot);
    const missingSlots = expectedSlots.filter(slot => !existingSlots.includes(slot));

    console.log(`Current games: ${existingSlots.join(', ')} (${existingSlots.length} total)`);
    console.log(`Missing games: ${missingSlots.length > 0 ? missingSlots.join(', ') : 'None'}`);

    // Create missing games
    if (missingSlots.length > 0) {
      console.log(`Creating ${missingSlots.length} missing games...`);
      
      const gamesToCreate = missingSlots.map(slot => ({
        matchId: match.id,
        slot,
        teamAScore: null,
        teamBScore: null,
        teamALineup: null,
        teamBLineup: null,
        lineupConfirmed: false,
        isComplete: false
      }));

      try {
        const result = await prisma.game.createMany({
          data: gamesToCreate,
          skipDuplicates: true
        });

        console.log(`✅ Created ${result.count} missing games`);
      } catch (error) {
        console.error(`❌ Error creating games:`, error);
        continue;
      }
    }

    // Now set up lineups for all games
    await setupLineupsForMatch(match.id, match.teamAId!, match.teamBId!, stop2.id, match.teamA?.name, match.teamB?.name);

    console.log('');
  }

  console.log('=== Summary ===');
  console.log('All matches should now have 5 games each with proper lineups.');
}

async function setupLineupsForMatch(matchId: string, teamAId: string, teamBId: string, stopId: string, teamAName?: string, teamBName?: string) {
  console.log('Setting up lineups...');

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

  // Get players from both teams
  const stopTeamPlayers = await prisma.stopTeamPlayer.findMany({
    where: {
      stopId: stopId,
      teamId: { in: [teamAId, teamBId] }
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

  // Separate players by team and gender
  const teamAPlayers = stopTeamPlayers.filter(stp => stp.teamId === teamAId);
  const teamBPlayers = stopTeamPlayers.filter(stp => stp.teamId === teamBId);

  const teamAMen = teamAPlayers.filter(stp => stp.player.gender === 'MALE');
  const teamAWomen = teamAPlayers.filter(stp => stp.player.gender === 'FEMALE');
  const teamBMen = teamBPlayers.filter(stp => stp.player.gender === 'MALE');
  const teamBWomen = teamBPlayers.filter(stp => stp.player.gender === 'FEMALE');

  console.log(`  Team A: ${teamAMen.length} men, ${teamAWomen.length} women`);
  console.log(`  Team B: ${teamBMen.length} men, ${teamBWomen.length} women`);

  if (teamAMen.length < 2 || teamAWomen.length < 2 || teamBMen.length < 2 || teamBWomen.length < 2) {
    console.log(`  ⚠️  Not enough players for complete lineups`);
    return;
  }

  // Set up lineups for each game
  for (const game of games) {
    if (game.teamALineup && game.teamBLineup && game.lineupConfirmed) {
      console.log(`  ${game.slot}: Already has lineup`);
      continue;
    }

    let teamALineup, teamBLineup;

    switch (game.slot) {
      case 'MENS_DOUBLES':
        teamALineup = [{ player1Id: teamAMen[0].player.id, player2Id: teamAMen[1].player.id }];
        teamBLineup = [{ player1Id: teamBMen[0].player.id, player2Id: teamBMen[1].player.id }];
        break;
      case 'WOMENS_DOUBLES':
        teamALineup = [{ player1Id: teamAWomen[0].player.id, player2Id: teamAWomen[1].player.id }];
        teamBLineup = [{ player1Id: teamBWomen[0].player.id, player2Id: teamBWomen[1].player.id }];
        break;
      case 'MIXED_1':
        teamALineup = [{ player1Id: teamAMen[0].player.id, player2Id: teamAWomen[0].player.id }];
        teamBLineup = [{ player1Id: teamBMen[0].player.id, player2Id: teamBWomen[0].player.id }];
        break;
      case 'MIXED_2':
        teamALineup = [{ player1Id: teamAMen[1].player.id, player2Id: teamAWomen[1].player.id }];
        teamBLineup = [{ player1Id: teamBMen[1].player.id, player2Id: teamBWomen[1].player.id }];
        break;
      case 'TIEBREAKER':
        // Skip tiebreaker for now
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

      console.log(`  ${game.slot}: Set lineup`);
    } catch (error) {
      console.error(`  ${game.slot}: Error setting lineup:`, error);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
