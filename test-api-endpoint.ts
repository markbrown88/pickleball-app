async function testAPIEndpoint() {
  try {
    // Test the actual API endpoint
    const response = await fetch('http://localhost:3000/api/admin/stops/cmftqlrha000crd1estw0n0a6/lineups');
    
    if (!response.ok) {
      console.log('API call failed:', response.status, response.statusText);
      return;
    }
    
    const data = await response.json();
    console.log('API Response:', JSON.stringify(data, null, 2));
    
    // Check the specific match
    const matchId = 'cmgfnr3z9000er0asu37azak6'; // Pickleplex Barrie 2.5 vs Pickleplex Promenade 2.5
    if (data[matchId]) {
      console.log(`\nMatch ${matchId} lineup data:`);
      Object.keys(data[matchId]).forEach(teamId => {
        const lineup = data[matchId][teamId];
        console.log(`Team ${teamId}:`, lineup.map((p: any) => `${p.name} (${p.gender})`));
        console.log(`Team ${teamId} length:`, lineup.length);
      });
    } else {
      console.log(`\nMatch ${matchId} not found in API response`);
      console.log('Available matches:', Object.keys(data));
    }
    
  } catch (error) {
    console.error('Error testing API endpoint:', error);
  }
}

testAPIEndpoint();
