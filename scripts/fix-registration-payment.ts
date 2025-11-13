import { PrismaClient } from '@prisma/client';
import { isTeamTournament } from '../src/lib/tournamentTypeConfig';

const prisma = new PrismaClient();

async function fixRegistrationPayment(registrationId: string, paymentIntentId: string) {
  try {
    console.log(`\n=== Fixing Registration Payment ===\n`);
    console.log('Registration ID:', registrationId);
    console.log('Payment Intent ID:', paymentIntentId);

    // Get registration with all details
    const registration = await prisma.tournamentRegistration.findUnique({
      where: { id: registrationId },
      include: {
        player: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            name: true,
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

    if (!registration) {
      console.log('❌ Registration not found!');
      return;
    }

    // Parse notes
    let notes: any = {};
    if (registration.notes) {
      try {
        notes = JSON.parse(registration.notes);
      } catch (e) {
        console.log('❌ Failed to parse notes');
        return;
      }
    }

    const stopIds: string[] = notes.stopIds || [];
    const brackets: Array<{ stopId: string; bracketId: string; gameTypes: string[] }> = notes.brackets || [];
    const clubId: string | null = notes.clubId || null;

    console.log('\n📋 Current State:');
    console.log('  Payment Status:', registration.paymentStatus);
    console.log('  Payment ID:', registration.paymentId || 'None');
    console.log('  Stop IDs:', stopIds);
    console.log('  Brackets:', brackets.length);
    console.log('  Club ID:', clubId || 'None');

    // Update registration to PAID
    console.log('\n🔄 Updating registration...');
    await prisma.tournamentRegistration.update({
      where: { id: registrationId },
      data: {
        paymentStatus: 'PAID',
        paymentId: paymentIntentId,
        notes: JSON.stringify({
          ...notes,
          paymentIntentId: paymentIntentId,
        }),
      },
    });
    console.log('  ✅ Registration updated to PAID');

    // Create roster entries for team tournaments
    const tournamentIsTeam = isTeamTournament(registration.tournament.type);
    if (tournamentIsTeam && clubId && stopIds.length > 0 && brackets.length > 0) {
      console.log('\n👥 Creating roster entries...');
      
      // Get tournament brackets and club info
      const [tournamentBrackets, club] = await Promise.all([
        prisma.tournamentBracket.findMany({
          where: { tournamentId: registration.tournamentId },
          select: { id: true, name: true },
        }),
        prisma.club.findUnique({
          where: { id: clubId },
          select: { name: true },
        }),
      ]);

      const clubName = club?.name || 'Team';

      // Create roster entries for each stop/bracket combination
      for (const stopId of stopIds) {
        // Find the bracket selection for this stop
        const bracketSelection = brackets.find((sb: any) => sb && sb.stopId === stopId);
        if (!bracketSelection || !bracketSelection.bracketId) {
          console.warn(`  ⚠️  No bracket selection found for stop ${stopId}`);
          continue;
        }

        const bracketId = bracketSelection.bracketId;
        const bracket = tournamentBrackets.find((b) => b.id === bracketId);
        if (!bracket) {
          console.warn(`  ⚠️  Bracket ${bracketId} not found`);
          continue;
        }

        // Find or create team for this club and bracket
        let team = await prisma.team.findFirst({
          where: {
            tournamentId: registration.tournamentId,
            clubId: clubId,
            bracketId: bracketId,
          },
        });

        if (!team) {
          const teamName = bracket.name === 'DEFAULT' ? clubName : `${clubName} ${bracket.name}`;
          team = await prisma.team.create({
            data: {
              name: teamName,
              tournamentId: registration.tournamentId,
              clubId: clubId,
              bracketId: bracketId,
            },
          });
          console.log(`  ✅ Created team: ${teamName}`);
        }

        // Create StopTeamPlayer entry (roster entry)
        try {
          await prisma.stopTeamPlayer.upsert({
            where: {
              stopId_teamId_playerId: {
                stopId,
                teamId: team.id,
                playerId: registration.playerId,
              },
            },
            create: {
              stopId,
              teamId: team.id,
              playerId: registration.playerId,
            },
            update: {},
          });
          console.log(`  ✅ Created roster entry for stop ${stopId}, team ${team.id}`);
        } catch (rosterError: any) {
          console.error(`  ❌ Failed to create roster entry:`, rosterError.message);
        }
      }
    } else {
      console.log('\n⏭️  Skipping roster creation (not a team tournament or missing data)');
    }

    // Send payment receipt email
    if (registration.player?.email) {
      console.log('\n📧 Sending payment receipt email...');
      try {
        const { sendPaymentReceiptEmail } = await import('../src/server/email');
        
        // Get stop details
        const fetchedStops = await prisma.stop.findMany({
          where: { id: { in: stopIds } },
          include: {
            club: {
              select: {
                name: true,
                address1: true,
                city: true,
                region: true,
                postalCode: true,
              },
            },
          },
        });

        // Get bracket names from roster entries
        const rosterEntries = await prisma.stopTeamPlayer.findMany({
          where: {
            stopId: { in: stopIds },
            playerId: registration.playerId,
          },
          include: {
            team: {
              include: {
                bracket: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        });

        const bracketMap = new Map<string, string>();
        for (const roster of rosterEntries) {
          if (roster.team?.bracket?.name) {
            bracketMap.set(roster.stopId, roster.team.bracket.name);
          }
        }

        const stops = fetchedStops.map((stop) => ({
          id: stop.id,
          name: stop.name,
          startAt: stop.startAt,
          endAt: stop.endAt,
          bracketName: bracketMap.get(stop.id) || null,
          club: stop.club ? {
            name: stop.club.name,
            address1: stop.club.address1,
            city: stop.club.city,
            region: stop.club.region,
            postalCode: stop.club.postalCode,
          } : null,
        }));

        const playerName =
          registration.player.name ||
          (registration.player.firstName && registration.player.lastName
            ? `${registration.player.firstName} ${registration.player.lastName}`
            : registration.player.firstName || 'Player');

        await sendPaymentReceiptEmail({
          to: registration.player.email,
          playerName,
          tournamentName: registration.tournament.name,
          tournamentId: registration.tournamentId,
          amountPaid: registration.amountPaid || 0,
          paymentDate: new Date(),
          transactionId: paymentIntentId,
          startDate: stops.length > 0 ? stops[0]?.startAt || null : null,
          endDate: stops.length > 0 ? stops[stops.length - 1]?.endAt || null : null,
          location: null,
          stops: stops.length > 0 ? stops : undefined,
        });

        console.log('  ✅ Payment receipt email sent');
      } catch (emailError) {
        console.error('  ❌ Failed to send email:', emailError);
      }
    }

    console.log('\n✅ Registration payment processing complete!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get registration ID and payment intent ID from command line args
const registrationId = process.argv[2];
const paymentIntentId = process.argv[3];

if (!registrationId || !paymentIntentId) {
  console.error('Usage: tsx scripts/fix-registration-payment.ts <registrationId> <paymentIntentId>');
  console.error('\nTo find the payment intent ID:');
  console.error('1. Go to Stripe Dashboard');
  console.error('2. Find the checkout session:', 'cs_test_...');
  console.error('3. Get the Payment Intent ID from the session details');
  process.exit(1);
}

fixRegistrationPayment(registrationId, paymentIntentId);

