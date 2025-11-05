declare module '@g-loot/react-tournament-brackets' {
  import { FC } from 'react';

  export interface Match {
    id: string | number;
    name?: string;
    nextMatchId?: string | number | null;
    nextLooserMatchId?: string | number | null;
    tournamentRoundText?: string;
    startTime?: string;
    state?: 'DONE' | 'SCORE_DONE' | 'WALK_OVER' | 'NO_SHOW' | 'NO_PARTY' | 'SCHEDULED' | 'PLAYED';
    participants: Participant[];
  }

  export interface Participant {
    id: string | number;
    resultText?: string | null;
    isWinner?: boolean;
    status?: 'PLAYED' | 'NO_SHOW' | 'WALK_OVER' | 'NO_PARTY' | null;
    name?: string;
  }

  export interface DoubleEliminationMatches {
    upper: Match[];
    lower: Match[];
  }

  export interface MatchClickArgs {
    match: { id: string };
    topWon: boolean;
    bottomWon: boolean;
  }

  export interface DoubleEliminationBracketProps {
    matches: DoubleEliminationMatches;
    matchComponent?: FC<any>;
    onMatchClick?: (args: MatchClickArgs) => void;
    svgWrapper?: FC<{ width: number; height: number; children: React.ReactNode }>;
    theme?: any;
    options?: {
      style?: {
        roundHeader?: any;
        connectorColor?: string;
        connectorColorHighlight?: string;
      };
    };
  }

  export const DoubleEliminationBracket: FC<DoubleEliminationBracketProps>;
  export const SingleEliminationBracket: FC<any>;
  export const Match: FC<any>;
  export const MATCH_STATES: {
    DONE: 'DONE';
    SCORE_DONE: 'SCORE_DONE';
    WALK_OVER: 'WALK_OVER';
    NO_SHOW: 'NO_SHOW';
    NO_PARTY: 'NO_PARTY';
    SCHEDULED: 'SCHEDULED';
    PLAYED: 'PLAYED';
  };
}
