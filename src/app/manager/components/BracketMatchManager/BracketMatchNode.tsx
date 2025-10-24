'use client';

/**
 * Bracket Match Node Component
 *
 * Custom React Flow node for displaying a single match in the bracket.
 * Shows team names, scores, and match status.
 */

import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';

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
  bracketId?: string | null;
  bracket?: { id: string; name: string } | null;
  teamAScore: number | null;
  teamBScore: number | null;
  isComplete: boolean;
  startedAt: string | null;
}

interface Round {
  id: string;
  idx: number;
  bracketType: string | null;
  depth: number | null;
}

interface BracketMatchNodeData {
  match: Match;
  round: Round;
  borderColor: string;
}

/**
 * Calculate bracket wins for club tournaments (not individual game wins)
 * For each bracket, determine which club won more games, then count bracket wins
 */
function calculateBracketWins(games: Game[]): { teamABracketWins: number; teamBBracketWins: number } {
  // Group games by bracket
  const bracketsByName: Record<string, { teamAWins: number; teamBWins: number }> = {};

  games.forEach(game => {
    if (!game.isComplete || game.teamAScore === null || game.teamBScore === null) return;

    const bracketName = game.bracket?.name || 'Main';
    if (!bracketsByName[bracketName]) {
      bracketsByName[bracketName] = { teamAWins: 0, teamBWins: 0 };
    }

    if (game.teamAScore > game.teamBScore) {
      bracketsByName[bracketName].teamAWins++;
    } else if (game.teamBScore > game.teamAScore) {
      bracketsByName[bracketName].teamBWins++;
    }
  });

  // Count how many brackets each club won
  let teamABracketWins = 0;
  let teamBBracketWins = 0;

  Object.values(bracketsByName).forEach(bracket => {
    if (bracket.teamAWins > bracket.teamBWins) {
      teamABracketWins++;
    } else if (bracket.teamBWins > bracket.teamAWins) {
      teamBBracketWins++;
    }
  });

  return { teamABracketWins, teamBBracketWins };
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

export const BracketMatchNode = memo(({ data }: NodeProps<BracketMatchNodeData>) => {
  const { match, round, borderColor } = data;
  const { teamABracketWins, teamBBracketWins } = calculateBracketWins(match.games);
  const roundLabel = getRoundLabel(round);

  const isComplete = match.winnerId !== null;
  const isPending = !match.teamA || !match.teamB || match.isBye;

  return (
    <div
      className="relative bg-gray-800 rounded-lg border-2 shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
      style={{ borderColor, width: 280, minHeight: 120 }}
    >
      {/* Handles for connections */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: borderColor, width: 10, height: 10 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: borderColor, width: 10, height: 10 }}
      />

      {/* Round label */}
      <div
        className="px-3 py-1 text-xs font-semibold text-white rounded-t-md"
        style={{ backgroundColor: borderColor }}
      >
        {roundLabel}
      </div>

      {/* Match content */}
      <div className="p-3 space-y-2">
        {/* BYE match */}
        {match.isBye ? (
          <div className="text-center py-4">
            <p className="text-gray-400 text-sm">BYE</p>
            <p className="text-gray-500 text-xs mt-1">
              {match.teamA?.name || 'TBD'}
            </p>
          </div>
        ) : isPending ? (
          /* Pending match (teams not decided yet) */
          <div className="text-center py-4">
            <p className="text-gray-400 text-sm">TBD</p>
            <p className="text-gray-500 text-xs mt-1">Waiting for previous matches</p>
          </div>
        ) : (
          /* Active or completed match */
          <>
            {/* Team A */}
            <div
              className={`flex items-center justify-between p-2 rounded ${
                match.winnerId === match.teamA?.id
                  ? 'bg-green-900/30 border border-green-500'
                  : 'bg-gray-700/50'
              }`}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {match.seedA !== null && (
                  <span className="text-xs text-gray-400 font-mono w-6 flex-shrink-0">
                    #{match.seedA}
                  </span>
                )}
                <span
                  className={`text-sm truncate ${
                    match.winnerId === match.teamA?.id
                      ? 'text-white font-semibold'
                      : 'text-gray-300'
                  }`}
                  title={match.teamA?.name}
                >
                  {match.teamA?.name || 'TBD'}
                </span>
              </div>
              {isComplete && (
                <span
                  className={`text-sm font-bold ml-2 flex-shrink-0 ${
                    match.winnerId === match.teamA?.id ? 'text-green-400' : 'text-gray-400'
                  }`}
                >
                  {teamABracketWins}
                </span>
              )}
            </div>

            {/* Team B */}
            <div
              className={`flex items-center justify-between p-2 rounded ${
                match.winnerId === match.teamB?.id
                  ? 'bg-green-900/30 border border-green-500'
                  : 'bg-gray-700/50'
              }`}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {match.seedB !== null && (
                  <span className="text-xs text-gray-400 font-mono w-6 flex-shrink-0">
                    #{match.seedB}
                  </span>
                )}
                <span
                  className={`text-sm truncate ${
                    match.winnerId === match.teamB?.id
                      ? 'text-white font-semibold'
                      : 'text-gray-300'
                  }`}
                  title={match.teamB?.name}
                >
                  {match.teamB?.name || 'TBD'}
                </span>
              </div>
              {isComplete && (
                <span
                  className={`text-sm font-bold ml-2 flex-shrink-0 ${
                    match.winnerId === match.teamB?.id ? 'text-green-400' : 'text-gray-400'
                  }`}
                >
                  {teamBBracketWins}
                </span>
              )}
            </div>
          </>
        )}

        {/* Status indicator */}
        {!isPending && (
          <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-gray-700">
            {isComplete ? (
              <span className="text-green-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400"></span>
                Complete
              </span>
            ) : (
              <span className="text-yellow-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>
                In Progress
              </span>
            )}
            <span className="text-gray-500">
              {match.games.filter(g => g.isComplete).length}/{match.games.length} games
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

BracketMatchNode.displayName = 'BracketMatchNode';
