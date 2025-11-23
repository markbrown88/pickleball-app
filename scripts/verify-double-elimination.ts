import { generateDoubleEliminationBracket } from '../src/lib/brackets/doubleElimination.ts';

const clubs = [
  { id: 'club-1', seed: 1, name: 'Club 1' },
  { id: 'club-2', seed: 2, name: 'Club 2' },
  { id: 'club-3', seed: 3, name: 'Club 3' },
  { id: 'club-4', seed: 4, name: 'Club 4' },
  { id: 'club-5', seed: 5, name: 'Club 5' },
  { id: 'club-6', seed: 6, name: 'Club 6' },
  { id: 'club-7', seed: 7, name: 'Club 7' },
];

const teams = clubs.map((club) => ({
  id: club.id,
  clubId: club.id,
  seed: club.seed,
  name: club.name,
  tournamentId: 'tournament-test',
}));

const bracket = generateDoubleEliminationBracket({
  tournamentId: 'tournament-test',
  stopId: 'stop-test',
  teams,
  gamesPerMatch: 3,
  gameSlots: ['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_1', 'MIXED_2'],
});

console.log('Winner Rounds:');
for (const round of bracket.rounds.filter((r) => r.bracketType === 'WINNER')) {
  console.log(`  Round ${round.idx} (${round.bracketType})`);
  for (const match of round.matches) {
    console.log(
      `    Match ${match.bracketPosition}: seedA=${match.seedA} seedB=${match.seedB} isBye=${match.isBye}`
    );
  }
}

console.log('\nLoser Rounds:');
for (const round of bracket.rounds.filter((r) => r.bracketType === 'LOSER')) {
  console.log(`  Round ${round.idx} (${round.bracketType})`);
  for (const match of round.matches) {
    console.log(
      `    Match ${match.bracketPosition}: isBye=${match.isBye} sourceA=${match.sourceMatchAId} sourceB=${match.sourceMatchBId}`
    );
  }
}

console.log('\nFinals Rounds:');
for (const round of bracket.rounds.filter((r) => r.bracketType === 'FINALS')) {
  console.log(`  Round ${round.idx} (${round.bracketType}) depth=${round.depth}`);
  for (const match of round.matches) {
    console.log(
      `    Match ${match.bracketPosition}: sourceA=${match.sourceMatchAId} sourceB=${match.sourceMatchBId}`
    );
  }
}

