import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function lookupRegistration(registrationId: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`LOOKING UP REGISTRATION: ${registrationId}`);
  console.log('='.repeat(80));

  try {
    const registration = await prisma.tournamentRegistration.findUnique({
      where: { id: registrationId },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
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
      console.log(`\n❌ Registration not found`);
      return;
    }

    console.log(`\n👤 Player:`);
    console.log(`   Name: ${registration.player.firstName || ''} ${registration.player.lastName || ''}`.trim() || 'N/A');
    console.log(`   Email: ${registration.player.email || 'No email'}`);
    console.log(`   Phone: ${registration.player.phone || 'No phone'}`);
    console.log(`   Player ID: ${registration.player.id}`);

    console.log(`\n🏆 Tournament:`);
    console.log(`   Name: ${registration.tournament.name}`);
    console.log(`   Type: ${registration.tournament.type}`);
    console.log(`   Tournament ID: ${registration.tournament.id}`);

    console.log(`\n📋 Registration Details:`);
    console.log(`   Status: ${registration.status}`);
    console.log(`   Payment Status: ${registration.paymentStatus}`);
    console.log(`   Amount Paid: $${((registration.amountPaid || 0) / 100).toFixed(2)}`);
    console.log(`   Registered At: ${registration.registeredAt.toISOString()}`);
    if (registration.paidAt) {
      console.log(`   Paid At: ${registration.paidAt.toISOString()}`);
    }
    if (registration.paymentId) {
      console.log(`   Payment ID: ${registration.paymentId}`);
    }
    if (registration.refundId) {
      console.log(`   Refund ID: ${registration.refundId}`);
    }

    // Get stops from StopTeamPlayer entries for this player and tournament
    const rosterEntries = await prisma.stopTeamPlayer.findMany({
      where: {
        playerId: registration.playerId,
      },
      include: {
        stop: {
          include: {
            tournament: {
              select: { name: true },
            },
            club: {
              select: {
                name: true,
                city: true,
                region: true,
              },
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

    const tournamentStops = rosterEntries.filter(re => re.stop.tournamentId === registration.tournamentId);

    console.log(`\n📍 Stops Registered For:`);
    if (tournamentStops.length > 0) {
      tournamentStops.forEach((re, sIdx) => {
        console.log(`\n   ${sIdx + 1}. ${re.stop.name}`);
        console.log(`      Club: ${re.stop.club.name} (${re.stop.club.city || 'N/A'}, ${re.stop.club.region || 'N/A'})`);
        if (re.stop.startAt) {
          console.log(`      Start: ${new Date(re.stop.startAt).toLocaleDateString()}`);
        }
        if (re.stop.endAt) {
          console.log(`      End: ${new Date(re.stop.endAt).toLocaleDateString()}`);
        }
        console.log(`      Bracket: ${re.team.bracket.name}`);
      });
    } else {
      console.log(`   No stops found in roster`);
    }

    // Check notes
    if (registration.notes) {
      try {
        const notes = JSON.parse(registration.notes);
        if (Object.keys(notes).length > 0) {
          console.log(`\n📝 Registration Notes:`);
          if (notes.stopIds) {
            console.log(`   Stop IDs: ${JSON.stringify(notes.stopIds)}`);
          }
          if (notes.brackets) {
            console.log(`   Brackets: ${JSON.stringify(notes.brackets)}`);
          }
          if (notes.playerInfo) {
            console.log(`   Player Info: ${JSON.stringify(notes.playerInfo)}`);
          }
        }
      } catch (e) {
        // Notes not JSON, skip
      }
    }

  } catch (error: any) {
    console.error(`\n❌ Error looking up registration:`, error.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: npx tsx scripts/lookup-registration.ts <registrationId>');
    console.error('Example: npx tsx scripts/lookup-registration.ts cmi41pbhs000hky04agxsmdh7');
    process.exit(1);
  }

  const registrationId = args[0];
  await lookupRegistration(registrationId);
}

main();

