'use client';

/**
 * Custom Match Component for Public Bracket View
 *
 * Displays match information in a read-only format.
 */

interface MatchProps {
  match: {
    id: string;
    name?: string;
    tournamentRoundText?: string;
    state: string;
    participants: Array<{
      id: string;
      name?: string;
      resultText?: string | null;
      isWinner?: boolean;
      status?: string | null;
    }>;
  };
  onMatchClick?: (args: { match: { id: string }; topWon: boolean; bottomWon: boolean }) => void;
  topParty: {
    id: string;
    name: string;
    resultText: string | null;
    isWinner: boolean;
    status: string | null;
  };
  bottomParty: {
    id: string;
    name: string;
    resultText: string | null;
    isWinner: boolean;
    status: string | null;
  };
  topWon: boolean;
  bottomWon: boolean;
  topHovered: boolean;
  bottomHovered: boolean;
  topText: string;
  bottomText: string;
  connectorColor: string;
}

export function CustomBracketMatch({
  match,
  onMatchClick,
  topParty,
  bottomParty,
  topWon,
  bottomWon,
  topHovered,
  bottomHovered,
  topText,
  bottomText,
  connectorColor,
}: MatchProps) {
  const handleClick = () => {
    if (onMatchClick) {
      onMatchClick({ match, topWon, bottomWon });
    }
  };

  // Determine if match has started (has scores or is complete)
  const hasStarted = match.state === 'PLAYED' || match.state === 'SCORE_DONE';

  return (
    <div
      onClick={handleClick}
      className={`bg-gray-700 rounded-lg border-2 border-gray-600 transition-colors ${
        hasStarted ? 'cursor-pointer hover:border-blue-500' : ''
      }`}
      style={{
        borderColor: topHovered || bottomHovered ? connectorColor : undefined,
        minWidth: '240px',
        width: 'auto',
        maxWidth: 'none',
      }}
    >
      {/* Round Label */}
      <div className="px-3 py-1 text-xs font-semibold text-gray-300 bg-gray-800 border-b border-gray-600 rounded-t-md">
        {match.tournamentRoundText || 'Match'}
      </div>

      {/* Match Content */}
      <div className="p-2 space-y-1">
        {/* Top Team */}
        <div
          className={`flex items-center justify-between p-2 rounded transition-colors ${
            topWon
              ? 'bg-green-900/40 border border-green-600'
              : topHovered
              ? 'bg-gray-600'
              : 'bg-gray-600/50'
          }`}
        >
          <div className="flex-1 min-w-0 break-words pr-2">
            <div
              className={`text-sm whitespace-normal leading-tight ${
                topWon ? 'text-white font-semibold' : 'text-gray-300'
              }`}
              title={topParty.name || topText}
            >
              {topParty.name || topText}
            </div>
          </div>
          {topParty.resultText !== null && (
            <span
              className={`text-sm font-bold flex-shrink-0 ml-2 ${
                topWon ? 'text-green-400' : 'text-gray-400'
              }`}
            >
              {topParty.resultText}
            </span>
          )}
        </div>

        {/* Bottom Team */}
        <div
          className={`flex items-center justify-between p-2 rounded transition-colors ${
            bottomWon
              ? 'bg-green-900/40 border border-green-600'
              : bottomHovered
              ? 'bg-gray-600'
              : 'bg-gray-600/50'
          }`}
        >
          <div className="flex-1 min-w-0 break-words pr-2">
            <div
              className={`text-sm whitespace-normal leading-tight ${
                bottomWon ? 'text-white font-semibold' : 'text-gray-300'
              }`}
              title={bottomParty.name || bottomText}
            >
              {bottomParty.name || bottomText}
            </div>
          </div>
          {bottomParty.resultText !== null && (
            <span
              className={`text-sm font-bold flex-shrink-0 ml-2 ${
                bottomWon ? 'text-green-400' : 'text-gray-400'
              }`}
            >
              {bottomParty.resultText}
            </span>
          )}
        </div>

        {/* Status Indicator */}
        {match.state === 'SCORE_DONE' && (
          <div className="flex items-center justify-center text-xs text-green-400 pt-1 pb-0 border-t border-gray-600">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-1"></span>
            Complete
          </div>
        )}
        {match.state === 'PLAYED' && (
          <div className="flex items-center justify-center text-xs text-yellow-400 pt-1 pb-0 border-t border-gray-600">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse mr-1"></span>
            In Progress
          </div>
        )}
      </div>
    </div>
  );
}
