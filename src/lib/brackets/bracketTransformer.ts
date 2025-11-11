/**
 * Bracket Data Transformer
 * 
 * Converts our internal bracket structure (Rounds with Matches) to
 * react-tournament-brackets format for double elimination visualization.
 */

interface Round {
  id: string;
  idx: number;
  bracketType: string | null;
  depth: number | null;
  matches: Match[];
}

interface Match {
  id: string;
  teamA: { id: string; name: string } | null;
  teamB: { id: string; name: string } | null;
  seedA: number | null;
  seedB: number | null;
  isBye: boolean;
  winnerId: string | null;
  games: Game[];
  sourceMatchAId?: string | null;
  sourceMatchBId?: string | null;
}

interface Game {
  id: string;
  slot: string;
  teamAScore: number | null;
  teamBScore: number | null;
  isComplete: boolean;
}

// react-tournament-brackets match format
interface TournamentBracketMatch {
  id: string;
  name?: string;
  nextMatchId: string | null;
  nextLooserMatchId?: string | null;
  startTime: string; // Required, must be a string
  tournamentRoundText?: string; // Library uses tournamentRoundText, not tournamentRound
  state: 'NO_SHOW' | 'WALK_OVER' | 'NO_PARTY' | 'PLAYED' | 'DONE' | 'SCORE_DONE';
  participants: Array<{
    id: string;
    resultText?: string | null;
    isWinner?: boolean;
    status?: 'PLAYED' | 'NO_SHOW' | 'WALK_OVER' | 'NO_PARTY' | null;
    name?: string;
  }>;
}

/**
 * Calculate cumulative game wins across all brackets
 */
function calculateGameWins(games: Game[]): { teamAGameWins: number; teamBGameWins: number } {
  let teamAGameWins = 0;
  let teamBGameWins = 0;

  games.forEach(game => {
    if (!game.isComplete || game.teamAScore === null || game.teamBScore === null) return;

    if (game.teamAScore > game.teamBScore) {
      teamAGameWins++;
    } else if (game.teamBScore > game.teamAScore) {
      teamBGameWins++;
    }
  });

  return { teamAGameWins, teamBGameWins };
}

/**
 * Strip bracket suffix from team names to show club name only
 */
function stripBracketSuffix(name: string | undefined | null): string {
  if (!name) return '';
  return name.replace(/\s+[\d.]+$/, '').replace(/\s+(Intermediate|Advanced|Beginner)$/i, '');
}

/**
 * Calculate match number globally across all brackets
 * Returns sequential numbers like 1, 2, 3, 4...
 */
function getMatchNumber(
  match: Match,
  round: Round,
  allRounds: Round[]
): string {
  // Sort all rounds by bracket type and idx to get consistent ordering
  // Order: WINNER rounds, then LOSER rounds, then FINALS rounds
  const sortedRounds = [...allRounds].sort((a, b) => {
    // Define bracket order
    const bracketOrder = { 'WINNER': 0, 'LOSER': 1, 'FINALS': 2 };
    const orderA = bracketOrder[a.bracketType as keyof typeof bracketOrder] ?? 99;
    const orderB = bracketOrder[b.bracketType as keyof typeof bracketOrder] ?? 99;

    if (orderA !== orderB) return orderA - orderB;
    return a.idx - b.idx;
  });

  // Calculate global match number by counting all matches before this one
  let matchNumber = 1;
  for (const r of sortedRounds) {
    if (r.id === round.id) {
      // Found current round, add position within this round
      const matchIndex = r.matches.findIndex(m => m.id === match.id);
      matchNumber += matchIndex;
      break;
    } else {
      // Add all matches from previous rounds
      matchNumber += r.matches.length;
    }
  }

  return `Match ${matchNumber}`;
}

/**
 * Get source match label for TBD teams
 * Returns labels like "W Match 3" or "L Match 7" or "BYE"
 */
function getSourceMatchLabel(
  sourceMatchId: string | null | undefined,
  isWinnerSlot: boolean,
  allMatches: Map<string, Match>,
  matchToRoundMap: Map<string, Round>,
  allRounds: Round[]
): string {
  if (!sourceMatchId) return 'TBD';

  const sourceMatch = allMatches.get(sourceMatchId);
  const sourceRound = matchToRoundMap.get(sourceMatchId);

  if (!sourceMatch || !sourceRound) return 'TBD';

  // Get the source match number (e.g., "Match 3")
  const sourceMatchNumber = getMatchNumber(sourceMatch, sourceRound, allRounds);

  // Determine if it's a winner or loser advancing
  const prefix = isWinnerSlot ? 'W' : 'L';

  return `${prefix} ${sourceMatchNumber}`;
}

/**
 * Convert a match to tournament bracket format
 */
