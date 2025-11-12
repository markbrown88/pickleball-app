const fetch = require('node-fetch');

async function completeLoserRound0() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  console.log('=== Completing L Round 0 Matches ===\n');

  // Match 1: Pickering BYE (cmhsho53)
  console.log('1. Completing Pickering BYE match (cmhsho53)...');
  try {
    const res1 = await fetch(`${API_URL}/api/admin/matches/cmhsho53/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const result1 = await res1.json();
    console.log('   Result:', result1);
  } catch (error) {
    console.error('   Error:', error.message);
  }

  console.log();

  // Match 2: Vaughn vs Promenade (cmhsho55)
  console.log('2. Completing Vaughn vs Promenade match (cmhsho55)...');
  try {
    const res2 = await fetch(`${API_URL}/api/admin/matches/cmhsho55/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const result2 = await res2.json();
    console.log('   Result:', result2);
  } catch (error) {
    console.error('   Error:', error.message);
  }

  console.log('\n✅ Done');
}

completeLoserRound0();
