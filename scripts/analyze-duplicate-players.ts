import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function analyzeDuplicates() {
  try {
    console.log('Analyzing duplicate players and their participation...\n');
    console.log('='.repeat(100));

    // Get all players
    const allPlayers = await prisma.player.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        clubId: true,
        clerkUserId: true,
        createdAt: true,
      },
      orderBy: {
        firstName: 'asc',
      },
    });

    // Group by first name + last name combination
    const nameCombinations = new Map<string, typeof allPlayers>();
    
    for (const player of allPlayers) {
      const firstName = (player.firstName || '').trim().toLowerCase();
      const lastName = (player.lastName || '').trim().toLowerCase();
      const key = `${firstName}|${lastName}`;
      
      if (key !== '|') { // Ignore empty names
        if (!nameCombinations.has(key)) {
          nameCombinations.set(key, []);
        }
        nameCombinations.get(key)!.push(player);
      }
    }

    // Find duplicates
    const duplicates: Array<{ name: string; players: typeof allPlayers }> = [];
    
    nameCombinations.forEach((players, key) => {
      if (players.length > 1) {
        const [firstName, lastName] = key.split('|');
        duplicates.push({
          name: `${firstName} ${lastName}`,
          players,
        });
      }
    });

    // Get clubs for display
    const clubs = await prisma.club.findMany({
      select: { id: true, name: true },
    });
    const clubMap = new Map(clubs.map(c => [c.id, c.name]));

    console.log(`Found ${duplicates.length} duplicate name combination(s)\n`);

    // Check participation for each duplicate group
    for (const group of duplicates) {
      console.log('='.repeat(100));
      console.log(`${group.name.toUpperCase()} - ${group.players.length} duplicate(s)`);
      console.log('='.repeat(100));

      for (const player of group.players) {
        const clubName = player.clubId ? clubMap.get(player.clubId) || 'Unknown' : 'No club';
        const hasClerk = player.clerkUserId ? 'Yes' : 'No';
        
        console.log(`\nPlayer ID: ${player.id}`);
        console.log(`  Name: ${player.firstName || ''} ${player.lastName || ''}`.trim() || 'N/A');
        console.log(`  Email: ${player.email || 'No email'}`);
        console.log(`  Phone: ${player.phone || 'No phone'}`);
        console.log(`  Club: ${clubName}`);
        console.log(`  Has Clerk Account: ${hasClerk}`);
        console.log(`  Created: ${player.createdAt.toISOString().split('T')[0]}`);

        // Check roster entries (StopTeamPlayer)
        const rosterEntries = await prisma.stopTeamPlayer.findMany({
          where: { playerId: player.id },
          include: {
            stop: {
              include: {
                tournament: {
                  select: { name: true },
                },
                club: {
                  select: { name: true },
                },
              },
            },
            team: {
              include: {
                bracket: {
                  select: { name: true },
                },
                club: {
                  select: { name: true },
                },
              },
            },
          },
        });

        if (rosterEntries.length > 0) {
          console.log(`  📋 Roster Entries: ${rosterEntries.length}`);
          rosterEntries.forEach((entry, idx) => {
            console.log(`     ${idx + 1}. Tournament: ${entry.stop.tournament.name}`);
            console.log(`        Stop: ${entry.stop.name} (${entry.stop.club?.name || 'N/A'})`);
            console.log(`        Team: ${entry.team.name} (${entry.team.club.name})`);
            console.log(`        Bracket: ${entry.team.bracket.name}`);
          });
        } else {
          console.log(`  📋 Roster Entries: None`);
        }

        // Check lineups (player participation in matches via LineupEntry)
        const lineupEntries = await prisma.lineupEntry.findMany({
          where: {
            OR: [
              { player1Id: player.id },
              { player2Id: player.id },
            ],
          },
          include: {
            lineup: {
              include: {
                round: {
                  include: {
                    stop: {
                      include: {
                        tournament: {
                          select: { name: true },
                        },
                      },
                    },
                    matches: {
                      include: {
                        teamA: {
                          select: { name: true },
                        },
                        teamB: {
                          select: { name: true },
                        },
                      },
                    },
                  },
                },
                team: {
                  include: {
                    club: {
                      select: { name: true },
                    },
                  },
                },
              },
            },
          },
        });

        if (lineupEntries.length > 0) {
          console.log(`  🎾 Lineup Entries: ${lineupEntries.length}`);
          lineupEntries.forEach((entry, idx) => {
            const lineup = entry.lineup;
            const tournamentName = lineup.round.stop.tournament.name;
            const stopName = lineup.round.stop.name;
            const teamName = lineup.team.name;
            const isPlayer1 = entry.player1Id === player.id;
            const partnerId = isPlayer1 ? entry.player2Id : entry.player1Id;
            console.log(`     ${idx + 1}. Tournament: ${tournamentName}`);
            console.log(`        Stop: ${stopName}`);
            console.log(`        Team: ${teamName} (${lineup.team.club.name})`);
            console.log(`        Game Slot: ${entry.slot}`);
            console.log(`        Position: ${isPlayer1 ? 'Player 1' : 'Player 2'}`);
          });
        } else {
          console.log(`  🎾 Lineup Entries: None`);
        }

        // Check tournament registrations
        const registrations = await prisma.tournamentRegistration.findMany({
          where: { playerId: player.id },
          include: {
            tournament: {
              select: { name: true },
            },
          },
        });

        if (registrations.length > 0) {
          console.log(`  📝 Registrations: ${registrations.length}`);
          registrations.forEach((reg, idx) => {
            console.log(`     ${idx + 1}. Tournament: ${reg.tournament.name}`);
            console.log(`        Status: ${reg.status}`);
            console.log(`        Payment Status: ${reg.paymentStatus}`);
            console.log(`        Amount Paid: $${((reg.amountPaid || 0) / 100).toFixed(2)}`);
          });
        } else {
          console.log(`  📝 Registrations: None`);
        }

        // Check if player is a captain
        const captainRoles = await prisma.tournamentCaptain.findMany({
          where: { playerId: player.id },
          include: {
            tournament: {
              select: { name: true },
            },
          },
        });

        if (captainRoles.length > 0) {
          console.log(`  👑 Captain Roles: ${captainRoles.length}`);
          captainRoles.forEach((role, idx) => {
            console.log(`     ${idx + 1}. Tournament: ${role.tournament.name}`);
          });
        }

        // Check if player is a tournament admin
        const adminRoles = await prisma.tournamentAdmin.findMany({
          where: { playerId: player.id },
          include: {
            tournament: {
              select: { name: true },
            },
          },
        });

        if (adminRoles.length > 0) {
          console.log(`  🔧 Admin Roles: ${adminRoles.length}`);
          adminRoles.forEach((role, idx) => {
            console.log(`     ${idx + 1}. Tournament: ${role.tournament.name}`);
          });
        }

        console.log('');
      }
    }

    // Summary table
    console.log('\n' + '='.repeat(100));
    console.log('SUMMARY TABLE');
    console.log('='.repeat(100));
    console.log('\nDuplicate Name Combinations:\n');
    
    console.log('Name'.padEnd(30) + 'Player ID'.padEnd(30) + 'Email'.padEnd(40) + 'Roster'.padEnd(10) + 'Lineups'.padEnd(10) + 'Registrations');
    console.log('-'.repeat(150));

    for (const group of duplicates) {
      for (const player of group.players) {
        const rosterCount = await prisma.stopTeamPlayer.count({ where: { playerId: player.id } });
        const lineupCount = await prisma.lineupEntry.count({
          where: {
            OR: [
              { player1Id: player.id },
              { player2Id: player.id },
            ],
          },
        });
        const regCount = await prisma.tournamentRegistration.count({ where: { playerId: player.id } });
        
        const name = `${player.firstName || ''} ${player.lastName || ''}`.trim().substring(0, 28);
        const email = (player.email || 'No email').substring(0, 38);
        
        console.log(
          name.padEnd(30) +
          player.id.substring(0, 28).padEnd(30) +
          email.padEnd(40) +
          rosterCount.toString().padEnd(10) +
          lineupCount.toString().padEnd(10) +
          regCount.toString()
        );
      }
      console.log('-'.repeat(150));
    }

    console.log('\n' + '='.repeat(100));
    console.log('TOTAL SUMMARY');
    console.log('='.repeat(100));
    console.log(`Total duplicate groups: ${duplicates.length}`);
    console.log(`Total players in duplicate groups: ${duplicates.reduce((sum, g) => sum + g.players.length, 0)}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeDuplicates();

