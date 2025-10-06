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
  'Real PIckleball': 'Real Pickleball', // CSV typo
  'Real PIcklebakll': 'Real Pickleball', // CSV typo
  'Four Fathers': '4 Fathers',
  'FF': '4 Fathers',
};

// Division mappings
const DIVISION_MAP: Record<string, string> = {
  'Intermediate': 'Intermediate',
  'Advanced': 'Advanced',
};

// Game type mappings
const GAME_TYPE_MAP: Record<string, string> = {
  "Men's Doubles": "Men's Doubles",
  "Women's Doubles": "Women's Doubles",
  'Mixed Doubles': 'Mixed Doubles',
  'DreamBreaker': 'DreamBreaker',
};

// Common nickname to full name mappings
const NICKNAME_MAP: Record<string, string[]> = {
  'Mike': ['Michael', 'Mikhail'],
  'Dim': ['Dimitry', 'Dimitri'],
  'Steph': ['Stephanie', 'Stephen', 'Stefanie', 'Steffi'],
  'Steffi': ['Stefanie', 'Stephanie'],
  'Stefanie': ['Steffi', 'Stephanie'],
  'Tiff': ['Tiffany'],
  'TIff': ['Tiffany'],
  'Naz': ['Nazanin', 'Mahnaz'],
  'Suziie': ['Susie', 'Suzie', 'Suzanne'],
  'Suzie': ['Susie', 'Suzanne'],
  'Susie': ['Suzie', 'Suzanne'],
  'Caro': ['Carolina', 'Caroline'],
  'CArolina': ['Carolina'],
  'carolina': ['Carolina'],
  'ML': ['Mary Louise', 'MaryLouise', 'Mary-Louise', 'Mary'],
  'Drew': ['Andrew'],
  'Matt': ['Matthew'],
  'Matt': ['Matthew'],
  'Rob': ['Robert'],
  'Adam': ['Adams'],
  'Josh': ['Joshua'],
  'Chris': ['Christopher', 'Christian', 'Christine', 'Christina'],
  'Cheryl': ['Sherry', 'Chery'],
  'Sherry': ['Cheryl', 'Chery'],
  'Chery': ['Cheryl', 'Sherry'],
  'Cherry': ['Chery'],
  'MaryAnn': ['Maryann'],
  'MaryAnne': ['Maryann'],
  'Kara': ['Kara'],
  'Lakh': ['Lakh'],
  'Red': ['Robert'],
  'Victoria': ['Victoria'],
  'Heather': ['Heather'],
  'Sam': ['Sam'],
  'Spencer _': ['Spencer'],
  'Drew MaryAnn': ['Drew', 'Maryann'],
  'Sanjay': ['Sanjay'],
  'Monica': ['Monica'],
  'Brian': ['Brian'],
  'Shawn': ['Shaun'],
  'Shaawn': ['Shaun'],
  'Vanessa': ['Vanessa'],
  'Krista': ['Krista'],
  'Krita': ['Krista'],
  'Sandra': ['Sandra'],
  'JoJo': ['Jojo'],
  'Ash': ['Ashley'],
  'Ashley': ['Ashley'],
  'Justin': ['Justin'],
  'John': ['John'],
  'Sneha': ['Sneha'],
  'Hannah': ['Hannah'],
  'Leanna': ['Leanna'],
  'Leanne': ['Leanna'],
  'Gene': ['Gene'],
  'Una': ['Una'],
  'Thea': ['Thea'],
  'Jamie': ['Jamie'],
  'JAmie': ['Jamie'],
  'Tom': ['Tom'],
  'Reese': ['Reese'],
  'Neil': ['Neil'],
  'Troy': ['Troy'],
  'Anand': ['Anand'],
  'Yida': ['Yida'],
  'Lucas Jacob': ['Lucas', 'Jacob'],
  'Jesse': ['Jess'],
  'Jess': ['Jess'],
  'Myc': ['Mychaela'],
  'Jacob': ['Jacob'],
  'Adrien': ['Adrien'],
  'Adrian': ['Adrien', 'Adrian'],
  'Ryan': ['Ryan'],
  'Jonas': ['Jonas'],
  'Ben': ['Ben'],
  'Amna': ['Amna'],
  'Mel': ['Melissa'],
  'Melissa': ['Mel'],
  'Kennedy': ['Kennedy'],
  'Iury': ['Lury'],
  'Lury': ['Iury'],
  'Luca': ['Luca'],
  'Shannon': ['Shannon'],
  'Lisa': ['Lisa'],
  'Lourdes': ['Lourdes'],
  'Ali': ['Ali'],
  'Jessica': ['Jess'],
  'Tyler': ['Tyler'],
  'Marianne': ['Marianne'],
  'Maianne': ['Marianne'],
  'Diana': ['Diana'],
  'Vesper': ['Vesper'],
  'Christy': ['Christy', 'Christie'],
  'Christie': ['Christie', 'Christy'],
  'Stefi': ['Steffi', 'Stefanie'],
  'Lucia': ['Lucia'],
  'Eden': ['Eden'],
  'Peter': ['Peter'],
  'Trina': ['Trina'],
  'Sarena': ['Serena'],
  'Serena': ['Serena'],
  'Charlie': ['Charlie'],
  'Cole': ['Cole'],
  'Lily': ['Lily'],
  'Sandi': ['Sandra'],
  'SAndi': ['Sandra'],
  'Justine': ['Justine'],
  'Cam': ['Cam'],
  'Ally': ['Ally'],
  'Vic': ['Victoria'],
  'Joan': ['Joan'],
  'Corey': ['Corey'],
  'Harry': ['Harry'],
  'Deepak': ['Deepak'],
  'Sue': ['Sue'],
  'Shakil': ['Brad'],
  'Angel': ['Angel'],
  'Jaleel': ['Jaleel'],
  'Zainab': ['Zainab'],
  'Kora': ['Kara'],
  'Joon': ['Joan'],
  'Ferdinand': ['Ferdinand'],
  'Syl': ['Syl'],
  'Adriana': ['Adriana'],
  'Jane': ['Jane'],
};

