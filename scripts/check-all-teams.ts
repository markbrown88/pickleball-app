import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkTeams() {
  const tournament = await prisma.tournament.findFirst({
    where: { name: { contains: 'Bracket Test 4' } },
    select: { id: true, name: true }
  });

  if (!tournament) {
    console.log('Tournament not found');
    return;
  }

  console.log('Tournament:', tournament.name);

  // Get all teams
  const teams = await prisma.team.findMany({
    where: { tournamentId: tournament.id },
    include: {
      club: { select: { name: true } },
      bracket: { select: { name: true } }
    },
    orderBy: [
      { clubId: 'asc' },
      { bracketId: 'asc' }
    ]
  });

  console.log(`\nAll teams (${teams.length} total):`);
  teams.forEach(t => {
    console.log(`  ${t.name}`);
    console.log(`    ID: ${t.id}`);
    console.log(`    Club: ${t.club?.name}`);
    console.log(`    ClubId: ${t.clubId}`);
    console.log(`    Bracket: ${t.bracket?.name}`);
    console.log(`    BracketId: ${t.bracketId}`);
    console.log();
  });

  // Get stop
  const stop = await prisma.stop.findFirst({
    where: { tournamentId: tournament.id }
  });

  if (!stop) {
    console.log('No stop found');
    await prisma.$disconnect();
    return;
  }

  // Get all lineups for this stop
  const lineups = await prisma.lineup.findMany({
    where: { stopId: stop.id },
    select: {
      id: true,
      teamId: true,
      bracketId: true,
      team: {
        select: {
          name: true,
          club: { select: { name: true } }
        }
      }
    }
  });

  console.log(`\nLineups for stop ${stop.id} (${lineups.length} total):`);
  lineups.forEach(l => {
    console.log(`  Lineup ${l.id}`);
    console.log(`    TeamId: ${l.teamId}`);
    console.log(`    BracketId: ${l.bracketId}`);
    console.log(`    Team: ${l.team.name}`);
    console.log();
  });

  // Find teams WITHOUT lineups
  const teamIdsWithLineups = new Set(lineups.map(l => l.teamId));
  const teamsWithoutLineups = teams.filter(t => !teamIdsWithLineups.has(t.id));

  console.log(`\nTeams WITHOUT lineups (${teamsWithoutLineups.length} total):`);
  teamsWithoutLineups.forEach(t => {
    console.log(`  ${t.name} (${t.club?.name})`);
    console.log(`    ID: ${t.id}`);
    console.log(`    BracketId: ${t.bracketId}`);
    console.log();
  });

  await prisma.$disconnect();
}

checkTeams().catch(console.error);
