const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function searchDuplicates() {
  try {
    console.log('🔍 Searching for duplicate matchups across all tournaments...\n');

    // Get all tournaments
    const tournaments = await prisma.tournament.findMany({
      select: { id: true, name: true }
    });

    console.log(`Found ${tournaments.length} tournaments:\n`);

    for (const tournament of tournaments) {
      console.log(`📊 TOURNAMENT: ${tournament.name} (${tournament.id})\n`);

      // Get all stops for this tournament
      const stops = await prisma.stop.findMany({
        where: { tournamentId: tournament.id },
        select: { id: true, name: true }
      });

      for (const stop of stops) {
        console.log(`📍 STOP: ${stop.name} (${stop.id})\n`);

        // Get all matches in this stop
        const matches = await prisma.match.findMany({
          where: {
            round: {
              stopId: stop.id
            }
          },
          include: {
            teamA: { select: { id: true, name: true } },
            teamB: { select: { id: true, name: true } },
            round: { select: { idx: true } }
          },
          orderBy: [
            { round: { idx: 'asc' } },
            { id: 'asc' }
          ]
        });

        console.log(`   Found ${matches.length} matches\n`);

        // Check for duplicates within this stop
        const teamPairings = new Map();

        matches.forEach(match => {
          if (match.isBye || !match.teamA || !match.teamB) return;

          // Create a consistent key for the team pairing (alphabetically sorted)
          const teamAId = match.teamA.id;
          const teamBId = match.teamB.id;
          const pairingKey = teamAId < teamBId ? `${teamAId}-${teamBId}` : `${teamBId}-${teamAId}`;
          
          if (!teamPairings.has(pairingKey)) {
            teamPairings.set(pairingKey, { count: 0, matches: [] });
          }
          
          const pairing = teamPairings.get(pairingKey);
          pairing.count++;
          pairing.matches.push(match);
        });

        // Check for duplicates
        const duplicates = [];
        teamPairings.forEach((pairing, pairingKey) => {
          if (pairing.count > 1) {
            const [teamAId, teamBId] = pairingKey.split('-');
            const firstMatch = pairing.matches[0];
            const teamAName = firstMatch.teamA.id === teamAId ? firstMatch.teamA.name : firstMatch.teamB.name;
            const teamBName = firstMatch.teamA.id === teamBId ? firstMatch.teamA.name : firstMatch.teamB.name;
            
            duplicates.push({
              teamAName,
              teamBName,
              count: pairing.count,
              matches: pairing.matches.map(m => ({
                id: m.id,
                round: m.round.idx,
                teamA: m.teamA.name,
                teamB: m.teamB.name
              }))
            });
          }
        });

        if (duplicates.length > 0) {
          console.log(`   🚨 FOUND ${duplicates.length} DUPLICATE(S):\n`);
          duplicates.forEach((dup, index) => {
            console.log(`   ${index + 1}. ${dup.teamAName} vs ${dup.teamBName} (${dup.count} times)`);
            dup.matches.forEach((match, matchIndex) => {
              console.log(`      Round ${match.round}: ${match.teamA} vs ${match.teamB} (ID: ${match.id})`);
            });
            console.log('');
          });
        } else {
          console.log(`   ✅ No duplicates found\n`);
        }

        console.log('   ' + '='.repeat(60) + '\n');
      }
    }

    console.log('🎯 SEARCH COMPLETE');

  } catch (error) {
    console.error('❌ Error searching for duplicates:', error);
  } finally {
    await prisma.$disconnect();
  }
}

searchDuplicates();