function convertMatch(
  match: Match,
  round: Round,
  allMatches: Map<string, Match>,
  matchToRoundMap: Map<string, Round>,
  allRounds: Round[]
): TournamentBracketMatch | null {
  if (!match || !match.id || !round) {
    return null;
  }
  const matchNumber = getMatchNumber(match, round, allRounds);
  
  // Determine match state
  let state: TournamentBracketMatch['state'] = 'NO_PARTY';
  if (match.isBye && match.teamA) {
    // BYE match with team assigned - show as completed with walkover
    state = 'WALK_OVER';
  } else if (match.isBye && !match.teamA) {
    // BYE match waiting for source match to complete - show as pending
    state = 'NO_PARTY';
  } else if (match.winnerId) {
    state = 'SCORE_DONE';
  } else if (match.teamA && match.teamB) {
    const hasStartedGames = match.games.some(g => g.isComplete || g.teamAScore !== null || g.teamBScore !== null);
    state = hasStartedGames ? 'PLAYED' : 'NO_PARTY';
  }

  // Find next matches using sourceMatch relationships
  let nextMatchId: string | null = null;
  let nextLooserMatchId: string | null = null;

  // Find matches that reference this match as their source
  for (const [matchId, m] of allMatches.entries()) {
    if (!m || !match.id) continue;

    if (m.sourceMatchAId === match.id || m.sourceMatchBId === match.id) {
      const targetRound = matchToRoundMap.get(matchId);
      if (!targetRound) {
        console.warn(`[BracketTransformer] Match ${match.id.slice(0,8)} has child match ${matchId.slice(0,8)} but no round found!`);
        continue;
      }

      if (round.bracketType === 'WINNER' && targetRound.bracketType === 'WINNER') {
        nextMatchId = matchId;
      } else if (round.bracketType === 'WINNER' && targetRound.bracketType === 'LOSER') {
        nextLooserMatchId = matchId;
      } else if (round.bracketType === 'LOSER' && targetRound.bracketType === 'LOSER') {
        nextMatchId = matchId;
      } else if (round.bracketType === 'LOSER' && targetRound.bracketType === 'FINALS') {
        console.log(`[BracketTransformer] LOSER match ${match.id.slice(0,8)} -> FINALS match ${matchId.slice(0,8)}`);
        nextMatchId = matchId;
      } else if (round.bracketType === 'WINNER' && targetRound.bracketType === 'FINALS') {
        console.log(`[BracketTransformer] WINNER match ${match.id.slice(0,8)} -> FINALS match ${matchId.slice(0,8)}`);
        nextMatchId = matchId;
      } else if (round.bracketType === 'FINALS' && targetRound.bracketType === 'FINALS') {
        // Finals 1 -> Finals 2 (bracket reset)
        // Only show this link if Finals 2 has teams assigned (bracket reset triggered)
        if (m.teamA && m.teamB) {
          console.log(`[BracketTransformer] FINALS match ${match.id.slice(0,8)} -> FINALS 2 match ${matchId.slice(0,8)} (bracket reset)`);
          nextMatchId = matchId;
        } else {
          console.log(`[BracketTransformer] FINALS 2 exists but no teams yet - not showing as next match`);
        }
      }
    }
  }

  // Build participants array
  const participants: TournamentBracketMatch['participants'] = [];

  if (match.isBye && match.teamA) {
    // BYE match with team assigned - show team advancing with bye
    participants.push({
      id: match.teamA.id,
      resultText: 'WON',
      isWinner: true,
      status: 'WALK_OVER',
      name: stripBracketSuffix(match.teamA.name),
    });
    // Add BYE as second participant (not TBD) - no status/text to avoid showing "WO"
    participants.push({
      id: 'bye',
      resultText: null,
      isWinner: false,
      status: null, // Set to null instead of 'WALK_OVER' to prevent "WO" from showing
      name: 'BYE',
    });
  } else if (match.isBye && !match.teamA) {
    // BYE match waiting for source match to complete - show source vs BYE
    // For loser bracket BYE matches, the team is a loser; for winner bracket, they're a winner
    const isLoserBracket = round.bracketType === 'LOSER';
    const teamALabel = getSourceMatchLabel(match.sourceMatchAId, !isLoserBracket, allMatches, matchToRoundMap, allRounds);
    participants.push({
      id: 'tbd-bye-team',
      resultText: null,
      isWinner: false,
      status: null,
      name: teamALabel,
    });
    participants.push({
      id: 'bye',
      resultText: null,
      isWinner: false,
      status: null,
      name: 'BYE',
    });
  } else {
    // Handle partial team assignments (when winners advance)
    const { teamAGameWins, teamBGameWins } = calculateGameWins(match.games);

    // Determine if teams are winners or losers advancing
    // For loser bracket, the source is a loser; for others, it's a winner
    const isLoserBracket = round.bracketType === 'LOSER';

    // Team A (or source match label if not set)
    if (match.teamA) {
      const teamAIsWinner = match.winnerId === match.teamA.id;
      participants.push({
        id: match.teamA.id,
        resultText: teamAIsWinner ? `${teamAGameWins}` : (match.teamB && match.winnerId === match.teamB.id ? `${teamAGameWins}` : null),
        isWinner: teamAIsWinner,
        status: match.winnerId ? 'PLAYED' : null,
        name: stripBracketSuffix(match.teamA.name),
      });
    } else {
      const teamALabel = getSourceMatchLabel(match.sourceMatchAId, !isLoserBracket, allMatches, matchToRoundMap, allRounds);
      participants.push({
        id: 'tbd-1',
        resultText: null,
        isWinner: false,
        status: null,
        name: teamALabel,
      });
    }

    // Team B (or source match label if not set)
    if (match.teamB) {
      const teamBIsWinner = match.winnerId === match.teamB.id;
      participants.push({
        id: match.teamB.id,
        resultText: teamBIsWinner ? `${teamBGameWins}` : (match.teamA && match.winnerId === match.teamA.id ? `${teamBGameWins}` : null),
        isWinner: teamBIsWinner,
        status: match.winnerId ? 'PLAYED' : null,
        name: stripBracketSuffix(match.teamB.name),
      });
    } else {
      const teamBLabel = getSourceMatchLabel(match.sourceMatchBId, !isLoserBracket, allMatches, matchToRoundMap, allRounds);
      participants.push({
        id: 'tbd-2',
        resultText: null,
        isWinner: false,
        status: null,
        name: teamBLabel,
      });
    }
  }

  // Ensure we always have at least 2 participants (library requirement)
  while (participants.length < 2) {
    participants.push({
      id: `tbd-${participants.length + 1}`,
      resultText: null,
      isWinner: false,
      status: null,
      name: 'TBD',
    });
  }

  return {
    id: match.id,
    name: match.id,
    nextMatchId: nextMatchId ?? null,
    nextLooserMatchId: nextLooserMatchId ?? null,
    startTime: '', // Required by library, empty string if not available
    tournamentRoundText: matchNumber,
    state,
    participants,
  };
}