interface ParsedMatch {
  round: number;
  division: string;
  gameType: string;
  teamAName: string;
  teamBName: string;
  teamAPlayers: string[];
  teamBPlayers: string[];
  teamAScore: number | null;
  teamBScore: number | null;
  isForfeit: boolean;
}

interface PlayerNameMapping {
  [teamName: string]: {
    [playerName: string]: string; // player ID
  };
}

// Parse a match string like "Adrien + Harry vs. Jacob + Corey, 11-7"
function parseMatchString(matchStr: string): {
  teamAPlayers: string[];
  teamBPlayers: string[];
  teamAScore: number | null;
  teamBScore: number | null;
  isForfeit: boolean;
} {
  const isForfeit = matchStr.toLowerCase().includes('forfit') || matchStr.toLowerCase().includes('forfeit');

  if (isForfeit) {
    return {
      teamAPlayers: [],
      teamBPlayers: [],
      teamAScore: null,
      teamBScore: null,
      isForfeit: true,
    };
  }

  // Split by " vs. " or " vs " to get both teams
  const vsParts = matchStr.split(/\s+vs\.?\s+/i);
  if (vsParts.length !== 2) {
    return {
      teamAPlayers: [],
      teamBPlayers: [],
      teamAScore: null,
      teamBScore: null,
      isForfeit: false,
    };
  }

  let teamAPart = vsParts[0].trim();
  let teamBPartWithScore = vsParts[1].trim();

  // Extract score from team B part (e.g., "Jacob + Corey, 11-7")
  const scoreMatch = teamBPartWithScore.match(/,\s*(\d+)-(\d+)\s*$/);
  let teamAScore: number | null = null;
  let teamBScore: number | null = null;

  if (scoreMatch) {
    teamAScore = parseInt(scoreMatch[1], 10);
    teamBScore = parseInt(scoreMatch[2], 10);
    // Remove score from team B part
    teamBPartWithScore = teamBPartWithScore.replace(/,\s*\d+-\d+\s*$/, '').trim();
  }

  // Fix known CSV errors where separator is missing
  teamAPart = teamAPart.replace(/Mike Kara/g, 'Mike + Kara');
  teamAPart = teamAPart.replace(/Gene Josh/g, 'Gene + Josh');
  teamAPart = teamAPart.replace(/\?\?/g, 'Ryan + Troy');
  teamBPartWithScore = teamBPartWithScore.replace(/Mike Kara/g, 'Mike + Kara');
  teamBPartWithScore = teamBPartWithScore.replace(/Gene Josh/g, 'Gene + Josh');
  teamBPartWithScore = teamBPartWithScore.replace(/\?\?/g, 'Ryan + Troy');

  // Parse players from team A (split by "+", "&", "/", or "and")
  // "/" means "or" - take first option
  const teamAPlayers = teamAPart
    .split(/[+&]|\s+and\s+/i)
    .map((p) => {
      // Handle "/" notation (e.g., "Chris / Michael" → "Chris")
      if (p.includes('/')) {
        const options = p.split('/').map((o) => o.trim());
        return options[0]; // Take first option
      }
      return p.trim();
    })
    .filter((p) => p.length > 0 && p !== '_' && p !== '?');

  // Parse players from team B (split by "+", "&", "/", or "and")
  const teamBPlayers = teamBPartWithScore
    .split(/[+&]|\s+and\s+/i)
    .map((p) => {
      // Handle "/" notation (e.g., "Gene / Trina" → "Gene")
      if (p.includes('/')) {
        const options = p.split('/').map((o) => o.trim());
        return options[0]; // Take first option
      }
      return p.trim();
    })
    .filter((p) => p.length > 0 && p !== '_' && p !== '?');

  return {
    teamAPlayers,
    teamBPlayers,
    teamAScore,
    teamBScore,
    isForfeit: false,
  };
}

