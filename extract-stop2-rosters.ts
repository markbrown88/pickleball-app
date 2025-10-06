import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Team name mappings from CSV to database
const TEAM_NAME_MAP: Record<string, string> = {
  'OH': 'One Health',
  'One Health': 'One Health',
  'Pickleplex': 'Pickleplex Barrie',
  'Blue Zone': 'Blue Zone',
  'BZ': 'Blue Zone',
  'Wild Card': 'Wildcard',
  'WCC': 'Wildcard',
  'Wild': 'Wildcard',
  'Wildcard': 'Wildcard',
  'Rally': 'Rally/OPA',
  'Rally/OPA': 'Rally/OPA',
  'Greenhills': 'Greenhills',
  'GreenHills': 'Greenhills',
  'Real Pickleball': 'Real Pickleball',
  'Real': 'Real Pickleball',
  'Four Fathers': '4 Fathers',
  'FF': '4 Fathers',
};

// Common nickname to full name mappings
const NICKNAME_MAP: Record<string, string[]> = {
  'Mike': ['Michael', 'Mikhail'],
  'Dim': ['Dimitry', 'Dimitri', 'Demetrius'],
  'Steph': ['Stephanie', 'Stephen'],
  'Tiff': ['Tiffany'],
  'Naz': ['Nazanin'],
  'Suziie': ['Suzie', 'Suzanne'],
  'Suzie': ['Suzanne'],
  'Caro': ['Carolina', 'Caroline'],
  'ML': ['Mary Louise', 'MaryLouise', 'Mary-Louise'],
  'Drew': ['Andrew'],
  'Matt': ['Matthew'],
  'Rob': ['Robert'],
  'Adam': ['Adams'],
  'Josh': ['Joshua'],
  'Chris': ['Christopher', 'Christian', 'Christine', 'Christina'],
  'Cheryl': ['Sherry'],
  'Sherry': ['Cheryl'],
  'Christie': ['Christina', 'Christine', 'Christian'],
  'Christy': ['Christie', 'Christina', 'Christine'],
};

function parseCSV(filePath: string): Map<string, Set<string>> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').map((line) => line.trim());

  // Map of team name -> set of player names
  const teamPlayers = new Map<string, Set<string>>();

  let currentRound = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const cells = line.split(',').map((c) => c.trim());

    // Check if this is a round header
    if (cells[0] && cells[0].match(/^Round\s+(\d+)$/i)) {
      const roundMatch = cells[0].match(/^Round\s+(\d+)$/i);
      if (roundMatch) {
        currentRound = parseInt(roundMatch[1], 10);
      }
      continue;
    }

    // Skip DreamBreaker rows
    if (cells[1] === 'DreamBreaker') continue;

    // Parse game rows
    if (currentRound > 0 && cells[1] && cells[1].includes('Doubles')) {
      // Get team matchups from row 2 (header row)
      const headerLine = lines[1];
      const headerCells = headerLine.split(',').map((c) => c.trim());

      // Process each matchup column
      const matchupColumns = [
        { cols: [2, 3] },
        { cols: [4, 5] },
        { cols: [6, 7] },
        { cols: [8, 9] },
        { cols: [10, 11] },
        { cols: [12, 13] },
        { cols: [14, 15] },
        { cols: [16, 17] },
      ];

      for (const { cols } of matchupColumns) {
        const matchStr = cells[cols[0]] || '';
        if (!matchStr || matchStr.toLowerCase() === 'result' || matchStr.toLowerCase().includes('forfit')) continue;

        // Get team names from header
        const teamHeader = headerCells[cols[0]] || '';
        const vsParts = teamHeader.split(/\s+vs\.?\s+/i);
        if (vsParts.length !== 2) continue;

        const teamAName = TEAM_NAME_MAP[vsParts[0].trim()] || vsParts[0].trim();
        const teamBName = TEAM_NAME_MAP[vsParts[1].trim()] || vsParts[1].trim();

        // Initialize team sets
        if (!teamPlayers.has(teamAName)) teamPlayers.set(teamAName, new Set());
        if (!teamPlayers.has(teamBName)) teamPlayers.set(teamBName, new Set());

        // Parse player names from match string
        const vsMatch = matchStr.split(/\s+vs\.?\s+/i);
        if (vsMatch.length === 2) {
          // Team A players
          const teamAPart = vsMatch[0].trim().replace(/,\s*\d+-\d+.*$/, '');
          const teamAPlayers = teamAPart.split('+').map((p) => p.trim()).filter(Boolean);

          // Team B players
          const teamBPart = vsMatch[1].trim().replace(/,\s*\d+-\d+.*$/, '');
          const teamBPlayers = teamBPart.split('+').map((p) => p.trim()).filter(Boolean);

          for (const player of teamAPlayers) {
            if (player && player !== '&' && !player.match(/^\d+$/)) {
              teamPlayers.get(teamAName)!.add(player);
            }
          }

          for (const player of teamBPlayers) {
            if (player && player !== '&' && !player.match(/^\d+$/)) {
              teamPlayers.get(teamBName)!.add(player);
            }
          }
        }
      }
    }
  }

  return teamPlayers;
}

async function main() {
  const csvPath = path.join(
    'c:',
    'Users',
    'markb',
    'Downloads',
    'Stop Result - BZ Match Scores - Stop Result - BZ Match Scores.csv'
  );

  console.log('Extracting players from CSV...\n');
  const teamPlayers = parseCSV(csvPath);

  // Get tournament
  const tournament = await prisma.tournament.findUnique({
    where: { id: 'cmfot1xt50000rd6a1gvw8ozn' },
  });

  if (!tournament) {
    console.error('Tournament not found');
    return;
  }

  // Get all teams
  const teams = await prisma.team.findMany({
    where: { tournamentId: tournament.id },
    include: { club: true },
  });

  // For each team, show extracted players and try to match them
  for (const [teamName, players] of teamPlayers.entries()) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${teamName} (${players.size} unique players from CSV)`);
    console.log(`${'='.repeat(60)}`);

    // Find the team in database
    const team = teams.find((t) => t.club?.name === teamName);
    if (!team) {
      console.log(`  ⚠️  Team not found in database!`);
      continue;
    }

    // Get all players from this club
    const clubPlayers = await prisma.player.findMany({
      where: { clubId: team.clubId },
    });

    const playerArray = Array.from(players).sort();

    for (const csvName of playerArray) {
      // Try to find match
      let match = clubPlayers.find(
        (p) =>
          p.firstName?.toLowerCase() === csvName.toLowerCase() ||
          `${p.firstName} ${p.lastName}`.toLowerCase() === csvName.toLowerCase()
      );

      // Try nicknames
      if (!match) {
        const nicknames = NICKNAME_MAP[csvName] || [];
        for (const nickname of nicknames) {
          match = clubPlayers.find(
            (p) =>
              p.firstName?.toLowerCase() === nickname.toLowerCase() ||
              `${p.firstName} ${p.lastName}`.toLowerCase() === nickname.toLowerCase()
          );
          if (match) break;
        }
      }

      if (match) {
        console.log(`  ✓ "${csvName}" → ${match.firstName} ${match.lastName} (${match.id})`);
      } else {
        console.log(`  ✗ "${csvName}" → NOT FOUND`);
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
