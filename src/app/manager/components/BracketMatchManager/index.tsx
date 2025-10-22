'use client';

/**
 * Bracket Match Manager Component
 *
 * Manages matches in a bracket tournament (Double Elimination).
 * Displays rounds grouped by bracket type (Winner, Loser, Finals).
 * Handles score entry and match completion.
 */

import { useState, useEffect } from 'react';
import { BracketRound } from './BracketRound';
import { BracketVisualization } from './BracketVisualization';
import { EventManagerTournament } from '../shared/types';

interface BracketMatchManagerProps {
  tournament: EventManagerTournament;
  stopId: string;
  onError: (message: string) => void;
  onInfo: (message: string) => void;
}

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
}

interface Game {
  id: string;
  slot: string;
  teamAScore: number | null;
  teamBScore: number | null;
  isComplete: boolean;
  startedAt: string | null;
}

export function BracketMatchManager({
  tournament,
  stopId,
  onError,
  onInfo,
}: BracketMatchManagerProps) {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'diagram'>('list');

  // Load bracket data
  useEffect(() => {
    loadBracketData();
  }, [stopId]);

  async function loadBracketData() {
    try {
      setLoading(true);

      const response = await fetch(`/api/admin/stops/${stopId}/schedule`);
      if (!response.ok) {
        throw new Error('Failed to load bracket data');
      }

      const data = await response.json();
      // data is an array of rounds, not an object with a rounds property
      const roundsData = Array.isArray(data) ? data : [];
      setRounds(roundsData);

      // Auto-expand incomplete rounds
      const incomplete = new Set<string>();
      for (const round of roundsData) {
        const hasIncomplete = round.matches.some((m: Match) => !m.winnerId);
        if (hasIncomplete) {
          incomplete.add(round.id);
        }
      }
      setExpandedRounds(incomplete);
    } catch (error) {
      console.error('Error loading bracket:', error);
      onError(error instanceof Error ? error.message : 'Failed to load bracket');
    } finally {
      setLoading(false);
    }
  }

  const toggleRound = (roundId: string) => {
    setExpandedRounds(prev => {
      const next = new Set(prev);
      if (next.has(roundId)) {
        next.delete(roundId);
      } else {
        next.add(roundId);
      }
      return next;
    });
  };

  const handleMatchUpdate = async () => {
    // Reload bracket data after match update
    await loadBracketData();
  };

  if (loading) {
    return (
      <div className="card p-8 flex items-center justify-center gap-3">
        <div className="loading-spinner" />
        <span className="text-muted">Loading bracket...</span>
      </div>
    );
  }

  if (rounds.length === 0) {
    return (
      <div className="card p-8 text-center">
        <div className="max-w-md mx-auto space-y-3">
          <div className="text-5xl">🏆</div>
          <h3 className="text-lg font-semibold text-secondary">No Bracket Found</h3>
          <p className="text-muted">
            The bracket hasn't been generated yet. Click below to set up the bracket.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            Go to Bracket Setup
          </button>
        </div>
      </div>
    );
  }

  // Group rounds by bracket type
  const winnerRounds = rounds.filter(r => r.bracketType === 'WINNER');
  const loserRounds = rounds.filter(r => r.bracketType === 'LOSER');
  const finalsRounds = rounds.filter(r => r.bracketType === 'FINALS');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Bracket Manager</h2>
          <p className="text-gray-400 mt-1">
            {tournament.tournamentName} - Manage bracket matches
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2 bg-gray-800 p-1 rounded-lg border border-gray-700">
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            📋 List View
          </button>
          <button
            onClick={() => setViewMode('diagram')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'diagram'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🎯 Bracket Diagram
          </button>
        </div>
      </div>

      {/* Bracket Diagram View */}
      {viewMode === 'diagram' ? (
        <BracketVisualization rounds={rounds} />
      ) : (
        <>
          {/* Winner Bracket */}
          {winnerRounds.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-blue-400 flex items-center gap-2">
                <span>🏆</span>
                Winner Bracket
              </h3>
              {winnerRounds.map(round => (
                <BracketRound
                  key={round.id}
                  round={round}
                  isExpanded={expandedRounds.has(round.id)}
                  onToggle={() => toggleRound(round.id)}
                  onMatchUpdate={handleMatchUpdate}
                  onError={onError}
                  onInfo={onInfo}
                />
              ))}
            </div>
          )}

          {/* Loser Bracket */}
          {loserRounds.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-orange-400 flex items-center gap-2">
                <span>⚠️</span>
                Loser Bracket
              </h3>
              {loserRounds.map(round => (
                <BracketRound
                  key={round.id}
                  round={round}
                  isExpanded={expandedRounds.has(round.id)}
                  onToggle={() => toggleRound(round.id)}
                  onMatchUpdate={handleMatchUpdate}
                  onError={onError}
                  onInfo={onInfo}
                />
              ))}
            </div>
          )}

          {/* Finals */}
          {finalsRounds.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-yellow-400 flex items-center gap-2">
                <span>👑</span>
                Finals
              </h3>
              {finalsRounds.map(round => (
                <BracketRound
                  key={round.id}
                  round={round}
                  isExpanded={expandedRounds.has(round.id)}
                  onToggle={() => toggleRound(round.id)}
                  onMatchUpdate={handleMatchUpdate}
                  onError={onError}
                  onInfo={onInfo}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
