import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Fixing Missing Games in Stop 2, Round 4 ===\n');

  // Find the tournament
  const tournament = await prisma.tournament.findFirst({
    where: { 
      name: { contains: 'Klyng' },
      NOT: { name: { contains: 'pickleplex' } }
    }
  });

  if (!tournament) {
    console.log('❌ Tournament not found');
    return;
  }

  // Find Stop 2
  const stops = await prisma.stop.findMany({
    where: { tournamentId: tournament.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true }
  });

  if (stops.length < 2) {
    console.log('❌ Stop 2 not found');
    return;
  }

  const stop2 = stops[1];
  console.log(`✅ Stop 2: ${stop2.name} (${stop2.id})\n`);

  // Find Round 4 in Stop 2
  const rounds = await prisma.round.findMany({
    where: { stopId: stop2.id },
    orderBy: { idx: 'asc' },
    select: { id: true, idx: true }
  });

  if (rounds.length < 4) {
    console.log('❌ Round 4 not found');
    return;
  }

  const round4 = rounds[3]; // Fourth round (index 3)
  console.log(`✅ Round 4: Round ${round4.idx + 1} (${round4.id})\n`);

  // Find the specific matches
  const matches = await prisma.match.findMany({
    where: { 
      roundId: round4.id,
      OR: [
        {
          teamA: { name: { contains: 'Real Pickleball Intermediate' } },
          teamB: { name: { contains: 'One Health Intermediate' } }
        },
        {
          teamA: { name: { contains: 'One Health Intermediate' } },
          teamB: { name: { contains: 'Real Pickleball Intermediate' } }
        },
        {
          teamA: { name: { contains: 'Real Pickleball Advanced' } },
          teamB: { name: { contains: 'One Health Advanced' } }
        },
        {
          teamA: { name: { contains: 'One Health Advanced' } },
          teamB: { name: { contains: 'Real Pickleball Advanced' } }
        }
      ]
    },
    include: {
      teamA: { select: { name: true } },
      teamB: { select: { name: true } },
      games: {
        select: { slot: true },
        orderBy: { slot: 'asc' }
      }
    }
  });

  console.log(`Found ${matches.length} matches to check:\n`);

  const expectedSlots = ['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_1', 'MIXED_2', 'TIEBREAKER'];

  for (const match of matches) {
    console.log(`=== ${match.teamA?.name} vs ${match.teamB?.name} ===`);
    console.log(`Match ID: ${match.id}`);
    
    const existingSlots = match.games.map(g => g.slot);
    const missingSlots = expectedSlots.filter(slot => !existingSlots.includes(slot));
    
    console.log(`Current games: ${existingSlots.join(', ')} (${existingSlots.length} total)`);
    console.log(`Missing games: ${missingSlots.length > 0 ? missingSlots.join(', ') : 'None'}`);
    
    if (missingSlots.length > 0) {
      console.log(`Creating ${missingSlots.length} missing games...`);
      
      const gamesToCreate = missingSlots.map(slot => ({
        matchId: match.id,
        slot,
        teamAScore: null,
        teamBScore: null,
        teamALineup: null,
        teamBLineup: null,
        lineupConfirmed: false,
        isComplete: false
      }));

      try {
        const result = await prisma.game.createMany({
          data: gamesToCreate,
          skipDuplicates: true
        });

        console.log(`✅ Created ${result.count} games`);
        
        // Verify
        const updatedGames = await prisma.game.findMany({
          where: { matchId: match.id },
          select: { slot: true },
          orderBy: { slot: 'asc' }
        });
        
        console.log(`Updated games: ${updatedGames.map(g => g.slot).join(', ')} (${updatedGames.length} total)`);
        
      } catch (error) {
        console.error(`❌ Error creating games:`, error);
      }
    } else {
      console.log('✅ All games already exist');
    }
    
    console.log('');
  }

  console.log('=== Summary ===');
  console.log('All matches in Round 4 should now have 5 games each.');
  console.log('Lineup selection should work for all matches.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
