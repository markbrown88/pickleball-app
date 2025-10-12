import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateJsonToLineupEntries() {
  try {
    console.log('Starting migration of JSON lineup data to LineupEntry records...\n');

    // Get all games with JSON lineup data, grouped by match
    const matches = await prisma.match.findMany({
      where: {
        games: {
          some: {
            OR: [
              { teamALineup: { not: Prisma.JsonNull } },
              { teamBLineup: { not: Prisma.JsonNull } }
            ]
          }
        }
      },
      include: {
        round: { select: { id: true, stopId: true, idx: true } },
        teamA: { select: { id: true, name: true } },
        teamB: { select: { id: true, name: true } },
        games: {
          where: {
            OR: [
              { teamALineup: { not: Prisma.JsonNull } },
              { teamBLineup: { not: Prisma.JsonNull } }
            ]
          },
          select: {
            id: true,
            slot: true,
            teamALineup: true,
            teamBLineup: true
          }
        }
      }
    });

    console.log(`Found ${matches.length} matches with JSON lineup data`);
    console.log(`Processing...

`);

    let processedMatches = 0;
    let createdLineups = 0;
    let createdEntries = 0;
    let skipped = 0;

    for (const match of matches) {
      if (!match.teamA || !match.teamB || !match.roundId) {
        console.log(`  ⚠️  Skipping match ${match.id} - missing teams or round`);
        skipped++;
        continue;
      }

      // Extract lineup data from games
      const teamAPlayers = new Map<string, { player1Id: string; player2Id: string }>();
      const teamBPlayers = new Map<string, { player1Id: string; player2Id: string }>();

      match.games.forEach(game => {
        if (game.teamALineup && Array.isArray(game.teamALineup) && game.teamALineup[0]) {
          const data = game.teamALineup[0] as any;
          if (data.player1Id && data.player2Id && game.slot) {
            teamAPlayers.set(game.slot, { player1Id: data.player1Id, player2Id: data.player2Id });
          }
        }

        if (game.teamBLineup && Array.isArray(game.teamBLineup) && game.teamBLineup[0]) {
          const data = game.teamBLineup[0] as any;
          if (data.player1Id && data.player2Id && game.slot) {
            teamBPlayers.set(game.slot, { player1Id: data.player1Id, player2Id: data.player2Id });
          }
        }
      });

      // Only migrate if we have all 4 slots for a team (complete lineup)
      const teamASlotsComplete = teamAPlayers.has('MENS_DOUBLES') &&
                                 teamAPlayers.has('WOMENS_DOUBLES') &&
                                 teamAPlayers.has('MIXED_1') &&
                                 teamAPlayers.has('MIXED_2');

      const teamBSlotsComplete = teamBPlayers.has('MENS_DOUBLES') &&
                                 teamBPlayers.has('WOMENS_DOUBLES') &&
                                 teamBPlayers.has('MIXED_1') &&
                                 teamBPlayers.has('MIXED_2');

      // Migrate Team A lineup
      if (teamASlotsComplete) {
        await prisma.$transaction(async (tx) => {
          // Check if lineup already exists
          const existing = await tx.lineup.findUnique({
            where: {
              roundId_teamId: {
                roundId: match.roundId,
                teamId: match.teamA!.id
              }
            }
          });

          let lineupId: string;

          if (existing) {
            // Delete existing entries and reuse lineup
            await tx.lineupEntry.deleteMany({
              where: { lineupId: existing.id }
            });
            lineupId = existing.id;
          } else {
            // Create new lineup
            const newLineup = await tx.lineup.create({
              data: {
                roundId: match.roundId,
                teamId: match.teamA!.id,
                stopId: match.round.stopId
              }
            });
            lineupId = newLineup.id;
            createdLineups++;
          }

          // Create entries for all 4 slots
          const entries = [
            { lineupId, slot: 'MENS_DOUBLES', ...teamAPlayers.get('MENS_DOUBLES')! },
            { lineupId, slot: 'WOMENS_DOUBLES', ...teamAPlayers.get('WOMENS_DOUBLES')! },
            { lineupId, slot: 'MIXED_1', ...teamAPlayers.get('MIXED_1')! },
            { lineupId, slot: 'MIXED_2', ...teamAPlayers.get('MIXED_2')! }
          ];

          await tx.lineupEntry.createMany({ data: entries });
          createdEntries += 4;
        });
      }

      // Migrate Team B lineup
      if (teamBSlotsComplete) {
        await prisma.$transaction(async (tx) => {
          // Check if lineup already exists
          const existing = await tx.lineup.findUnique({
            where: {
              roundId_teamId: {
                roundId: match.roundId,
                teamId: match.teamB!.id
              }
            }
          });

          let lineupId: string;

          if (existing) {
            // Delete existing entries and reuse lineup
            await tx.lineupEntry.deleteMany({
              where: { lineupId: existing.id }
            });
            lineupId = existing.id;
          } else {
            // Create new lineup
            const newLineup = await tx.lineup.create({
              data: {
                roundId: match.roundId,
                teamId: match.teamB!.id,
                stopId: match.round.stopId
              }
            });
            lineupId = newLineup.id;
            createdLineups++;
          }

          // Create entries for all 4 slots
          const entries = [
            { lineupId, slot: 'MENS_DOUBLES', ...teamBPlayers.get('MENS_DOUBLES')! },
            { lineupId, slot: 'WOMENS_DOUBLES', ...teamBPlayers.get('WOMENS_DOUBLES')! },
            { lineupId, slot: 'MIXED_1', ...teamBPlayers.get('MIXED_1')! },
            { lineupId, slot: 'MIXED_2', ...teamBPlayers.get('MIXED_2')! }
          ];

          await tx.lineupEntry.createMany({ data: entries });
          createdEntries += 4;
        });
      }

      processedMatches++;
      if (processedMatches % 10 === 0) {
        console.log(`  Processed ${processedMatches}/${matches.length} matches...`);
      }
    }

    console.log('\n✅ Migration complete!');
    console.log(`  Processed matches: ${processedMatches}`);
    console.log(`  Created lineups: ${createdLineups}`);
    console.log(`  Created lineup entries: ${createdEntries}`);
    console.log(`  Skipped: ${skipped}`);

    // Verify the migration
    console.log('\nVerifying migration...');
    const lineupCount = await prisma.lineup.count();
    const entryCount = await prisma.lineupEntry.count();
    console.log(`  Total Lineups in database: ${lineupCount}`);
    console.log(`  Total LineupEntries in database: ${entryCount}`);

  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateJsonToLineupEntries();
