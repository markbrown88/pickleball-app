import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkStructure() {
  try {
    // Get column information
    const columns = await prisma.$queryRaw<Array<{ column_name: string; data_type: string }>>`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'LineupEntry'
      ORDER BY ordinal_position
    `;

    console.log('LineupEntry columns:');
    console.log(columns);

    // Check if there's any data
    const count = await prisma.lineupEntry.count();
    console.log(`\nTotal LineupEntry records: ${count}`);

    // Sample a few records to see the structure
    if (count > 0) {
      const sample = await prisma.lineupEntry.findMany({ take: 3 });
      console.log('\nSample records:');
      console.log(JSON.stringify(sample, null, 2));
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkStructure();