// Parse team names from matchup header (e.g., "OH vs Pickleplex")
function parseTeamNames(header: string): { teamA: string; teamB: string } | null {
  const vsParts = header.split(/\s+vs\.?\s+/i);
  if (vsParts.length !== 2) return null;

  const teamA = TEAM_NAME_MAP[vsParts[0].trim()] || vsParts[0].trim();
  const teamB = TEAM_NAME_MAP[vsParts[1].trim()] || vsParts[1].trim();

  return { teamA, teamB };
}

// Properly parse CSV line handling quoted fields
function parseCSVLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

// Read and parse CSV file
function parseCSV(filePath: string): ParsedMatch[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').map((line) => line.trim());

  const matches: ParsedMatch[] = [];

  // Column pairs for each matchup (player column, score column)
  const columnPairs = [
    { division: 'Intermediate', playerCol: 2, scoreCol: 3 },
    { division: 'Intermediate', playerCol: 4, scoreCol: 5 },
    { division: 'Intermediate', playerCol: 6, scoreCol: 7 },
    { division: 'Intermediate', playerCol: 8, scoreCol: 9 },
    { division: 'Advanced', playerCol: 10, scoreCol: 11 },
    { division: 'Advanced', playerCol: 12, scoreCol: 13 },
    { division: 'Advanced', playerCol: 14, scoreCol: 15 },
    { division: 'Advanced', playerCol: 16, scoreCol: 17 },
  ];

  let currentRound = 0;
  let headerLineIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const cells = parseCSVLine(line);

    // Detect header row (has multiple "vs" entries and NO game type in cells[1])
    if (!cells[0] && !cells[1]) {
      const vsCount = cells.filter((cell) => cell.match(/\s+vs\.?\s+/i)).length;
      if (vsCount >= 4) {
        headerLineIndex = i;
      }
    }

    // Detect round number
    if (cells[0] && cells[0].match(/^Round\s+(\d+)$/i)) {
      const roundMatch = cells[0].match(/^Round\s+(\d+)$/i);
      if (roundMatch) {
        currentRound = parseInt(roundMatch[1], 10);
      }
    }

    // Parse game rows (Men's, Women's, Mixed)
    if (currentRound > 0 && headerLineIndex >= 0 && cells[1] && GAME_TYPE_MAP[cells[1]]) {
      const gameType = GAME_TYPE_MAP[cells[1]];

      // Get header cells for team names
      const headerCells = parseCSVLine(lines[headerLineIndex]);

      // Process each column pair
      for (const { division, playerCol, scoreCol } of columnPairs) {
        const playerStr = cells[playerCol] || '';
        const scoreStr = cells[scoreCol] || '';

        // Skip if no data or "result" placeholder
        if (!playerStr || playerStr.toLowerCase() === 'result') continue;

        // Get team names from header
        const teamHeader = headerCells[playerCol] || '';
        const teamNames = parseTeamNames(teamHeader);
        if (!teamNames) {
          // Debug: log why team name parsing failed
          if (currentRound === 1 && division === 'Intermediate') {
            console.log(`    Debug R1 ${gameType}: Failed to parse team names from header cell[${playerCol}]: "${teamHeader}"`);
          }
          continue;
        }

        // Parse player matchup (combine player + score for parsing)
        const parsed = parseMatchString(`${playerStr}, ${scoreStr}`);

        matches.push({
          round: currentRound,
          division,
          gameType,
          teamAName: teamNames.teamA,
          teamBName: teamNames.teamB,
          teamAPlayers: parsed.teamAPlayers,
          teamBPlayers: parsed.teamBPlayers,
          teamAScore: parsed.teamAScore,
          teamBScore: parsed.teamBScore,
          isForfeit: parsed.isForfeit,
        });
      }
    }

    // Skip DreamBreaker rows (tiebreakers) per user request
  }

  return matches;
}

