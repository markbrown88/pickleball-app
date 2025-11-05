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
 * Convert a match to tournament bracket format
 */
function convertMatch(
  match: Match,
  round: Round,
  allMatches: Map<string, Match>,
  matchToRoundMap: Map<string, Round>
): TournamentBracketMatch | null {
  if (!match || !match.id || !round) {
    return null;
  }
  const roundLabel = getRoundLabel(round);
  
  // Determine match state
  let state: TournamentBracketMatch['state'] = 'NO_PARTY';
  if (match.isBye) {
    state = 'WALK_OVER';
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
      if (!targetRound) continue;

      if (round.bracketType === 'WINNER' && targetRound.bracketType === 'WINNER') {
        nextMatchId = matchId;
      } else if (round.bracketType === 'WINNER' && targetRound.bracketType === 'LOSER') {
        nextLooserMatchId = matchId;
      } else if (round.bracketType === 'LOSER' && targetRound.bracketType === 'LOSER') {
        nextMatchId = matchId;
      } else if (round.bracketType === 'LOSER' && targetRound.bracketType === 'FINALS') {
        nextMatchId = matchId;
      } else if (round.bracketType === 'WINNER' && targetRound.bracketType === 'FINALS') {
        nextMatchId = matchId;
      }
    }
  }

  // Build participants array
  const participants: TournamentBracketMatch['participants'] = [];

  if (match.isBye && match.teamA) {
    // Bye match - only teamA advances
    participants.push({
      id: match.teamA.id,
      resultText: 'WON',
      isWinner: true,
      status: 'WALK_OVER',
      name: stripBracketSuffix(match.teamA.name),
    });
  } else if (match.teamA && match.teamB) {
    const { teamAGameWins, teamBGameWins } = calculateGameWins(match.games);
    const teamAIsWinner = match.winnerId === match.teamA.id;
    const teamBIsWinner = match.winnerId === match.teamB.id;

    // Team A
    participants.push({
      id: match.teamA.id,
      resultText: teamAIsWinner ? `${teamAGameWins}` : (teamBIsWinner ? `${teamAGameWins}` : null),
      isWinner: teamAIsWinner,
      status: match.winnerId ? 'PLAYED' : null,
      name: stripBracketSuffix(match.teamA.name),
    });

    // Team B
    participants.push({
      id: match.teamB.id,
      resultText: teamBIsWinner ? `${teamBGameWins}` : (teamAIsWinner ? `${teamBGameWins}` : null),
      isWinner: teamBIsWinner,
      status: match.winnerId ? 'PLAYED' : null,
      name: stripBracketSuffix(match.teamB.name),
    });
  } else {
    // TBD - no teams assigned yet
    participants.push({
      id: 'tbd-1',
      resultText: null,
      isWinner: false,
      status: null,
      name: 'TBD',
    });
    participants.push({
      id: 'tbd-2',
      resultText: null,
      isWinner: false,
      status: null,
      name: 'TBD',
    });
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
    tournamentRoundText: roundLabel,
    state,
    participants,
  };
}

/**
 * Get round label based on bracket type and depth
 */
function getRoundLabel(round: Round): string {
  if (round.bracketType === 'FINALS') {
    return 'Finals';
  }

  const depth = round.depth ?? 0;

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

  // Convert matches
  const upperMatches: TournamentBracketMatch[] = [];
  const lowerMatches: TournamentBracketMatch[] = [];

  // Winner bracket (upper)
  winnerRounds.forEach(round => {
    if (!round || !round.matches) return;
    round.matches.forEach(match => {
      if (match && match.id) {
        const converted = convertMatch(match, round, allMatchesMap, matchToRoundMap);
        if (converted) {
          upperMatches.push(converted);
        }
      }
    });
  });

  // Finals goes to upper bracket
  finalsRounds.forEach(round => {
    if (!round || !round.matches) return;
    round.matches.forEach(match => {
      if (match && match.id) {
        const converted = convertMatch(match, round, allMatchesMap, matchToRoundMap);
        if (converted) {
          upperMatches.push(converted);
        }
      }
    });
  });

  // Loser bracket (lower)
  loserRounds.forEach(round => {
    if (!round || !round.matches) return;
    round.matches.forEach(match => {
      if (match && match.id) {
        const converted = convertMatch(match, round, allMatchesMap, matchToRoundMap);
        if (converted) {
          lowerMatches.push(converted);
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

  return {
    upper: validatedUpper.filter(m => m && m.id),
    lower: validatedLower.filter(m => m && m.id),
  };
}

