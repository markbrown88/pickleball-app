import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Checking Stop 1 Lineup Data ===\n');

  // Get Stop 1
  const stop1 = await prisma.stop.findFirst({
    where: { name: 'Stop 1' },
    select: { id: true, name: true }
  });

  if (!stop1) {
    console.log('❌ Stop 1 not found');
    return;
  }

  // Check if there are lineups in the old system for Stop 1
  const oldLineups = await prisma.lineup.findMany({
    where: {
      stopId: stop1.id
    },
    include: {
      entries: {
        include: {
          player1: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              gender: true
            }
          },
          player2: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              gender: true
            }
          }
        }
      },
      round: {
        select: { idx: true }
      },
      team: {
        select: { name: true }
      }
    }
  });

  console.log(`Found ${oldLineups.length} lineups in old system for Stop 1`);

  if (oldLineups.length > 0) {
    console.log('\nSample lineup:');
    const sampleLineup = oldLineups[0];
    console.log(`  Round ${sampleLineup.round.idx + 1}: ${sampleLineup.team.name}`);
    console.log(`  Entries: ${sampleLineup.entries.length}`);
    sampleLineup.entries.forEach(entry => {
      const player1Name = entry.player1.name || `${entry.player1.firstName || ''} ${entry.player1.lastName || ''}`.trim();
      const player2Name = entry.player2.name || `${entry.player2.firstName || ''} ${entry.player2.lastName || ''}`.trim();
      console.log(`    ${entry.slot}: ${player1Name} & ${player2Name}`);
    });
  }

  // Check if we need to migrate lineups from old system to new system
  console.log('\n=== Checking if lineups need to be migrated ===');
  
  // Get a sample match from Stop 1
  const sampleMatch = await prisma.match.findFirst({
    where: {
      round: { stopId: stop1.id }
    },
    include: {
      teamA: { select: { name: true } },
      teamB: { select: { name: true } },
      round: { select: { idx: true } },
      games: {
        where: {
          slot: { in: ['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_1', 'MIXED_2'] }
        },
        select: {
          id: true,
          slot: true,
          teamALineup: true,
          teamBLineup: true
        }
      }
    }
  });

  if (sampleMatch) {
    console.log(`\nSample match: ${sampleMatch.teamA?.name} vs ${sampleMatch.teamB?.name}`);
    console.log(`Games: ${sampleMatch.games.length}`);
    
    const gamesWithLineups = sampleMatch.games.filter(g => 
      (g.teamALineup && Array.isArray(g.teamALineup) && g.teamALineup.length > 0) ||
      (g.teamBLineup && Array.isArray(g.teamBLineup) && g.teamBLineup.length > 0)
    );
    
    console.log(`Games with lineups: ${gamesWithLineups.length}/${sampleMatch.games.length}`);
    
    if (gamesWithLineups.length === 0) {
      console.log('❌ No lineups in new system - need to migrate from old system');
    } else {
      console.log('✅ Lineups already exist in new system');
    }
  }

  console.log('\n=== RECOMMENDATION ===');
  if (oldLineups.length > 0 && sampleMatch && gamesWithLineups.length === 0) {
    console.log('✅ Stop 1 has lineup data in the old system that needs to be migrated');
    console.log('✅ This will fix the issue where games show but no players/scores are visible');
    console.log('✅ The migration should convert old Lineup/LineupEntry data to Game.teamALineup/teamBLineup');
  } else if (oldLineups.length === 0) {
    console.log('❌ No lineup data found for Stop 1 in either system');
    console.log('❌ This explains why no players/scores are visible');
  } else {
    console.log('✅ Stop 1 should already be working properly');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
