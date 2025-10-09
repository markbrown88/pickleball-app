import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugForfeitLogic() {
  console.log('🔍 Debugging forfeit logic in materialized view...\n');

  try {
    const team = await prisma.team.findFirst({
      where: { name: '4 Fathers Advanced' },
      select: { id: true, name: true }
    });

    if (!team) return;

    // Let's check what the materialized view is actually calculating
    console.log('🔍 Checking materialized view calculation step by step...');
    
    const viewBreakdown = await prisma.$queryRaw`
      WITH match_results AS (
        SELECT 
          m.id as match_id,
          t.id as tournament_id,
          m."forfeitTeam",
          ta.id as team_a_id,
          ta.name as team_a_name,
          ta."clubId" as team_a_club_id,
          tb.id as team_b_id,
          tb.name as team_b_name,
          tb."clubId" as team_b_club_id,
          -- For forfeited matches - simplified logic
          CASE 
            WHEN m."forfeitTeam" = 'A' THEN 0  -- Team A forfeited, gets 0 points
            WHEN m."forfeitTeam" = 'B' THEN 0  -- Team B forfeited, gets 0 points
            ELSE 0
          END as team_a_forfeit_points,
          CASE 
            WHEN m."forfeitTeam" = 'A' THEN 0  -- Team A forfeited, gets 0 points
            WHEN m."forfeitTeam" = 'B' THEN 0  -- Team B forfeited, gets 0 points
            ELSE 0
          END as team_b_forfeit_points,
          -- For normal matches, calculate from games - simplified logic
          CASE 
            WHEN m."forfeitTeam" IS NULL THEN (
              WITH game_scores AS (
                SELECT 
                  CASE WHEN g."teamAScore" > g."teamBScore" THEN 1 ELSE 0 END as team_a_wins,
                  CASE WHEN g."teamBScore" > g."teamAScore" THEN 1 ELSE 0 END as team_b_wins
                FROM "Game" g 
                WHERE g."matchId" = m.id 
                  AND g."teamAScore" IS NOT NULL 
                  AND g."teamBScore" IS NOT NULL
              )
              SELECT 
                CASE 
                  WHEN COUNT(*) = 0 THEN 0
                  WHEN SUM(team_a_wins) > SUM(team_b_wins) THEN 3
                  WHEN SUM(team_b_wins) > SUM(team_a_wins) THEN 1
                  ELSE 0
                END
              FROM game_scores
            )
            ELSE 0
          END as team_a_normal_points,
          CASE 
            WHEN m."forfeitTeam" IS NULL THEN (
              WITH game_scores AS (
                SELECT 
                  CASE WHEN g."teamAScore" > g."teamBScore" THEN 1 ELSE 0 END as team_a_wins,
                  CASE WHEN g."teamBScore" > g."teamAScore" THEN 1 ELSE 0 END as team_b_wins
                FROM "Game" g 
                WHERE g."matchId" = m.id 
                  AND g."teamAScore" IS NOT NULL 
                  AND g."teamBScore" IS NOT NULL
              )
              SELECT 
                CASE 
                  WHEN COUNT(*) = 0 THEN 0
                  WHEN SUM(team_b_wins) > SUM(team_a_wins) THEN 3
                  WHEN SUM(team_a_wins) > SUM(team_b_wins) THEN 1
                  ELSE 0
                END
              FROM game_scores
            )
            ELSE 0
          END as team_b_normal_points
        FROM "Match" m
        LEFT JOIN "Team" ta ON m."teamAId" = ta.id
        LEFT JOIN "Team" tb ON m."teamBId" = tb.id
        LEFT JOIN "Round" r ON m."roundId" = r.id
        LEFT JOIN "Stop" s ON r."stopId" = s.id
        LEFT JOIN "Tournament" t ON s."tournamentId" = t.id
        WHERE t.id IS NOT NULL
          AND ta.id IS NOT NULL 
          AND tb.id IS NOT NULL
          AND (ta.id = ${team.id} OR tb.id = ${team.id})
      )
      SELECT 
        match_id,
        team_a_id,
        team_a_name,
        team_b_id,
        team_b_name,
        team_a_forfeit_points,
        team_b_forfeit_points,
        team_a_normal_points,
        team_b_normal_points,
        (team_a_forfeit_points + team_a_normal_points) as team_a_total,
        (team_b_forfeit_points + team_b_normal_points) as team_b_total,
        "forfeitTeam"
      FROM match_results
      ORDER BY match_id;
    `;

    console.log(`Found ${(viewBreakdown as any[]).length} matches in materialized view logic\n`);
    
    let totalPoints = 0;
    let wins = 0;
    let losses = 0;

    (viewBreakdown as any[]).forEach((match, index) => {
      const isTeamA = match.team_a_id === team.id;
      const points = isTeamA ? match.team_a_total : match.team_b_total;
      const opponent = isTeamA ? match.team_b_name : match.team_a_name;
      const forfeitTeam = match.forfeitTeam;
      
      console.log(`Match ${index + 1}: vs ${opponent}`);
      console.log(`   Forfeit Team: ${forfeitTeam || 'None'}`);
      console.log(`   Is Team A: ${isTeamA}`);
      console.log(`   Team A Forfeit Points: ${match.team_a_forfeit_points}`);
      console.log(`   Team B Forfeit Points: ${match.team_b_forfeit_points}`);
      console.log(`   Team A Normal Points: ${match.team_a_normal_points}`);
      console.log(`   Team B Normal Points: ${match.team_b_normal_points}`);
      console.log(`   Team A Total: ${match.team_a_total}`);
      console.log(`   Team B Total: ${match.team_b_total}`);
      console.log(`   Points for 4 Fathers Advanced: ${points}`);
      
      totalPoints += points;
      if (points > 0) wins++;
      else losses++;
      
      console.log('');
    });

    console.log(`📊 Total from materialized view logic: ${totalPoints} points (${wins}W-${losses}L)`);

    // The issue might be that the forfeit logic is wrong
    // Let me check the actual forfeit matches
    console.log('\n🔍 Checking actual forfeit matches...');
    
    const forfeitMatches = await prisma.match.findMany({
      where: {
        OR: [
          { teamAId: team.id },
          { teamBId: team.id }
        ],
        forfeitTeam: {
          not: null
        }
      },
      include: {
        teamA: { select: { name: true } },
        teamB: { select: { name: true } },
        round: {
          include: {
            stop: {
              select: { name: true }
            }
          }
        }
      }
    });

    console.log(`Found ${forfeitMatches.length} forfeit matches:`);
    for (const match of forfeitMatches) {
      const isTeamA = match.teamAId === team.id;
      const opponent = isTeamA ? match.teamB?.name : match.teamA?.name;
      const stopName = match.round?.stop?.name;
      const roundNum = (match.round?.idx || 0) + 1;
      
      console.log(`   ${stopName}, Round ${roundNum}: vs ${opponent}`);
      console.log(`   Forfeit Team: ${match.forfeitTeam}`);
      console.log(`   Is Team A: ${isTeamA}`);
      
      if ((match.forfeitTeam === 'A' && isTeamA) || (match.forfeitTeam === 'B' && !isTeamA)) {
        console.log(`   🚫 4 Fathers Advanced forfeited - Should get 0 points`);
      } else {
        console.log(`   🏆 Opponent forfeited - Should get 3 points`);
      }
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugForfeitLogic();
