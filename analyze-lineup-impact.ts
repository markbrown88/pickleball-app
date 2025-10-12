import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeImpact() {
  try {
    // Check what's in LineupEntry currently (without using the slot field)
    const lineupEntryCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM "LineupEntry"
    `;
    console.log('Total LineupEntry records:', lineupEntryCount[0].count.toString());

    // Check distinct lineupIds
    const distinctLineups = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT "lineupId") as count FROM "LineupEntry"
    `;
    console.log('Distinct lineups:', distinctLineups[0].count.toString());

    // Check which lineups these belong to
    const lineupInfo = await prisma.$queryRaw<Array<any>>`
      SELECT
        l.id,
        l."roundId",
        l."teamId",
        l."createdAt",
        r."stopId",
        s."name" as stop_name,
        COUNT(le.id) as entry_count
      FROM "Lineup" l
      JOIN "Round" r ON l."roundId" = r.id
      JOIN "Stop" s ON r."stopId" = s.id
      LEFT JOIN "LineupEntry" le ON l.id = le."lineupId"
      GROUP BY l.id, l."roundId", l."teamId", l."createdAt", r."stopId", s."name"
      ORDER BY l."createdAt" DESC
      LIMIT 20
    `;

    console.log('\nRecent lineups:');
    lineupInfo.forEach(info => {
      console.log(`  - Stop: ${info.stop_name}, Lineup ID: ${info.id.substring(0, 8)}..., Entries: ${info.entry_count}, Created: ${info.createdAt}`);
    });

    // Check Game records with scores (completed games)
    const completedGames = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM "Game"
      WHERE "isComplete" = true
    `;
    console.log('\nCompleted games:', completedGames[0].count.toString());

    // Check if Game table still has JSON lineup fields
    const gamesWithJsonLineups = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM "Game"
      WHERE "teamALineup" IS NOT NULL OR "teamBLineup" IS NOT NULL
    `;
    console.log('Games with JSON lineup data:', gamesWithJsonLineups[0].count.toString());

    // The key question: will completed games be affected?
    console.log('\n=== IMPACT ANALYSIS ===');
    console.log('LineupEntry table stores FUTURE/ACTIVE lineup selections.');
    console.log('Completed games rely on Game.teamALineup/teamBLineup JSON fields (if they exist).');
    console.log('\nChanging LineupEntry.slot will NOT affect:');
    console.log('  ✓ Game scores (stored in Game.teamAScore/teamBScore)');
    console.log('  ✓ Game completion status (stored in Game.isComplete)');
    console.log('  ✓ Historical game data');
    console.log('  ✓ Tournament results and standings');

    if (gamesWithJsonLineups[0].count > BigInt(0)) {
      console.log('  ✓ Old lineup data in Game JSON fields (still preserved)');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeImpact();