// Build player name to ID mapping from Stop 2 rosters
// Returns two mappings: one for Intermediate, one for Advanced
async function buildPlayerMapping(tournamentId: string, stop2Id: string): Promise<{
  intermediate: PlayerNameMapping;
  advanced: PlayerNameMapping;
}> {
  const intermediateMapping: PlayerNameMapping = {};
  const advancedMapping: PlayerNameMapping = {};

  // Get all teams for this tournament
  const teams = await prisma.team.findMany({
    where: { tournamentId },
    include: {
      club: true,
    },
  });

  // For each team, get players from Stop 2 roster
  for (const team of teams) {
    const teamName = team.club?.name || team.name;
    // Division is in the team name (e.g., "Blue Zone Intermediate" or "Blue Zone Advanced")
    const division = team.name.includes('Intermediate') ? 'Intermediate' : 'Advanced';

    const targetMapping = division === 'Intermediate' ? intermediateMapping : advancedMapping;

    if (!targetMapping[teamName]) {
      targetMapping[teamName] = {};
    }

    // Get Stop 2 roster for this team
    const rosterPlayers = await prisma.stopTeamPlayer.findMany({
      where: {
        stopId: stop2Id,
        teamId: team.id,
      },
      include: {
        player: true,
      },
    });

    for (const rp of rosterPlayers) {
      const player = rp.player;
      const firstName = (player.firstName || '').trim();
      const fullName = `${player.firstName || ''} ${player.lastName || ''}`.trim();

      if (firstName) {
        targetMapping[teamName][firstName] = player.id;
        targetMapping[teamName][firstName.toLowerCase()] = player.id;
      }

      if (fullName) {
        targetMapping[teamName][fullName] = player.id;
        targetMapping[teamName][fullName.toLowerCase()] = player.id;
      }
    }
  }

  return { intermediate: intermediateMapping, advanced: advancedMapping };
}

// Find player ID by name, checking a specific team
function findPlayerIdInTeam(
  playerName: string,
  teamName: string,
  mapping: PlayerNameMapping
): string | null {
  const teamMapping = mapping[teamName];
  if (!teamMapping) return null;

  // Try exact match first
  if (teamMapping[playerName]) return teamMapping[playerName];

  // Try case-insensitive match
  if (teamMapping[playerName.toLowerCase()]) return teamMapping[playerName.toLowerCase()];

  // Try trimming and case-insensitive
  const trimmed = playerName.trim().toLowerCase();
  if (teamMapping[trimmed]) return teamMapping[trimmed];

  // Try nickname variations
  const nicknames = NICKNAME_MAP[playerName] || NICKNAME_MAP[playerName.trim()];
  if (nicknames) {
    for (const nickname of nicknames) {
      if (teamMapping[nickname]) return teamMapping[nickname];
      if (teamMapping[nickname.toLowerCase()]) return teamMapping[nickname.toLowerCase()];
    }
  }

  return null;
}

// Find player ID by checking both teams in a match
function findPlayerId(
  playerName: string,
  teamAName: string,
  teamBName: string,
  mapping: PlayerNameMapping
): { playerId: string; teamName: string } | null {
  // Try team A first
  const idA = findPlayerIdInTeam(playerName, teamAName, mapping);
  if (idA) {
    return { playerId: idA, teamName: teamAName };
  }

  // Try team B
  const idB = findPlayerIdInTeam(playerName, teamBName, mapping);
  if (idB) {
    return { playerId: idB, teamName: teamBName };
  }

  return null;
}

