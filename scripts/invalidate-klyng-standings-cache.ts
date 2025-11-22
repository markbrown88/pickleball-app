import { cacheKeys, deleteCache, isCacheAvailable } from '../src/lib/cache';

const TOURNAMENT_ID = 'cmh7qeb1t0000ju04udwe7w8w';

async function main() {
  if (!isCacheAvailable()) {
    console.log('Cache is not available; nothing to invalidate.');
    return;
  }

  const key = cacheKeys.tournamentStandings(TOURNAMENT_ID);
  await deleteCache(key);
  console.log(`Deleted cache key: ${key}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());

