import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function mergeLouise() {
  const keepUserId = 'cmi9hj7en0027kz04dz4bgxa2'; // Gmail account (newer, has data)
  const deleteUserId = 'cmh822awy004dr0j4ra8eyomn'; // Manual account (older, minimal data)

  console.log('='.repeat(80));
  console.log('MERGING LOUISE KWONG ACCOUNTS');
  console.log('='.repeat(80));
  console.log(`\nKeeping: ${keepUserId} (louisewkwong@gmail.com - has registration & data)`);
  console.log(`Deleting: ${deleteUserId} (manual account - only has Vaughn roster)`);
  console.log('');

  try {
    await prisma.$transaction(async (tx) => {
      // Get user info for logging
      const [keepUser, deleteUser] = await Promise.all([
        tx.player.findUnique({ where: { id: keepUserId } }),
        tx.player.findUnique({ where: { id: deleteUserId } }),
      ]);

      if (!keepUser || !deleteUser) {
        throw new Error('One or both users not found');
      }

      console.log(`Keep: ${keepUser.firstName} ${keepUser.lastName} (${keepUser.email})`);
      console.log(`Delete: ${deleteUser.firstName} ${deleteUser.lastName} (${deleteUser.email || 'No email'})`);

      // STEP 1: Transfer lineup entries (if any)
      console.log('\n--- STEP 1: Transfer Lineup Entries ---');

      const lineupEntriesP1 = await tx.lineupEntry.findMany({
        where: { player1Id: deleteUserId },
      });

      const lineupEntriesP2 = await tx.lineupEntry.findMany({
        where: { player2Id: deleteUserId },
      });

      console.log(`Found ${lineupEntriesP1.length} lineup entries where manual account is Player 1`);
      console.log(`Found ${lineupEntriesP2.length} lineup entries where manual account is Player 2`);

      // Update player1Id references
      if (lineupEntriesP1.length > 0) {
        const result = await tx.lineupEntry.updateMany({
          where: { player1Id: deleteUserId },
          data: { player1Id: keepUserId },
        });
        console.log(`✅ Updated ${result.count} lineup entries (player1Id)`);
      }

      // Update player2Id references
      if (lineupEntriesP2.length > 0) {
        const result = await tx.lineupEntry.updateMany({
          where: { player2Id: deleteUserId },
          data: { player2Id: keepUserId },
        });
        console.log(`✅ Updated ${result.count} lineup entries (player2Id)`);
      }

      if (lineupEntriesP1.length === 0 && lineupEntriesP2.length === 0) {
        console.log('No lineup entries to transfer');
      }

      // STEP 2: Transfer roster entries
      console.log('\n--- STEP 2: Transfer Roster Entries ---');

      const rosterEntries = await tx.stopTeamPlayer.findMany({
        where: { playerId: deleteUserId },
        include: {
          stop: { select: { name: true } },
        },
      });

      console.log(`Found ${rosterEntries.length} roster entries for manual account`);

      for (const entry of rosterEntries) {
        // Check if gmail account already has a roster entry for this stop/team
        const existingEntry = await tx.stopTeamPlayer.findUnique({
          where: {
            stopId_teamId_playerId: {
              stopId: entry.stopId,
              teamId: entry.teamId,
              playerId: keepUserId,
            },
          },
        });

        if (existingEntry) {
          // Gmail account already has this roster entry
          // Keep the one with better payment status (STRIPE > MANUAL > UNPAID)
          const manualPayment = entry.paymentMethod;
          const gmailPayment = existingEntry.paymentMethod;

          const paymentPriority = { STRIPE: 3, MANUAL: 2, UNPAID: 1 };
          const manualPriority = paymentPriority[manualPayment] || 0;
          const gmailPriority = paymentPriority[gmailPayment] || 0;

          if (manualPriority > gmailPriority) {
            // Manual account's entry is better, update gmail's
            await tx.stopTeamPlayer.update({
              where: {
                stopId_teamId_playerId: {
                  stopId: entry.stopId,
                  teamId: entry.teamId,
                  playerId: keepUserId,
                },
              },
              data: {
                paymentMethod: entry.paymentMethod,
              },
            });
            console.log(`  ✅ Updated roster entry for stop ${entry.stop.name} (kept ${manualPayment} payment)`);
          } else {
            console.log(`  ℹ️  Gmail account already has roster entry for stop ${entry.stop.name} (kept ${gmailPayment} payment)`);
          }

          // Delete manual account's duplicate entry
          await tx.stopTeamPlayer.delete({
            where: {
              stopId_teamId_playerId: {
                stopId: entry.stopId,
                teamId: entry.teamId,
                playerId: deleteUserId,
              },
            },
          });
        } else {
          // Gmail account doesn't have this roster entry, transfer it
          await tx.stopTeamPlayer.update({
            where: {
              stopId_teamId_playerId: {
                stopId: entry.stopId,
                teamId: entry.teamId,
                playerId: deleteUserId,
              },
            },
            data: {
              playerId: keepUserId,
            },
          });
          console.log(`  ✅ Transferred roster entry for stop ${entry.stop.name}`);
        }
      }

      // STEP 3: Check for any other references before deletion
      console.log('\n--- STEP 3: Check for Other References ---');

      // Check teams as captain
      const captainedTeams = await tx.team.count({
        where: { captainId: deleteUserId },
      });
      if (captainedTeams > 0) {
        console.log(`  ⚠️  Manual account is captain of ${captainedTeams} teams - transferring...`);
        await tx.team.updateMany({
          where: { captainId: deleteUserId },
          data: { captainId: keepUserId },
        });
      }

      // Check captain invites
      const captainInvites = await tx.captainInvite.count({
        where: { captainId: deleteUserId },
      });
      if (captainInvites > 0) {
        console.log(`  ⚠️  Manual account has ${captainInvites} captain invites - transferring...`);
        await tx.captainInvite.updateMany({
          where: { captainId: deleteUserId },
          data: { captainId: keepUserId },
        });
      }

      // Check tournament admin
      const adminRoles = await tx.tournamentAdmin.count({
        where: { playerId: deleteUserId },
      });
      if (adminRoles > 0) {
        console.log(`  ⚠️  Manual account has ${adminRoles} admin roles - transferring...`);
        const roles = await tx.tournamentAdmin.findMany({
          where: { playerId: deleteUserId },
        });
        for (const role of roles) {
          const exists = await tx.tournamentAdmin.findUnique({
            where: {
              tournamentId_playerId: {
                tournamentId: role.tournamentId,
                playerId: keepUserId,
              },
            },
          });
          if (exists) {
            await tx.tournamentAdmin.delete({
              where: {
                tournamentId_playerId: {
                  tournamentId: role.tournamentId,
                  playerId: deleteUserId,
                },
              },
            });
          } else {
            await tx.tournamentAdmin.update({
              where: {
                tournamentId_playerId: {
                  tournamentId: role.tournamentId,
                  playerId: deleteUserId,
                },
              },
              data: { playerId: keepUserId },
            });
          }
        }
      }

      // Check tournament captain
      const captainRoles = await tx.tournamentCaptain.count({
        where: { playerId: deleteUserId },
      });
      if (captainRoles > 0) {
        console.log(`  ⚠️  Manual account has ${captainRoles} captain roles - transferring...`);
        const roles = await tx.tournamentCaptain.findMany({
          where: { playerId: deleteUserId },
        });
        for (const role of roles) {
          const exists = await tx.tournamentCaptain.findUnique({
            where: {
              tournamentId_clubId: {
                tournamentId: role.tournamentId,
                clubId: role.clubId,
              },
            },
          });
          if (exists && exists.playerId !== deleteUserId) {
            await tx.tournamentCaptain.delete({
              where: {
                tournamentId_clubId: {
                  tournamentId: role.tournamentId,
                  clubId: role.clubId,
                },
              },
            });
          } else if (exists && exists.playerId === deleteUserId) {
            await tx.tournamentCaptain.update({
              where: {
                tournamentId_clubId: {
                  tournamentId: role.tournamentId,
                  clubId: role.clubId,
                },
              },
              data: { playerId: keepUserId },
            });
          }
        }
      }

      // Check team memberships
      const teamMemberships = await tx.teamPlayer.count({
        where: { playerId: deleteUserId },
      });
      if (teamMemberships > 0) {
        console.log(`  ⚠️  Manual account has ${teamMemberships} team memberships - transferring...`);
        const memberships = await tx.teamPlayer.findMany({
          where: { playerId: deleteUserId },
        });
        for (const membership of memberships) {
          const exists = await tx.teamPlayer.findUnique({
            where: {
              teamId_playerId: {
                teamId: membership.teamId,
                playerId: keepUserId,
              },
            },
          });
          if (exists) {
            await tx.teamPlayer.delete({
              where: {
                teamId_playerId: {
                  teamId: membership.teamId,
                  playerId: deleteUserId,
                },
              },
            });
          } else {
            await tx.teamPlayer.update({
              where: {
                teamId_playerId: {
                  teamId: membership.teamId,
                  playerId: deleteUserId,
                },
              },
              data: { playerId: keepUserId },
            });
          }
        }
      }

      if (captainedTeams === 0 && captainInvites === 0 && adminRoles === 0 && captainRoles === 0 && teamMemberships === 0) {
        console.log('No other references found');
      }

      // STEP 4: Delete manual account
      console.log('\n--- STEP 4: Delete Manual Account ---');

      await tx.player.delete({
        where: { id: deleteUserId },
      });

      console.log('✅ Deleted manual account');
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ MERGE COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log('\nLouise Kwong (louisewkwong@gmail.com) now has:');
    console.log('  • All 6 lineup entries (already had them)');
    console.log('  • Roster entries for both Vaughn and Oshawa stops');
    console.log('  • Email: louisewkwong@gmail.com');
    console.log('  • Phone: (630) 777-7542');
    console.log('  • Paid registration');
    console.log('  • Can login with gmail account');
    console.log('\nManual account has been deleted.');

  } catch (error) {
    console.error('\n❌ ERROR during merge:', error);
    console.error('\nTransaction rolled back - no changes were made.');
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

mergeLouise();
