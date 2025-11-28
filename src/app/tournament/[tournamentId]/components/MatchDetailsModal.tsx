'use client';

/**
 * Read-Only Match Details Modal
 *
 * Displays match and game details without edit capabilities.
 * Matches the manager modal layout but without interactive controls.
 */

import { useMemo } from 'react';

interface Match {
  id: string;
  teamA: { id: string; name: string; club?: { name: string } } | null;
  teamB: { id: string; name: string; club?: { name: string } } | null;
  winnerId: string | null;
  games: Game[];
  isBye?: boolean;
  forfeitTeam?: 'A' | 'B' | null;
}

interface Game {
  id: string;
  slot: string;
  teamAScore: number | null;
  teamBScore: number | null;
  isComplete: boolean;
  startedAt: string | null;
  courtNumber?: string | null;
  bracketId?: string | null;
  bracket?: { id: string; name: string } | null;
  teamALineup?: Player[];
  teamBLineup?: Player[];
}

interface Player {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string;
}

interface MatchDetailsModalProps {
  match: Match;
  onClose: () => void;
}

const GAME_SLOT_LABELS: Record<string, string> = {
  MENS_DOUBLES: "Men's Doubles",
  WOMENS_DOUBLES: "Women's Doubles",
  MIXED_1: 'Mixed 1',
  MIXED_2: 'Mixed 2',
  TIEBREAKER: 'Tiebreaker',
};

function formatPlayerName(player: Player | undefined): string {
  if (!player) return 'TBD';
  if (player.firstName && player.lastName) {
    return `${player.firstName} ${player.lastName}`;
  }
  return player.name || 'Unknown';
}

/**
 * Strip bracket level suffix from team/club name
 */
function stripBracketSuffix(name: string): string {
  return name.replace(/\s+[\d.]+$/, '').replace(/\s+(Intermediate|Advanced|Beginner)$/i, '');
}

/**
 * Get player lineup display for a specific game slot
 * The API returns a 2-player array for each game (the specific players for that game)
 */
function getLineupForSlot(lineup: Player[] | undefined, slot: string): string {
  if (!lineup || lineup.length < 2) return '';

  const player1 = lineup[0];
  const player2 = lineup[1];

  if (!player1 || !player2) return '';

  return `${formatPlayerName(player1)} & ${formatPlayerName(player2)}`;
}

/**
 * Get display name - prefer club name for DE Clubs tournaments
 */
function getDisplayName(team: { name: string; club?: { name: string } } | null | undefined): string {
  if (!team) return 'TBD';
  // For DE Clubs tournaments, prefer club name
  if (team.club?.name) {
    return team.club.name;
  }
  return stripBracketSuffix(team.name);
}