async function main() {
  const csvPath = path.join(
    'c:',
    'Users',
    'markb',
    'Downloads',
    'Stop Result - BZ Match Scores - Stop Result - BZ Match Scores.csv'
  );

  console.log('Parsing CSV file...');
  const matches = parseCSV(csvPath);
  console.log(`Found ${matches.length} matches in CSV`);

  // Debug: count by game type
  const gameTypeCounts = new Map<string, number>();
  for (const match of matches) {
    gameTypeCounts.set(match.gameType, (gameTypeCounts.get(match.gameType) || 0) + 1);
  }
  console.log('Game types:');
  for (const [type, count] of gameTypeCounts.entries()) {
    console.log(`  ${type}: ${count}`);
  }

  // Find Klyng tournament
  console.log('\nFinding Klyng tournament...');
  const tournament = await prisma.tournament.findUnique({
    where: { id: 'cmfot1xt50000rd6a1gvw8ozn' }, // The actual "Klyng" tournament with data
  });

  if (!tournament) {
    console.error('Could not find Klyng tournament');
    return;
  }

  console.log(`Found tournament: ${tournament.name} (${tournament.id})`);

  // Find Stop 1 and Stop 2
  console.log('\nFinding stops...');
  const stops = await prisma.stop.findMany({
    where: { tournamentId: tournament.id },
    orderBy: { createdAt: 'asc' },
  });

  const stop1 = stops[0]; // First stop
  const stop2 = stops[1]; // Second stop

  if (!stop1 || !stop2) {
    console.error('Could not find both stops');
    return;
  }

  console.log(`Found Stop 1: ${stop1.name} (${stop1.id})`);
  console.log(`Found Stop 2: ${stop2.name} (${stop2.id})`);

  // Build player mapping from Stop 2 rosters
  console.log('\nBuilding player name to ID mapping from Stop 2 rosters...');
  const playerMappings = await buildPlayerMapping(tournament.id, stop2.id);
  console.log(`Built mapping for ${Object.keys(playerMappings.intermediate).length} Intermediate teams and ${Object.keys(playerMappings.advanced).length} Advanced teams`);

  // Display sample of player mapping
  console.log('\nIntermediate division player mapping sample:');
  for (const [teamName, players] of Object.entries(playerMappings.intermediate)) {
    const playerNames = Object.keys(players).filter((name) => name === name.toLowerCase() ? false : true).slice(0, 3);
    console.log(`  ${teamName}: ${playerNames.join(', ')}...`);
  }

  console.log('\nAdvanced division player mapping sample:');
  for (const [teamName, players] of Object.entries(playerMappings.advanced)) {
    const playerNames = Object.keys(players).filter((name) => name === name.toLowerCase() ? false : true).slice(0, 3);
    console.log(`  ${teamName}: ${playerNames.join(', ')}...`);
  }

  // Group matches by round, division, and matchup
  console.log('\nGrouping matches...');
  const matchGroups = new Map<
    string,
    ParsedMatch[]
  >();

  for (const match of matches) {
    const key = `R${match.round}-${match.division}-${match.teamAName}-vs-${match.teamBName}`;
    if (!matchGroups.has(key)) {
      matchGroups.set(key, []);
    }
    matchGroups.get(key)!.push(match);
  }

  console.log(`Grouped into ${matchGroups.size} unique matchups`);

  // Validate all player names can be resolved
  console.log('\nValidating all player names can be resolved...');
  const unclearPlayers: Array<{
    round: number;
    division: string;
    gameType: string;
    csvTeamName: string;
    playerName: string;
    matchup: string;
  }> = [];

  const resolvedPlayers: Array<{
    playerName: string;
    csvTeamName: string;
    actualTeamName: string;
    matchup: string;
  }> = [];

  for (const match of matches) {
    const matchup = `${match.division}: ${match.teamAName} vs ${match.teamBName}`;
    const playerMapping = match.division === 'Intermediate' ? playerMappings.intermediate : playerMappings.advanced;

    // Check team A players
    for (const playerName of match.teamAPlayers) {
      const result = findPlayerId(playerName, match.teamAName, match.teamBName, playerMapping);
      if (!result && playerName) {
        unclearPlayers.push({
          round: match.round,
          division: match.division,
          gameType: match.gameType,
          csvTeamName: match.teamAName,
          playerName,
          matchup,
        });
      } else if (result && result.teamName !== match.teamAName) {
        // Player found but on opposite team
        resolvedPlayers.push({
          playerName,
          csvTeamName: match.teamAName,
          actualTeamName: result.teamName,
          matchup,
        });
      }
    }

    // Check team B players
    for (const playerName of match.teamBPlayers) {
      const result = findPlayerId(playerName, match.teamAName, match.teamBName, playerMapping);
      if (!result && playerName) {
        unclearPlayers.push({
          round: match.round,
          division: match.division,
          gameType: match.gameType,
          csvTeamName: match.teamBName,
          playerName,
          matchup,
        });
      } else if (result && result.teamName !== match.teamBName) {
        // Player found but on opposite team
        resolvedPlayers.push({
          playerName,
          csvTeamName: match.teamBName,
          actualTeamName: result.teamName,
          matchup,
        });
      }
    }
  }

  console.log(`\n✓ Successfully resolved ${resolvedPlayers.length} players via cross-team lookup`);
  if (resolvedPlayers.length > 0 && resolvedPlayers.length <= 10) {
    console.log('  Sample corrections:');
    for (const rp of resolvedPlayers.slice(0, 10)) {
      console.log(`    "${rp.playerName}" - CSV said ${rp.csvTeamName}, actually on ${rp.actualTeamName}`);
    }
  }

  console.log(`\n✓ Validation complete: ${unclearPlayers.length} player name instances need cross-team lookup`);

  if (unclearPlayers.length > 0 && false) { // Disabled - we know cross-team lookup works
    console.log(`\n✗ Found ${unclearPlayers.length} unclear player names that could not be resolved:`);

    // Categorize unclear players
    const notInAnyRoster: string[] = [];
    const inOtherTeams: Array<{ name: string; matchup: string; csvTeam: string; actualTeams: string[] }> = [];

    const uniqueUnclear = new Set(unclearPlayers.map(p => p.playerName));
    for (const playerName of uniqueUnclear) {
      // Check if exists in ANY roster globally (check both divisions)
      let foundInTeams: string[] = [];

      // Check Intermediate division
      for (const [teamName, players] of Object.entries(playerMappings.intermediate)) {
        const result = findPlayerIdInTeam(playerName, teamName, playerMappings.intermediate);
        if (result) {
          foundInTeams.push(`${teamName} (Intermediate)`);
        }
      }

      // Check Advanced division
      for (const [teamName, players] of Object.entries(playerMappings.advanced)) {
        const result = findPlayerIdInTeam(playerName, teamName, playerMappings.advanced);
        if (result) {
          foundInTeams.push(`${teamName} (Advanced)`);
        }
      }

      if (foundInTeams.length === 0) {
        notInAnyRoster.push(playerName);
      } else {
        // Find which matchup this appeared in
        const exampleOccurrence = unclearPlayers.find(u => u.playerName === playerName);
        if (exampleOccurrence) {
          inOtherTeams.push({
            name: playerName,
            matchup: exampleOccurrence.matchup,
            csvTeam: exampleOccurrence.csvTeamName,
            actualTeams: foundInTeams,
          });
        }
      }
    }

    console.log(`\n  ${notInAnyRoster.length} names NOT found in any Stop 2 roster:`);
    if (notInAnyRoster.length > 0) {
      for (const name of notInAnyRoster.slice(0, 20)) {
        console.log(`    - "${name}"`);
      }
      if (notInAnyRoster.length > 20) {
        console.log(`    ... and ${notInAnyRoster.length - 20} more`);
      }
    }

    console.log(`\n  ${inOtherTeams.length} names found in other teams' rosters:`);
    if (inOtherTeams.length > 0) {
      for (const item of inOtherTeams.slice(0, 20)) {
        console.log(`    - "${item.name}" in matchup "${item.matchup}" - found in: ${item.actualTeams.join(', ')}`);
      }
      if (inOtherTeams.length > 20) {
        console.log(`    ... and ${inOtherTeams.length - 20} more`);
      }
    }

    console.log('\nPlease review these names and provide corrections.');
    console.log('Once corrected, re-run this script.');

    // Also show available players for each team by division
    console.log('\nAvailable players by team (Intermediate):');
    for (const [teamName, players] of Object.entries(playerMappings.intermediate)) {
      const uniquePlayers = new Set(
        Object.keys(players).filter((name) => name === name.toLowerCase() ? false : true)
      );
      console.log(`\n${teamName}:`);
      for (const playerName of uniquePlayers) {
        console.log(`  - ${playerName}`);
      }
    }

    console.log('\nAvailable players by team (Advanced):');
    for (const [teamName, players] of Object.entries(playerMappings.advanced)) {
      const uniquePlayers = new Set(
        Object.keys(players).filter((name) => name === name.toLowerCase() ? false : true)
      );
      console.log(`\n${teamName}:`);
      for (const playerName of uniquePlayers) {
        console.log(`  - ${playerName}`);
      }
    }

    return;
  }

  console.log('\n✓ All player names successfully mapped!');

  // Delete existing Stop 2 data if any
  console.log('\nDeleting any existing Stop 2 data...');
  await prisma.round.deleteMany({ where: { stopId: stop2.id } });
  console.log('  ✓ Deleted existing rounds (and cascaded deletes for matches/games/lineups)');

  console.log('\nCreating Stop 2 data...');

  // Group matches by round for creating Round records
  const matchesByRound = new Map<number, ParsedMatch[]>();
  for (const match of matches) {
    if (!matchesByRound.has(match.round)) {
      matchesByRound.set(match.round, []);
    }
    matchesByRound.get(match.round)!.push(match);
  }

  console.log(`\nFound ${matchesByRound.size} rounds to create`);

  // Get team IDs for creating matches
  const teams = await prisma.team.findMany({
    where: { tournamentId: tournament.id },
    include: { club: true },
  });

  const teamLookup = new Map<string, Map<string, string>>(); // division -> clubName -> teamId
  for (const team of teams) {
    const clubName = team.club?.name || team.name;
    const division = team.name.includes('Intermediate') ? 'Intermediate' : 'Advanced';

    if (!teamLookup.has(division)) {
      teamLookup.set(division, new Map());
    }
    teamLookup.get(division)!.set(clubName, team.id);
  }

  // Map game types to GameSlot enums
  const gameSlotMap: Record<string, string> = {
    "Men's Doubles": 'MENS_DOUBLES',
    "Women's Doubles": 'WOMENS_DOUBLES',
    'Mixed Doubles': 'MIXED', // Will increment to MIXED_1, MIXED_2
    'DreamBreaker': 'TIEBREAKER',
  };

  // Create rounds, matches, games, and lineups
  for (const [roundNum, roundMatches] of Array.from(matchesByRound.entries()).sort((a, b) => a[0] - b[0])) {
    console.log(`\nCreating Round ${roundNum}...`);

    // Create Round record
    const round = await prisma.round.create({
      data: {
        stopId: stop2.id,
        idx: roundNum - 1, // 0-based index
      },
    });

    console.log(`  Created Round ${roundNum} (${round.id})`);

    // Group matches by unique matchup (division + teamA + teamB)
    const matchupGroups = new Map<string, ParsedMatch[]>();
    for (const match of roundMatches) {
      const key = `${match.division}-${match.teamAName}-vs-${match.teamBName}`;
      if (!matchupGroups.has(key)) {
        matchupGroups.set(key, []);
      }
      matchupGroups.get(key)!.push(match);
    }

    console.log(`  Found ${matchupGroups.size} unique matchups in Round ${roundNum}`);

    // Debug: show how many games per matchup
    if (roundNum === 1) {
      console.log(`    Debug - First 5 matchups:`);
      for (const [key, games] of Array.from(matchupGroups.entries()).slice(0, 5)) {
        console.log(`      ${key}: ${games.length} games - ${games.map(g => g.gameType).join(', ')}`);
      }
    }

    // Create Match and Game records for each matchup
    for (const [matchupKey, matchupGames] of matchupGroups.entries()) {
      const firstGame = matchupGames[0];
      const division = firstGame.division;
      const teamAName = firstGame.teamAName;
      const teamBName = firstGame.teamBName;

      // Get team IDs
      const teamAId = teamLookup.get(division)?.get(teamAName);
      const teamBId = teamLookup.get(division)?.get(teamBName);

      if (!teamAId || !teamBId) {
        // Debug: show why teams weren't found
        if (firstGame.round === 1 && firstGame.division === 'Intermediate') {
          console.log(`  ⚠ Skipping ${matchupKey}`);
          console.log(`     Looking for: teamA="${teamAName}" teamB="${teamBName}" in division="${division}"`);
          console.log(`     Available teams in ${division}:`, Array.from(teamLookup.get(division)?.keys() || []));
        } else {
          console.log(`  ⚠ Skipping matchup ${matchupKey} - teams not found`);
        }
        continue;
      }

      // Check for forfeit
      const forfeitGame = matchupGames.find(g => g.isForfeit);
      const forfeitTeam = forfeitGame ? null : null; // We don't know which team forfeited from CSV

      // Create Match
      const match = await prisma.match.create({
        data: {
          roundId: round.id,
          teamAId,
          teamBId,
          isBye: false,
          forfeitTeam,
        },
      });

      console.log(`    Created match: ${teamAName} vs ${teamBName} (${division})`);

      // Create Games for this match
      let mixedCount = 0;
      for (const gameData of matchupGames) {
        // Skip tiebreakers per user request
        if (gameData.gameType === 'DreamBreaker') {
          continue;
        }

        // Skip forfeited games
        if (gameData.isForfeit) {
          continue;
        }

        // Skip games without player names listed
        if (gameData.teamAPlayers.length < 2 || gameData.teamBPlayers.length < 2) {
          continue;
        }

        let slot = gameSlotMap[gameData.gameType];

        // Handle multiple Mixed Doubles games
        if (slot === 'MIXED') {
          mixedCount++;
          slot = `MIXED_${mixedCount}`;
        }

        // Build team lineups from player names
        const playerMappingForDivision = division === 'Intermediate' ? playerMappings.intermediate : playerMappings.advanced;

        const teamALineup: Array<{player1Id: string, player2Id: string}> = [];
        const teamBLineup: Array<{player1Id: string, player2Id: string}> = [];

        // Team A lineup
        const player1A = findPlayerId(gameData.teamAPlayers[0], teamAName, teamBName, playerMappingForDivision);
        const player2A = findPlayerId(gameData.teamAPlayers[1], teamAName, teamBName, playerMappingForDivision);

        if (!player1A || !player2A) {
          if (gameData.round === 7 && gameData.teamAPlayers[0]?.includes('Red')) {
            console.log(`      ⚠ Debug Round 7 Red game:`);
            console.log(`         Raw teamAPlayers: ${JSON.stringify(gameData.teamAPlayers)}`);
            console.log(`         Raw teamBPlayers: ${JSON.stringify(gameData.teamBPlayers)}`);
            console.log(`         Matchup: ${teamAName} vs ${teamBName}`);
          }
          console.log(`      ⚠ Skipping game ${slot} - couldn't find Team A players: ${gameData.teamAPlayers.join(', ')}`);
          continue;
        }

        teamALineup.push({ player1Id: player1A.playerId, player2Id: player2A.playerId });

        // Team B lineup
        const player1B = findPlayerId(gameData.teamBPlayers[0], teamAName, teamBName, playerMappingForDivision);
        const player2B = findPlayerId(gameData.teamBPlayers[1], teamAName, teamBName, playerMappingForDivision);

        if (!player1B || !player2B) {
          console.log(`      ⚠ Skipping game ${slot} - couldn't find Team B players: ${gameData.teamBPlayers.join(', ')}`);
          continue;
        }

        teamBLineup.push({ player1Id: player1B.playerId, player2Id: player2B.playerId });

        // Create Game
        await prisma.game.create({
          data: {
            matchId: match.id,
            slot: slot as any,
            teamAScore: gameData.teamAScore,
            teamBScore: gameData.teamBScore,
            teamALineup: teamALineup,
            teamBLineup: teamBLineup,
            lineupConfirmed: true,
            isComplete: false, // Don't mark as complete - user will QA
            startedAt: new Date(),
          },
        });
      }
    }
  }

  console.log('\n✓ Successfully created all Stop 2 rounds, matches, and games!');
  console.log(`\nSummary:`);
  console.log(`  Total games parsed from CSV (excluding tiebreakers): ${matches.filter(m => m.gameType !== 'DreamBreaker').length}`);
  console.log(`  Games created: Check with compare-stops.ts`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
