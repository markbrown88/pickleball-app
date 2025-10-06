import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkLineupSchema() {
  // Check what columns the Lineup table actually has
  const result = await prisma.$queryRaw<Array<{ column_name: string; data_type: string }>>`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'Lineup'
    ORDER BY ordinal_position;
  `;

  console.log('\n=== Lineup Table Columns ===');
  result.forEach(col => {
    console.log(`${col.column_name}: ${col.data_type}`);
  });

  // Check if there are any lineups for Stop 2 with old matchId reference
  const stop2Id = 'cmfot1xzy0008rd6a1kvvmvta';

  // Get all rounds for Stop 2
  const rounds = await prisma.round.findMany({
    where: { stopId: stop2Id },
    select: { id: true, idx: true }
  });

  console.log(`\n=== Stop 2 Rounds (${rounds.length} total) ===`);
  rounds.forEach(r => console.log(`Round ${r.idx}: ${r.id}`));

  // Check if any lineups exist that might be orphaned
  const allLineups = await prisma.$queryRaw<Array<{ id: string; roundId: string | null; teamId: string }>>`
    SELECT id, "roundId", "teamId"
    FROM "Lineup"
    LIMIT 10;
  `;

  console.log('\n=== Sample Lineup Records ===');
  allLineups.forEach(l => {
    console.log(`Lineup ${l.id}: roundId=${l.roundId}, teamId=${l.teamId}`);
  });

  await prisma.$disconnect();
}

checkLineupSchema().catch(console.error);
