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
      className={`bg-surface-2 rounded-lg border-2 border-subtle transition-colors ${
        hasStarted ? 'cursor-pointer hover:border-primary' : ''
      }`}
      style={{
        borderColor: topHovered || bottomHovered ? connectorColor : undefined,
        minWidth: '240px',
        width: 'auto',
        maxWidth: 'none',
      }}
    >
      {/* Round Label */}
      <div className="px-3 py-0.5 text-xs font-semibold text-muted bg-surface border-b border-subtle rounded-t-md">
        {match.tournamentRoundText || 'Match'}
      </div>

      {/* Match Content */}
      <div className="p-2 space-y-1">
        {/* Top Team */}
        <div
          className={`flex items-center justify-between p-1.5 rounded transition-colors ${
            topWon
              ? 'bg-success/20 border border-success'
              : topHovered
              ? 'bg-surface'
              : 'bg-surface/50'
          }`}
        >
          <div className="flex-1 min-w-0 break-words pr-2">
            <div
              className={`text-sm whitespace-normal leading-tight ${
                topWon ? 'text-primary font-semibold' : 'text-secondary'
              }`}
              title={topParty.name || topText}
            >
              {topParty.name || topText}
            </div>
          </div>
          {topParty.resultText !== null && (
            <span
              className={`text-xs font-bold flex-shrink-0 ${
                topWon ? 'text-success' : 'text-muted'
              }`}
            >
              {topParty.resultText}
            </span>
          )}
        </div>

        {/* Bottom Team */}
        <div
          className={`flex items-center justify-between p-1.5 rounded transition-colors ${
            bottomWon
              ? 'bg-success/20 border border-success'
              : bottomHovered
              ? 'bg-surface'
              : 'bg-surface/50'
          }`}
        >
          <div className="flex-1 min-w-0 break-words pr-2">
            <div
              className={`text-sm whitespace-normal leading-tight ${
                bottomWon ? 'text-primary font-semibold' : 'text-secondary'
              }`}
              title={bottomParty.name || bottomText}
            >
              {bottomParty.name || bottomText}
            </div>
          </div>
          {bottomParty.resultText !== null && (
            <span
              className={`text-xs font-bold flex-shrink-0 ${
                bottomWon ? 'text-success' : 'text-muted'
              }`}
            >
              {bottomParty.resultText}
            </span>
          )}
        </div>

        {/* Status Indicator */}
        {match.state === 'SCORE_DONE' && (
          <div className="flex items-center justify-center text-xs text-success pt-1 pb-0 border-t border-subtle">
            <span className="w-1.5 h-1.5 rounded-full bg-success mr-1"></span>
            Complete
          </div>
        )}
        {match.state === 'PLAYED' && (
          <div className="flex items-center justify-center text-xs text-warning pt-1 pb-0 border-t border-subtle">
            <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse mr-1"></span>
            In Progress
          </div>
        )}
      </div>
    </div>
  );
}
