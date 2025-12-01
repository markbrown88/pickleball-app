import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function fixWomensDoubles() {
  console.log(`\n${'='.repeat(80)}`);
  console.log('FIXING WOMENS_DOUBLES TO MATCH MIXED SWAP');
  console.log('Tournament: "KLYNG CUP - GRAND FINALE"');
  console.log('='.repeat(80));

  const tournament = await prisma.tournament.findFirst({
    where: { name: { equals: 'KLYNG CUP - GRAND FINALE' } },
    select: { id: true },
  });

  if (!tournament) return;

  const rounds = [0, 3, 4];
  const greenhillsTeam = await prisma.team.findFirst({
    where: {
      name: { contains: 'Greenhills Intermediate', mode: 'insensitive' },
      tournamentId: tournament.id,
    },
    select: { id: true },
  });

  if (!greenhillsTeam) return;

  for (const roundIdx of rounds) {
    const round = await prisma.round.findFirst({
      where: {
        stop: { tournamentId: tournament.id },
        idx: roundIdx,
      },
    });

    if (!round) continue;

    const lineup = await prisma.lineup.findFirst({
      where: {
        roundId: round.id,
        teamId: greenhillsTeam.id,
      },
      include: {
        entries: {
          include: {
            player1: { select: { name: true } },
            player2: { select: { name: true } },
          },
        },
      },
    });

    if (!lineup) continue;

    const womensDoubles = lineup.entries.find(e => e.slot === 'WOMENS_DOUBLES');
    const mixed1 = lineup.entries.find(e => e.slot === 'MIXED_1');
    const mixed2 = lineup.entries.find(e => e.slot === 'MIXED_2');
    const mensDoubles = lineup.entries.find(e => e.slot === 'MENS_DOUBLES');

    if (!womensDoubles || !mixed1 || !mixed2 || !mensDoubles) continue;

    console.log(`\nRound ${roundIdx}:`);
    console.log(`  MENS_DOUBLES: ${mensDoubles.player1?.name} & ${mensDoubles.player2?.name}`);
    console.log(`  WOMENS_DOUBLES (current): ${womensDoubles.player1?.name} & ${womensDoubles.player2?.name}`);
    console.log(`  MIXED_1: ${mixed1.player1?.name} & ${mixed1.player2?.name}`);
    console.log(`  MIXED_2: ${mixed2.player1?.name} & ${mixed2.player2?.name}`);

    // The system derives MIXED from: [Man1, Man2, Woman1, Woman2]
    // MIXED_1 = Man1 & Woman1, MIXED_2 = Man2 & Woman2
    // We want MIXED_1 = Man2 & Woman2, MIXED_2 = Man1 & Woman1
    
    // So we need to swap Man1/Man2 OR Woman1/Woman2
    // Since MIXED_1 should be Adam & Monica, and MIXED_2 should be Tyler & Sharon
    // And MENS_DOUBLES is Tyler & Adam
    // We need WOMENS_DOUBLES to be Monica & Sharon (not Sharon & Monica)
    // So that: [Tyler, Adam, Monica, Sharon]
    // MIXED_1 = Tyler & Monica (still wrong...)
    
    // Actually, we need to swap MENS_DOUBLES to Adam & Tyler
    // So that: [Adam, Tyler, Monica, Sharon]
    // MIXED_1 = Adam & Monica ✓
    // MIXED_2 = Tyler & Sharon ✓
    
    // OR swap WOMENS_DOUBLES to Monica & Sharon
    // So that: [Tyler, Adam, Monica, Sharon]
    // MIXED_1 = Tyler & Monica (wrong)
    
    // Let me check what the actual desired state is:
    // MIXED_1 should show: Adam & Monica
    // MIXED_2 should show: Tyler & Sharon
    
    // Current MENS: Tyler & Adam → [Tyler, Adam, ...]
    // Current WOMENS: Sharon & Monica → [..., Sharon, Monica]
    // Array: [Tyler, Adam, Sharon, Monica]
    // Derived MIXED_1: Tyler & Sharon (wrong, should be Adam & Monica)
    // Derived MIXED_2: Adam & Monica (wrong, should be Tyler & Sharon)
    
    // To get MIXED_1 = Adam & Monica, we need Man2 & Woman2
    // To get MIXED_2 = Tyler & Sharon, we need Man1 & Woman1
    // So we need: [Adam, Tyler, Monica, Sharon]
    // Which means: MENS = Adam & Tyler, WOMENS = Monica & Sharon
    
    const shouldSwapMens = roundIdx === 0 || roundIdx === 3;
    const shouldSwapWomens = roundIdx === 4;

    if (shouldSwapMens) {
      // Swap MENS_DOUBLES: Tyler & Adam → Adam & Tyler
      console.log(`  → Need to swap MENS_DOUBLES to: ${mensDoubles.player2?.name} & ${mensDoubles.player1?.name}`);
    } else if (shouldSwapWomens) {
      // Swap WOMENS_DOUBLES: Sharon & Monica → Monica & Sharon
      console.log(`  → Need to swap WOMENS_DOUBLES to: ${womensDoubles.player2?.name} & ${womensDoubles.player1?.name}`);
    }
  }
}

fixWomensDoubles()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

