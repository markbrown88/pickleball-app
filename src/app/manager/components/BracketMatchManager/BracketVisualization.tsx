'use client';

/**
 * Bracket Visualization Component
 *
 * Uses react-tournament-brackets to display double elimination tournament bracket.
 * Shows winner bracket, loser bracket, and finals in a traditional bracket layout.
 */

import { useCallback, useState, useEffect, useMemo, ReactNode } from 'react';
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
  teamA: { id: string; name: string; club?: { name: string } | null } | null;
  teamB: { id: string; name: string; club?: { name: string } | null } | null;
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
  tournamentType: string;
  stopId: string;
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

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateSize);
      updateSize();
      return () => window.removeEventListener('resize', updateSize);
    }
  }, []);

  return size;
}

export function BracketVisualization({
  rounds,
  tournamentType,
  stopId,
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
      return { upper: [], lower: [] };
    }
    try {
      const transformed = transformRoundsToBracketFormat(rounds, tournamentType);
      
      
      // Ensure we have valid arrays (filter out any undefined/null entries)
      const upper = (transformed.upper || []).filter(m => m && m.id);
      const lower = (transformed.lower || []).filter(m => m && m.id);
      
      
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
        setSelectedMatch(match);
      } else {
        console.warn('Match not found in rounds data:', args.match.id);
      }
    },
    [rounds]
  );

  const handleModalClose = async () => {
    // Close the modal
    setSelectedMatch(null);

    // Refresh bracket data to ensure next time we open a match, we have fresh data
    // This ensures game statuses and scores are up-to-date when reopening
    if (onMatchUpdate) {
      await onMatchUpdate();
    }
  };

  const handleMatchUpdate = async () => {
    if (onMatchUpdate) {
      // Store the currently selected match ID to keep modal open
      const currentMatchId = selectedMatch?.id;
      
      // Call parent's update handler which will reload bracket data
      await onMatchUpdate();
      
      // Wait for React state to update - the rounds prop will change
      // We need to wait a bit longer for the state update to propagate
      await new Promise(resolve => setTimeout(resolve, 800));
      
      
      // The rounds prop should update after onMatchUpdate completes
      // If a match was selected, refresh it from the updated rounds to keep modal open
      if (currentMatchId) {
        const updatedMatch = rounds
          .flatMap(r => r.matches)
          .find(m => m.id === currentMatchId);
        
        if (updatedMatch) {
          // Update the selected match with fresh data, keeping modal open
          setSelectedMatch(updatedMatch);
        } else {
          console.warn('BracketVisualization: Updated match not found in rounds:', currentMatchId);
        }
      }
      
      // Also log all matches to see if winners advanced
      
    }
  };

  if (rounds.length === 0 || (!bracketData.upper.length && !bracketData.lower.length)) {
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
  // Early validation: Check if bracketData is valid
  if (!bracketData || typeof bracketData !== 'object') {
    console.error('[BracketVisualization] bracketData is invalid:', typeof bracketData);
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-gray-900 rounded-lg border border-gray-700">
        <p className="text-gray-400">No bracket data available.</p>
      </div>
    );
  }

  if (!Array.isArray(bracketData.upper) || !Array.isArray(bracketData.lower)) {
    console.error('[BracketVisualization] bracketData arrays are invalid:', {
      upperType: typeof bracketData.upper,
      lowerType: typeof bracketData.lower,
      isUpperArray: Array.isArray(bracketData.upper),
      isLowerArray: Array.isArray(bracketData.lower),
    });
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-gray-900 rounded-lg border border-gray-700">
        <p className="text-gray-400">Invalid bracket data structure.</p>
      </div>
    );
  }

  // First filter out any undefined/null matches
  const cleanUpper = bracketData.upper.filter(m => m && m.id);
  const cleanLower = bracketData.lower.filter(m => m && m.id);

  // Check if we have any matches at all
  if (cleanUpper.length === 0 && cleanLower.length === 0) {
    console.warn('[BracketVisualization] No valid matches found in bracket data');
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-gray-900 rounded-lg border border-gray-700">
        <p className="text-gray-400">No matches in bracket. Please generate a bracket first.</p>
      </div>
    );
  }

  // Library expects both winner and loser brackets to have at least one match
  if (cleanUpper.length === 0 || cleanLower.length === 0) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-gray-900 rounded-lg border border-gray-700 text-center px-6">
        <div>
          <p className="text-gray-300 font-medium">Bracket cannot be rendered</p>
          <p className="text-gray-400 text-sm mt-2">
            Double elimination bracket requires both winner and loser brackets. Add more teams or regenerate the bracket.
          </p>
        </div>
      </div>
    );
  }

  const allMatchIds = new Set([...cleanUpper.map(m => m.id), ...cleanLower.map(m => m.id)]);

  const safeBracketData = {
    upper: cleanUpper.map(m => ({
      ...m,
      // Ensure nextMatchId only points to existing matches
      nextMatchId: (m.nextMatchId && allMatchIds.has(m.nextMatchId)) ? m.nextMatchId : null,
      nextLooserMatchId: (m.nextLooserMatchId && allMatchIds.has(m.nextLooserMatchId)) ? m.nextLooserMatchId : undefined,
    })),
    lower: cleanLower.map(m => ({
      ...m,
      // Ensure nextMatchId only points to existing matches
      nextMatchId: (m.nextMatchId && allMatchIds.has(m.nextMatchId)) ? m.nextMatchId : null,
      nextLooserMatchId: (m.nextLooserMatchId && allMatchIds.has(m.nextLooserMatchId)) ? m.nextLooserMatchId : undefined,
    })),
  };
  if (typeof window !== 'undefined') {
    (window as any).__lastBracketData = safeBracketData;
    console.info('[BracketVisualization] Latest bracket data stored on window.__lastBracketData');
  }
  
  // Final safety check: Ensure no undefined/null matches in arrays

  const hasInvalidUpper = safeBracketData.upper.some(m => {
    if (!m || typeof m !== 'object') {
      console.error('[BracketVisualization] Invalid upper match: not an object', m);
      return true;
    }
    const matchObj = m as any;
    if (!matchObj.id) {
      console.error('[BracketVisualization] Invalid upper match: no id', matchObj);
      return true;
    }
    if (!('nextMatchId' in matchObj)) {
      console.error('[BracketVisualization] Invalid upper match: no nextMatchId property', matchObj.id);
      return true;
    }
    if (!matchObj.participants || !Array.isArray(matchObj.participants)) {
      console.error('[BracketVisualization] Invalid upper match: invalid participants', matchObj.id);
      return true;
    }
    if (!matchObj.state) {
      console.error('[BracketVisualization] Invalid upper match: no state', matchObj.id);
      return true;
    }
    return false;
  });

  const hasInvalidLower = safeBracketData.lower.some(m => {
    if (!m || typeof m !== 'object') {
      console.error('[BracketVisualization] Invalid lower match: not an object', m);
      return true;
    }
    const matchObj = m as any;
    if (!matchObj.id) {
      console.error('[BracketVisualization] Invalid lower match: no id', matchObj);
      return true;
    }
    if (!('nextMatchId' in matchObj)) {
      console.error('[BracketVisualization] Invalid lower match: no nextMatchId property', matchObj.id);
      return true;
    }
    if (!matchObj.participants || !Array.isArray(matchObj.participants)) {
      console.error('[BracketVisualization] Invalid lower match: invalid participants', matchObj.id);
      return true;
    }
    if (!matchObj.state) {
      console.error('[BracketVisualization] Invalid lower match: no state', matchObj.id);
      return true;
    }
    return false;
  });

  if (hasInvalidUpper || hasInvalidLower) {
    console.error('[BracketVisualization] Invalid match objects detected:', {
      hasInvalidUpper,
      hasInvalidLower,
      upperCount: safeBracketData.upper.length,
      lowerCount: safeBracketData.lower.length,
    });
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-gray-900 rounded-lg border border-gray-700">
        <p className="text-gray-400">Bracket data is corrupted. Please regenerate the bracket.</p>
      </div>
    );
  }


  // Fix SVG height after render to accommodate taller match boxes
  useEffect(() => {
    const fixSvgHeights = () => {
      // Try multiple selectors - the library might use different class names
      const svgs1 = document.querySelectorAll('.react-tournament-brackets svg');
      const svgs2 = document.querySelectorAll('svg[viewBox*="110"]');
      const svgs3 = document.querySelectorAll('svg[height="110"]');
      const svgs = Array.from(new Set([...svgs1, ...svgs2, ...svgs3]));
      
      
      svgs.forEach((svg, index) => {
        const htmlSvg = svg as SVGElement;
        const currentHeight = htmlSvg.getAttribute('height');
        const viewBox = htmlSvg.getAttribute('viewBox');
        
        // Check if this SVG needs fixing (height is 110 or viewBox contains 110)
        if (currentHeight === '110' || viewBox?.includes('110')) {
          htmlSvg.setAttribute('height', '160');
          if (viewBox) {
            const parts = viewBox.split(' ');
            if (parts.length === 4) {
              const newViewBox = `${parts[0]} ${parts[1]} ${parts[2]} 160`;
              htmlSvg.setAttribute('viewBox', newViewBox);
            }
          }
          const foreignObject = htmlSvg.querySelector('foreignObject');
          if (foreignObject) {
            foreignObject.setAttribute('height', '160');
            foreignObject.setAttribute('y', '0'); // Ensure it starts at the top
          }
        }
      });
    };

    // Run immediately
    fixSvgHeights();
    
    // Set up MutationObserver to catch dynamically added SVGs
    const observer = new MutationObserver((mutations) => {
      let shouldFix = false;
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || mutation.type === 'attributes') {
          shouldFix = true;
        }
      });
      if (shouldFix) {
        fixSvgHeights();
      }
    });
    
    // Observe the entire document body to catch SVGs wherever they're added
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['height', 'viewBox'],
    });
    
    // Also run after delays as fallback
    const timeout1 = setTimeout(fixSvgHeights, 100);
    const timeout2 = setTimeout(fixSvgHeights, 500);
    const timeout3 = setTimeout(fixSvgHeights, 1000);
    const timeout4 = setTimeout(fixSvgHeights, 2000);
    
    return () => {
      observer.disconnect();
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearTimeout(timeout3);
      clearTimeout(timeout4);
    };
  }, [safeBracketData]);
  
  let bracketContent: React.ReactNode;
  try {
    bracketContent = (
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
    );
  } catch (error) {
    console.error('[BracketVisualization] Failed to render bracket', error, {
      upper: safeBracketData.upper,
      lower: safeBracketData.lower,
    });
    bracketContent = (
      <div className="w-full h-[400px] flex items-center justify-center text-center text-gray-300">
        <div>
          <p className="font-semibold">Unable to display bracket</p>
          <p className="text-sm text-gray-400 mt-2">
            The bracket data is missing progression links. Please regenerate the bracket or contact support.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
        __html: `
          .react-tournament-brackets svg {
            height: 160px !important;
            min-height: 160px !important;
          }
          .react-tournament-brackets svg[height="110"] {
            height: 160px !important;
            min-height: 160px !important;
          }
          .react-tournament-brackets svg foreignObject {
            height: 160px !important;
            min-height: 160px !important;
            overflow: visible !important;
          }
        `,
      }}
      />
      <div
        className="w-full bg-gray-900 rounded-lg border border-gray-700 p-4 overflow-x-auto overflow-y-visible"
        style={{ minHeight: '400px' }}
      >
        <div style={{ minWidth: finalWidth, width: 'max-content', padding: '20px 0' }}>
          {bracketContent}
        </div>
      </div>

      {/* Scoring Modal */}
      {selectedMatch && (
        <BracketMatchModal
          match={selectedMatch}
          tournamentType={tournamentType}
          stopId={stopId}
          lineups={lineups}
          onClose={handleModalClose}
          onUpdate={handleMatchUpdate}
          onError={onError || (() => {})}
          onInfo={onInfo || (() => {})}
        />
      )}
    </>
  );
}
