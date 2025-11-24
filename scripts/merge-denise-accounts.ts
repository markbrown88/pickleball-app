import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function mergeDenise() {
  const keepUserId = 'cmi9ki2hs0001l104qx06gnbi'; // Gmail account (newer, empty)
  const deleteUserId = 'cmh8227hb001pr0j47i5h9wyc'; // Hotmail account (older, has game history)

  console.log('='.repeat(80));
  console.log('MERGING DENISE DENOMEY ACCOUNTS');
  console.log('='.repeat(80));
  console.log(`\nKeeping: ${keepUserId} (denomey99@gmail.com - newer account)`);
  console.log(`Deleting: ${deleteUserId} (ddenomey@hotmail.com - older account with game history)`);
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
      console.log(`Delete: ${deleteUser.firstName} ${deleteUser.lastName} (${deleteUser.email})`);
      console.log(`Both have same phone: ${keepUser.phone}`);

      // STEP 1: Transfer lineup entries
      console.log('\n--- STEP 1: Transfer Lineup Entries ---');

      const lineupEntriesP1 = await tx.lineupEntry.findMany({
        where: { player1Id: deleteUserId },
      });

      const lineupEntriesP2 = await tx.lineupEntry.findMany({
        where: { player2Id: deleteUserId },
      });

      console.log(`Found ${lineupEntriesP1.length} lineup entries where hotmail account is Player 1`);
      console.log(`Found ${lineupEntriesP2.length} lineup entries where hotmail account is Player 2`);

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
        include: {
          stop: { select: { name: true } },
        },
      });

      console.log(`Found ${rosterEntries.length} roster entries for hotmail account`);

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
          // Gmail account already has this roster entry (unlikely but check anyway)
          console.log(`  ℹ️  Gmail account already has roster entry for stop ${entry.stop.name}`);

          // Delete hotmail's duplicate entry
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
        console.log(`  ⚠️  Hotmail account is captain of ${captainedTeams} teams - transferring...`);
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
        console.log(`  ⚠️  Hotmail account has ${captainInvites} captain invites - transferring...`);
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
        console.log(`  ⚠️  Hotmail account has ${adminRoles} admin roles - transferring...`);
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
        console.log(`  ⚠️  Hotmail account has ${captainRoles} captain roles - transferring...`);
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
            // Someone else is already captain, just delete hotmail's role
            await tx.tournamentCaptain.delete({
              where: {
                tournamentId_clubId: {
                  tournamentId: role.tournamentId,
                  clubId: role.clubId,
                },
              },
            });
          } else if (exists && exists.playerId === deleteUserId) {
            // Update to gmail account
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
        console.log(`  ⚠️  Hotmail account has ${teamMemberships} team memberships - transferring...`);
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

      // Check tournament registrations
      const registrations = await tx.tournamentRegistration.count({
        where: { playerId: deleteUserId },
      });
      if (registrations > 0) {
        console.log(`  ⚠️  Hotmail account has ${registrations} tournament registrations - transferring...`);
        const regs = await tx.tournamentRegistration.findMany({
          where: { playerId: deleteUserId },
        });
        for (const reg of regs) {
          const exists = await tx.tournamentRegistration.findUnique({
            where: {
              tournamentId_playerId: {
                tournamentId: reg.tournamentId,
                playerId: keepUserId,
              },
            },
          });
          if (exists) {
            // Gmail account already registered, just delete hotmail's registration
            await tx.tournamentRegistration.delete({
              where: { id: reg.id },
            });
          } else {
            // Transfer registration to gmail account
            await tx.tournamentRegistration.update({
              where: { id: reg.id },
              data: { playerId: keepUserId },
            });
          }
        }
      }

      // STEP 4: Delete hotmail account
      console.log('\n--- STEP 4: Delete Hotmail Account ---');

      await tx.player.delete({
        where: { id: deleteUserId },
      });

      console.log('✅ Deleted hotmail account');
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ MERGE COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log('\nDenise Denomey (denomey99@gmail.com) now has:');
    console.log('  • All 16 lineup entries from hotmail account');
    console.log('  • All 2 roster entries (Vaughn + Oshawa stops)');
    console.log('  • Email: denomey99@gmail.com');
    console.log('  • Phone: (519) 991-1518');
    console.log('  • Can login with gmail account');
    console.log('\nHotmail account (ddenomey@hotmail.com) has been deleted.');

  } catch (error) {
    console.error('\n❌ ERROR during merge:', error);
    console.error('\nTransaction rolled back - no changes were made.');
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

mergeDenise();
