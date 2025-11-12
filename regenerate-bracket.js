/**
 * Regenerate Bracket Script
 *
 * This script regenerates the double elimination bracket with the corrected loser bracket structure.
 * Use this after fixing the loser bracket formula to get 5 loser rounds instead of 2.
 *
 * Usage:
 *   node regenerate-bracket.js <tournamentId> <stopId>
 *
 * Example:
 *   node regenerate-bracket.js cm123abc cm456def
 */

async function regenerateBracket(tournamentId, stopId) {
  const baseUrl = 'http://localhost:3000';

  console.log('\n🔄 Regenerating bracket...');
  console.log(`📋 Tournament ID: ${tournamentId}`);
  console.log(`📍 Stop ID: ${stopId || '(will use default)'}\n`);

  try {
    // Step 1: Get tournament details
    console.log('1️⃣  Fetching tournament details...');
    const tournamentRes = await fetch(`${baseUrl}/api/admin/tournaments/${tournamentId}`);

    if (!tournamentRes.ok) {
      throw new Error(`Failed to fetch tournament: ${tournamentRes.status}`);
    }

    const tournament = await tournamentRes.json();
    console.log(`   ✅ Found tournament: ${tournament.name || 'Unknown'}`);
    console.log(`   📊 Type: ${tournament.type}`);

    // Step 2: Get clubs with their seeding
    console.log('\n2️⃣  Fetching clubs...');
    const clubsRes = await fetch(`${baseUrl}/api/admin/clubs?tournamentId=${tournamentId}`);

    if (!clubsRes.ok) {
      throw new Error(`Failed to fetch clubs: ${clubsRes.status}`);
    }

    const clubs = await clubsRes.json();
    console.log(`   ✅ Found ${clubs.length} clubs`);

    // Get current seeding from roster
    const rosterRes = await fetch(`${baseUrl}/api/admin/rosters/${tournamentId}`);
    if (!rosterRes.ok) {
      throw new Error(`Failed to fetch roster: ${rosterRes.status}`);
    }

    const roster = await rosterRes.json();
    console.log(`   ✅ Roster has ${roster.clubs?.length || 0} clubs with seeding`);

    // Use roster clubs if available, otherwise use clubs with default seeding
    const clubsWithSeeding = roster.clubs?.length > 0
      ? roster.clubs
      : clubs.map((club, idx) => ({ id: club.id, seed: idx + 1, name: club.name }));

    clubsWithSeeding.sort((a, b) => a.seed - b.seed);

    console.log('\n   📋 Club seeding:');
    clubsWithSeeding.forEach(club => {
      console.log(`      ${club.seed}. ${club.name || club.id}`);
    });

    // Step 3: Regenerate bracket
    console.log('\n3️⃣  Regenerating bracket...');
    console.log('   ⚠️  This will DELETE all existing matches and rounds!');

    const generateRes = await fetch(`${baseUrl}/api/admin/tournaments/${tournamentId}/generate-bracket`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        stopId: stopId || undefined,
        clubs: clubsWithSeeding,
        gamesPerMatch: tournament.gamesPerMatch || 3,
      }),
    });

    if (!generateRes.ok) {
      const errorData = await generateRes.json().catch(() => ({}));
      throw new Error(`Failed to generate bracket: ${generateRes.status}\n${JSON.stringify(errorData, null, 2)}`);
    }

    const result = await generateRes.json();
    console.log('\n   ✅ Bracket regenerated successfully!\n');
    console.log(`   📊 Bracket Info:`);
    console.log(`      • Stop ID: ${result.stopId}`);
    console.log(`      • Rounds Created: ${result.roundsCreated}`);
    console.log(`      • Total Matches: ${result.totalMatches}`);
    console.log(`      • Teams: ${result.bracketInfo.teamCount}`);
    console.log(`      • Total Rounds: ${result.bracketInfo.roundCount}`);

    // Calculate expected loser rounds
    const winnerRounds = Math.ceil(Math.log2(result.bracketInfo.teamCount));
    const loserRounds = 2 * (winnerRounds - 1);
    console.log(`\n   📐 Expected Structure:`);
    console.log(`      • Winner Rounds: ${winnerRounds}`);
    console.log(`      • Loser Rounds: ${loserRounds} (FORMULA: 2×(${winnerRounds}-1))`);
    console.log(`      • Finals: 1`);
    console.log(`      • Total: ${winnerRounds + loserRounds + 1}`);

    console.log('\n✅ DONE! Bracket has been regenerated with correct loser bracket structure.\n');
    console.log('🔗 View it at:');
    console.log(`   ${baseUrl}/manager?tournamentId=${tournamentId}&stopId=${result.stopId}\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 1) {
  console.error('\n❌ Usage: node regenerate-bracket.js <tournamentId> [stopId]\n');
  console.error('Example: node regenerate-bracket.js cm123abc cm456def\n');
  process.exit(1);
}

const [tournamentId, stopId] = args;

regenerateBracket(tournamentId, stopId);
