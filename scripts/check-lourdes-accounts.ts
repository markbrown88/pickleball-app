import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function checkLourdesAccounts() {
  try {
    console.log(`\n=== Checking Lourdes Villamor Accounts ===\n`);

    const player1Id = 'cmi3lhkv40001js04g834lent'; // lourdesvillamor@gmail.com
    const player2Id = 'cmi6sdzn4000pjv04e3dl0ah4'; // lourdesevillamor@gmail.com

    async function checkPlayer(playerId: string, label: string) {
      console.log(`\n📋 ${label} (${playerId}):\n`);

      // Get player info
      const player = await prisma.player.findUnique({
        where: { id: playerId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          name: true,
          email: true,
          clerkUserId: true,
          clubId: true,
          club: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!player) {
        console.log(`   ❌ Player not found`);
        return;
      }

      console.log(`   Name: ${player.name || `${player.firstName} ${player.lastName}`}`);
      console.log(`   Email: ${player.email || 'None'}`);
      console.log(`   Clerk User ID: ${player.clerkUserId || 'None'}`);
      console.log(`   Club: ${player.club?.name || 'None'}`);

      // Check roster entries
      const rosterEntries = await prisma.stopTeamPlayer.findMany({
        where: { playerId },
        include: {
          stop: {
            select: {
              id: true,
              name: true,
              tournament: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          team: {
            select: {
              id: true,
              name: true,
              bracket: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });
      console.log(`\n   📋 Roster Entries: ${rosterEntries.length}`);
      if (rosterEntries.length > 0) {
        rosterEntries.forEach((entry, idx) => {
          console.log(`      ${idx + 1}. ${entry.stop.tournament.name} - ${entry.stop.name} - ${entry.team.bracket.name} - ${entry.team.name}`);
        });
      }

      // Check lineup entries (as player1)
      const lineupEntriesP1 = await prisma.lineupEntry.findMany({
        where: { player1Id: playerId },
        select: {
          id: true,
          lineupId: true,
          slot: true,
        },
      });

      // Check lineup entries (as player2)
      const lineupEntriesP2 = await prisma.lineupEntry.findMany({
        where: { player2Id: playerId },
        select: {
          id: true,
          lineupId: true,
          slot: true,
        },
      });

      // Get unique lineup IDs
      const lineupIds = new Set<string>();
      [...lineupEntriesP1, ...lineupEntriesP2].forEach(entry => {
        lineupIds.add(entry.lineupId);
      });

      // Get lineups and their rounds/stops
      const lineups = lineupIds.size > 0 ? await prisma.lineup.findMany({
        where: { id: { in: Array.from(lineupIds) } },
        include: {
          round: {
            include: {
              stop: {
                select: {
                  id: true,
                  name: true,
                  tournament: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      }) : [];

      console.log(`\n   🎯 Lineup Entries as Player1: ${lineupEntriesP1.length}`);
      console.log(`   🎯 Lineup Entries as Player2: ${lineupEntriesP2.length}`);
      if (lineups.length > 0) {
        const uniqueStops = new Set<string>();
        lineups.forEach((lineup) => {
          const stopKey = `${lineup.round.stop.tournament.name} - ${lineup.round.stop.name}`;
          if (!uniqueStops.has(stopKey)) {
            uniqueStops.add(stopKey);
            console.log(`      - ${stopKey} (${lineupIds.size} lineups)`);
          }
        });
      }

      // Check registrations
      const registrations = await prisma.tournamentRegistration.findMany({
        where: { playerId },
        include: {
          tournament: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      console.log(`\n   📝 Registrations: ${registrations.length}`);
      if (registrations.length > 0) {
        registrations.forEach((reg, idx) => {
          console.log(`      ${idx + 1}. ${reg.tournament.name} - Status: ${reg.status} - Amount: $${reg.amountPaidInCents ? (reg.amountPaidInCents / 100).toFixed(2) : '0.00'}`);
        });
      }

      // Check team memberships
      const teamMemberships = await prisma.teamPlayer.findMany({
        where: { playerId },
        include: {
          team: {
            select: {
              id: true,
              name: true,
              tournament: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });
      console.log(`\n   👥 Team Memberships: ${teamMemberships.length}`);
      if (teamMemberships.length > 0) {
        teamMemberships.forEach((membership, idx) => {
          console.log(`      ${idx + 1}. ${membership.team.tournament.name} - ${membership.team.name}`);
        });
      }

      // Get matches from lineups
      const matchIds = new Set<string>();
      lineups.forEach((lineup) => {
        // Lineup has roundId, need to get matches from round
      });

      // Get matches from rounds that have lineups with this player
      const roundIds = new Set<string>();
      lineups.forEach((lineup) => {
        roundIds.add(lineup.roundId);
      });

      let gamesCount = 0;
      let completedGamesCount = 0;
      if (roundIds.size > 0) {
        const matches = await prisma.match.findMany({
          where: {
            roundId: { in: Array.from(roundIds) },
          },
          include: {
            games: {
              select: {
                id: true,
                isComplete: true,
              },
            },
          },
        });

        matches.forEach((match) => {
          gamesCount += match.games.length;
          completedGamesCount += match.games.filter(g => g.isComplete).length;
        });
      }

      console.log(`\n   🎮 Games in Matches: ${gamesCount}`);
      console.log(`      Completed: ${completedGamesCount}`);

      return {
        rosterEntries: rosterEntries.length,
        lineupEntries: lineupEntriesP1.length + lineupEntriesP2.length,
        registrations: registrations.length,
        teamMemberships: teamMemberships.length,
        matches: lineupIds.size,
        games: gamesCount,
      };
    }

    const player1Stats = await checkPlayer(player1Id, 'Player 1: lourdesvillamor@gmail.com');
    const player2Stats = await checkPlayer(player2Id, 'Player 2: lourdesevillamor@gmail.com');

    console.log(`\n\n📊 COMPARISON SUMMARY:\n`);
    console.log(`Player 1 (lourdesvillamor@gmail.com):`);
    console.log(`   Roster Entries: ${player1Stats?.rosterEntries || 0}`);
    console.log(`   Lineup Entries: ${player1Stats?.lineupEntries || 0}`);
    console.log(`   Registrations: ${player1Stats?.registrations || 0}`);
    console.log(`   Team Memberships: ${player1Stats?.teamMemberships || 0}`);
    console.log(`   Matches: ${player1Stats?.matches || 0}`);
    console.log(`   Games: ${player1Stats?.games || 0}`);

    console.log(`\nPlayer 2 (lourdesevillamor@gmail.com):`);
    console.log(`   Roster Entries: ${player2Stats?.rosterEntries || 0}`);
    console.log(`   Lineup Entries: ${player2Stats?.lineupEntries || 0}`);
    console.log(`   Registrations: ${player2Stats?.registrations || 0}`);
    console.log(`   Team Memberships: ${player2Stats?.teamMemberships || 0}`);
    console.log(`   Matches: ${player2Stats?.matches || 0}`);
    console.log(`   Games: ${player2Stats?.games || 0}`);

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkLourdesAccounts();

