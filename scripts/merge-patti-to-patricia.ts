import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function mergePatti() {
  const keepUserId = 'cmiaj3qbv0001ld04r4dmcvuw'; // Patricia (with email/payment)
  const deleteUserId = 'cmh822cep005jr0j4ro16a5e0'; // Patti (old manual account)

  console.log('='.repeat(80));
  console.log('MERGING PATTI BEAVER INTO PATRICIA BEAVER');
  console.log('='.repeat(80));
  console.log(`\nKeeping: ${keepUserId} (Patricia - has email, payment, login)`);
  console.log(`Deleting: ${deleteUserId} (Patti - old manual account)`);
  console.log('');

  try {
    await prisma.$transaction(async (tx) => {
      // STEP 1: Transfer lineup entries
      console.log('\n--- STEP 1: Transfer Lineup Entries ---');

      const lineupEntriesP1 = await tx.lineupEntry.findMany({
        where: { player1Id: deleteUserId },
      });

      const lineupEntriesP2 = await tx.lineupEntry.findMany({
        where: { player2Id: deleteUserId },
      });

      console.log(`Found ${lineupEntriesP1.length} lineup entries where Patti is Player 1`);
      console.log(`Found ${lineupEntriesP2.length} lineup entries where Patti is Player 2`);

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

      // STEP 2: Transfer roster entries
      console.log('\n--- STEP 2: Transfer Roster Entries ---');

      const rosterEntries = await tx.stopTeamPlayer.findMany({
        where: { playerId: deleteUserId },
      });

      console.log(`Found ${rosterEntries.length} roster entries for Patti`);

      for (const entry of rosterEntries) {
        // Check if Patricia already has a roster entry for this stop/team
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
          // Patricia already has this roster entry
          // Keep the one with better payment status (STRIPE > MANUAL > UNPAID)
          const pattiPayment = entry.paymentMethod;
          const patriciaPayment = existingEntry.paymentMethod;

          const paymentPriority = { STRIPE: 3, MANUAL: 2, UNPAID: 1 };
          const pattiPriority = paymentPriority[pattiPayment] || 0;
          const patriciaPriority = paymentPriority[patriciaPayment] || 0;

          if (pattiPriority > patriciaPriority) {
            // Patti's entry is better, update Patricia's
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
            console.log(`  ✅ Updated roster entry for stop ${entry.stopId} (kept ${pattiPayment} payment)`);
          } else {
            console.log(`  ℹ️  Patricia already has roster entry for stop ${entry.stopId} (kept ${patriciaPayment} payment)`);
          }

          // Delete Patti's duplicate entry
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
          // Patricia doesn't have this roster entry, transfer it
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
          console.log(`  ✅ Transferred roster entry for stop ${entry.stopId}`);
        }
      }

      // STEP 3: Check for any other references before deletion
      console.log('\n--- STEP 3: Check for Other References ---');

      // Check teams as captain
      const captainedTeams = await tx.team.count({
        where: { captainId: deleteUserId },
      });
      if (captainedTeams > 0) {
        console.log(`  ⚠️  Patti is captain of ${captainedTeams} teams - transferring...`);
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
        console.log(`  ⚠️  Patti has ${captainInvites} captain invites - transferring...`);
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
        console.log(`  ⚠️  Patti has ${adminRoles} admin roles - transferring...`);
        // Need to check for duplicates
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
        console.log(`  ⚠️  Patti has ${captainRoles} captain roles - transferring...`);
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
            // Someone else is already captain, just delete Patti's role
            await tx.tournamentCaptain.delete({
              where: {
                tournamentId_clubId: {
                  tournamentId: role.tournamentId,
                  clubId: role.clubId,
                },
              },
            });
          } else if (exists && exists.playerId === deleteUserId) {
            // Update to Patricia
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
        console.log(`  ⚠️  Patti has ${teamMemberships} team memberships - transferring...`);
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

      // STEP 4: Delete Patti's account
      console.log('\n--- STEP 4: Delete Patti\'s Account ---');

      await tx.player.delete({
        where: { id: deleteUserId },
      });

      console.log('✅ Deleted Patti\'s player account');
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ MERGE COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log('\nPatricia Beaver now has:');
    console.log('  • All 22 lineup entries from Patti');
    console.log('  • All roster entries (with best payment status)');
    console.log('  • Email, phone, and login credentials');
    console.log('  • Paid registration');
    console.log('\nPatti\'s account has been deleted.');

  } catch (error) {
    console.error('\n❌ ERROR during merge:', error);
    console.error('\nTransaction rolled back - no changes were made.');
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

mergePatti();
