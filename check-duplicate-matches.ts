import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDuplicates() {
  try {
    // Check for duplicate match IDs in the database
    const duplicateMatches = await prisma.$queryRaw<Array<{ id: string; count: bigint }>>`
      SELECT id, COUNT(*) as count
      FROM "Match"
      GROUP BY id
      HAVING COUNT(*) > 1
    `;

    if (duplicateMatches.length > 0) {
      console.log('Found duplicate Match IDs in the database:');
      duplicateMatches.forEach(match => {
        console.log(`  Match ID: ${match.id}, Count: ${match.count.toString()}`);
      });
    } else {
      console.log('No duplicate Match IDs found in database.');
    }

    // Check the specific IDs from the error
    const problemIds = [
      'cmfpbp7ez0013rdn0lurlnqbe',
      'cmfpbp7q9001lrdn0eso5evio',
      'cmfosyye10001rdkf7f6sr0di',
      'cmfosyyfk0003rdkf16xmvibe'
    ];

    console.log('\nChecking specific match IDs from error:');
    for (const id of problemIds) {
      const matches = await prisma.match.findMany({
        where: { id },
        include: {
          round: { select: { id: true, idx: true, stopId: true } },
          teamA: { select: { id: true, name: true, bracketId: true } },
          teamB: { select: { id: true, name: true, bracketId: true } }
        }
      });

      console.log(`\nMatch ${id}:`);
      console.log(`  Found ${matches.length} records`);
      matches.forEach((match, i) => {
        console.log(`    [${i}] Round: ${match.round.idx}, Stop: ${match.round.stopId}, TeamA Bracket: ${match.teamA?.bracketId}, TeamB Bracket: ${match.teamB?.bracketId}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicates();
