import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const stop1Id = 'cmfot1xyc0006rd6akzrbmapv';

  const lineupCount: any = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM "Lineup" l
    JOIN "Round" r ON l."roundId" = r.id
    WHERE r."stopId" = ${stop1Id}
  `;

  console.log('Stop 1 Lineups:', lineupCount[0].count);

  const entryCount: any = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM "LineupEntry"
  `;

  console.log('Total LineupEntry records:', entryCount[0].count);

  // Get sample lineup data
  const sampleLineup: any = await prisma.$queryRaw`
    SELECT
      l.id as lineup_id,
      l."teamId",
      t.name as team_name,
      c.name as club_name,
      r.idx as round_idx
    FROM "Lineup" l
    JOIN "Round" r ON l."roundId" = r.id
    JOIN "Team" t ON l."teamId" = t.id
    LEFT JOIN "Club" c ON t."clubId" = c.id
    WHERE r."stopId" = ${stop1Id}
    LIMIT 5
  `;

  console.log('\nSample lineups:');
  for (const l of sampleLineup) {
    console.log(`  Round ${l.round_idx}: ${l.club_name} (${l.lineup_id})`);
  }

  // Check LineupEntry structure
  const sampleEntry: any = await prisma.$queryRaw`
    SELECT *
    FROM "LineupEntry"
    LIMIT 1
  `;

  if (sampleEntry.length > 0) {
    console.log('\nLineupEntry columns:');
    console.log(Object.keys(sampleEntry[0]));
    console.log('\nSample entry:');
    console.log(sampleEntry[0]);
  }

  // Count total games for Stop 1
  const gameCount: any = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM "Game" g
    JOIN "Match" m ON g."matchId" = m.id
    JOIN "Round" r ON m."roundId" = r.id
    WHERE r."stopId" = ${stop1Id}
  `;

  console.log('\nStop 1 Total Games:', gameCount[0].count);

  // Count rounds
  const roundCount: any = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM "Round" r
    WHERE r."stopId" = ${stop1Id}
  `;

  console.log('Stop 1 Total Rounds:', roundCount[0].count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
