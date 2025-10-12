const fetch = global.fetch;

async function main() {
  const token = 'vycxv';
  const stopId = 'cmftqlrha000crd1estw0n0a6';

  const stopRes = await fetch(`http://localhost:3010/api/captain-portal/${token}/stop/${stopId}`);
  const stopData = await stopRes.json();
  console.log('stop data', JSON.stringify(stopData, null, 2));

  const bracketId = stopData.brackets?.[0]?.id;
  if (!bracketId) return;

  const roundsRes = await fetch(`http://localhost:3010/api/captain-portal/${token}/stop/${stopId}/bracket/${bracketId}`);
  const roundsData = await roundsRes.json();
  console.log('rounds data', JSON.stringify(roundsData, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


