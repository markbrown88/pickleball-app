const fetch = global.fetch;

async function main() {
  const token = 'vycxv';
  const stopId = 'cmftqlrha000crd1estw0n0a6';
  const bracketId = 'cmftqlr4p0004rd1es02r5rmo';
  const roundId = 'cmgfnr3xd000br0as15y59e1s';
  const matchId = 'cmgfnr3z9000gr0asfxhbiiq3';

  const payload = {
    lineups: {
      [matchId]: {
        'cmftqlrqb000mrd1ehlf4r2ql': [
          { id: 'player1A', gender: 'MALE', name: 'Player 1A' },
          { id: 'player2A', gender: 'MALE', name: 'Player 2A' },
          { id: 'player3A', gender: 'FEMALE', name: 'Player 3A' },
          { id: 'player4A', gender: 'FEMALE', name: 'Player 4A' }
        ],
        'cmftqnlsu000rrd1et3mt3g2d': [
          { id: 'player1B', gender: 'MALE', name: 'Player 1B' },
          { id: 'player2B', gender: 'MALE', name: 'Player 2B' },
          { id: 'player3B', gender: 'FEMALE', name: 'Player 3B' },
          { id: 'player4B', gender: 'FEMALE', name: 'Player 4B' }
        ]
      }
    }
  };

  const response = await fetch(`http://localhost:3010/api/admin/stops/${stopId}/lineups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  try {
    const data = JSON.parse(text);
    console.log('Response', response.status, data);
  } catch (err) {
    console.log('Response', response.status, text);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

