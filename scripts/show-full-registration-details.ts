import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function showFullRegistrationDetails(email: string) {
  try {
    console.log(`\n=== Full Registration Details for: ${email} ===\n`);

    const player = await prisma.player.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        phone: true,
        clubId: true,
        club: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!player) {
      console.log(`❌ Player not found`);
      return;
    }

    console.log(`👤 PLAYER INFORMATION:`);
    console.log(`   ID: ${player.id}`);
    console.log(`   Name: ${player.name || `${player.firstName} ${player.lastName}`}`);
    console.log(`   First Name: ${player.firstName || 'None'}`);
    console.log(`   Last Name: ${player.lastName || 'None'}`);
    console.log(`   Email: ${player.email}`);
    console.log(`   Phone: ${player.phone || 'None'}`);
    console.log(`   Club ID: ${player.clubId || 'None'}`);
    console.log(`   Club Name: ${player.club?.name || 'None'}`);

    const registration = await prisma.tournamentRegistration.findFirst({
      where: { playerId: player.id },
      include: {
        tournament: {
          include: {
            stops: {
              orderBy: { startAt: 'asc' },
              include: {
                club: {
                  select: {
                    id: true,
                    name: true,
                    address: true,
                    address1: true,
                    city: true,
                    region: true,
                    postalCode: true,
                  },
                },
              },
            },
            brackets: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        registeredAt: 'desc',
      },
    });

    if (!registration) {
      console.log(`\n❌ No registration found`);
      return;
    }

    console.log(`\n📋 REGISTRATION INFORMATION:`);
    console.log(`   Registration ID: ${registration.id}`);
    console.log(`   Tournament ID: ${registration.tournamentId}`);
    console.log(`   Tournament Name: ${registration.tournament.name}`);
    console.log(`   Status: ${registration.status}`);
    console.log(`   Payment Status: ${registration.paymentStatus}`);
    console.log(`   Amount Paid: ${registration.amountPaid ? `$${(registration.amountPaid / 100).toFixed(2)}` : 'None'}`);
    console.log(`   Payment ID: ${registration.paymentId || 'None'}`);
    console.log(`   Refund ID: ${registration.refundId || 'None'}`);
    console.log(`   Registered At: ${registration.registeredAt.toISOString()}`);
    console.log(`   Withdrawn At: ${registration.withdrawnAt?.toISOString() || 'None'}`);
    console.log(`   Rejected At: ${registration.rejectedAt?.toISOString() || 'None'}`);

    // Parse notes
    let notes: any = {};
    if (registration.notes) {
      try {
        notes = JSON.parse(registration.notes);
        console.log(`\n📝 REGISTRATION NOTES (Parsed):`);
        console.log(`   Stop IDs: ${notes.stopIds ? JSON.stringify(notes.stopIds, null, 2) : 'None'}`);
        console.log(`   Brackets: ${notes.brackets ? JSON.stringify(notes.brackets, null, 2) : 'None'}`);
        console.log(`   Club ID: ${notes.clubId || 'None'}`);
        console.log(`   Player Info: ${notes.playerInfo ? JSON.stringify(notes.playerInfo, null, 2) : 'None'}`);
        console.log(`   Subtotal: ${notes.subtotal ? `$${notes.subtotal.toFixed(2)}` : 'None'}`);
        console.log(`   Tax: ${notes.tax ? `$${notes.tax.toFixed(2)}` : 'None'}`);
        console.log(`   Expected Amount: ${notes.expectedAmount ? `$${notes.expectedAmount.toFixed(2)}` : 'None'}`);
        console.log(`   Pricing Model: ${notes.pricingModel || 'None'}`);
        console.log(`   Stripe Session ID: ${notes.stripeSessionId || 'None'}`);
        console.log(`   Payment Intent ID: ${notes.paymentIntentId || 'None'}`);
      } catch (e) {
        console.log(`\n📝 REGISTRATION NOTES (Raw):`);
        console.log(`   ${registration.notes}`);
      }
    } else {
      console.log(`\n📝 REGISTRATION NOTES: None`);
    }

    // Show stop details
    if (notes.stopIds && notes.stopIds.length > 0) {
      console.log(`\n📍 REGISTERED STOPS:`);
      const registeredStops = registration.tournament.stops.filter(s => notes.stopIds.includes(s.id));
      for (const stop of registeredStops) {
        console.log(`\n   Stop: ${stop.name}`);
        console.log(`     Stop ID: ${stop.id}`);
        console.log(`     Start Date: ${stop.startAt?.toISOString() || 'TBD'}`);
        console.log(`     End Date: ${stop.endAt?.toISOString() || 'TBD'}`);
        console.log(`     Club: ${stop.club?.name || 'None'}`);
        if (stop.club) {
          console.log(`       Club ID: ${stop.club.id}`);
          console.log(`       Address: ${stop.club.address || stop.club.address1 || 'None'}`);
          console.log(`       City: ${stop.club.city || 'None'}`);
          console.log(`       Region: ${stop.club.region || 'None'}`);
          console.log(`       Postal Code: ${stop.club.postalCode || 'None'}`);
        }
        
        // Show brackets for this stop
        const stopBrackets = notes.brackets?.filter((b: any) => b.stopId === stop.id) || [];
        if (stopBrackets.length > 0) {
          console.log(`     Brackets:`);
          for (const bracketNote of stopBrackets) {
            const bracket = registration.tournament.brackets.find(b => b.id === bracketNote.bracketId);
            console.log(`       - ${bracket?.name || bracketNote.bracketId}`);
            console.log(`         Game Types: ${bracketNote.gameTypes?.join(', ') || 'None'}`);
          }
        }
      }
    }

    // Show team/club information if applicable
    if (notes.clubId) {
      const teamClub = await prisma.club.findUnique({
        where: { id: notes.clubId },
        select: {
          id: true,
          name: true,
        },
      });
      console.log(`\n🏢 TEAM CLUB:`);
      console.log(`   Club ID: ${teamClub?.id || notes.clubId}`);
      console.log(`   Club Name: ${teamClub?.name || 'Not found'}`);
    }

    // Check roster entries
    if (notes.stopIds && notes.stopIds.length > 0) {
      const rosterEntries = await prisma.stopTeamPlayer.findMany({
        where: {
          playerId: player.id,
          stopId: { in: notes.stopIds },
        },
        include: {
          team: {
            include: {
              bracket: {
                select: {
                  name: true,
                },
              },
              club: {
                select: {
                  name: true,
                },
              },
            },
          },
          stop: {
            select: {
              name: true,
            },
          },
        },
      });

      if (rosterEntries.length > 0) {
        console.log(`\n👥 ROSTER ENTRIES:`);
        for (const roster of rosterEntries) {
          console.log(`   Stop: ${roster.stop.name}`);
          console.log(`     Team: ${roster.team?.club?.name || 'Unknown'}`);
          console.log(`     Bracket: ${roster.team?.bracket?.name || 'Unknown'}`);
        }
      } else {
        console.log(`\n👥 ROSTER ENTRIES: None (player not added to roster)`);
      }
    }

  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: npx tsx scripts/show-full-registration-details.ts <email>');
  process.exit(1);
}

showFullRegistrationDetails(email)
  .then(() => {
    console.log('\n✅ Complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });

