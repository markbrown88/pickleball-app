'use client';

/**
 * Custom Match Component for react-tournament-brackets
 * 
 * Displays match information and integrates with BracketMatchModal for scoring.
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
  onPartyClick?: (partyId: string) => void;
  onMouseEnter?: (partyId: string) => void;
  onMouseLeave?: () => void;
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
  computedStyles: any;
  teamNameFallback: string;
  resultFallback: (party: any) => string;
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

  return (
    <div
      onClick={handleClick}
      className="bg-gray-800 rounded-lg border-2 border-gray-700 hover:border-blue-500 transition-colors cursor-pointer min-w-[200px]"
      style={{ borderColor: topHovered || bottomHovered ? connectorColor : undefined }}
    >
      {/* Round Label */}
      <div className="px-3 py-1 text-xs font-semibold text-gray-400 bg-gray-900 rounded-t-md border-b border-gray-700">
        {match.tournamentRoundText || 'Match'}
      </div>

      {/* Match Content */}
      <div className="p-3 space-y-2">
        {/* Top Team */}
        <div
          className={`flex items-center justify-between p-2 rounded transition-colors ${
            topWon
              ? 'bg-green-900/30 border border-green-500'
              : topHovered
              ? 'bg-gray-700'
              : 'bg-gray-700/50'
          }`}
        >
          <div className="flex-1 min-w-0">
            <div
              className={`text-sm truncate ${topWon ? 'text-white font-semibold' : 'text-gray-300'}`}
              title={topParty.name || topText}
            >
              {topParty.name || topText}
            </div>
          </div>
          {topParty.resultText !== null && (
            <span
              className={`text-sm font-bold ml-2 flex-shrink-0 ${
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
              ? 'bg-green-900/30 border border-green-500'
              : bottomHovered
              ? 'bg-gray-700'
              : 'bg-gray-700/50'
          }`}
        >
          <div className="flex-1 min-w-0">
            <div
              className={`text-sm truncate ${bottomWon ? 'text-white font-semibold' : 'text-gray-300'}`}
              title={bottomParty.name || bottomText}
            >
              {bottomParty.name || bottomText}
            </div>
          </div>
          {bottomParty.resultText !== null && (
            <span
              className={`text-sm font-bold ml-2 flex-shrink-0 ${
                bottomWon ? 'text-green-400' : 'text-gray-400'
              }`}
            >
              {bottomParty.resultText}
            </span>
          )}
        </div>

        {/* Status Indicator */}
        {match.state === 'SCORE_DONE' && (
          <div className="flex items-center justify-center text-xs text-green-400 pt-2 border-t border-gray-700">
            <span className="w-2 h-2 rounded-full bg-green-400 mr-1"></span>
            Complete
          </div>
        )}
        {match.state === 'PLAYED' && (
          <div className="flex items-center justify-center text-xs text-yellow-400 pt-2 border-t border-gray-700">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse mr-1"></span>
            In Progress
          </div>
        )}
      </div>
    </div>
  );
}

