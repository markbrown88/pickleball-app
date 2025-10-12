async function main() {
  const token = 'vycxv';
  const stopId = 'cmftqlrha000crd1estw0n0a6';
  const bracketId = 'cmftqn1hm000qr433bycfd7w8';
  const roundId = 'cmftqnwk1001wr433h20nvapx';

  const response = await (globalThis.fetch as typeof fetch)(`http://localhost:3010/api/captain-portal/${token}/stop/${stopId}/bracket/${bracketId}/round/${roundId}`);
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

