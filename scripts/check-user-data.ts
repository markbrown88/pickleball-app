import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function checkUserData() {
  try {
    const userId1 = 'cmiaj3qbv0001ld04r4dmcvuw';
    const userId2 = 'cmh822cep005jr0j4ro16a5e0';

    console.log('='.repeat(80));
    console.log('USER DATA COMPARISON');
    console.log('='.repeat(80));

    for (const userId of [userId1, userId2]) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`USER: ${userId}`);
      console.log('='.repeat(80));

      // Get basic user info
      const user = await prisma.player.findUnique({
        where: { id: userId },
        include: { club: true },
      });

      if (!user) {
        console.log(`❌ User not found\n`);
        continue;
      }

      console.log('\n--- BASIC INFO ---');
      console.log(`Name: ${user.firstName} ${user.lastName}`);
      console.log(`Email: ${user.email || 'N/A'}`);
      console.log(`Phone: ${user.phone || 'N/A'}`);
      console.log(`Gender: ${user.gender}`);
      console.log(`Club: ${user.club.name}`);
      console.log(`Created: ${user.createdAt}`);
      console.log(`Clerk User ID: ${user.clerkUserId || 'N/A'}`);

      // Check tournament registrations
      const registrations = await prisma.tournamentRegistration.findMany({
        where: { playerId: userId },
        include: {
          tournament: {
            select: { name: true, type: true },
          },
        },
        orderBy: { registeredAt: 'desc' },
      });

      console.log(`\n--- TOURNAMENT REGISTRATIONS (${registrations.length}) ---`);
      if (registrations.length === 0) {
        console.log('None');
      } else {
        for (const reg of registrations) {
          console.log(`  • ${reg.tournament.name}`);
          console.log(`    Status: ${reg.status}, Payment: ${reg.paymentStatus}`);
          console.log(`    Registered: ${reg.registeredAt.toISOString()}`);
          console.log(`    ID: ${reg.id}`);
        }
      }

      // Check roster entries (StopTeamPlayer)
      const rosterEntries = await prisma.stopTeamPlayer.findMany({
        where: { playerId: userId },
        include: {
          stop: {
            select: {
              name: true,
              tournament: { select: { name: true } },
            },
          },
          team: {
            select: { name: true },
          },
        },
      });

      console.log(`\n--- ROSTER ENTRIES (${rosterEntries.length}) ---`);
      if (rosterEntries.length === 0) {
        console.log('None');
      } else {
        for (const entry of rosterEntries) {
          console.log(`  • ${entry.stop.tournament.name} / ${entry.stop.name}`);
          console.log(`    Team: ${entry.team.name}`);
          console.log(`    Payment: ${entry.paymentMethod}`);
          console.log(`    Created: ${entry.createdAt.toISOString()}`);
        }
      }

      // Check team memberships (TeamPlayer)
      const teamMemberships = await prisma.teamPlayer.findMany({
        where: { playerId: userId },
        include: {
          team: {
            select: {
              name: true,
              tournament: { select: { name: true } },
            },
          },
        },
      });

      console.log(`\n--- TEAM MEMBERSHIPS (${teamMemberships.length}) ---`);
      if (teamMemberships.length === 0) {
        console.log('None');
      } else {
        for (const membership of teamMemberships) {
          console.log(`  • ${membership.team.tournament.name}`);
          console.log(`    Team: ${membership.team.name}`);
          console.log(`    Created: ${membership.createdAt.toISOString()}`);
        }
      }

      // Check teams they captain
      const captainedTeams = await prisma.team.findMany({
        where: { captainId: userId },
        include: {
          tournament: { select: { name: true } },
        },
      });

      console.log(`\n--- TEAMS AS CAPTAIN (${captainedTeams.length}) ---`);
      if (captainedTeams.length === 0) {
        console.log('None');
      } else {
        for (const team of captainedTeams) {
          console.log(`  • ${team.tournament.name}`);
          console.log(`    Team: ${team.name}`);
        }
      }

      // Check lineup entries as player 1
      const lineupEntriesP1 = await prisma.lineupEntry.findMany({
        where: { player1Id: userId },
        include: {
          lineup: {
            include: {
              team: { select: { name: true } },
              round: {
                include: {
                  stop: {
                    select: {
                      name: true,
                      tournament: { select: { name: true } },
                    },
                  },
                },
              },
            },
          },
          player2: { select: { firstName: true, lastName: true } },
        },
      });

      // Check lineup entries as player 2
      const lineupEntriesP2 = await prisma.lineupEntry.findMany({
        where: { player2Id: userId },
        include: {
          lineup: {
            include: {
              team: { select: { name: true } },
              round: {
                include: {
                  stop: {
                    select: {
                      name: true,
                      tournament: { select: { name: true } },
                    },
                  },
                },
              },
            },
          },
          player1: { select: { firstName: true, lastName: true } },
        },
      });

      const totalLineupEntries = lineupEntriesP1.length + lineupEntriesP2.length;
      console.log(`\n--- LINEUP ENTRIES (${totalLineupEntries}) ---`);
      if (totalLineupEntries === 0) {
        console.log('None');
      } else {
        console.log(`  As Player 1: ${lineupEntriesP1.length}`);
        console.log(`  As Player 2: ${lineupEntriesP2.length}`);

        // Show some examples
        const allEntries = [...lineupEntriesP1, ...lineupEntriesP2].slice(0, 5);
        if (allEntries.length > 0) {
          console.log('\n  Recent entries:');
          for (const entry of allEntries) {
            const partner = 'player2' in entry ? entry.player2 : entry.player1;
            console.log(`    • ${entry.lineup.round.stop.tournament.name} / ${entry.lineup.round.stop.name}`);
            console.log(`      Team: ${entry.lineup.team.name}, Slot: ${entry.slot}`);
            console.log(`      Partner: ${partner.firstName} ${partner.lastName}`);
          }
        }
      }

      // Check captain invites
      const captainInvites = await prisma.captainInvite.findMany({
        where: { captainId: userId },
        include: {
          tournament: { select: { name: true } },
          team: { select: { name: true } },
        },
      });

      console.log(`\n--- CAPTAIN INVITES (${captainInvites.length}) ---`);
      if (captainInvites.length === 0) {
        console.log('None');
      } else {
        for (const invite of captainInvites) {
          console.log(`  • ${invite.tournament.name} / ${invite.team.name}`);
          console.log(`    Status: ${invite.usedAt ? 'Used' : 'Pending'}`);
        }
      }

      // Check tournament admin roles
      const adminRoles = await prisma.tournamentAdmin.findMany({
        where: { playerId: userId },
        include: {
          tournament: { select: { name: true } },
        },
      });

      console.log(`\n--- TOURNAMENT ADMIN ROLES (${adminRoles.length}) ---`);
      if (adminRoles.length === 0) {
        console.log('None');
      } else {
        for (const role of adminRoles) {
          console.log(`  • ${role.tournament.name}`);
        }
      }

      // Check tournament captain roles
      const captainRoles = await prisma.tournamentCaptain.findMany({
        where: { playerId: userId },
        include: {
          tournament: { select: { name: true } },
          club: { select: { name: true } },
        },
      });

      console.log(`\n--- TOURNAMENT CAPTAIN ROLES (${captainRoles.length}) ---`);
      if (captainRoles.length === 0) {
        console.log('None');
      } else {
        for (const role of captainRoles) {
          console.log(`  • ${role.tournament.name} (${role.club.name})`);
        }
      }
    }

    // Summary comparison
    console.log(`\n${'='.repeat(80)}`);
    console.log('SUMMARY');
    console.log('='.repeat(80));

    const [user1, user2] = await Promise.all([
      prisma.player.findUnique({ where: { id: userId1 } }),
      prisma.player.findUnique({ where: { id: userId2 } }),
    ]);

    if (user1 && user2) {
      console.log('\nPotential duplicate indicators:');

      const matches: string[] = [];
      const diffs: string[] = [];

      if (user1.firstName?.toLowerCase() === user2.firstName?.toLowerCase()) matches.push('First name');
      else diffs.push('First name');

      if (user1.lastName?.toLowerCase() === user2.lastName?.toLowerCase()) matches.push('Last name');
      else diffs.push('Last name');

      if (user1.email?.toLowerCase() === user2.email?.toLowerCase()) matches.push('Email');
      else diffs.push('Email');

      if (user1.phone === user2.phone && user1.phone) matches.push('Phone');
      else if (user1.phone || user2.phone) diffs.push('Phone');

      console.log(`\nMatches: ${matches.join(', ') || 'None'}`);
      console.log(`Differences: ${diffs.join(', ') || 'None'}`);

      if (matches.length >= 2) {
        console.log('\n🔴 LIKELY DUPLICATES - Consider merging these accounts');
      } else if (matches.length === 1) {
        console.log('\n🟡 POSSIBLE DUPLICATES - Review manually');
      } else {
        console.log('\n🟢 LIKELY DIFFERENT USERS');
      }
    }

  } finally {
    await prisma.$disconnect();
  }
}

checkUserData();
