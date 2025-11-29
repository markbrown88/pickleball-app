import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function investigate() {
  const tournament = await prisma.tournament.findFirst({
    where: { name: { contains: 'Bracket Test 4' } },
    select: { id: true, name: true }
  });

  if (!tournament) {
    console.log('Tournament not found');
    return;
  }

  console.log('Tournament:', tournament.name, tournament.id);

  // Get ALL teams
  const allTeams = await prisma.team.findMany({
    where: { tournamentId: tournament.id },
    include: {
      club: { select: { name: true } },
      bracket: { select: { name: true } }
    },
    orderBy: [{ clubId: 'asc' }, { bracketId: 'asc' }]
  });

  console.log(`\nTotal teams: ${allTeams.length}`);

  // Get ALL lineups for this tournament (not filtered by stopId)
  const allLineups = await prisma.lineup.findMany({
    where: {
      team: {
        tournamentId: tournament.id
      }
    },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          club: { select: { name: true } },
          bracket: { select: { name: true } }
        }
      },
      Stop: {
        select: { id: true, name: true }
      },
      bracket: {
        select: { id: true, name: true }
      },
      entries: {
        select: {
          slot: true,
          player1: { select: { name: true } },
          player2: { select: { name: true } }
        }
      }
    }
  });

  console.log(`\nTotal lineups in tournament: ${allLineups.length}`);

  // Group lineups by team
  const lineupsByTeam = new Map<string, any[]>();
  allLineups.forEach(lineup => {
    const teamId = lineup.teamId;
    if (!lineupsByTeam.has(teamId)) {
      lineupsByTeam.set(teamId, []);
    }
    lineupsByTeam.get(teamId)!.push(lineup);
  });

  // Check each team
  console.log('\n=== TEAM LINEUP STATUS ===');
  for (const team of allTeams) {
    const teamLineups = lineupsByTeam.get(team.id) || [];
    console.log(`\n${team.club?.name} - ${team.bracket?.name}`);
    console.log(`  Team ID: ${team.id}`);
    console.log(`  Lineups: ${teamLineups.length}`);

    teamLineups.forEach(lineup => {
      console.log(`    Lineup ID: ${lineup.id}`);
      console.log(`      Stop: ${lineup.Stop?.name || 'N/A'} (${lineup.stopId})`);
      console.log(`      Bracket: ${lineup.bracket?.name || 'N/A'} (${lineup.bracketId})`);
      console.log(`      Entries: ${lineup.entries.length}`);
      lineup.entries.forEach((entry: any) => {
        console.log(`        ${entry.slot}: ${entry.player1?.name || '?'} & ${entry.player2?.name || '?'}`);
      });
    });
  }

  // Find teams without lineups
  const teamsWithoutLineups = allTeams.filter(t => !lineupsByTeam.has(t.id));
  console.log(`\n\n=== TEAMS WITHOUT LINEUPS (${teamsWithoutLineups.length}) ===`);
  teamsWithoutLineups.forEach(t => {
    console.log(`  ${t.club?.name} - ${t.bracket?.name} (${t.id})`);
  });

  await prisma.$disconnect();
}

investigate().catch(console.error);
