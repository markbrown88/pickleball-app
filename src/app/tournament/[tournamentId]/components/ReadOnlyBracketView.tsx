'use client';

/**
 * Read-Only Bracket Visualization for Public Tournament View
 *
 * Displays double elimination bracket without edit capabilities.
 * Shows match details in a simple modal on click.
 */

import { useState, useEffect, useMemo } from 'react';
import { DoubleEliminationBracket } from '@g-loot/react-tournament-brackets';
import { transformRoundsToBracketFormat } from '@/lib/brackets/bracketTransformer';
import { CustomBracketMatch } from './CustomBracketMatch';
import { MatchDetailsModal } from './MatchDetailsModal';

interface Round {
  id: string;
  idx: number;
  bracketType: string | null;
  depth: number | null;
  matches: Match[];
}

interface Match {
  id: string;
  teamA: { id: string; name: string; club?: { name: string } } | null;
  teamB: { id: string; name: string; club?: { name: string } } | null;
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
  startedAt: string | null;
  teamALineup?: any[];
  teamBLineup?: any[];
}

interface ReadOnlyBracketViewProps {
  stopId: string;
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

export function ReadOnlyBracketView({ stopId }: ReadOnlyBracketViewProps) {
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [width] = useWindowSize();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch bracket data
  useEffect(() => {
    async function fetchBracketData() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/public/stops/${stopId}/bracket`);
        if (!response.ok) {
          throw new Error('Failed to fetch bracket data');
        }
        const data = await response.json();
        setRounds(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching bracket data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load bracket');
      } finally {
        setLoading(false);
      }
    }

    if (stopId) {
      fetchBracketData();
    }
  }, [stopId]);

  // Transform rounds to bracket format
  const bracketData = useMemo(() => {
    if (!rounds || rounds.length === 0) {
      return { upper: [], lower: [] };
    }
    try {
      const transformed = transformRoundsToBracketFormat(rounds);

      // Ensure we have valid arrays
      const upper = (transformed.upper || []).filter(m => m && m.id);
      const lower = (transformed.lower || []).filter(m => m && m.id);

      // Validate and sanitize match data
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

      // Validate nextMatchId references
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
      console.error('ReadOnlyBracketView: Error transforming bracket data:', error);
      return { upper: [], lower: [] };
    }
  }, [rounds]);

  // Calculate viewport size
  const isMobile = width > 0 && width < 768;
  const finalWidth = isMobile ? width - 40 : width - 100;

  const handleMatchClick = (args: { match: { id: string }; topWon: boolean; bottomWon: boolean }) => {
    // Find match in rounds data
    const match = rounds
      .flatMap(r => r.matches)
      .find(m => m.id === args.match.id);

    if (match) {
      setSelectedMatch(match);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center bg-surface rounded-lg border border-subtle">
        <div className="flex items-center gap-3">
          <div className="loading-spinner"></div>
          <span className="text-muted">Loading bracket...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center bg-surface rounded-lg border border-subtle">
        <div className="text-center">
          <p className="text-muted">Failed to load bracket</p>
          <p className="text-xs text-muted mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (rounds.length === 0 || (!bracketData.upper.length && !bracketData.lower.length)) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center bg-surface rounded-lg border border-subtle">
        <div className="text-center">
          <p className="text-muted">No bracket data available</p>
          <p className="text-xs text-muted mt-2">The tournament bracket has not been generated yet.</p>
        </div>
      </div>
    );
  }

  // Validate bracket structure
  if (!bracketData || typeof bracketData !== 'object' || !Array.isArray(bracketData.upper) || !Array.isArray(bracketData.lower)) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center bg-surface rounded-lg border border-subtle">
        <p className="text-muted">Invalid bracket data format</p>
      </div>
    );
  }

  const cleanUpper = bracketData.upper.filter(m => m && m.id);
  const cleanLower = bracketData.lower.filter(m => m && m.id);

  if (cleanUpper.length === 0 && cleanLower.length === 0) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center bg-surface rounded-lg border border-subtle">
        <p className="text-muted">No matches in bracket</p>
      </div>
    );
  }

  if (cleanUpper.length === 0 || cleanLower.length === 0) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center bg-surface rounded-lg border border-subtle text-center px-6">
        <div>
          <p className="text-primary font-medium">Bracket cannot be rendered</p>
          <p className="text-muted text-sm mt-2">
            Double elimination bracket requires both winner and loser brackets.
          </p>
        </div>
      </div>
    );
  }

  const allMatchIds = new Set([...cleanUpper.map(m => m.id), ...cleanLower.map(m => m.id)]);

  const safeBracketData = {
    upper: cleanUpper.map(m => ({
      ...m,
      nextMatchId: (m.nextMatchId && allMatchIds.has(m.nextMatchId)) ? m.nextMatchId : null,
      nextLooserMatchId: (m.nextLooserMatchId && allMatchIds.has(m.nextLooserMatchId)) ? m.nextLooserMatchId : undefined,
    })),
    lower: cleanLower.map(m => ({
      ...m,
      nextMatchId: (m.nextMatchId && allMatchIds.has(m.nextMatchId)) ? m.nextMatchId : null,
      nextLooserMatchId: (m.nextLooserMatchId && allMatchIds.has(m.nextLooserMatchId)) ? m.nextLooserMatchId : undefined,
    })),
  };

  // Fix SVG heights for match boxes
  useEffect(() => {
    const fixSvgHeights = () => {
      const svgs = document.querySelectorAll('.bracket-container svg');
      svgs.forEach((svg) => {
        const htmlSvg = svg as SVGElement;
        const currentHeight = htmlSvg.getAttribute('height');
        const viewBox = htmlSvg.getAttribute('viewBox');

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
            foreignObject.setAttribute('y', '0');
          }
        }
      });
    };

    fixSvgHeights();
    const timeout = setTimeout(fixSvgHeights, 100);
    return () => clearTimeout(timeout);
  }, [safeBracketData]);

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .bracket-container svg {
              height: 160px !important;
              min-height: 160px !important;
            }
            .bracket-container svg foreignObject {
              height: 160px !important;
              min-height: 160px !important;
              overflow: visible !important;
            }
          `,
        }}
      />
      <div className="w-full bg-surface rounded-lg border border-subtle p-2 md:p-4 overflow-x-auto overflow-y-visible bracket-container">
        <div style={{ minWidth: finalWidth, width: 'max-content', padding: '20px 0' }}>
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

      {/* Read-only Match Details Modal */}
      {selectedMatch && (
        <MatchDetailsModal
          match={selectedMatch}
          onClose={() => setSelectedMatch(null)}
        />
      )}
    </>
  );
}
