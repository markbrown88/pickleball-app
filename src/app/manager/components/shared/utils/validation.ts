/**
 * Validation Utilities
 *
 * Utilities for validating matchups, schedules, and detecting duplicates.
 */

import type { EventManagerTournament } from '../types';

/**
 * Check for duplicate matchups within a stop
 */
export function checkForDuplicateMatchups(
  stopId: string,
  roundMatchups: Record<string, any[]>,
  scheduleData: Record<string, any[]>,
  tournaments: EventManagerTournament[],
  onError: (message: string) => void
): void {
  const allMatches: any[] = [];

  // Collect all matches from all rounds in this stop
  Object.values(roundMatchups).forEach(matches => {
    allMatches.push(...matches);
  });

  // Create a map to track team pairings
  const teamPairings = new Map<string, { count: number; matches: any[] }>();

  allMatches.forEach(match => {
    if (match.isBye || !match.teamA || !match.teamB) return;

    // Create a consistent key for the team pairing (alphabetically sorted)
    const teamAId = match.teamA.id;
    const teamBId = match.teamB.id;
    const pairingKey = teamAId < teamBId ? `${teamAId}-${teamBId}` : `${teamBId}-${teamAId}`;

    if (!teamPairings.has(pairingKey)) {
      teamPairings.set(pairingKey, { count: 0, matches: [] });
    }

    const pairing = teamPairings.get(pairingKey)!;
    pairing.count++;
    pairing.matches.push(match);
  });

  // Check for duplicates and show alerts
  let duplicateCount = 0;
  const duplicateMessages: string[] = [];

  teamPairings.forEach((pairing, pairingKey) => {
    if (pairing.count > 1) {
      duplicateCount++;
      const [teamAId, teamBId] = pairingKey.split('-');
      const firstMatch = pairing.matches[0];
      const teamAName = firstMatch.teamA.id === teamAId ? firstMatch.teamA.name : firstMatch.teamB.name;
      const teamBName = firstMatch.teamA.id === teamBId ? firstMatch.teamA.name : firstMatch.teamB.name;

      // Get round numbers for this duplicate
      const rounds = pairing.matches.map(match => {
        // Find which round this match belongs to
        for (const [roundId, matches] of Object.entries(roundMatchups)) {
          if (matches.some(m => m.id === match.id)) {
            // Find the round index from scheduleData
            const stopSchedule = scheduleData[stopId] || [];
            const round = stopSchedule.find(r => r.id === roundId);
            return round?.idx || 'Unknown';
          }
        }
        return 'Unknown';
      }).sort((a: any, b: any) => a - b);

      const roundsText = rounds.join(' & ');

      duplicateMessages.push(`${teamAName} vs ${teamBName} (${pairing.count} times) - Rounds ${roundsText}`);
    }
  });

  // Show all duplicates in a single error message
  if (duplicateCount > 0) {
    // Get stop name from the current tournament
    const currentStop = tournaments[0]?.stops?.find(s => s.stopId === stopId);
    const stopDisplayName = currentStop?.stopName || `Stop ${stopId}`;

    onError(
      `⚠️ ${duplicateCount} duplicate matchup(s) detected in ${stopDisplayName}:\n${duplicateMessages.join('\n')}`
    );
  }
}

/**
 * Check for duplicate matchups using schedule data directly
 */
export function checkForDuplicateMatchupsFromSchedule(
  stopId: string,
  roundMatchups: Record<string, any[]>,
  scheduleData: any[],
  tournaments: EventManagerTournament[],
  onError: (message: string) => void
): void {
  const allMatches: any[] = [];

  // Collect all matches from all rounds in this stop
  Object.values(roundMatchups).forEach(matches => {
    allMatches.push(...matches);
  });

  // Create a map to track team pairings
  const teamPairings = new Map();

  allMatches.forEach(match => {
    if (match.isBye || !match.teamA || !match.teamB) return;

    // Create a consistent key for the team pairing (alphabetically sorted)
    const teamAId = match.teamA.id;
    const teamBId = match.teamB.id;
    const pairingKey = teamAId < teamBId ? `${teamAId}-${teamBId}` : `${teamBId}-${teamAId}`;

    if (!teamPairings.has(pairingKey)) {
      teamPairings.set(pairingKey, { count: 0, matches: [] });
    }

    const pairing = teamPairings.get(pairingKey);
    pairing.count++;
    pairing.matches.push(match);
  });

  // Check for duplicates and show alerts
  let duplicateCount = 0;
  const duplicateMessages: string[] = [];

  teamPairings.forEach((pairing, pairingKey) => {
    if (pairing.count > 1) {
      duplicateCount++;
      const [teamAId, teamBId] = pairingKey.split('-');
      const firstMatch = pairing.matches[0];
      const teamAName = firstMatch.teamA.id === teamAId ? firstMatch.teamA.name : firstMatch.teamB.name;
      const teamBName = firstMatch.teamA.id === teamBId ? firstMatch.teamA.name : firstMatch.teamB.name;

      // Get round numbers for this duplicate using schedule data
      const rounds = pairing.matches.map((match: any) => {
        // Find which round this match belongs to in the schedule data
        for (const round of scheduleData) {
          if (round.matches?.some((m: any) => m.id === match.id)) {
            return round.idx;
          }
        }
        return 'Unknown';
      }).sort((a: any, b: any) => a - b);

      const roundsText = rounds.join(' & ');

      duplicateMessages.push(`${teamAName} vs ${teamBName} (${pairing.count} times) - Rounds ${roundsText}`);
    }
  });

  // Show all duplicates in a single error message
  if (duplicateCount > 0) {
    // Get stop name from the current tournament
    const currentStop = tournaments[0]?.stops?.find(s => s.stopId === stopId);
    const stopDisplayName = currentStop?.stopName || `Stop ${stopId}`;

    onError(
      `⚠️ ${duplicateCount} duplicate matchup(s) detected in ${stopDisplayName}:\n${duplicateMessages.join('\n')}`
    );
  }
}