export function MatchDetailsModal({ match, onClose }: MatchDetailsModalProps) {
  // Calculate games won
  const gamesWon = useMemo(() => {
    let teamAWins = 0;
    let teamBWins = 0;

    match.games.forEach((game) => {
      if (game.isComplete && game.teamAScore !== null && game.teamBScore !== null) {
        if (game.teamAScore > game.teamBScore) {
          teamAWins++;
        } else if (game.teamBScore > game.teamAScore) {
          teamBWins++;
        }
      }
    });

    return { teamA: teamAWins, teamB: teamBWins };
  }, [match.games]);

  const hasStarted = match.games.some(g => g.startedAt !== null);
  const isComplete = match.winnerId !== null;

  const cleanTeamAName = match.teamA?.club?.name
    ? stripBracketSuffix(match.teamA.club.name)
    : stripBracketSuffix(match.teamA?.name || '');
  const cleanTeamBName = match.teamB?.club?.name
    ? stripBracketSuffix(match.teamB.club.name)
    : stripBracketSuffix(match.teamB?.name || '');

  if (match.isBye) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
        <div className="bg-gray-800 rounded-lg border border-gray-700 max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
          <div className="text-center">
            <h3 className="text-xl font-bold text-white mb-3">BYE Match</h3>
            <p className="text-gray-400 mb-4">{cleanTeamAName || 'TBD'} automatically advances</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Group games by bracket
  const gamesByBracket = useMemo(() => {
    const grouped = new Map<string, Game[]>();
    match.games.forEach((game) => {
      const bracketKey = game.bracket?.name || 'Main';
      if (!grouped.has(bracketKey)) {
        grouped.set(bracketKey, []);
      }
      grouped.get(bracketKey)!.push(game);
    });
    return grouped;
  }, [match.games]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="bg-gray-800 rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto border border-gray-700 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-white">
                {cleanTeamAName} vs {cleanTeamBName}
              </h3>
              <div className="text-sm text-gray-400 mt-1">
                {gamesWon.teamA} - {gamesWon.teamB} (Games Won)
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Match Status Badge */}
          {isComplete && (
            <div className="text-xs font-semibold px-2 py-1 bg-green-900/40 text-green-400 rounded inline-block">
              ✓ Complete
            </div>
          )}
        </div>

        {/* Content - Games by Bracket */}
        <div className="p-6 space-y-6">
          {match.forfeitTeam ? (
            <div className="text-center py-12">
              <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-6 max-w-md mx-auto">
                <div className="text-yellow-400 text-4xl mb-4">⚠️</div>
                <h3 className="text-lg font-semibold text-white mb-2">Match Forfeited</h3>
                <p className="text-gray-400 mb-4">
                  {match.forfeitTeam === 'A' ? cleanTeamAName : cleanTeamBName} forfeited this match.
                </p>
                <p className="font-semibold text-green-400">
                  {match.forfeitTeam === 'A' ? cleanTeamBName : cleanTeamAName} wins by forfeit
                </p>
              </div>
            </div>
          ) : (
            Array.from(gamesByBracket.entries()).map(([bracketName, games]) => {
              // Calculate bracket winner
              let teamAWins = 0;
              let teamBWins = 0;
              for (const game of games) {
                if (game.isComplete && game.teamAScore !== null && game.teamBScore !== null) {
                  if (game.teamAScore > game.teamBScore) teamAWins++;
                  else if (game.teamBScore > game.teamAScore) teamBWins++;
                }
              }

              const bracketLabel =
                bracketName === 'Main'
                  ? 'Overall'
                  : bracketName;

              return (
                <div key={bracketName}>
                  {/* Bracket Header */}
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-blue-400">
                      {bracketLabel}
                    </h4>
                    <span className="text-xs font-semibold text-gray-300 bg-gray-700/60 px-2 py-0.5 rounded">
                      {teamAWins} - {teamBWins}
                    </span>
                  </div>

                  {/* Games in 2-column grid */}
                  <div className="grid gap-4 lg:grid-cols-2">
                    {games.map((game) => {
                      const gameWinner =
                        game.isComplete && game.teamAScore !== null && game.teamBScore !== null
                          ? game.teamAScore > game.teamBScore
                            ? 'A'
                            : game.teamBScore > game.teamAScore
                            ? 'B'
                            : null
                          : null;

                      const gameTitle = GAME_SLOT_LABELS[game.slot] || game.slot;
                      const teamALineup = getLineupForSlot(game.teamALineup, game.slot);
                      const teamBLineup = getLineupForSlot(game.teamBLineup, game.slot);

                      return (
                        <div
                          key={game.id}
                          className={`rounded-lg border-2 overflow-hidden ${
                            game.isComplete ? 'border-gray-600 bg-gray-700' : 'border-gray-600 bg-gray-700/50'
                          }`}
                        >
                          {/* Game Header */}
                          <div className={`px-4 py-2 flex items-center justify-between ${
                            game.isComplete ? 'bg-gray-700' : 'bg-gray-700/80'
                          }`}>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-white">{gameTitle}</h4>
                              {game.isComplete && (
                                <span className="text-[10px] px-2 py-0.5 bg-green-900/40 text-green-400 rounded">
                                  Complete
                                </span>
                              )}
                              {!game.isComplete && game.startedAt && (
                                <span className="text-[10px] px-2 py-0.5 bg-yellow-900/40 text-yellow-400 rounded">
                                  In Progress
                                </span>
                              )}
                            </div>
                            {game.courtNumber && (
                              <span className="text-xs text-gray-400">Court {game.courtNumber}</span>
                            )}
                          </div>

                          {/* Game Body - Players and Scores */}
                          <div className="p-4 space-y-3">
                            {!teamALineup && !teamBLineup && !hasStarted ? (
                              <div className="text-center py-4 text-sm text-gray-400">
                                Lineups have not been set for this game
                              </div>
                            ) : (
                              <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                                {/* Team A Side */}
                                <div className={`text-sm ${
                                  game.isComplete && gameWinner === 'A' ? 'text-green-400 font-semibold' : 'text-gray-300'
                                }`}>
                                  <div className="leading-relaxed">
                                    {teamALineup || getDisplayName(match.teamA)}
                                  </div>
                                </div>

                                {/* Scores */}
                                <div className="flex items-center gap-3">
                                  {game.isComplete ? (
                                    <>
                                      <div className={`text-2xl font-bold tabular ${
                                        gameWinner === 'A' ? 'text-green-400' : 'text-gray-400'
                                      }`}>
                                        {game.teamAScore || 0}
                                      </div>
                                      <div className="text-gray-400 font-medium">-</div>
                                      <div className={`text-2xl font-bold tabular ${
                                        gameWinner === 'B' ? 'text-green-400' : 'text-gray-400'
                                      }`}>
                                        {game.teamBScore || 0}
                                      </div>
                                    </>
                                  ) : (
                                    <div className="text-gray-500 text-sm">-</div>
                                  )}
                                </div>

                                {/* Team B Side */}
                                <div className={`text-sm text-right ${
                                  game.isComplete && gameWinner === 'B' ? 'text-green-400 font-semibold' : 'text-gray-300'
                                }`}>
                                  <div className="leading-relaxed">
                                    {teamBLineup || getDisplayName(match.teamB)}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
