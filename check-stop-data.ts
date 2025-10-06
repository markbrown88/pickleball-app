import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check StopTeamPlayer for both stops
  const stop1Id = 'cmftqlrha000crd1estw0n0a6';
  const stop2Id = 'cmftqlril000erd1ez92q1cyg';

  const stop1PlayersRaw: any[] = await prisma.$queryRaw`
    SELECT
      stp."stopId",
      stp."teamId",
      stp."playerId",
      p."firstName",
      p."lastName",
      t.name as team_name,
      c.name as club_name
    FROM "StopTeamPlayer" stp
    JOIN "Player" p ON stp."playerId" = p.id
    JOIN "Team" t ON stp."teamId" = t.id
    LEFT JOIN "Club" c ON t."clubId" = c.id
    WHERE stp."stopId" = ${stop1Id}
    LIMIT 20
  `;

  console.log(`Stop 1 StopTeamPlayer count: ${stop1PlayersRaw.length}`);
  if (stop1PlayersRaw.length > 0) {
    console.log('\nStop 1 sample players:');
    for (const row of stop1PlayersRaw) {
      console.log(`  ${row.club_name || row.team_name}: ${row.firstName} ${row.lastName}`);
    }
  }

  const stop2PlayersRaw: any[] = await prisma.$queryRaw`
    SELECT
      stp."stopId",
      stp."teamId",
      stp."playerId",
      p."firstName",
      p."lastName",
      t.name as team_name,
      c.name as club_name
    FROM "StopTeamPlayer" stp
    JOIN "Player" p ON stp."playerId" = p.id
    JOIN "Team" t ON stp."teamId" = t.id
    LEFT JOIN "Club" c ON t."clubId" = c.id
    WHERE stp."stopId" = ${stop2Id}
    LIMIT 20
  `;

  console.log(`\nStop 2 StopTeamPlayer count: ${stop2PlayersRaw.length}`);
  if (stop2PlayersRaw.length > 0) {
    console.log('\nStop 2 sample players:');
    for (const row of stop2PlayersRaw) {
      console.log(`  ${row.club_name || row.team_name}: ${row.firstName} ${row.lastName}`);
    }
  }

  // Check for lineups
  const stop1Lineups: any[] = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM "Lineup" l
    JOIN "Round" r ON l."roundId" = r.id
    WHERE r."stopId" = ${stop1Id}
  `;

  console.log(`\nStop 1 Lineups: ${stop1Lineups[0]?.count || 0}`);

  const stop2Lineups: any[] = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM "Lineup" l
    JOIN "Round" r ON l."roundId" = r.id
    WHERE r."stopId" = ${stop2Id}
  `;

  console.log(`Stop 2 Lineups: ${stop2Lineups[0]?.count || 0}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
