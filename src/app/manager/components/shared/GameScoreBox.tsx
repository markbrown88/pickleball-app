'use client';

import { memo } from 'react';

interface GameScoreBoxProps {
  game: any;
  match: any;
  lineups: Record<string, Record<string, any[]>>;
  startGame: (gameId: string) => Promise<void>;
  endGame: (gameId: string) => Promise<void>;
  reopenGame: (gameId: string) => Promise<void>;
  updateGameScore: (gameId: string, teamAScore: number | null, teamBScore: number | null) => Promise<void>;
  updateGameCourtNumber: (gameId: string, courtNumber: string) => Promise<void>;
}

export const GameScoreBox = memo(function GameScoreBox({
  game,
  match,
  lineups,
  startGame,
  endGame,
  reopenGame,
  updateGameScore,
  updateGameCourtNumber,
}: GameScoreBoxProps) {
  // Derive game status from isComplete and startedAt fields
  const getGameStatus = (game: any): 'not_started' | 'in_progress' | 'completed' => {
    if (game.isComplete) return 'completed';
    if (game.startedAt || game.teamAScoreSubmitted || game.teamBScoreSubmitted) return 'in_progress';
    return 'not_started';
  };

  const gameStatus = getGameStatus(game);
  const isCompleted = gameStatus === 'completed';
  const isInProgress = gameStatus === 'in_progress';

  const getGameTitle = () => {
    switch (game.slot) {
      case 'MENS_DOUBLES': return "Men's Doubles";
      case 'WOMENS_DOUBLES': return "Women's Doubles";
      case 'MIXED_1': return "Mixed Doubles 1";
      case 'MIXED_2': return "Mixed Doubles 2";
      case 'TIEBREAKER': return "Tiebreaker";
      default: return game.slot;
    }
  };

  const getTeamALineup = () => {
    // For tiebreakers, show actual team names
    if (game.slot === 'TIEBREAKER' && match) {
      return match.teamA?.name || 'Team A';
    }

    // First, try to get lineup from the game object (DB-stored lineup)
    if (game.teamALineup && Array.isArray(game.teamALineup) && game.teamALineup.length === 4) {
      // Lineup structure: [Man1, Man2, Woman1, Woman2]
      const man1 = game.teamALineup[0];
      const man2 = game.teamALineup[1];
      const woman1 = game.teamALineup[2];
      const woman2 = game.teamALineup[3];

      switch (game.slot) {
        case 'MENS_DOUBLES':
          return man1 && man2 ? `${man1.name} &\n${man2.name}` : 'Team A';
        case 'WOMENS_DOUBLES':
          return woman1 && woman2 ? `${woman1.name} &\n${woman2.name}` : 'Team A';
        case 'MIXED_1':
          return man1 && woman1 ? `${man1.name} &\n${woman1.name}` : 'Team A';
        case 'MIXED_2':
          return man2 && woman2 ? `${man2.name} &\n${woman2.name}` : 'Team A';
        default:
          return 'Team A';
      }
    }

    // Second, try to get lineup from the lineups prop (state-stored lineup)
    // lineups structure can be:
    // - For DE Club: bracketId -> teamId -> players
    // - For Team: matchId -> teamId -> players
    if (match && match.teamA) {
      // Try DE Club structure first (game.bracketId)
      let teamALineup = game.bracketId && lineups[game.bracketId]
        ? lineups[game.bracketId][match.teamA.id] || []
        : [];

      // Fall back to Team structure (match.id)
      if (teamALineup.length === 0 && lineups[match.id]) {
        teamALineup = lineups[match.id][match.teamA.id] || [];
      }

      if (teamALineup.length === 4) {
        // Lineup structure: [Man1, Man2, Woman1, Woman2]
        const man1 = teamALineup[0];
        const man2 = teamALineup[1];
        const woman1 = teamALineup[2];
        const woman2 = teamALineup[3];

        switch (game.slot) {
          case 'MENS_DOUBLES':
            return man1 && man2 ? `${man1.name} &\n${man2.name}` : 'Team A';
          case 'WOMENS_DOUBLES':
            return woman1 && woman2 ? `${woman1.name} &\n${woman2.name}` : 'Team A';
          case 'MIXED_1':
            return man1 && woman1 ? `${man1.name} &\n${woman1.name}` : 'Team A';
          case 'MIXED_2':
            return man2 && woman2 ? `${man2.name} &\n${woman2.name}` : 'Team A';
          default:
            return 'Team A';
        }
      }
    }
    return 'Team A';
  };

  const getTeamBLineup = () => {
    // For tiebreakers, show actual team names
    if (game.slot === 'TIEBREAKER' && match) {
      return match.teamB?.name || 'Team B';
    }

    // First, try to get lineup from the game object (DB-stored lineup)
    if (game.teamBLineup && Array.isArray(game.teamBLineup) && game.teamBLineup.length === 4) {
      // Lineup structure: [Man1, Man2, Woman1, Woman2]
      const man1 = game.teamBLineup[0];
      const man2 = game.teamBLineup[1];
      const woman1 = game.teamBLineup[2];
      const woman2 = game.teamBLineup[3];

      switch (game.slot) {
        case 'MENS_DOUBLES':
          return man1 && man2 ? `${man1.name} &\n${man2.name}` : 'Team B';
        case 'WOMENS_DOUBLES':
          return woman1 && woman2 ? `${woman1.name} &\n${woman2.name}` : 'Team B';
        case 'MIXED_1':
          return man1 && woman1 ? `${man1.name} &\n${woman1.name}` : 'Team B';
        case 'MIXED_2':
          return man2 && woman2 ? `${man2.name} &\n${woman2.name}` : 'Team B';
        default:
          return 'Team B';
      }
    }

    // Second, try to get lineup from the lineups prop (state-stored lineup)
    // lineups structure can be:
    // - For DE Club: bracketId -> teamId -> players
    // - For Team: matchId -> teamId -> players
    if (match && match.teamB) {
      // Try DE Club structure first (game.bracketId)
      let teamBLineup = game.bracketId && lineups[game.bracketId]
        ? lineups[game.bracketId][match.teamB.id] || []
        : [];

      // Fall back to Team structure (match.id)
      if (teamBLineup.length === 0 && lineups[match.id]) {
        teamBLineup = lineups[match.id][match.teamB.id] || [];
      }

      if (teamBLineup.length === 4) {
        // Lineup structure: [Man1, Man2, Woman1, Woman2]
        const man1 = teamBLineup[0];
        const man2 = teamBLineup[1];
        const woman1 = teamBLineup[2];
        const woman2 = teamBLineup[3];

        switch (game.slot) {
          case 'MENS_DOUBLES':
            return man1 && man2 ? `${man1.name} &\n${man2.name}` : 'Team B';
          case 'WOMENS_DOUBLES':
            return woman1 && woman2 ? `${woman1.name} &\n${woman2.name}` : 'Team B';
          case 'MIXED_1':
            return man1 && woman1 ? `${man1.name} &\n${woman1.name}` : 'Team B';
          case 'MIXED_2':
            return man2 && woman2 ? `${man2.name} &\n${woman2.name}` : 'Team B';
          default:
            return 'Team B';
        }
      }
    }
    return 'Team B';
  };

  const teamAScore = game.teamAScore || 0;
  const teamBScore = game.teamBScore || 0;
  const teamAWon = teamAScore > teamBScore;
  const teamBWon = teamBScore > teamAScore;

  return (
    <div className={`rounded-lg border-2 overflow-visible ${
      isCompleted ? 'border-border-subtle bg-surface-1' :
      isInProgress ? 'border-warning bg-warning/5' :
      'border-border-medium bg-surface-2'
    }`}>
      {/* Game Header */}
      <div className={`px-4 py-2 flex items-center justify-between ${
        isCompleted ? 'bg-surface-2' :
        isInProgress ? 'bg-warning/10' :
        'bg-surface-1'
      }`}>
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-primary">{getGameTitle()}</h4>
          {isCompleted && (
            <span className="chip chip-success text-[10px] px-2 py-0.5">Complete</span>
          )}
          {isInProgress && (
            <span className="chip chip-warning text-[10px] px-2 py-0.5">In Progress</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isCompleted && (
            <>
              <label className="text-xs font-medium text-muted">Court:</label>
              <input
                type="text"
                className="w-12 px-2 py-1 text-sm border border-border-medium rounded bg-surface-2 text-center focus:border-secondary focus:outline-none"
                value={game.courtNumber || ''}
                onChange={(e) => updateGameCourtNumber(game.id, e.target.value)}
                placeholder="#"
              />
            </>
          )}
          {isCompleted && game.courtNumber && (
            <span className="text-xs text-muted">Court {game.courtNumber}</span>
          )}
          {gameStatus === 'not_started' && (
            <button
              className="px-3 py-1 rounded-lg text-xs font-semibold transition-all bg-success hover:bg-success-hover text-white cursor-pointer"
              onClick={() => startGame(game.id)}
            >
              Start
            </button>
          )}
          {gameStatus === 'in_progress' && (
            <button
              className="px-3 py-1 rounded-lg text-xs font-semibold transition-all bg-error hover:bg-error-hover text-white cursor-pointer"
              onClick={() => endGame(game.id)}
            >
              Finish
            </button>
          )}
          {gameStatus === 'completed' && (
            <button
              className="px-3 py-1 rounded-lg text-xs font-semibold transition-all bg-warning hover:bg-warning-hover text-white cursor-pointer"
              onClick={() => reopenGame(game.id)}
            >
              Reopen
            </button>
          )}
        </div>
      </div>

      {/* Game Body - Players and Scores */}
      <div className="p-4 space-y-3 overflow-visible">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center min-w-0">
          {/* Team A Side */}
          <div className={`text-sm min-w-0 ${
            isCompleted && teamAWon ? 'text-success font-semibold' : 'text-secondary'
          }`}>
            <div className="whitespace-pre-line leading-relaxed break-words">{getTeamALineup()}</div>
          </div>

          {/* Scores */}
          <div className="flex items-center gap-3">
            {isCompleted ? (
              <>
                <div className={`text-2xl font-bold tabular ${
                  teamAWon ? 'text-success' : 'text-muted'
                }`}>
                  {teamAScore}
                </div>
                <div className="text-muted font-medium">-</div>
                <div className={`text-2xl font-bold tabular ${
                  teamBWon ? 'text-success' : 'text-muted'
                }`}>
                  {teamBScore}
                </div>
              </>
            ) : isInProgress ? (
              <>
                <input
                  type="number"
                  min="0"
                  max="99"
                  className="w-16 px-2 py-2 text-xl font-bold border-2 border-border-medium rounded-lg text-center bg-surface-1 focus:border-secondary focus:outline-none tabular [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={teamAScore || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 99)) {
                      updateGameScore(game.id, value ? parseInt(value) : null, teamBScore);
                    }
                  }}
                  placeholder="0"
                />
                <div className="text-muted font-medium">-</div>
                <input
                  type="number"
                  min="0"
                  max="99"
                  className="w-16 px-2 py-2 text-xl font-bold border-2 border-border-medium rounded-lg text-center bg-surface-1 focus:border-secondary focus:outline-none tabular [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={teamBScore || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 99)) {
                      updateGameScore(game.id, teamAScore, value ? parseInt(value) : null);
                    }
                  }}
                  placeholder="0"
                />
              </>
            ) : (
              <>
                <div className="w-16 text-2xl text-center text-muted font-bold tabular">-</div>
                <div className="text-muted font-medium">-</div>
                <div className="w-16 text-2xl text-center text-muted font-bold tabular">-</div>
              </>
            )}
          </div>

          {/* Team B Side */}
          <div className={`text-sm text-right min-w-0 ${
            isCompleted && teamBWon ? 'text-success font-semibold' : 'text-secondary'
          }`}>
            <div className="whitespace-pre-line leading-relaxed break-words">{getTeamBLineup()}</div>
          </div>
        </div>

        {(game.teamAScoreSubmitted || game.teamBScoreSubmitted) && !isCompleted && (
          <div className="text-xs text-muted border-t border-border-subtle pt-2 mt-2">
            <div>Latest submissions:</div>
            <div className="flex justify-between">
              <span>
                {(() => {
                  const teamAName = match.teamA?.name || 'Team A';
                  const bracketLabel = match.bracketName || match.teamA?.bracketName;
                  const cleanName = bracketLabel && teamAName.endsWith(` ${bracketLabel}`)
                    ? teamAName.replace(` ${bracketLabel}`, '')
                    : teamAName;
                  const scoreA = game.teamASubmittedScore != null ? game.teamASubmittedScore : '—';
                  const scoreB = game.teamBSubmittedScore != null ? game.teamBSubmittedScore : '—';
                  return `${cleanName}: ${scoreA}-${scoreB}`;
                })()}
              </span>
              <span>
                {(() => {
                  const teamBName = match.teamB?.name || 'Team B';
                  const bracketLabel = match.bracketName || match.teamB?.bracketName;
                  const cleanName = bracketLabel && teamBName.endsWith(` ${bracketLabel}`)
                    ? teamBName.replace(` ${bracketLabel}`, '')
                    : teamBName;
                  const scoreB = game.teamBSubmittedScore != null ? game.teamBSubmittedScore : '—';
                  const scoreA = game.teamASubmittedScore != null ? game.teamASubmittedScore : '—';
                  return `${cleanName}: ${scoreB}-${scoreA}`;
                })()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
