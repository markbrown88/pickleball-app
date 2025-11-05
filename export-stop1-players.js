const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function exportStop1Players() {
  try {
    console.log('🏆 Exporting players from Stop 1 of "Klyng Cup - Pickleplex"...\n');

    // Find the tournament by name (exact, case-insensitive)
    const tournament = await prisma.tournament.findFirst({
      where: { name: { equals: 'Klyng Cup - Pickleplex', mode: 'insensitive' } },
      select: { id: true, name: true }
    });

    if (!tournament) {
      console.log('❌ Tournament "Klyng Cup - Pickleplex" not found');
      return;
    }

    console.log(`📊 Tournament: ${tournament.name} (${tournament.id})`);

    // Get the first stop ordered by startAt
    const stop = await prisma.stop.findFirst({
      where: { tournamentId: tournament.id },
      orderBy: { startAt: 'asc' },
      select: { id: true, name: true }
    });

    if (!stop) {
      console.log('❌ No stops found for this tournament');
      return;
    }

    console.log(`📍 Stop: ${stop.name} (${stop.id})`);

    // Get all lineup data for this stop
    console.log('📋 Fetching lineup data...');
    const allLineups = await prisma.lineup.findMany({
      where: { stopId: stop.id },
      include: {
        team: { 
          select: { 
            id: true, 
            name: true 
          } 
        },
        entries: {
          include: {
            player1: { 
              select: { 
                id: true, 
                firstName: true, 
                lastName: true,
                name: true 
              } 
            },
            player2: { 
              select: { 
                id: true, 
                firstName: true, 
                lastName: true,
                name: true 
              } 
            },
          }
        }
      }
    });

    console.log(`📊 Found ${allLineups.length} lineups`);

    // Map to track player -> teams they play for
    const playerTeamsMap = new Map(); // playerId -> Set of team names

    // Array to store unique player-team combinations (using objects to avoid string splitting issues)
    const playerTeamEntries = [];

    // Process all lineups and extract players
    for (const lineup of allLineups) {
      const teamName = lineup.team?.name || 'Unknown Team';
      
      for (const entry of lineup.entries) {
        // Process player1
        if (entry.player1) {
          const playerId = entry.player1.id;
          
          if (!playerTeamsMap.has(playerId)) {
            playerTeamsMap.set(playerId, new Set());
          }
          playerTeamsMap.get(playerId).add(teamName);
          
          // Add to entries if not already present
          const exists = playerTeamEntries.some(
            e => e.playerId === playerId && e.teamName === teamName
          );
          if (!exists) {
            playerTeamEntries.push({ playerId, teamName });
          }
        }

        // Process player2
        if (entry.player2) {
          const playerId = entry.player2.id;
          
          if (!playerTeamsMap.has(playerId)) {
            playerTeamsMap.set(playerId, new Set());
          }
          playerTeamsMap.get(playerId).add(teamName);
          
          // Add to entries if not already present
          const exists = playerTeamEntries.some(
            e => e.playerId === playerId && e.teamName === teamName
          );
          if (!exists) {
            playerTeamEntries.push({ playerId, teamName });
          }
        }
      }
    }

    console.log(`\n📋 Processing player-team combinations...`);
    console.log(`   Found ${playerTeamEntries.length} unique player-team entries`);
    console.log(`   Found ${playerTeamsMap.size} unique players`);

    // Find players on multiple teams
    const multiTeamPlayers = [];
    for (const [playerId, teams] of playerTeamsMap.entries()) {
      if (teams.size > 1) {
        multiTeamPlayers.push({ playerId, teams: Array.from(teams) });
      }
    }

    if (multiTeamPlayers.length > 0) {
      console.log(`\n⚠️  Found ${multiTeamPlayers.length} players on multiple teams:`);
      for (const { playerId, teams } of multiTeamPlayers) {
        const player = await prisma.player.findUnique({
          where: { id: playerId },
          select: { firstName: true, lastName: true, name: true }
        });
        const playerName = player?.name || `${player?.firstName || '?'} ${player?.lastName || '?'}`.trim();
        console.log(`   - ${playerName}: ${teams.join(', ')}`);
      }
    }

    // Get all players for the final list
    console.log('\n📝 Generating CSV entries...');
    const csvRows = [];
    
    // Get unique player data to minimize DB queries
    const uniquePlayerIds = [...new Set(playerTeamEntries.map(e => e.playerId))];
    const playersData = await prisma.player.findMany({
      where: { id: { in: uniquePlayerIds } },
      select: { id: true, firstName: true, lastName: true, name: true }
    });
    
    const playerDataMap = new Map(playersData.map(p => [p.id, p]));
    
    for (const { playerId, teamName } of playerTeamEntries) {
      const player = playerDataMap.get(playerId);

      const firstName = player?.firstName || (player?.name ? player.name.split(' ')[0] : '?');
      const lastName = player?.lastName || (player?.name ? player.name.split(' ').slice(1).join(' ') : '?');
      
      // If firstName is still empty or just whitespace, use "?"
      const finalFirstName = (firstName || '?').trim() || '?';
      const finalLastName = (lastName || '?').trim() || '?';

      csvRows.push({
        firstName: finalFirstName,
        lastName: finalLastName,
        teamName: teamName
      });
    }

    // Sort by team name, then last name, then first name
    csvRows.sort((a, b) => {
      if (a.teamName !== b.teamName) {
        return a.teamName.localeCompare(b.teamName);
      }
      if (a.lastName !== b.lastName) {
        return a.lastName.localeCompare(b.lastName);
      }
      return a.firstName.localeCompare(b.firstName);
    });

    // Generate CSV
    const csvHeader = 'First Name,Last Name,Team\n';
    const csvLines = csvRows.map(row => {
      // Escape quotes and wrap in quotes if contains comma
      const escapeCSV = (str) => {
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      return `${escapeCSV(row.firstName)},${escapeCSV(row.lastName)},${escapeCSV(row.teamName)}`;
    });

    const csvContent = csvHeader + csvLines.join('\n');

    const filename = 'klyng-cup-pickleplex-stop1-players.csv';
    fs.writeFileSync(filename, csvContent, 'utf8');

    console.log(`\n✅ Generated ${filename}`);
    console.log(`📊 Summary:`);
    console.log(`   - ${csvRows.length} player-team entries`);
    console.log(`   - ${playerTeamsMap.size} unique players`);
    if (multiTeamPlayers.length > 0) {
      console.log(`   - ${multiTeamPlayers.length} players on multiple teams`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

exportStop1Players();

