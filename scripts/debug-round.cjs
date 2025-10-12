const fetch = global.fetch;

async function main() {
  const token = 'vycxv';
  const stopId = 'cmftqlrha000crd1estw0n0a6';
  const bracketId = 'cmftqlr4p0004rd1es02r5rmo';
  const roundId = 'cmgfnr3xd000br0as15y59e1s';

  const response = await fetch(
    `http://localhost:3010/api/captain-portal/${token}/stop/${stopId}/bracket/${bracketId}/round/${roundId}`
  );
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});


