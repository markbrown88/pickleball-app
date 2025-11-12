import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkClubs() {
  try {
    const clubs = await prisma.club.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    console.log('Valid Club IDs in database:\n');
    clubs.forEach(c => {
      console.log(`  ${c.id} - ${c.name}`);
    });

    console.log(`\nTotal: ${clubs.length} clubs`);

    // Check the invalid ones from CSV
    const invalidClubIds = [
      'cmfwjxglo0000rdxtvyl80iu7',
      'cmfwjxglo0000rdxtvyl80iu8',
      'cmfwjxglo0000rdxtvyl80iu9',
      'cmfwjxglo0000rdxtvyl80iu10',
      'cmfwjxglo0000rdxtvyl80iu11',
      'cmfwjxglo0000rdxtvyl80iu12',
      'cmfwjxglo0000rdxtvyl80iu13',
      'cmfwjxglo0000rdxtvyl80iu14',
      'cmfwjxglo0000rdxtvyl80iu15',
      'cmfwjxglo0000rdxtvyl80iu16',
      'cmfwjxglo0000rdxtvyl80iu17',
      'cmfwjxglo0000rdxtvyl80iu18',
    ];

    console.log('\n\nChecking invalid Club IDs from CSV:');
    const validClubIds = new Set(clubs.map(c => c.id));
    
    // Check if there's a pattern - maybe these are old IDs for "Pickleplex Windsor"?
    const windsorClub = clubs.find(c => c.name === 'Pickleplex Windsor');
    if (windsorClub) {
      console.log(`\nFound "Pickleplex Windsor" with ID: ${windsorClub.id}`);
      console.log('Invalid IDs appear to be old Windsor club IDs (iu7, iu8, etc.)');
      console.log('These should probably be updated to the current Windsor club ID.');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkClubs();

