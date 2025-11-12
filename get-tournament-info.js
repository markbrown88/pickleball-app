/**
 * Get Tournament Info Script
 *
 * This script helps you find the tournament ID and stop ID for regenerating brackets.
 *
 * Usage:
 *   node get-tournament-info.js [search-term]
 *
 * Examples:
 *   node get-tournament-info.js
 *   node get-tournament-info.js "DE Clubs"
 *   node get-tournament-info.js "Klyng"
 */

async function getTournamentInfo(searchTerm = '') {
  const baseUrl = 'http://localhost:3000';

  console.log('\n🔍 Finding tournaments...\n');

  try {
    // Fetch all tournaments
    const tournamentsRes = await fetch(`${baseUrl}/api/admin/tournaments`);

    if (!tournamentsRes.ok) {
      throw new Error(`Failed to fetch tournaments: ${tournamentsRes.status}`);
    }

    let tournaments = await tournamentsRes.json();

    // Filter by search term if provided
    if (searchTerm) {
      tournaments = tournaments.filter(t =>
        t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      console.log(`📋 Found ${tournaments.length} tournament(s) matching "${searchTerm}":\n`);
    } else {
      console.log(`📋 Found ${tournaments.length} tournament(s):\n`);
    }

    if (tournaments.length === 0) {
      console.log('   No tournaments found.\n');
      return;
    }

    // Display tournaments
    for (const tournament of tournaments) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📊 ${tournament.name || 'Unnamed Tournament'}`);
      console.log(`   ID: ${tournament.id}`);
      console.log(`   Type: ${tournament.type}`);
      console.log(`   Games Per Match: ${tournament.gamesPerMatch || 'Not set'}`);

      // Get stops for this tournament
      const stopsRes = await fetch(`${baseUrl}/api/admin/stops?tournamentId=${tournament.id}`);
      if (stopsRes.ok) {
        const stops = await stopsRes.json();
        console.log(`\n   📍 Stops (${stops.length}):`);

        if (stops.length === 0) {
          console.log(`      (No stops yet - one will be created on bracket generation)`);
        } else {
          for (const stop of stops) {
            console.log(`      • ${stop.name || 'Unnamed Stop'}`);
            console.log(`        ID: ${stop.id}`);

            // Check how many rounds this stop has
            const roundsRes = await fetch(`${baseUrl}/api/admin/rounds?stopId=${stop.id}`);
            if (roundsRes.ok) {
              const rounds = await roundsRes.json();
              const winnerRounds = rounds.filter(r => r.bracketType === 'WINNER');
              const loserRounds = rounds.filter(r => r.bracketType === 'LOSER');
              const finalsRounds = rounds.filter(r => r.bracketType === 'FINALS');

              if (rounds.length > 0) {
                console.log(`        Rounds: ${winnerRounds.length} winner, ${loserRounds.length} loser, ${finalsRounds.length} finals`);

                // Check if loser rounds match expected
                if (winnerRounds.length > 0) {
                  const expectedLoserRounds = 2 * winnerRounds.length - 1;
                  if (loserRounds.length !== expectedLoserRounds) {
                    console.log(`        ⚠️  INCORRECT: Should have ${expectedLoserRounds} loser rounds, has ${loserRounds.length}`);
                    console.log(`        💡 Run: node regenerate-bracket.js ${tournament.id} ${stop.id}`);
                  } else {
                    console.log(`        ✅ Loser bracket structure is correct`);
                  }
                }
              } else {
                console.log(`        (No bracket generated yet)`);
              }
            }
          }
        }
      }

      // Get clubs/teams count
      if (tournament.type === 'DOUBLE_ELIMINATION_CLUBS') {
        const clubsRes = await fetch(`${baseUrl}/api/admin/clubs?tournamentId=${tournament.id}`);
        if (clubsRes.ok) {
          const clubs = await clubsRes.json();
          console.log(`\n   🏢 Clubs: ${clubs.length}`);
        }
      }

      console.log('');
    }

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // If there's exactly one tournament with incorrect loser bracket, show regeneration command
    const incorrectTournaments = [];
    for (const tournament of tournaments) {
      const stopsRes = await fetch(`${baseUrl}/api/admin/stops?tournamentId=${tournament.id}`);
      if (stopsRes.ok) {
        const stops = await stopsRes.json();
        for (const stop of stops) {
          const roundsRes = await fetch(`${baseUrl}/api/admin/rounds?stopId=${stop.id}`);
          if (roundsRes.ok) {
            const rounds = await roundsRes.json();
            const winnerRounds = rounds.filter(r => r.bracketType === 'WINNER');
            const loserRounds = rounds.filter(r => r.bracketType === 'LOSER');

            if (winnerRounds.length > 0) {
              const expectedLoserRounds = 2 * winnerRounds.length - 1;
              if (loserRounds.length !== expectedLoserRounds) {
                incorrectTournaments.push({ tournament, stop });
              }
            }
          }
        }
      }
    }

    if (incorrectTournaments.length > 0) {
      console.log('⚠️  Tournaments with INCORRECT loser bracket structure:\n');
      incorrectTournaments.forEach(({ tournament, stop }) => {
        console.log(`   ${tournament.name || tournament.id}`);
        console.log(`   Command: node regenerate-bracket.js ${tournament.id} ${stop.id}\n`);
      });
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Parse command line arguments
const searchTerm = process.argv.slice(2).join(' ');

getTournamentInfo(searchTerm);
