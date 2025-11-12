import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const playerIdToDelete = 'cmg07c262001drddc12y5sss9';

async function checkReferences() {
  try {
    console.log(`Checking all references to player ID: ${playerIdToDelete}\n`);

    // Check TournamentRegistration
    const registrations = await prisma.tournamentRegistration.findMany({
      where: { playerId: playerIdToDelete },
    });
    console.log(`Tournament Registrations: ${registrations.length}`);

    // Check TeamPlayer
    const teamPlayers = await prisma.teamPlayer.findMany({
      where: { playerId: playerIdToDelete },
    });
    console.log(`Team Player entries: ${teamPlayers.length}`);

    // Check StopTeamPlayer
    const stopTeamPlayers = await prisma.stopTeamPlayer.findMany({
      where: { playerId: playerIdToDelete },
    });
    console.log(`Stop Team Player entries: ${stopTeamPlayers.length}`);

    // Check LineupEntry (as player1)
    const lineupEntriesP1 = await prisma.lineupEntry.findMany({
      where: { player1Id: playerIdToDelete },
    });
    console.log(`Lineup Entries (as player1): ${lineupEntriesP1.length}`);

    // Check LineupEntry (as player2)
    const lineupEntriesP2 = await prisma.lineupEntry.findMany({
      where: { player2Id: playerIdToDelete },
    });
    console.log(`Lineup Entries (as player2): ${lineupEntriesP2.length}`);

    // Check TournamentAdmin
    const admins = await prisma.tournamentAdmin.findMany({
      where: { playerId: playerIdToDelete },
    });
    console.log(`Tournament Admin entries: ${admins.length}`);

    // Check TournamentEventManager
    const eventManagers = await prisma.tournamentEventManager.findMany({
      where: { playerId: playerIdToDelete },
    });
    console.log(`Tournament Event Manager entries: ${eventManagers.length}`);

    // Check TournamentCaptain
    const captains = await prisma.tournamentCaptain.findMany({
      where: { playerId: playerIdToDelete },
    });
    console.log(`Tournament Captain entries: ${captains.length}`);

    // Check Team (as captain)
    const teamsAsCaptain = await prisma.team.findMany({
      where: { captainId: playerIdToDelete },
    });
    console.log(`Teams as Captain: ${teamsAsCaptain.length}`);

    // Check Stop (as event manager)
    const stopsAsManager = await prisma.stop.findMany({
      where: { eventManagerId: playerIdToDelete },
    });
    console.log(`Stops as Event Manager: ${stopsAsManager.length}`);

    // Check Club (as director)
    const clubsAsDirector = await prisma.club.findMany({
      where: { directorId: playerIdToDelete },
    });
    console.log(`Clubs as Director: ${clubsAsDirector.length}`);

    // Check TournamentInvite (as player)
    const invitesReceived = await prisma.tournamentInvite.findMany({
      where: { playerId: playerIdToDelete },
    });
    console.log(`Tournament Invites Received: ${invitesReceived.length}`);

    // Check TournamentInvite (as invitedBy)
    const invitesSent = await prisma.tournamentInvite.findMany({
      where: { invitedBy: playerIdToDelete },
    });
    console.log(`Tournament Invites Sent: ${invitesSent.length}`);

    // Check InviteRequest
    const inviteRequests = await prisma.inviteRequest.findMany({
      where: { playerId: playerIdToDelete },
    });
    console.log(`Invite Requests: ${inviteRequests.length}`);

    // Check TournamentWaitlist
    const waitlist = await prisma.tournamentWaitlist.findMany({
      where: { playerId: playerIdToDelete },
    });
    console.log(`Waitlist entries: ${waitlist.length}`);

    // Check Match (as tiebreaker decider)
    const matchesAsDecider = await prisma.match.findMany({
      where: { tiebreakerDecidedById: playerIdToDelete },
    });
    console.log(`Matches as Tiebreaker Decider: ${matchesAsDecider.length}`);

    const totalReferences = 
      registrations.length +
      teamPlayers.length +
      stopTeamPlayers.length +
      lineupEntriesP1.length +
      lineupEntriesP2.length +
      admins.length +
      eventManagers.length +
      captains.length +
      teamsAsCaptain.length +
      stopsAsManager.length +
      clubsAsDirector.length +
      invitesReceived.length +
      invitesSent.length +
      inviteRequests.length +
      waitlist.length +
      matchesAsDecider.length;

    console.log(`\n=== Total References: ${totalReferences} ===\n`);

    if (totalReferences === 0) {
      console.log('✓ No references found. Safe to delete.');
    } else {
      console.log('⚠️  References found. Review above before deleting.');
    }

  } catch (error) {
    console.error('Error checking references:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkReferences();

