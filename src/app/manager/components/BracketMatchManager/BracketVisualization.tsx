'use client';

/**
 * Bracket Visualization Component
 *
 * Uses react-tournament-brackets to display double elimination tournament bracket.
 * Shows winner bracket, loser bracket, and finals in a traditional bracket layout.
 */

import { useCallback, useState, useEffect, useMemo } from 'react';
import { DoubleEliminationBracket } from '@g-loot/react-tournament-brackets';
import { transformRoundsToBracketFormat } from '@/lib/brackets/bracketTransformer';
import { CustomBracketMatch } from './CustomBracketMatch';
import { BracketMatchModal } from './BracketMatchModal';

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
  bracketId?: string | null;
  bracket?: { id: string; name: string } | null;
  teamAScore: number | null;
  teamBScore: number | null;
  isComplete: boolean;
  startedAt: string | null;
  teamALineup?: any[];
  teamBLineup?: any[];
}

interface BracketVisualizationProps {
  rounds: Round[];
  lineups: Record<string, Record<string, any[]>>; // bracketId -> teamId -> players
  onMatchUpdate?: () => void;
  onError?: (message: string) => void;
  onInfo?: (message: string) => void;
}

/**
 * Hook to get window dimensions for responsive sizing
 */
function useWindowSize() {
  const [size, setSize] = useState<[number, number]>([0, 0]);

  useEffect(() => {
    function updateSize() {
      setSize([window.innerWidth, window.innerHeight]);
    }
    window.addEventListener('resize', updateSize);
    updateSize();
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  return size;
}

export function BracketVisualization({
  rounds,
  lineups,
  onMatchUpdate,
  onError,
  onInfo,
}: BracketVisualizationProps) {
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [width, height] = useWindowSize();

  // Refresh selectedMatch when rounds update (e.g., after reloading bracket data)
  useEffect(() => {
    if (selectedMatch) {
      // Find the updated match data from the fresh rounds
      const updatedMatch = rounds
        .flatMap(r => r.matches)
        .find(m => m.id === selectedMatch.id);
      
      if (updatedMatch) {
        setSelectedMatch(updatedMatch);
      }
    }
  }, [rounds, selectedMatch?.id]);

  // Transform rounds to bracket format
  const bracketData = useMemo(() => {
    if (!rounds || rounds.length === 0) {
      console.log('BracketVisualization: No rounds provided');
      return { upper: [], lower: [] };
    }
    try {
      console.log('BracketVisualization: Transforming rounds', { roundCount: rounds.length });
      const transformed = transformRoundsToBracketFormat(rounds);
      
      console.log('BracketVisualization: Transformation result', {
        upperCount: transformed.upper?.length || 0,
        lowerCount: transformed.lower?.length || 0,
      });
      
      // Ensure we have valid arrays (filter out any undefined/null entries)
      const upper = (transformed.upper || []).filter(m => m && m.id);
      const lower = (transformed.lower || []).filter(m => m && m.id);
      
      console.log('BracketVisualization: After filtering', {
        upperCount: upper.length,
        lowerCount: lower.length,
      });
      
      // Ensure all matches have required fields and are valid objects
      const validatedUpper = upper
        .filter(m => m && typeof m === 'object' && m.id)
        .map(m => ({
          ...m,
          id: String(m.id || ''),
          nextMatchId: m.nextMatchId ? String(m.nextMatchId) : null,
          nextLooserMatchId: m.nextLooserMatchId ? String(m.nextLooserMatchId) : undefined,
          startTime: String(m.startTime || ''),
          tournamentRoundText: m.tournamentRoundText || '',
          state: m.state || 'NO_PARTY',
          participants: Array.isArray(m.participants) 
            ? m.participants.filter(p => p && p.id).map(p => ({
                id: String(p.id || ''),
                name: String(p.name || ''),
                resultText: p.resultText ?? null,
                isWinner: Boolean(p.isWinner),
                status: p.status ?? null,
              }))
            : [],
        }));
      
      const validatedLower = lower
        .filter(m => m && typeof m === 'object' && m.id)
        .map(m => ({
          ...m,
          id: String(m.id || ''),
          nextMatchId: m.nextMatchId ? String(m.nextMatchId) : null,
          nextLooserMatchId: m.nextLooserMatchId ? String(m.nextLooserMatchId) : undefined,
          startTime: String(m.startTime || ''),
          tournamentRoundText: m.tournamentRoundText || '',
          state: m.state || 'NO_PARTY',
          participants: Array.isArray(m.participants)
            ? m.participants.filter(p => p && p.id).map(p => ({
                id: String(p.id || ''),
                name: String(p.name || ''),
                resultText: p.resultText ?? null,
                isWinner: Boolean(p.isWinner),
                status: p.status ?? null,
              }))
            : [],
        }));
      
      // Additional validation: ensure all nextMatchId references point to existing matches
      const allMatchIds = new Set([...validatedUpper.map(m => m.id), ...validatedLower.map(m => m.id)]);
      
      const finalUpper = validatedUpper.map(m => ({
        ...m,
        nextMatchId: (m.nextMatchId && allMatchIds.has(m.nextMatchId)) ? m.nextMatchId : null,
        nextLooserMatchId: (m.nextLooserMatchId && allMatchIds.has(m.nextLooserMatchId)) ? m.nextLooserMatchId : undefined,
      }));
      
      const finalLower = validatedLower.map(m => ({
        ...m,
        nextMatchId: (m.nextMatchId && allMatchIds.has(m.nextMatchId)) ? m.nextMatchId : null,
        nextLooserMatchId: (m.nextLooserMatchId && allMatchIds.has(m.nextLooserMatchId)) ? m.nextLooserMatchId : undefined,
      }));
      
      return { upper: finalUpper, lower: finalLower };
    } catch (error) {
      console.error('BracketVisualization: Error transforming bracket data:', error);
      if (onError) {
        onError('Failed to transform bracket data');
      }
      return { upper: [], lower: [] };
    }
  }, [rounds, onError]);

  // Calculate viewport size - use full width, no height limit
  const finalWidth = width > 0 ? width - 100 : 1200;

  const handleMatchClick = useCallback(
    (args: { match: { id: string }; topWon: boolean; bottomWon: boolean }) => {
      // Always get fresh match data from rounds (in case data was updated)
      const match = rounds
        .flatMap(r => r.matches)
        .find(m => m.id === args.match.id);

      if (match) {
        console.log('Opening match modal:', match.id, 'Games:', match.games.length, 'Completed:', match.games.filter(g => g.isComplete).length);
        setSelectedMatch(match);
      } else {
        console.warn('Match not found in rounds data:', args.match.id);
      }
    },
    [rounds]
  );

  const handleModalClose = () => {
    setSelectedMatch(null);
  };

  const handleMatchUpdate = async () => {
    if (onMatchUpdate) {
      // Call parent's update handler which will reload bracket data
      await onMatchUpdate();
      
      // If a match is selected, refresh it from the updated rounds
      if (selectedMatch) {
        const updatedMatch = rounds
          .flatMap(r => r.matches)
          .find(m => m.id === selectedMatch.id);
        
        if (updatedMatch) {
          setSelectedMatch(updatedMatch);
        }
      }
    }
  };

  if (rounds.length === 0 || (!bracketData.upper.length && !bracketData.lower.length)) {
    console.log('BracketVisualization: No data to display', {
      roundsCount: rounds.length,
      upperCount: bracketData.upper.length,
      lowerCount: bracketData.lower.length,
    });
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-gray-900 rounded-lg border border-gray-700">
        <p className="text-gray-400">No bracket data available</p>
        <p className="text-gray-500 text-sm mt-2">Rounds: {rounds.length}, Upper: {bracketData.upper.length}, Lower: {bracketData.lower.length}</p>
      </div>
    );
  }

  // Additional validation: ensure bracketData structure is valid
  if (!bracketData || typeof bracketData !== 'object' || !Array.isArray(bracketData.upper) || !Array.isArray(bracketData.lower)) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-gray-900 rounded-lg border border-gray-700">
        <p className="text-gray-400">Invalid bracket data format</p>
      </div>
    );
  }

  // The library's findTheFinals function expects certain bracket structures.
  // It tries to find the "last" match in each bracket by checking for matches that don't have
  // a nextMatchId pointing to another match in the same bracket.
  // If find() returns undefined, accessing properties on it fails.
  // We need to ensure the bracket structure is valid before passing it to the library.
  
  // Step 1: Sanitize data - ensure all nextMatchId references point to existing matches
  const allMatchIds = new Set([...bracketData.upper.map(m => m.id), ...bracketData.lower.map(m => m.id)]);
  
  const safeBracketData = {
    upper: bracketData.upper.map(m => ({
      ...m,
      // Ensure nextMatchId only points to existing matches
      nextMatchId: (m.nextMatchId && allMatchIds.has(m.nextMatchId)) ? m.nextMatchId : null,
      nextLooserMatchId: (m.nextLooserMatchId && allMatchIds.has(m.nextLooserMatchId)) ? m.nextLooserMatchId : undefined,
    })),
    lower: bracketData.lower.map(m => ({
      ...m,
      // Ensure nextMatchId only points to existing matches
      nextMatchId: (m.nextMatchId && allMatchIds.has(m.nextMatchId)) ? m.nextMatchId : null,
      nextLooserMatchId: (m.nextLooserMatchId && allMatchIds.has(m.nextLooserMatchId)) ? m.nextLooserMatchId : undefined,
    })),
  };
  
  // Step 2: Validate that the library's findTheFinals function won't crash
  // The library checks isFinalInLower/isFinalInUpper first, then tries to find lastUpper/lastLower
  // If find() returns undefined, accessing .nextMatchId on it crashes
  
  const isFinalInUpper = safeBracketData.upper.some(match => !match.nextMatchId);
  const isFinalInLower = safeBracketData.lower.some(match => !match.nextMatchId);
  
  // Simulate what the library does - find the "last" match in each bracket
  // A "last" match is one that doesn't have a nextMatchId pointing to another match in the same bracket
  const lastUpper = safeBracketData.upper.find(match => {
    const hasNextMatchInUpper = safeBracketData.upper.some(m => m.id === match.nextMatchId);
    return !hasNextMatchInUpper;
  });
  
  const lastLower = safeBracketData.lower.find(match => {
    const hasNextMatchInLower = safeBracketData.lower.some(m => m.id === match.nextMatchId);
    return !hasNextMatchInLower;
  });
  
  // Debug logging
  console.log('Bracket validation:', {
    upperCount: safeBracketData.upper.length,
    lowerCount: safeBracketData.lower.length,
    isFinalInUpper,
    isFinalInLower,
    lastUpper: lastUpper ? { id: lastUpper.id, nextMatchId: lastUpper.nextMatchId } : null,
    lastLower: lastLower ? { id: lastLower.id, nextMatchId: lastLower.nextMatchId } : null,
  });
  
  // The library will crash if:
  // 1. isFinalInLower is true, upper has matches, but lastUpper is undefined (line 23: lastUpper.nextMatchId)
  // 2. isFinalInUpper is true, lower has matches, but lastLower is undefined (line 34: lastLower.nextMatchId)
  // 3. lastUpper exists but lastUpper.nextMatchId is null/undefined when the library tries to find convergingMatch
  
  if (isFinalInLower && safeBracketData.upper.length > 0 && !lastUpper) {
    console.warn('Invalid bracket structure: isFinalInLower=true but upper bracket has no valid final match', {
      upperMatches: safeBracketData.upper.map(m => ({ id: m.id, nextMatchId: m.nextMatchId })),
    });
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-gray-900 rounded-lg border border-gray-700">
        <p className="text-gray-400">Bracket structure is incomplete. Please regenerate the bracket.</p>
      </div>
    );
  }
  
  if (isFinalInUpper && safeBracketData.lower.length > 0 && !lastLower) {
    console.warn('Invalid bracket structure: isFinalInUpper=true but lower bracket has no valid final match', {
      lowerMatches: safeBracketData.lower.map(m => ({ id: m.id, nextMatchId: m.nextMatchId })),
    });
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-gray-900 rounded-lg border border-gray-700">
        <p className="text-gray-400">Bracket structure is incomplete. Please regenerate the bracket.</p>
      </div>
    );
  }
  
  // Additional check: if lastUpper exists, ensure it has a nextMatchId (library accesses lastUpper.nextMatchId)
  if (isFinalInLower && lastUpper && !lastUpper.nextMatchId) {
    console.warn('Invalid bracket structure: lastUpper exists but has no nextMatchId', {
      lastUpper: { id: lastUpper.id, nextMatchId: lastUpper.nextMatchId },
    });
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-gray-900 rounded-lg border border-gray-700">
        <p className="text-gray-400">Bracket structure is incomplete. Please regenerate the bracket.</p>
      </div>
    );
  }
  
  // Additional check: if lastLower exists, ensure it has a nextMatchId (library accesses lastLower.nextMatchId)
  if (isFinalInUpper && lastLower && !lastLower.nextMatchId) {
    console.warn('Invalid bracket structure: lastLower exists but has no nextMatchId', {
      lastLower: { id: lastLower.id, nextMatchId: lastLower.nextMatchId },
    });
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-gray-900 rounded-lg border border-gray-700">
        <p className="text-gray-400">Bracket structure is incomplete. Please regenerate the bracket.</p>
      </div>
    );
  }
  
  return (
    <>
      <div className="w-full bg-gray-900 rounded-lg border border-gray-700 p-4 overflow-x-auto overflow-y-visible">
        <div style={{ width: finalWidth }}>
          <DoubleEliminationBracket
            matches={safeBracketData}
            matchComponent={CustomBracketMatch}
            onMatchClick={handleMatchClick}
            options={{
              style: {
                roundHeader: {
                  backgroundColor: '#1f2937',
                  fontColor: '#fff',
                },
                connectorColor: '#374151',
                connectorColorHighlight: '#3b82f6',
              },
            }}
          />
        </div>
      </div>

      {/* Scoring Modal */}
      <BracketMatchModal
        match={selectedMatch}
        lineups={lineups}
        onClose={handleModalClose}
        onUpdate={handleMatchUpdate}
        onError={onError || (() => {})}
        onInfo={onInfo || (() => {})}
      />
    </>
  );
}