/**
 * Get round label based on bracket type and depth
 */
function getRoundLabel(round: Round): string {
  const depth = round.depth ?? 0;

  if (round.bracketType === 'FINALS') {
    // True double elimination has 2 finals matches
    if (depth === 1) return 'Finals 1';
    if (depth === 0) return 'Finals 2';
    return 'Finals';
  }

  if (round.bracketType === 'WINNER') {
    if (depth === 0) return 'W Finals';
    if (depth === 1) return 'W Semis';
    if (depth === 2) return 'W Quarters';
    return `W Round ${depth}`;
  }

  if (round.bracketType === 'LOSER') {
    if (depth === 0) return 'L Finals';
    if (depth === 1) return 'L Semis';
    if (depth === 2) return 'L Quarters';
    return `L Round ${depth}`;
  }

  return `Round ${round.idx + 1}`;
}

/**
 * Transform rounds to react-tournament-brackets format
 */
export function transformRoundsToBracketFormat(rounds: Round[]): {
  upper: TournamentBracketMatch[];
  lower: TournamentBracketMatch[];
} {
  // Create a map of all matches for quick lookup
  const allMatchesMap = new Map<string, Match>();
  const matchToRoundMap = new Map<string, Round>();

  rounds.forEach(round => {
    if (!round || !round.matches) return;
    round.matches.forEach(match => {
      if (match && match.id) {
        allMatchesMap.set(match.id, match);
        matchToRoundMap.set(match.id, round);
      }
    });
  });

  // Separate rounds by bracket type
  const winnerRounds = rounds.filter(r => r && r.bracketType === 'WINNER');
  const loserRounds = rounds.filter(r => r && r.bracketType === 'LOSER');
  const finalsRounds = rounds.filter(r => r && r.bracketType === 'FINALS');

  console.log(`[BracketTransformer] Processing ${rounds.length} total rounds:`);
  console.log(`  Winner rounds: ${winnerRounds.length}`);
  console.log(`  Loser rounds: ${loserRounds.length}`);
  console.log(`  Finals rounds: ${finalsRounds.length}`);

  // Convert matches
  const upperMatches: TournamentBracketMatch[] = [];
  const lowerMatches: TournamentBracketMatch[] = [];

  // Winner bracket (upper)
  winnerRounds.forEach((round, idx) => {
    if (!round || !round.matches) return;
    console.log(`BracketTransformer: Processing winner round ${idx + 1} (depth ${round.depth}) with ${round.matches.length} matches`);
    round.matches.forEach(match => {
      if (match && match.id) {
        console.log(`BracketTransformer: Converting winner match ${match.id}:`, {
          teamA: match.teamA?.name || 'TBD',
          teamB: match.teamB?.name || 'TBD',
        });
        const converted = convertMatch(match, round, allMatchesMap, matchToRoundMap, rounds);
        if (converted) {
          upperMatches.push(converted);
        }
      }
    });
  });

  // Loser bracket (lower)
  loserRounds.forEach((round, idx) => {
    if (!round || !round.matches) return;
    console.log(`BracketTransformer: Processing loser round ${idx} (depth ${round.depth}) with ${round.matches.length} matches`);
    round.matches.forEach(match => {
      if (match && match.id) {
        console.log(`BracketTransformer: Converting loser match ${match.id.slice(0, 8)}:`, {
          teamA: match.teamA?.name || 'TBD',
          teamB: match.teamB?.name || 'TBD',
        });
        const converted = convertMatch(match, round, allMatchesMap, matchToRoundMap, rounds);
        if (converted) {
          console.log(`  -> nextMatchId: ${converted.nextMatchId?.slice(0, 8) || 'NULL'}`);
          lowerMatches.push(converted);
        }
      }
    });
  });

  // Finals matches (go in upper bracket)
  // Sort by depth (higher depth = earlier finals, e.g., Finals 1 before Finals 2)
  const sortedFinalsRounds = [...finalsRounds].sort((a, b) => (b.depth ?? 0) - (a.depth ?? 0));

  sortedFinalsRounds.forEach((round, idx) => {
    if (!round || !round.matches) return;
    console.log(`BracketTransformer: Processing finals round ${idx + 1} (depth ${round.depth}) with ${round.matches.length} matches`);
    round.matches.forEach(match => {
      if (match && match.id) {
        // For bracket reset: Only show Finals 2 (depth 0) if teams are assigned
        const isFinals2 = round.depth === 0;
        const shouldShowFinals2 = !isFinals2 || (match.teamA && match.teamB);

        if (shouldShowFinals2) {
          console.log(`BracketTransformer: Converting finals match ${match.id.slice(0, 8)}:`, {
            depth: round.depth,
            teamA: match.teamA?.name || 'TBD',
            teamB: match.teamB?.name || 'TBD',
          });
          const converted = convertMatch(match, round, allMatchesMap, matchToRoundMap, rounds);
          if (converted) {
            upperMatches.push(converted);
          }
        } else {
          console.log(`BracketTransformer: Skipping Finals 2 (no teams assigned yet)`);
        }
      }
    });
  });

  // Validate that all referenced matches exist
  const allConvertedMatchIds = new Set([
    ...upperMatches.map(m => m.id),
    ...lowerMatches.map(m => m.id),
  ]);

  // Filter out invalid nextMatchId references
  const validatedUpper = upperMatches.map(match => {
    if (match.nextMatchId && !allConvertedMatchIds.has(match.nextMatchId)) {
      return { ...match, nextMatchId: null };
    }
    if (match.nextLooserMatchId && !allConvertedMatchIds.has(match.nextLooserMatchId)) {
      return { ...match, nextLooserMatchId: undefined };
    }
    return match;
  });

  const validatedLower = lowerMatches.map(match => {
    if (match.nextMatchId && !allConvertedMatchIds.has(match.nextMatchId)) {
      return { ...match, nextMatchId: null };
    }
    if (match.nextLooserMatchId && !allConvertedMatchIds.has(match.nextLooserMatchId)) {
      return { ...match, nextLooserMatchId: undefined };
    }
    return match;
  });

  // Ensure no undefined/null matches slip through - library crashes on undefined
  // Also ensure all required properties exist with proper types
  const finalUpper = validatedUpper.filter((m): m is TournamentBracketMatch => {
    if (!m || typeof m !== 'object') return false;
    if (!('id' in m) || !m.id) return false;
    if (!('nextMatchId' in m)) return false; // Must have property even if null
    if (!('participants' in m) || !Array.isArray(m.participants)) return false;
    if (!('state' in m)) return false;
    return true;
  });

  const finalLower = validatedLower.filter((m): m is TournamentBracketMatch => {
    if (!m || typeof m !== 'object') return false;
    if (!('id' in m) || !m.id) return false;
    if (!('nextMatchId' in m)) return false; // Must have property even if null
    if (!('participants' in m) || !Array.isArray(m.participants)) return false;
    if (!('state' in m)) return false;
    return true;
  });

  console.log(`[BracketTransformer] Final counts - Upper: ${finalUpper.length}, Lower: ${finalLower.length}`);

  return {
    upper: finalUpper,
    lower: finalLower,
  };
}

