import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function fixPaymentIssues() {
  try {
    console.log('Finding and fixing payment status issues...\n');
    
    let fixedCount = 0;
    let errorCount = 0;

    // Find all registrations that are PAID or COMPLETED
    const paidRegistrations = await prisma.tournamentRegistration.findMany({
      where: {
        paymentStatus: {
          in: ['PAID', 'COMPLETED'],
        },
      },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        tournament: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    console.log(`Found ${paidRegistrations.length} paid registrations\n`);

    // Check if tournament is a team tournament
    const { isTeamTournament } = await import('@/lib/tournamentTypeConfig');

    for (const registration of paidRegistrations) {
      const playerName = registration.player.firstName && registration.player.lastName
        ? `${registration.player.firstName} ${registration.player.lastName}`
        : registration.player.email || 'Unknown';

      // Parse registration notes to get stopIds
      let stopIds: string[] = [];
      if (registration.notes) {
        try {
          const notes = JSON.parse(registration.notes);
          stopIds = notes.stopIds || [];
        } catch (e) {
          console.warn(`Failed to parse notes for registration ${registration.id}`);
          continue;
        }
      }

      if (stopIds.length === 0) {
        continue;
      }

      const tournamentIsTeam = isTeamTournament(registration.tournament.type);

      if (tournamentIsTeam) {
        // For team tournaments, check and fix roster entries
        for (const stopId of stopIds) {
          try {
            const rosterEntry = await prisma.stopTeamPlayer.findFirst({
              where: {
                playerId: registration.playerId,
                stopId: stopId,
              },
            });

            if (!rosterEntry) {
              // Missing roster entry - need to create it
              // First, we need to find the team
              let notes: any = {};
              if (registration.notes) {
                try {
                  notes = JSON.parse(registration.notes);
                } catch (e) {
                  console.warn(`Failed to parse notes for registration ${registration.id}`);
                  continue;
                }
              }

              const clubId = notes.clubId;
              const brackets = notes.brackets || [];
              const bracketSelection = brackets.find((b: any) => b && b.stopId === stopId);
              
              if (!bracketSelection || !bracketSelection.bracketId || !clubId) {
                console.warn(`Missing data to create roster entry for ${playerName} at stop ${stopId}`);
                continue;
              }

              // Find or create team
              let team = await prisma.team.findFirst({
                where: {
                  tournamentId: registration.tournamentId,
                  clubId: clubId,
                  bracketId: bracketSelection.bracketId,
                },
              });

              if (!team) {
                const bracket = await prisma.tournamentBracket.findUnique({
                  where: { id: bracketSelection.bracketId },
                  select: { name: true },
                });
                const club = await prisma.club.findUnique({
                  where: { id: clubId },
                  select: { name: true },
                });
                const teamName = bracket?.name === 'DEFAULT' ? (club?.name || 'Team') : `${club?.name || 'Team'} ${bracket?.name || ''}`;
                
                team = await prisma.team.create({
                  data: {
                    name: teamName,
                    tournamentId: registration.tournamentId,
                    clubId: clubId,
                    bracketId: bracketSelection.bracketId,
                  },
                });
              }

              // Create roster entry with STRIPE payment method
              await prisma.stopTeamPlayer.create({
                data: {
                  stopId,
                  teamId: team.id,
                  playerId: registration.playerId,
                  paymentMethod: 'STRIPE',
                },
              });

              console.log(`✅ Created roster entry for ${playerName} at stop ${stopId} with STRIPE payment`);
              fixedCount++;
            } else if (rosterEntry.paymentMethod !== 'STRIPE') {
              // Wrong payment method - update it
              await prisma.stopTeamPlayer.updateMany({
                where: {
                  stopId: stopId,
                  playerId: registration.playerId,
                },
                data: {
                  paymentMethod: 'STRIPE',
                },
              });

              console.log(`✅ Updated ${playerName} at stop ${stopId} from ${rosterEntry.paymentMethod} to STRIPE`);
              fixedCount++;
            }
          } catch (error: any) {
            console.error(`❌ Error fixing ${playerName} at stop ${stopId}:`, error.message);
            errorCount++;
          }
        }
      }
    }

    // Also fix unpaid roster entries that belong to paid registrations
    const allUnpaidRosterEntries = await prisma.stopTeamPlayer.findMany({
      where: {
        paymentMethod: 'UNPAID',
      },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        stop: {
          select: {
            id: true,
            name: true,
            tournament: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
      },
    });

    console.log(`\nChecking ${allUnpaidRosterEntries.length} unpaid roster entries...\n`);

    for (const rosterEntry of allUnpaidRosterEntries) {
      const tournamentIsTeam = isTeamTournament(rosterEntry.stop.tournament.type);
      
      if (tournamentIsTeam) {
        // Check if this player has a paid registration for this tournament and stop
        const paidRegistration = await prisma.tournamentRegistration.findFirst({
          where: {
            playerId: rosterEntry.playerId,
            tournamentId: rosterEntry.stop.tournamentId,
            paymentStatus: {
              in: ['PAID', 'COMPLETED'],
            },
          },
          select: {
            id: true,
            notes: true,
          },
        });

        if (paidRegistration) {
          // Check if this stop is in the registration
          let stopIds: string[] = [];
          if (paidRegistration.notes) {
            try {
              const notes = JSON.parse(paidRegistration.notes);
              stopIds = notes.stopIds || [];
            } catch (e) {
              // Ignore parse errors
            }
          }

          if (stopIds.includes(rosterEntry.stopId)) {
            const playerName = rosterEntry.player.firstName && rosterEntry.player.lastName
              ? `${rosterEntry.player.firstName} ${rosterEntry.player.lastName}`
              : rosterEntry.player.email || 'Unknown';

            try {
              await prisma.stopTeamPlayer.updateMany({
                where: {
                  stopId: rosterEntry.stopId,
                  playerId: rosterEntry.playerId,
                },
                data: {
                  paymentMethod: 'STRIPE',
                },
              });

              console.log(`✅ Updated ${playerName} at stop ${rosterEntry.stop.name} from UNPAID to STRIPE`);
              fixedCount++;
            } catch (error: any) {
              console.error(`❌ Error fixing ${playerName} at stop ${rosterEntry.stop.name}:`, error.message);
              errorCount++;
            }
          }
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('FIX SUMMARY');
    console.log('='.repeat(80));
    console.log(`✅ Fixed: ${fixedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Fix script failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixPaymentIssues()
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

