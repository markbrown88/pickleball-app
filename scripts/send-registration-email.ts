import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'markbrown8@gmail.com';

  // Find the player
  const player = await prisma.player.findUnique({
    where: { email }
  });

  if (!player) {
    console.error('Player not found:', email);
    return;
  }

  // Find their most recent registration for Grand Finale
  const registration = await prisma.tournamentRegistration.findFirst({
    where: {
      playerId: player.id,
      tournament: {
        name: {
          contains: 'Grand Finale',
          mode: 'insensitive'
        }
      }
    },
    include: {
      tournament: {
        include: {
          stops: {
            include: {
              club: true
            }
          },
          brackets: true
        }
      }
    },
    orderBy: {
      registeredAt: 'desc'
    }
  });

  if (!registration) {
    console.error('No registration found for Grand Finale');
    return;
  }

  // Find roster entries to get club and bracket info
  const rosterEntries = await prisma.stopTeamPlayer.findMany({
    where: {
      playerId: player.id,
      stop: {
        tournamentId: registration.tournamentId
      }
    },
    include: {
      stop: {
        include: {
          club: true
        }
      },
      team: {
        include: {
          bracket: true,
          club: true
        }
      }
    }
  });

  if (rosterEntries.length === 0) {
    console.error('No roster entries found');
    return;
  }

  const playerName = player.name || `${player.firstName} ${player.lastName}`;
  const clubName = rosterEntries[0].team.club.name;

  // Build stops array
  const stops = rosterEntries.map(entry => ({
    name: entry.stop.name,
    startAt: entry.stop.startAt,
    endAt: entry.stop.endAt,
    club: entry.stop.club,
    bracketName: entry.team.bracket?.name || 'Intermediate'
  }));

  console.log('Sending registration email to:', email);
  console.log('Tournament:', registration.tournament.name);
  console.log('Player:', playerName);
  console.log('Club:', clubName);
  console.log('Stops:', stops.length);

  const { sendRegistrationConfirmationEmail } = await import('../src/server/email');

  await sendRegistrationConfirmationEmail({
    to: email,
    playerName,
    tournamentName: registration.tournament.name,
    tournamentId: registration.tournamentId,
    isPaid: false,
    registrationDate: registration.registeredAt,
    stops: stops as any,
    clubName
  });

  console.log('✅ Email sent successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
