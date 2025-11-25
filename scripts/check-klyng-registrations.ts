import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TOURNAMENT_ID = 'cmi7gs5xf0000le04k8mie9oa'; // KLYNG CUP-GRAND FINALE

async function main() {
  console.log('\n=== KLYNG CUP-GRAND FINALE Registrations ===\n');

  const tournament = await prisma.tournament.findUnique({
    where: { id: TOURNAMENT_ID },
    select: {
      id: true,
      name: true,
      type: true
    }
  });

  if (!tournament) {
    console.log('❌ Tournament not found');
    return;
  }

  console.log(`Tournament: ${tournament.name}`);
  console.log(`Type: ${tournament.type}\n`);

  // Get all registrations
  const registrations = await prisma.tournamentRegistration.findMany({
    where: {
      tournamentId: TOURNAMENT_ID
    },
    include: {
      player: true
    },
    orderBy: {
      registeredAt: 'desc'
    }
  });

  console.log(`Total Registrations: ${registrations.length}\n`);

  if (registrations.length === 0) {
    console.log('❌ No registrations found for this tournament.');
  } else {
    registrations.forEach((reg, idx) => {
      const playerName = `${reg.player.firstName || ''} ${reg.player.lastName || ''}`.trim()
        || reg.player.name
        || 'Unknown';

      console.log(`${idx + 1}. ${playerName}`);
      console.log(`   Player ID: ${reg.player.id}`);
      console.log(`   Email: ${reg.player.email || 'N/A'}`);
      console.log(`   Status: ${reg.status}`);
      console.log(`   Payment Status: ${reg.paymentStatus}`);
      console.log(`   Registration ID: ${reg.id}`);
      console.log(`   Registered: ${reg.registeredAt.toISOString()}`);

      // Parse notes to see stop/bracket selections
      if (reg.notes) {
        try {
          const notes = JSON.parse(reg.notes);
          console.log(`   Notes:`);
          if (notes.stopIds) console.log(`     Stop IDs: ${JSON.stringify(notes.stopIds)}`);
          if (notes.clubId) console.log(`     Club ID: ${notes.clubId}`);
          if (notes.brackets) console.log(`     Brackets: ${JSON.stringify(notes.brackets)}`);
        } catch (e) {
          console.log(`   Notes (raw): ${reg.notes}`);
        }
      }
      console.log();
    });
  }

  // Check StopTeamPlayer entries
  console.log('═══════════════════════════════════════');
  console.log('📋 ROSTER ENTRIES (StopTeamPlayer):');
  console.log('═══════════════════════════════════════\n');

  const stops = await prisma.stop.findMany({
    where: { tournamentId: TOURNAMENT_ID },
    select: { id: true, name: true }
  });

  const stopIds = stops.map(s => s.id);

  const rosterEntries = await prisma.stopTeamPlayer.findMany({
    where: {
      stopId: { in: stopIds }
    },
    include: {
      player: true,
      team: {
        include: {
          bracket: true,
          club: true
        }
      },
      stop: true
    },
    orderBy: [
      { createdAt: 'asc' }
    ]
  });

  console.log(`Total Roster Entries: ${rosterEntries.length}\n`);

  if (rosterEntries.length === 0) {
    console.log('❌ No roster entries found.');
  } else {
    // Group by team/club
    const byClub = new Map<string, typeof rosterEntries>();
    rosterEntries.forEach(entry => {
      const clubName = entry.team.club?.name || 'Unknown';
      if (!byClub.has(clubName)) {
        byClub.set(clubName, []);
      }
      byClub.get(clubName)!.push(entry);
    });

    byClub.forEach((entries, clubName) => {
      console.log(`📁 ${clubName}:`);
      entries.forEach(entry => {
        const playerName = `${entry.player.firstName || ''} ${entry.player.lastName || ''}`.trim()
          || entry.player.name
          || 'Unknown';

        console.log(`   • ${playerName}`);
        console.log(`     Team: ${entry.team.name}`);
        console.log(`     Bracket: ${entry.team.bracket?.name || '❌ NULL'}`);
        console.log(`     Stop: ${entry.stop.name}`);
        console.log(`     Payment: ${entry.paymentMethod}`);
        console.log(`     Created: ${entry.createdAt.toISOString()}`);
      });
      console.log();
    });
  }

  // Check TeamPlayer entries (tournament-wide roster)
  console.log('═══════════════════════════════════════');
  console.log('📋 TEAM MEMBERS (TeamPlayer):');
  console.log('═══════════════════════════════════════\n');

  const teams = await prisma.team.findMany({
    where: { tournamentId: TOURNAMENT_ID },
    select: { id: true }
  });

  const teamIds = teams.map(t => t.id);

  const teamPlayers = await prisma.teamPlayer.findMany({
    where: {
      teamId: { in: teamIds }
    },
    include: {
      player: true,
      team: {
        include: {
          bracket: true,
          club: true
        }
      }
    },
    orderBy: [
      { createdAt: 'asc' }
    ]
  });

  console.log(`Total Team Members: ${teamPlayers.length}\n`);

  if (teamPlayers.length === 0) {
    console.log('❌ No team members found.');
  } else {
    // Group by club
    const byClub = new Map<string, typeof teamPlayers>();
    teamPlayers.forEach(entry => {
      const clubName = entry.team.club?.name || 'Unknown';
      if (!byClub.has(clubName)) {
        byClub.set(clubName, []);
      }
      byClub.get(clubName)!.push(entry);
    });

    byClub.forEach((entries, clubName) => {
      console.log(`📁 ${clubName}:`);
      entries.forEach(entry => {
        const playerName = `${entry.player.firstName || ''} ${entry.player.lastName || ''}`.trim()
          || entry.player.name
          || 'Unknown';

        console.log(`   • ${playerName}`);
        console.log(`     Team: ${entry.team.name}`);
        console.log(`     Bracket: ${entry.team.bracket?.name || '❌ NULL'}`);
        console.log(`     Created: ${entry.createdAt.toISOString()}`);
      });
      console.log();
    });
  }

  console.log('\n═══════════════════════════════════════');
  console.log('📊 SUMMARY:');
  console.log('═══════════════════════════════════════');
  console.log(`Registrations: ${registrations.length}`);
  console.log(`Roster Entries (StopTeamPlayer): ${rosterEntries.length}`);
  console.log(`Team Members (TeamPlayer): ${teamPlayers.length}`);
  console.log();
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
