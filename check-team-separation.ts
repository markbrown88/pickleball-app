import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTeamSeparation() {
  console.log('🔍 Checking if Advanced and Intermediate teams are being combined...\n');

  try {
    // Find all 4 Fathers teams
    const fourFathersTeams = await prisma.team.findMany({
      where: {
        name: {
          contains: '4 Fathers'
        }
      },
      select: { 
        id: true, 
        name: true,
        clubId: true
      }
    });

    console.log('🏆 All 4 Fathers teams:');
    fourFathersTeams.forEach(team => {
      console.log(`   ${team.name} (${team.id}) - Club: ${team.clubId}`);
    });

    // Check standings for each team separately
    console.log('\n📊 Standings for each 4 Fathers team:');
    
    for (const team of fourFathersTeams) {
      const standings = await prisma.$queryRaw`
        SELECT * FROM tournament_standings 
        WHERE team_id = ${team.id}
      `;

      if (standings && (standings as any[]).length > 0) {
        const data = (standings as any[])[0];
        console.log(`\n   ${team.name}:`);
        console.log(`     Points: ${data.points}`);
        console.log(`     Wins: ${data.wins}`);
        console.log(`     Losses: ${data.losses}`);
        console.log(`     Matches Played: ${data.matches_played}`);
      } else {
        console.log(`\n   ${team.name}: No standings found`);
      }
    }

    // Check if there's any club-level aggregation happening
    console.log('\n🔍 Checking for club-level aggregation...');
    
    const clubStandings = await prisma.$queryRaw`
      SELECT 
        "clubId",
        COUNT(*) as team_count,
        SUM(points) as total_points,
        SUM(wins) as total_wins,
        SUM(losses) as total_losses
      FROM tournament_standings 
      WHERE "clubId" = (
        SELECT "clubId" FROM "Team" WHERE name = '4 Fathers Advanced' LIMIT 1
      )
      GROUP BY "clubId"
    `;

    if (clubStandings && (clubStandings as any[]).length > 0) {
      const data = (clubStandings as any[])[0];
      console.log(`   Club aggregation found:`);
      console.log(`     Teams: ${data.team_count}`);
      console.log(`     Total Points: ${data.total_points}`);
      console.log(`     Total Wins: ${data.total_wins}`);
      console.log(`     Total Losses: ${data.total_losses}`);
    }

    // Let's manually count 4 Fathers Advanced matches
    console.log('\n🧮 Manual count for 4 Fathers Advanced:');
    
    const advancedTeam = fourFathersTeams.find(t => t.name === '4 Fathers Advanced');
    if (advancedTeam) {
      const matches = await prisma.match.findMany({
        where: {
          OR: [
            { teamAId: advancedTeam.id },
            { teamBId: advancedTeam.id }
          ]
        },
        include: {
          teamA: { select: { name: true } },
          teamB: { select: { name: true } },
          games: {
            select: {
              slot: true,
              teamAScore: true,
              teamBScore: true,
              isComplete: true
            }
          },
          round: {
            include: {
              stop: {
                select: { name: true }
              }
            }
          }
        }
      });

      let wins = 0;
      let losses = 0;
      let forfeits = 0;

      for (const match of matches) {
        const isTeamA = match.teamAId === advancedTeam.id;
        const opponent = isTeamA ? match.teamB?.name : match.teamA?.name;
        const stopName = match.round?.stop?.name;
        const roundNum = (match.round?.idx || 0) + 1;
        
        if (match.forfeitTeam) {
          forfeits++;
          if ((match.forfeitTeam === 'A' && isTeamA) || (match.forfeitTeam === 'B' && !isTeamA)) {
            console.log(`   🚫 ${stopName} R${roundNum}: vs ${opponent} - FORFEITED`);
            losses++;
          } else {
            console.log(`   🏆 ${stopName} R${roundNum}: vs ${opponent} - WON BY FORFEIT`);
            wins++;
          }
        } else {
          const completedGames = match.games.filter(g => 
            g.teamAScore !== null && g.teamBScore !== null
          );
          
          if (completedGames.length > 0) {
            let teamWins = 0;
            let opponentWins = 0;
            
            for (const game of completedGames) {
              const teamScore = isTeamA ? game.teamAScore : game.teamBScore;
              const opponentScore = isTeamA ? game.teamBScore : game.teamAScore;
              
              if (teamScore > opponentScore) {
                teamWins++;
              } else if (opponentScore > teamScore) {
                opponentWins++;
              }
            }
            
            if (teamWins > opponentWins) {
              console.log(`   🏆 ${stopName} R${roundNum}: vs ${opponent} - WON (${teamWins}-${opponentWins})`);
              wins++;
            } else if (opponentWins > teamWins) {
              console.log(`   ❌ ${stopName} R${roundNum}: vs ${opponent} - LOST (${teamWins}-${opponentWins})`);
              losses++;
            } else {
              console.log(`   🤝 ${stopName} R${roundNum}: vs ${opponent} - TIED (${teamWins}-${opponentWins})`);
            }
          } else {
            console.log(`   ⏳ ${stopName} R${roundNum}: vs ${opponent} - NO GAMES`);
          }
        }
      }

      console.log(`\n📊 Manual calculation for 4 Fathers Advanced:`);
      console.log(`   Total matches: ${matches.length}`);
      console.log(`   Wins: ${wins}`);
      console.log(`   Losses: ${losses}`);
      console.log(`   Forfeits: ${forfeits}`);
      console.log(`   Points: ${wins * 3 + losses * 1}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTeamSeparation();
