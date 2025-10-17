'use client';

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { DndContext, DragEndEvent, DragStartEvent, closestCenter } from '@dnd-kit/core';
import { useSortable, SortableContext } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { fetchWithActAs } from '@/lib/fetchWithActAs';
import { expectedGenderForIndex, LINEUP_SLOT_ORDER, LINEUP_SLOT_CONFIG } from '@/lib/lineupSlots';
import { formatDateUTC, formatDateRangeUTC } from '@/lib/utils';

// Conditional logging helper
const isDev = process.env.NODE_ENV === 'development';
const log = (...args: any[]) => { if (isDev) console.log(...args); };

// Custom strategy that disables automatic reordering
const noReorderStrategy = () => null;

type Id = string;

type PlayerLite = {
  id: Id;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  gender: 'MALE' | 'FEMALE';
  dupr?: number | null;
  age?: number | null;
};

type EventManagerTournament = {
  tournamentId: Id;
  tournamentName: string;
  type: string;
  maxTeamSize: number | null;
  roles: {
    manager: boolean;
    admin: boolean;
    captainOfClubs: string[];
  };
  clubs: Array<{ id: Id; name: string }>;
  stops: Array<{
    stopId: Id;
    stopName: string;
    locationName?: string | null;
    startAt?: string | null;
    endAt?: string | null;
    lineupDeadline?: string | null;
    rounds: Array<{ roundId: Id; idx: number; gameCount: number; matchCount: number }>;
  }>;
};

// Draggable Team Component using @dnd-kit - Memoized for performance
const DraggableTeam = memo(function DraggableTeam({
  team,
  teamPosition,
  roundId,
  matchIndex,
  bracketName,
  isDragging = false,
  dragPreview = null
}: {
  team: any;
  teamPosition: 'A' | 'B';
  roundId: string;
  matchIndex: number;
  bracketName: string;
  isDragging?: boolean;
  dragPreview?: any;
}) {
  const teamId = `${roundId}-${bracketName}-${matchIndex}-${teamPosition}`;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: teamId,
    data: {
      roundId,
      matchIndex,
      teamPosition,
      bracketName,
      team
    }
  });

  // Determine visual state
  const isSourceTeam = dragPreview && dragPreview.sourceId === teamId;
  const isTargetTeam = dragPreview && dragPreview.targetId === teamId;
  const isBeingDragged = isDragging && isSourceTeam;
  const isPreviewTarget = isDragging && isTargetTeam;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isBeingDragged ? 0.6 : isPreviewTarget ? 0.8 : 1,
    zIndex: isBeingDragged ? 1000 : isPreviewTarget ? 999 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`rounded-lg border px-3 py-2 cursor-move transition-all duration-200 ${
        isBeingDragged
          ? 'opacity-60 scale-105 shadow-lg border-info bg-info/10'
          : isPreviewTarget
            ? 'opacity-80 scale-102 shadow-md border-success bg-success/10'
            : ''
      } ${
        !team ? 'border-dashed border-subtle bg-surface-2 cursor-not-allowed' : 'border-subtle bg-surface-1 hover:shadow-md'
      }`}
    >
      {team ? (
        <div className="text-center">
          <div className="font-medium">{team.name}</div>
        </div>
      ) : (
        <div className="text-muted italic">Drop team here</div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if team data or drag state changed
  return (
    prevProps.team?.id === nextProps.team?.id &&
    prevProps.team?.name === nextProps.team?.name &&
    prevProps.isDragging === nextProps.isDragging &&
    prevProps.dragPreview?.sourceId === nextProps.dragPreview?.sourceId &&
    prevProps.dragPreview?.targetId === nextProps.dragPreview?.targetId
  );
});

// GameScoreBox Component - Memoized for performance
const GameScoreBox = memo(function GameScoreBox({
  game,
  match,
  lineups,
  startGame,
  endGame,
  updateGameScore,
  updateGameCourtNumber,
}: {
  game: any;
  match: any;
  lineups: Record<string, Record<string, any[]>>;
  startGame: (gameId: string) => Promise<void>;
  endGame: (gameId: string) => Promise<void>;
  updateGameScore: (gameId: string, teamAScore: number | null, teamBScore: number | null) => Promise<void>;
  updateGameCourtNumber: (gameId: string, courtNumber: string) => Promise<void>;
}) {
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
    if (game.teamALineup && Array.isArray(game.teamALineup)) {
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
        case 'TIEBREAKER':
          return match?.teamA?.name || 'Team A';
        default:
          return 'Team A';
      }
    }
    // For tiebreakers, show actual team names
    if (game.slot === 'TIEBREAKER' && match) {
      return match.teamA?.name || 'Team A';
    }
    // Generate lineup from team roster based on game slot and lineup positions
    if (match && match.teamA && lineups[match.id]) {
      const teamALineup = lineups[match.id][match.teamA.id] || [];
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
        case 'TIEBREAKER':
          return match.teamA?.name || 'Team A';
        default:
          return 'Team A';
      }
    }
    return 'Team A';
  };

  const getTeamBLineup = () => {
    if (game.teamBLineup && Array.isArray(game.teamBLineup)) {
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
        case 'TIEBREAKER':
          return match?.teamB?.name || 'Team B';
        default:
          return 'Team B';
      }
    }
    // For tiebreakers, show actual team names
    if (game.slot === 'TIEBREAKER' && match) {
      return match.teamB?.name || 'Team B';
    }
    // Generate lineup from team roster based on game slot and lineup positions
    if (match && match.teamB && lineups[match.id]) {
      const teamBLineup = lineups[match.id][match.teamB.id] || [];
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
        case 'TIEBREAKER':
          return match.teamB?.name || 'Team B';
        default:
          return 'Team B';
      }
    }
    return 'Team B';
  };

  const teamAScore = game.teamAScore || 0;
  const teamBScore = game.teamBScore || 0;
  const teamAWon = teamAScore > teamBScore;
  const teamBWon = teamBScore > teamAScore;

  return (
    <div className={`rounded-lg border-2 overflow-hidden ${
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
          {gameStatus !== 'completed' && (
            <button
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                gameStatus === 'not_started'
                  ? 'bg-success hover:bg-success-hover text-white'
                  : 'bg-error hover:bg-error-hover text-white'
              }`}
              onClick={() => {
                if (gameStatus === 'not_started') {
                  startGame(game.id);
                } else if (gameStatus === 'in_progress') {
                  endGame(game.id);
                }
              }}
            >
              {gameStatus === 'not_started' ? 'Start' : 'Finish'}
            </button>
          )}
        </div>
      </div>

      {/* Game Body - Players and Scores */}
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
          {/* Team A Side */}
          <div className={`text-sm ${
            isCompleted && teamAWon ? 'text-success font-semibold' : 'text-secondary'
          }`}>
            <div className="whitespace-pre-line leading-relaxed">{getTeamALineup()}</div>
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
          <div className={`text-sm text-right ${
            isCompleted && teamBWon ? 'text-success font-semibold' : 'text-secondary'
          }`}>
            <div className="whitespace-pre-line leading-relaxed">{getTeamBLineup()}</div>
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
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if relevant game data changed
  return (
    prevProps.game.id === nextProps.game.id &&
    prevProps.game.teamAScore === nextProps.game.teamAScore &&
    prevProps.game.teamBScore === nextProps.game.teamBScore &&
    prevProps.game.isComplete === nextProps.game.isComplete &&
    prevProps.game.startedAt === nextProps.game.startedAt &&
    prevProps.game.courtNumber === nextProps.game.courtNumber &&
    prevProps.match.id === nextProps.match.id
  );
});

// InlineLineupEditor Component
function InlineLineupEditor({
  matchId,
  stopId,
  teamA,
  teamB,
  lineups,
  onSave,
  onCancel,
  prefetchedTeamRosters,
  teamRosters,
}: {
  matchId: string;
  stopId: string;
  teamA: { id: string; name: string };
  teamB: { id: string; name: string };
  lineups: Record<string, Record<string, PlayerLite[]>>;
  onSave: (lineups: { teamA: PlayerLite[]; teamB: PlayerLite[] }) => void;
  onCancel: () => void;
  prefetchedTeamRosters?: { teamA?: PlayerLite[]; teamB?: PlayerLite[] };
  teamRosters: Record<string, PlayerLite[]>;
}) {
  const [teamALineup, setTeamALineup] = useState<(PlayerLite | undefined)[]>([undefined, undefined, undefined, undefined]);
  const [teamBLineup, setTeamBLineup] = useState<(PlayerLite | undefined)[]>([undefined, undefined, undefined, undefined]);
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [loadedRosters, setLoadedRosters] = useState<{ teamA: PlayerLite[]; teamB: PlayerLite[] }>({ teamA: [], teamB: [] });
  const [rosterError, setRosterError] = useState<string | null>(null);

  // Fetch team rosters for this specific stop when component mounts
  useEffect(() => {
    let isMounted = true;

    const loadRosters = async () => {
      if (!teamA.id || !teamB.id || !stopId) return;

      const validateAndApply = (teamARoster: PlayerLite[], teamBRoster: PlayerLite[]) => {
        if (!isMounted) return;

        setLoadedRosters({ teamA: teamARoster, teamB: teamBRoster });

        const issues: string[] = [];

        const teamAMen = teamARoster.filter(player => player?.gender === 'MALE').length;
        const teamAWomen = teamARoster.filter(player => player?.gender === 'FEMALE').length;
        const teamBMen = teamBRoster.filter(player => player?.gender === 'MALE').length;
        const teamBWomen = teamBRoster.filter(player => player?.gender === 'FEMALE').length;

        if (teamAMen < 2 || teamAWomen < 2) {
          issues.push(`${teamA.name} roster must include at least 2 men and 2 women for this stop before lineups can be edited.`);
        }

        if (teamBMen < 2 || teamBWomen < 2) {
          issues.push(`${teamB.name} roster must include at least 2 men and 2 women for this stop before lineups can be edited.`);
        }

        if (issues.length > 0) {
          setRosterError(issues.join(' '));
        } else {
          setRosterError(null);
        }
      };

      const prefetchedA = prefetchedTeamRosters?.teamA && prefetchedTeamRosters.teamA.length > 0
        ? prefetchedTeamRosters.teamA
        : teamRosters[teamA.id];
      const prefetchedB = prefetchedTeamRosters?.teamB && prefetchedTeamRosters.teamB.length > 0
        ? prefetchedTeamRosters.teamB
        : teamRosters[teamB.id];

      const filteredA = (prefetchedA ?? []).filter(Boolean) as PlayerLite[];
      const filteredB = (prefetchedB ?? []).filter(Boolean) as PlayerLite[];

      if (prefetchedA && prefetchedB) {
        validateAndApply(filteredA, filteredB);
        return;
      }

      try {
        const [responseA, responseB] = await Promise.all([
          fetchWithActAs(`/api/admin/stops/${stopId}/teams/${teamA.id}/roster`),
          fetchWithActAs(`/api/admin/stops/${stopId}/teams/${teamB.id}/roster`)
        ]);

        const [dataA, dataB] = await Promise.all([
          responseA.json(),
          responseB.json()
        ]);

        const rosterA = dataA.items || [];
        const rosterB = dataB.items || [];

        validateAndApply(rosterA, rosterB);
      } catch (error) {
        console.error('Failed to load stop-specific rosters:', error);
        if (!isMounted) return;
        setLoadedRosters({ teamA: [], teamB: [] });
        setRosterError('Unable to load rosters for this stop. Please create stop rosters before editing lineups.');
      }
    };

    loadRosters();

    return () => {
      isMounted = false;
    };
  }, [teamA.id, teamB.id, stopId, prefetchedTeamRosters, teamRosters]);

  // Initialize lineups when component mounts or when editing starts
  useEffect(() => {
    const existingLineups = lineups[matchId];
    const rosterMapA = new Map(loadedRosters.teamA.map((p) => [p.id, p]));
    const rosterMapB = new Map(loadedRosters.teamB.map((p) => [p.id, p]));

    if (existingLineups) {
      const teamALineupData = existingLineups[teamA.id] || [];
      const teamBLineupData = existingLineups[teamB.id] || [];

      setTeamALineup([
        rosterMapA.get(teamALineupData[0]?.id) || teamALineupData[0] || undefined,
        rosterMapA.get(teamALineupData[1]?.id) || teamALineupData[1] || undefined,
        rosterMapA.get(teamALineupData[2]?.id) || teamALineupData[2] || undefined,
        rosterMapA.get(teamALineupData[3]?.id) || teamALineupData[3] || undefined
      ]);

      setTeamBLineup([
        rosterMapB.get(teamBLineupData[0]?.id) || teamBLineupData[0] || undefined,
        rosterMapB.get(teamBLineupData[1]?.id) || teamBLineupData[1] || undefined,
        rosterMapB.get(teamBLineupData[2]?.id) || teamBLineupData[2] || undefined,
        rosterMapB.get(teamBLineupData[3]?.id) || teamBLineupData[3] || undefined
      ]);

      const allSelectedPlayers = new Set([
        ...teamALineupData.map((p: any) => p.id),
        ...teamBLineupData.map((p: any) => p.id)
      ]);
      setSelectedPlayers(allSelectedPlayers);
    } else {
      setTeamALineup([undefined, undefined, undefined, undefined]);
      setTeamBLineup([undefined, undefined, undefined, undefined]);
      setSelectedPlayers(new Set());
    }
  }, [matchId, teamA.id, teamB.id, lineups, loadedRosters.teamA, loadedRosters.teamB]);

  const addPlayerToLineup = (player: PlayerLite, teamId: string, slotIndex: number) => {
    const isTeamA = teamId === teamA.id;
    const currentLineup = isTeamA ? teamALineup : teamBLineup;
    const currentPlayer = currentLineup[slotIndex];

    // Check gender constraints: slots 0,1 are male, slots 2,3 are female
    const expectedGender = slotIndex < 2 ? 'MALE' : 'FEMALE';
    if (player.gender !== expectedGender) return;

    // Update selectedPlayers first to avoid race conditions
    setSelectedPlayers(prev => {
      const newSet = new Set(prev);

      // Remove current player from selectedPlayers if there is one
      if (currentPlayer) {
        newSet.delete(currentPlayer.id);
      }

      // Remove the new player from selectedPlayers if they're already selected elsewhere
      if (newSet.has(player.id)) {
        newSet.delete(player.id);
      }

      // Add the new player
      newSet.add(player.id);

      return newSet;
    });

    // Update lineup state
    if (isTeamA) {
      setTeamALineup(prev => {
        const newLineup = [...prev];

        // Remove the new player from other slots if they exist
        for (let i = 0; i < newLineup.length; i++) {
          if (newLineup[i]?.id === player.id) {
            newLineup[i] = undefined;
          }
        }

        // Add player to the new slot
        newLineup[slotIndex] = player;
        return newLineup;
      });
    } else {
      setTeamBLineup(prev => {
        const newLineup = [...prev];

        // Remove the new player from other slots if they exist
        for (let i = 0; i < newLineup.length; i++) {
          if (newLineup[i]?.id === player.id) {
            newLineup[i] = undefined;
          }
        }

        // Add player to the new slot
        newLineup[slotIndex] = player;
        return newLineup;
      });
    }
  };

  const removePlayerFromLineup = (playerId: string, teamId: string, slotIndex: number) => {
    const isTeamA = teamId === teamA.id;

    // Update selectedPlayers first
    setSelectedPlayers(prev => {
      const newSet = new Set(prev);
      newSet.delete(playerId);
      return newSet;
    });

    // Update lineup state
    if (isTeamA) {
      setTeamALineup(prev => {
        const newLineup = [...prev];
        newLineup[slotIndex] = undefined as any;
        return newLineup;
      });
    } else {
      setTeamBLineup(prev => {
        const newLineup = [...prev];
        newLineup[slotIndex] = undefined as any;
        return newLineup;
      });
    }
  };

  const rosterReady =
    !rosterError &&
    loadedRosters.teamA.filter(player => player?.gender === 'MALE').length >= 2 &&
    loadedRosters.teamA.filter(player => player?.gender === 'FEMALE').length >= 2 &&
    loadedRosters.teamB.filter(player => player?.gender === 'MALE').length >= 2 &&
    loadedRosters.teamB.filter(player => player?.gender === 'FEMALE').length >= 2;

  const getAvailablePlayers = (teamId: string, slotIndex: number) => {
    const isTeamA = teamId === teamA.id;
    const roster = isTeamA ? loadedRosters.teamA : loadedRosters.teamB;
    const expectedGender = expectedGenderForIndex(slotIndex);
    const currentLineup = isTeamA ? teamALineup : teamBLineup;
    const currentPlayer = currentLineup[slotIndex];

    const availableMap = new Map<string, PlayerLite>();

    const addPlayer = (player?: PlayerLite) => {
      if (!player || player.gender !== expectedGender) return;
      availableMap.set(player.id, player);
    };

    roster.forEach((player) => {
      if (player.gender !== expectedGender) return;
      if (currentPlayer && player.id === currentPlayer.id) {
        addPlayer(player);
        return;
      }
      if (!selectedPlayers.has(player.id)) {
        addPlayer(player);
      }
    });

    currentLineup.forEach((player, idx) => {
      if (!player || player.gender !== expectedGender) return;
      if (idx === slotIndex) {
        addPlayer(player);
        return;
      }
      if (!selectedPlayers.has(player.id)) {
        addPlayer(player);
      }
    });

    if (currentPlayer) {
      addPlayer(currentPlayer);
    }

    return Array.from(availableMap.values());
  };

  const isLineupComplete = teamALineup.filter(p => p !== undefined).length === 4 && teamBLineup.filter(p => p !== undefined).length === 4;

  const handleSave = async () => {
    if (isSaving) return; // Prevent double-clicks

    setIsSaving(true);
    try {
      await onSave({
        teamA: teamALineup.filter(p => p !== undefined) as PlayerLite[],
        teamB: teamBLineup.filter(p => p !== undefined) as PlayerLite[]
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-subtle bg-surface-1 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Edit Lineups</h3>
        <div className="flex gap-2">
          <button
            className="btn btn-xs btn-primary disabled:opacity-50"
            onClick={handleSave}
            disabled={!rosterReady || !isLineupComplete || isSaving}
          >
            {isSaving ? 'Saving...' : 'Confirm Lineup'}
          </button>
          <button
            className="btn btn-ghost btn-xs"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>

      {rosterError && (
        <div className="mb-3 p-3 border border-warning/40 bg-warning/10 text-warning text-xs rounded">
          {rosterError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Team A */}
        <div>
          <h4 className="text-xs font-medium mb-2 text-muted">{teamA.name}</h4>
          <div className="space-y-2">
            {[0, 1, 2, 3].map((slotIndex) => (
              <div key={slotIndex} className="flex items-center gap-2">
                <label className="text-xs font-medium w-4">{slotIndex + 1}:</label>
                <select
                  disabled={!rosterReady}
                  className={`flex-1 text-xs border rounded focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary ${
                    rosterReady ? 'bg-surface-1 text-primary' : 'bg-surface-2 text-muted cursor-not-allowed'
                  }`}
                  value={teamALineup[slotIndex]?.id || ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      const player = loadedRosters.teamA.find(p => p.id === e.target.value);
                      if (player) addPlayerToLineup(player, teamA.id, slotIndex);
                    } else if (teamALineup[slotIndex]) {
                      removePlayerFromLineup(teamALineup[slotIndex]!.id, teamA.id, slotIndex);
                    }
                  }}
                >
                  <option value="">{rosterReady ? `Select Player ${slotIndex + 1}` : 'Waiting for roster...'}</option>
                  {getAvailablePlayers(teamA.id, slotIndex).map(player => (
                    <option key={player.id} value={player.id} className="bg-surface-1 text-primary">
                      {player.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Team B */}
        <div>
          <h4 className="text-xs font-medium mb-2 text-muted">{teamB.name}</h4>
          <div className="space-y-2">
            {[0, 1, 2, 3].map((slotIndex) => (
              <div key={slotIndex} className="flex items-center gap-2">
                <label className="text-xs font-medium w-4">{slotIndex + 1}:</label>
                <select
                  disabled={!rosterReady}
                  className={`flex-1 text-xs border rounded focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary ${
                    rosterReady ? 'bg-surface-1 text-primary' : 'bg-surface-2 text-muted cursor-not-allowed'
                  }`}
                  value={teamBLineup[slotIndex]?.id || ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      const player = loadedRosters.teamB.find(p => p.id === e.target.value);
                      if (player) addPlayerToLineup(player, teamB.id, slotIndex);
                    } else if (teamBLineup[slotIndex]) {
                      removePlayerFromLineup(teamBLineup[slotIndex]!.id, teamB.id, slotIndex);
                    }
                  }}
                >
                  <option value="">{rosterReady ? `Select Player ${slotIndex + 1}` : 'Waiting for roster...'}</option>
                  {getAvailablePlayers(teamB.id, slotIndex).map(player => (
                    <option key={player.id} value={player.id} className="bg-surface-1 text-primary">
                      {player.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Main EventManagerTab Component
export function EventManagerTab({
  tournaments,
  onError,
  onInfo,
}: {
  tournaments: EventManagerTournament[];
  onError: (m: string) => void;
  onInfo: (m: string) => void;
}) {
  // Default to expanding only in-progress or not-started rounds (not completed)
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set());
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [scheduleData, setScheduleData] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [lineupDeadlines, setLineupDeadlines] = useState<Record<string, string>>({});

  // Lineup and game state
  const [editingMatch, setEditingMatch] = useState<string | null>(null);
  const [lineups, setLineups] = useState<Record<string, Record<string, PlayerLite[]>>>({});
  const [teamRosters, setTeamRosters] = useState<Record<string, PlayerLite[]>>({});
  const [games, setGames] = useState<Record<string, any[]>>({});
  const [resolvingMatch, setResolvingMatch] = useState<string | null>(null);

  // Derive game status from isComplete and startedAt fields
  const getGameStatus = (game: any): 'not_started' | 'in_progress' | 'completed' => {
    if (game.isComplete) return 'completed';
    if (game.startedAt) return 'in_progress';
    return 'not_started';
  };

  type MatchStatus =
    | 'not_started'
    | 'in_progress'
    | 'completed'
    | 'tied_pending'
    | 'tied_requires_tiebreaker'
    | 'needs_decision'
    | 'decided_points'
    | 'decided_tiebreaker';
  const normalizeTiebreakerStatus = (status?: string | null): MatchStatus | null => {
    switch (status) {
      case 'PENDING_TIEBREAKER':
        return 'tied_pending';
      case 'NEEDS_DECISION':
        return 'needs_decision';
      case 'REQUIRES_TIEBREAKER':
        return 'tied_requires_tiebreaker';
      case 'DECIDED_POINTS':
        return 'decided_points';
      case 'DECIDED_TIEBREAKER':
        return 'decided_tiebreaker';
      case 'tied_pending':
      case 'tied_requires_tiebreaker':
      case 'needs_decision':
      case 'decided_points':
      case 'decided_tiebreaker':
        return status as MatchStatus;
      default:
        return null;
    }
  };

  const deriveMatchStatus = (match: any): MatchStatus => {
    if (!match) return 'not_started';

    const tiebreakerStatus = normalizeTiebreakerStatus(match.tiebreakerStatus);

    if (tiebreakerStatus) {
      return tiebreakerStatus;
    }

    if (match.matchStatus === 'in_progress') return 'in_progress';
    if (match.matchStatus === 'completed') return 'completed';
    return 'not_started';
  };

  // Check if a match is completed (one team has >= 3 wins and they're not tied)
  const isMatchComplete = (match: any): boolean => {
    const status = deriveMatchStatus(match);
    if (status === 'completed' || status === 'decided_points' || status === 'decided_tiebreaker') {
      return true;
    }

    const matchGames = games[match.id] ?? match.games ?? [];
    if (matchGames.length === 0) return false;

    let teamAWins = 0;
    let teamBWins = 0;

    for (const game of matchGames) {
      if (!game) continue;
      const status = getGameStatus(game);
      if (status === 'in_progress') {
        return false;
      }

      const a = game.teamAScore;
      const b = game.teamBScore;

      if (a != null && b != null) {
        if (a > b) teamAWins += 1;
        else if (b > a) teamBWins += 1;
      }
    }

    return (teamAWins >= 3 || teamBWins >= 3) && teamAWins !== teamBWins;
  };

  // Check for duplicate matchups within a stop
  const checkForDuplicateMatchups = (stopId: string, roundMatchups: Record<string, any[]>) => {
    console.log('🔍 Checking for duplicate matchups in stop:', stopId);
    console.log('📊 Round matchups data:', roundMatchups);
    
    const allMatches: any[] = [];
    
    // Collect all matches from all rounds in this stop
    Object.values(roundMatchups).forEach(matches => {
      allMatches.push(...matches);
    });

    console.log('🏓 Total matches to check:', allMatches.length);

    // Create a map to track team pairings
    const teamPairings = new Map<string, { count: number; matches: any[] }>();

    allMatches.forEach(match => {
      if (match.isBye || !match.teamA || !match.teamB) return;

      // Create a consistent key for the team pairing (alphabetically sorted)
      const teamAId = match.teamA.id;
      const teamBId = match.teamB.id;
      const pairingKey = teamAId < teamBId ? `${teamAId}-${teamBId}` : `${teamBId}-${teamAId}`;
      
      if (!teamPairings.has(pairingKey)) {
        teamPairings.set(pairingKey, { count: 0, matches: [] });
      }
      
      const pairing = teamPairings.get(pairingKey)!;
      pairing.count++;
      pairing.matches.push(match);
    });

    console.log('📈 Team pairings found:', teamPairings.size);

    // Check for duplicates and show alerts
    let duplicateCount = 0;
    const duplicateMessages: string[] = [];
    
    teamPairings.forEach((pairing, pairingKey) => {
      if (pairing.count > 1) {
        duplicateCount++;
        const [teamAId, teamBId] = pairingKey.split('-');
        const firstMatch = pairing.matches[0];
        const teamAName = firstMatch.teamA.id === teamAId ? firstMatch.teamA.name : firstMatch.teamB.name;
        const teamBName = firstMatch.teamA.id === teamBId ? firstMatch.teamA.name : firstMatch.teamB.name;
        
        // Get round numbers for this duplicate
        const rounds = pairing.matches.map(match => {
          // Find which round this match belongs to
          for (const [roundId, matches] of Object.entries(roundMatchups)) {
            if (matches.some(m => m.id === match.id)) {
              // Find the round index from scheduleData
              const stopSchedule = scheduleData[stopId] || [];
              const round = stopSchedule.find(r => r.id === roundId);
              return round?.idx || 'Unknown';
            }
          }
          return 'Unknown';
        }).sort((a: any, b: any) => a - b);
        
        const roundsText = rounds.join(' & ');
        
        console.log(`⚠️ Duplicate found: ${teamAName} vs ${teamBName} (${pairing.count} times) - Rounds ${roundsText}`);
        
        duplicateMessages.push(`${teamAName} vs ${teamBName} (${pairing.count} times) - Rounds ${roundsText}`);
      }
    });

    // Show all duplicates in a single error message
    if (duplicateCount > 0) {
      // Get stop name from the current tournament
      const currentStop = tournaments[0]?.stops?.find(s => s.stopId === stopId);
      const stopDisplayName = currentStop?.stopName || `Stop ${stopId}`;
      
      onError(
        `⚠️ ${duplicateCount} duplicate matchup(s) detected in ${stopDisplayName}:\n${duplicateMessages.join('\n')}`
      );
    }

    console.log(`✅ Duplicate check complete: ${duplicateCount} duplicates found`);
  };

  // Check for duplicate matchups using schedule data directly
  const checkForDuplicateMatchupsFromSchedule = (stopId: string, roundMatchups: Record<string, any[]>, scheduleData: any[]) => {
    console.log('🔍 Checking for duplicate matchups in stop (from schedule):', stopId);
    console.log('📊 Round matchups data:', roundMatchups);
    
    const allMatches: any[] = [];
    
    // Collect all matches from all rounds in this stop
    Object.values(roundMatchups).forEach(matches => {
      allMatches.push(...matches);
    });

    console.log('🏓 Total matches to check:', allMatches.length);

    // Create a map to track team pairings
    const teamPairings = new Map();

    allMatches.forEach(match => {
      if (match.isBye || !match.teamA || !match.teamB) return;

      // Create a consistent key for the team pairing (alphabetically sorted)
      const teamAId = match.teamA.id;
      const teamBId = match.teamB.id;
      const pairingKey = teamAId < teamBId ? `${teamAId}-${teamBId}` : `${teamBId}-${teamAId}`;
      
      if (!teamPairings.has(pairingKey)) {
        teamPairings.set(pairingKey, { count: 0, matches: [] });
      }
      
      const pairing = teamPairings.get(pairingKey);
      pairing.count++;
      pairing.matches.push(match);
    });

    console.log('📈 Team pairings found:', teamPairings.size);

    // Check for duplicates and show alerts
    let duplicateCount = 0;
    const duplicateMessages: string[] = [];
    
    teamPairings.forEach((pairing, pairingKey) => {
      if (pairing.count > 1) {
        duplicateCount++;
        const [teamAId, teamBId] = pairingKey.split('-');
        const firstMatch = pairing.matches[0];
        const teamAName = firstMatch.teamA.id === teamAId ? firstMatch.teamA.name : firstMatch.teamB.name;
        const teamBName = firstMatch.teamA.id === teamBId ? firstMatch.teamA.name : firstMatch.teamB.name;
        
        // Get round numbers for this duplicate using schedule data
        const rounds = pairing.matches.map((match: any) => {
          // Find which round this match belongs to in the schedule data
          for (const round of scheduleData) {
            if (round.matches?.some((m: any) => m.id === match.id)) {
              return round.idx;
            }
          }
          return 'Unknown';
        }).sort((a: any, b: any) => a - b);
        
        const roundsText = rounds.join(' & ');
        
        console.log(`⚠️ Duplicate found: ${teamAName} vs ${teamBName} (${pairing.count} times) - Rounds ${roundsText}`);
        
        duplicateMessages.push(`${teamAName} vs ${teamBName} (${pairing.count} times) - Rounds ${roundsText}`);
      }
    });

    // Show all duplicates in a single error message
    if (duplicateCount > 0) {
      // Get stop name from the current tournament
      const currentStop = tournaments[0]?.stops?.find(s => s.stopId === stopId);
      const stopDisplayName = currentStop?.stopName || `Stop ${stopId}`;
      
      onError(
        `⚠️ ${duplicateCount} duplicate matchup(s) detected in ${stopDisplayName}:\n${duplicateMessages.join('\n')}`
      );
    }

    console.log(`✅ Duplicate check complete: ${duplicateCount} duplicates found`);
  };

  const getTiebreakerBanner = (
    status: MatchStatus,
    matchLabel: string,
    winnerName?: string | null,
    totals?: { teamA: number | null; teamB: number | null },
  ) => {
    switch (status) {
      case 'tied_requires_tiebreaker':
        return {
          tone: 'warning' as const,
          message: `${matchLabel} is tied 2-2. Add and schedule a tiebreaker game to decide the winner.`,
        };
      case 'tied_pending':
        return {
          tone: 'info' as const,
          message: `${matchLabel} tiebreaker has been scheduled but is not complete yet.`,
        };
      case 'decided_points':
        return {
          tone: 'success' as const,
          message: `${matchLabel} decided via total points${winnerName ? ` – ${winnerName} wins.` : '.'}${
            totals ? ` (Total Points ${totals.teamA ?? 0} - ${totals.teamB ?? 0})` : ''
          }`,
        };
      case 'decided_tiebreaker':
        return {
          tone: 'success' as const,
          message: `${matchLabel} tiebreaker played${winnerName ? ` – ${winnerName} wins.` : '.'}`,
        };
      default:
        return null;
    }
  };

  const formatMatchLabel = (match: any) => {
    const teamAName = match.teamA?.name || 'Team A';
    const teamBName = match.teamB?.name || 'Team B';
    return `${teamAName} vs ${teamBName}`;
  };

  const gatherRoundTiebreakerAlerts = (
    roundMatches: any[],
    statusResolver: (match: any) => MatchStatus,
  ) => {
    return roundMatches
      .map((match) => {
        const status = statusResolver(match);
        if (!status || ['not_started', 'in_progress', 'completed'].includes(status)) {
          return null;
        }
        const matchLabel = formatMatchLabel(match);
        const winnerName = match.tiebreakerWinnerTeamId
          ? match.tiebreakerWinnerTeamId === match.teamA?.id
            ? match.teamA?.name
            : match.teamB?.name
          : null;
        return getTiebreakerBanner(status, matchLabel, winnerName, {
          teamA: match.totalPointsTeamA ?? null,
          teamB: match.totalPointsTeamB ?? null,
        });
      })
      .filter(Boolean) as Array<{ tone: 'warning' | 'info' | 'success'; message: string }>;
  };

  const totalPointsDisagree = (pointsA: number | null | undefined, pointsB: number | null | undefined) => {
    if (pointsA == null || pointsB == null) return false;
    return pointsA !== pointsB;
  };

  // Matchup editing state
  const [editingRounds, setEditingRounds] = useState<Set<string>>(new Set());
  const [roundMatchups, setRoundMatchups] = useState<Record<string, Array<{
    id: Id;
    isBye: boolean;
    bracketName?: string;
    teamA?: { id: Id; name: string; clubName?: string; bracketName?: string };
    teamB?: { id: Id; name: string; clubName?: string; bracketName?: string };
  }>>>({});
  const [updateKey, setUpdateKey] = useState(0);
  const [renderKey, setRenderKey] = useState(0);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    sourceId: string;
    targetId: string;
    sourceTeam: any;
    targetTeam: any;
  } | null>(null);

  // Debounce refs
  const debouncedScoreUpdate = useRef<Record<string, NodeJS.Timeout>>({});
  const debouncedCourtUpdate = useRef<Record<string, NodeJS.Timeout>>({});

  // Auto-select first stop when tournaments load
  useEffect(() => {
    if (tournaments.length > 0 && !selectedStopId) {
      const firstTournament = tournaments[0];
      log('First tournament:', firstTournament);
      if (firstTournament.stops.length > 0) {
        const firstStopId = firstTournament.stops[0].stopId;
        log('Auto-selecting stop:', firstStopId);
        setSelectedStopId(firstStopId);
        loadSchedule(firstStopId);
      }
    }
  }, [tournaments, selectedStopId]);

  // Initialize lineup deadlines from tournament data
  useEffect(() => {
    const deadlines: Record<string, string> = {};
    tournaments.forEach(tournament => {
      tournament.stops.forEach(stop => {
        if (stop.lineupDeadline) {
          // Convert ISO string to datetime-local format (YYYY-MM-DDTHH:mm)
          const date = new Date(stop.lineupDeadline);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          deadlines[stop.stopId] = `${year}-${month}-${day}T${hours}:${minutes}`;
        }
      });
    });
    setLineupDeadlines(deadlines);
  }, [tournaments]);

  const formatDate = (dateStr: string | null) => {
    return formatDateUTC(dateStr);
  };

  const formatDateRange = (startAt: string | null, endAt: string | null) => {
    return formatDateRangeUTC(startAt, endAt);
  };

  const formatDeadline = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getTournamentTypeDisplayName = (type: string) => {
    const typeMap: Record<string, string> = {
      'TEAM_FORMAT': 'Team Format',
      'SINGLE_ELIMINATION': 'Single Elimination',
      'DOUBLE_ELIMINATION': 'Double Elimination',
      'ROUND_ROBIN': 'Round Robin',
      'POOL_PLAY': 'Pool Play',
      'LADDER_TOURNAMENT': 'Ladder Tournament',
    };
    return typeMap[type] || type;
  };

  const toggleRound = (roundId: string) => {
    setExpandedRounds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(roundId)) {
        newSet.delete(roundId);
      } else {
        // Close all other rounds first (only one open at a time)
        newSet.clear();
        newSet.add(roundId);
      }
      return newSet;
    });
  };

  const toggleRoundEdit = (roundId: string) => {
    setEditingRounds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(roundId)) {
        newSet.delete(roundId);
        // Remove from roundMatchups when closing edit mode
        setRoundMatchups(prev => {
          const newMatchups = { ...prev };
          delete newMatchups[roundId];
          return newMatchups;
        });
      } else {
        newSet.add(roundId);
        // Load round data when opening edit mode, but only if we don't already have it
        if (!roundMatchups[roundId]) {
          loadRoundMatchups(roundId);
        }
      }
      return newSet;
    });
  };

  const loadSchedule = async (stopId: string, force = false) => {
    if (scheduleData[stopId] && !force) return; // Already loaded

    log('Loading schedule for stop:', stopId);
    setLoading(prev => ({ ...prev, [stopId]: true }));
    try {
      const response = await fetchWithActAs(`/api/admin/stops/${stopId}/schedule`);
      log('Schedule response status:', response.status);
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Schedule error:', errorData);
        throw new Error(errorData.error || 'Failed to load schedule');
      }
      const data = await response.json();
      log('Schedule data:', data);
      setScheduleData(prev => ({ ...prev, [stopId]: data || [] }));

      // Prefetch stop rosters for all teams in this schedule
      const teamIds = new Set<string>();
      data.forEach((round: any) => {
        round.matches?.forEach((match: any) => {
          if (match.teamA?.id) teamIds.add(match.teamA.id);
          if (match.teamB?.id) teamIds.add(match.teamB.id);
        });
      });

      if (teamIds.size > 0) {
        const prefetchEntries = await Promise.all(
          Array.from(teamIds).map(async (teamId) => {
            try {
              const rosterResp = await fetchWithActAs(`/api/admin/stops/${stopId}/teams/${teamId}/roster`);
              if (!rosterResp.ok) {
                return { teamId, roster: [] as PlayerLite[] };
              }
              const rosterJson = await rosterResp.json();
              return { teamId, roster: (rosterJson.items || []) as PlayerLite[] };
            } catch (err) {
              console.error('Failed to prefetch roster for team', teamId, err);
              return { teamId, roster: [] as PlayerLite[] };
            }
          })
        );

        setTeamRosters(prev => {
          const updated = { ...prev };
          prefetchEntries.forEach(({ teamId, roster }) => {
            if (!updated[teamId] || updated[teamId].length === 0) {
              updated[teamId] = roster;
            }
          });
          return updated;
        });
      }

      // Extract games from schedule data and populate games state
      const gamesMap: Record<string, any[]> = {};

      data.forEach((round: any) => {
        round.matches?.forEach((match: any) => {
          if (match.games && match.games.length > 0) {
            gamesMap[match.id] = match.games;
          }
        });
      });

      log('🎮 EXTRACTED GAMES FOR STOP:', stopId);
      log('🎮 Total matches with games:', Object.keys(gamesMap).length);
      setGames(prev => {
        const updated = { ...prev, ...gamesMap };
        log('🎮 GAMES STATE UPDATED:', Object.keys(updated).length, 'matches');
        return updated;
      });

      // Load lineups from the dedicated lineups endpoint instead of extracting from games
      await loadLineupsForStop(stopId);

      // Auto-expand the first incomplete round
      const firstIncompleteRound = data.find((round: any) => {
        const allMatchesComplete = round.matches?.every((match: any) => {
          const gamesForMatch = match.games || [];
          return gamesForMatch.length > 0 && gamesForMatch.every((g: any) =>
            g.teamAScore !== null && g.teamBScore !== null
          );
        });
        return !allMatchesComplete;
      });

      if (firstIncompleteRound) {
        setExpandedRounds(new Set([firstIncompleteRound.id]));
      } else if (data.length > 0) {
        // If all rounds complete, expand the last one
        setExpandedRounds(new Set([data[data.length - 1].id]));
      }

      // Check for duplicate matchups after loading schedule
      setTimeout(() => {
        // Convert schedule data to roundMatchups format for duplicate checking
        const scheduleRoundMatchups: Record<string, any> = {};
        data.forEach((round: any) => {
          if (round.matches) {
            scheduleRoundMatchups[round.id as string] = round.matches.map((match: any) => ({
              id: match.id,
              isBye: match.isBye,
              bracketName: match.bracketName,
              teamA: match.teamA ? {
                id: match.teamA.id,
                name: match.teamA.name,
                clubName: match.teamA.clubName || undefined,
                bracketName: match.teamA.bracketName || undefined,
              } : undefined,
              teamB: match.teamB ? {
                id: match.teamB.id,
                name: match.teamB.name,
                clubName: match.teamB.clubName || undefined,
                bracketName: match.teamB.bracketName || undefined,
              } : undefined,
              games: match.games || [],
            }));
          }
        });
        
        // Create a modified version of checkForDuplicateMatchups that works with schedule data
        checkForDuplicateMatchupsFromSchedule(stopId, scheduleRoundMatchups, data);
      }, 100);
    } catch (e) {
      console.error('Load schedule error:', e);
      onError(`Failed to load schedule: ${(e as Error).message}`);
      setScheduleData(prev => ({ ...prev, [stopId]: [] }));
    } finally {
      setLoading(prev => ({ ...prev, [stopId]: false }));
    }
  };

  const loadLineupsForStop = async (stopId: string) => {
    try {
      const response = await fetchWithActAs(`/api/admin/stops/${stopId}/lineups`);
      log('=== Lineups response status:', response.status);
      if (response.ok) {
        const lineupsData = await response.json();
        log('=== Lineups data received:', lineupsData);
        log('=== Number of matches with lineups:', Object.keys(lineupsData).length);
        setLineups(prev => {
          const updated = { ...prev, ...lineupsData };
          log('=== Updated lineups state:', updated);
          return updated;
        });

        // Load games for matches that have confirmed lineups
        Object.keys(lineupsData).forEach(matchId => {
          const matchLineups = lineupsData[matchId];
          const teamAId = Object.keys(matchLineups)[0];
          const teamBId = Object.keys(matchLineups)[1];

          if (matchLineups[teamAId]?.length === 4 && matchLineups[teamBId]?.length === 4) {
            log('=== Loading games for match with confirmed lineups:', matchId);
            // Add a small delay to prevent overwhelming the API
            setTimeout(() => loadGamesForMatch(matchId, true), 100);
          }
        });
      }
    } catch (error) {
      console.error('Error loading lineups for stop:', error);
    }
  };

  const loadRoundMatchups = async (roundId: string) => {
    try {
      const response = await fetchWithActAs(`/api/admin/rounds/${roundId}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const roundData = await response.json();

      if (!roundData.matches) {
        return;
      }

      const matches = roundData.matches.map((match: any) => ({
        id: match.id,
        isBye: match.isBye,
        bracketName: match.bracketName,
        teamA: match.teamA ? {
          id: match.teamA.id,
          name: match.teamA.name,
          clubName: match.teamA.clubName || undefined,
          bracketName: match.teamA.bracketName || undefined,
        } : undefined,
        teamB: match.teamB ? {
          id: match.teamB.id,
          name: match.teamB.name,
          clubName: match.teamB.clubName || undefined,
          bracketName: match.teamB.bracketName || undefined,
        } : undefined,
        games: match.games || [],
      }));

      setRoundMatchups(prev => {
        const newRoundMatchups = {
          ...prev,
          [roundId]: matches
        };
        
        // Check for duplicate matchups after updating the state
        // We need to find the stopId for this round to check all rounds in the stop
        const stopId = Object.keys(scheduleData).find(stopId =>
          scheduleData[stopId].some((round: any) => round.id === roundId)
        );
        
        if (stopId) {
          // Use setTimeout to ensure state is updated before checking
          setTimeout(() => {
            checkForDuplicateMatchups(stopId, newRoundMatchups);
          }, 0);
        }
        
        return newRoundMatchups;
      });
    } catch (e) {
      onError((e as Error).message);
    }
  };

  const generateSchedule = async (stopId: string, stopName: string) => {
    setLoading(prev => ({ ...prev, [stopId]: true }));
    try {
      const response = await fetchWithActAs(`/api/admin/stops/${stopId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overwrite: true,
          slots: ['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_1', 'MIXED_2', 'TIEBREAKER']
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate schedule');
      }

      const result = await response.json();
      onInfo(`Matchups regenerated: ${result.roundsCreated} rounds, ${result.matchesCreated} matches, ${result.gamesCreated} games`);

      // Reload schedule data
      await loadSchedule(stopId, true);
      
      // Check for duplicate matchups after schedule generation
      setTimeout(() => {
        checkForDuplicateMatchups(stopId, roundMatchups);
      }, 100);
    } catch (e) {
      onError(`Failed to generate schedule: ${(e as Error).message}`);
    } finally {
      setLoading(prev => ({ ...prev, [stopId]: false }));
    }
  };

  const saveLineupDeadline = async (stopId: string) => {
    const deadlineValue = lineupDeadlines[stopId];
    if (!deadlineValue) {
      onError('Please select a deadline date and time');
      return;
    }

    setLoading(prev => ({ ...prev, [stopId]: true }));
    try {
      const response = await fetchWithActAs(`/api/admin/stops/${stopId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineupDeadline: deadlineValue,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save lineup deadline');
      }

      onInfo('Lineup deadline saved successfully');
    } catch (e) {
      onError(`Failed to save lineup deadline: ${(e as Error).message}`);
    } finally {
      setLoading(prev => ({ ...prev, [stopId]: false }));
    }
  };

  const copyLineupsFromPreviousRound = useCallback(async (stopId: string, roundIdx: number) => {
    const rounds = scheduleData[stopId];
    if (!rounds || roundIdx <= 0) {
      onInfo('No previous round available to copy lineups from.');
      return;
    }

    const currentRound = rounds[roundIdx];
    const previousRound = rounds[roundIdx - 1];

    if (!currentRound?.matches || !previousRound?.matches) {
      onInfo('No previous round matches found to copy lineups.');
      return;
    }

    const teamLineupMap = new Map<string, PlayerLite[]>();

    previousRound.matches.forEach((prevMatch: any) => {
      const prevMatchLineups = lineups[prevMatch.id];
      if (!prevMatchLineups) return;

      const teamAId = prevMatch.teamA?.id;
      const teamBId = prevMatch.teamB?.id;

      if (teamAId && prevMatchLineups[teamAId]?.length) {
        teamLineupMap.set(teamAId, prevMatchLineups[teamAId].map((p: PlayerLite) => ({ ...p })));
      }
      if (teamBId && prevMatchLineups[teamBId]?.length) {
        teamLineupMap.set(teamBId, prevMatchLineups[teamBId].map((p: PlayerLite) => ({ ...p })));
      }
    });

    const updates: Record<string, Record<string, PlayerLite[]>> = {};
    let copiedTeams = 0;

    currentRound.matches.forEach((match: any) => {
            const matchUpdates: Record<string, PlayerLite[]> = {};

            const applyTeam = (team: any) => {
              if (!team?.id) return;
              const previousLineup = teamLineupMap.get(team.id);
              if (!previousLineup || previousLineup.length === 0) return;
              matchUpdates[team.id] = previousLineup.map((p) => ({ ...p }));
              copiedTeams += 1;
            };

            applyTeam(match.teamA);
            applyTeam(match.teamB);

      if (Object.keys(matchUpdates).length > 0) {
        updates[match.id] = matchUpdates;
      }
    });

    if (Object.keys(updates).length === 0) {
      onInfo('No previous lineups found to copy.');
      return;
    }

    try {
      const response = await fetchWithActAs(`/api/admin/stops/${stopId}/lineups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineups: updates }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to copy lineups');
      }

      setLineups((prev) => {
        const next = { ...prev };
        for (const [matchId, teamMap] of Object.entries(updates)) {
          const existing = { ...(next[matchId] ?? {}) };
          for (const [teamId, players] of Object.entries(teamMap)) {
            existing[teamId] = players.map((p) => ({ ...p }));
          }
          next[matchId] = existing;
        }
        return next;
      });

      await Promise.all(Object.keys(updates).map((matchId) => loadGamesForMatch(matchId, true)));

      onInfo(`Copied previous lineups for ${copiedTeams} team${copiedTeams === 1 ? '' : 's'}.`);
    } catch (error) {
      console.error('Error copying previous lineups:', error);
      onError(error instanceof Error ? error.message : 'Failed to copy lineups');
    }
  }, [scheduleData, lineups, onError, onInfo]);

  const autoSaveRoundMatchups = async (roundId: string) => {
    const matches = roundMatchups[roundId];
    if (!matches) return;

    try {
      const updates = matches.map(match => ({
        gameId: match.id,
        teamAId: match.teamA?.id || null,
        teamBId: match.teamB?.id || null,
      }));

      await fetchWithActAs(`/api/admin/rounds/${roundId}/matchups`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
    } catch (e) {
      onError((e as Error).message);
    }
  };

  const saveRoundMatchups = async (roundId: string) => {
    const matches = roundMatchups[roundId];
    if (!matches) return;

    try {
      const updates = matches.map(match => ({
        gameId: match.id,
        teamAId: match.teamA?.id || null,
        teamBId: match.teamB?.id || null,
      }));

      await fetchWithActAs(`/api/admin/rounds/${roundId}/matchups`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });

      setEditingRounds(prev => {
        const newSet = new Set(prev);
        newSet.delete(roundId);
        return newSet;
      });

      const stopId = Object.keys(scheduleData).find(stopId =>
        scheduleData[stopId].some((round: any) => round.id === roundId)
      );
      if (stopId) {
        await loadSchedule(stopId, true);
        await loadRoundMatchups(roundId);
      }

      onInfo('Matchups confirmed and saved!');
    } catch (e) {
      onError((e as Error).message);
    }
  };

  const loadGamesForMatch = async (matchId: string, force = false) => {
    if (!force && games[matchId]) return;

    try {
      const response = await fetchWithActAs(`/api/admin/matches/${matchId}/games`, { cache: 'no-store' });
      if (response.ok) {
        const gamesData = await response.json();
        setGames(prev => ({ ...prev, [matchId]: gamesData }));
      } else if (response.status === 404) {
        console.warn(`Match ${matchId} not found, removing from games state`);
        setGames(prev => {
          const { [matchId]: removed, ...rest } = prev;
          return rest;
        });
      } else {
        console.error(`Failed to load games for match ${matchId}:`, response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error loading games:', error);
    }
  };


  const startGame = async (gameId: string) => {
    try {
      const response = await fetchWithActAs(`/api/admin/games/${gameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isComplete: false,
          startedAt: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start game');
      }

      // Update local state
      setGames(prev => {
        const updated = { ...prev };
        for (const matchId in updated) {
          updated[matchId] = updated[matchId]?.map(g =>
            g.id === gameId ? { ...g, startedAt: new Date().toISOString(), isComplete: false } : g
          );
        }
        return updated;
      });
    } catch (error) {
      onError(`Failed to start game: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const endGame = async (gameId: string) => {
    try {
      let gameToCheck: any = null;
      let parentMatchId: string | null = null;
      for (const [matchId, matchGames] of Object.entries(games)) {
        const foundGame = matchGames?.find(game => game.id === gameId);
        if (foundGame) {
          gameToCheck = foundGame;
          parentMatchId = matchId;
          break;
        }
      }

      if (!gameToCheck || !parentMatchId) {
        throw new Error('Game not found');
      }

      const teamAScore = gameToCheck.teamAScore || 0;
      const teamBScore = gameToCheck.teamBScore || 0;

      if (teamAScore === teamBScore) {
        onError('Cannot end game with tied scores. One team must win.');
        return;
      }

      const response = await fetchWithActAs(`/api/admin/games/${gameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isComplete: true,
          endedAt: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to end game');
      }

      // Update local state
      setGames(prev => {
        const updated = { ...prev };
        for (const matchId in updated) {
          updated[matchId] = updated[matchId]?.map(g =>
            g.id === gameId ? { ...g, isComplete: true, endedAt: new Date().toISOString() } : g
          );
        }
        return updated;
      });

      await loadGamesForMatch(parentMatchId, true);
    } catch (error) {
      onError(`Failed to end game: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const updateGameScore = async (gameId: string, teamAScore: number | null, teamBScore: number | null) => {
    if (debouncedScoreUpdate.current[gameId]) {
      clearTimeout(debouncedScoreUpdate.current[gameId]);
    }

    setGames(prev => {
      const newGames = { ...prev };
      Object.keys(newGames).forEach(matchId => {
        newGames[matchId] = newGames[matchId].map(game =>
          game.id === gameId ? { ...game, teamAScore, teamBScore } : game
        );
      });
      return newGames;
    });

    debouncedScoreUpdate.current[gameId] = setTimeout(async () => {
      try {
        const response = await fetchWithActAs(`/api/admin/games/${gameId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamAScore, teamBScore })
        });

        if (!response.ok) {
          throw new Error('Failed to update score');
        }
      } catch (error) {
        console.error('Error updating game score:', error);
      }
    }, 500);
  };

  const updateGameCourtNumber = async (gameId: string, courtNumber: string) => {
    if (debouncedCourtUpdate.current[gameId]) {
      clearTimeout(debouncedCourtUpdate.current[gameId]);
    }

    setGames(prev => {
      const newGames = { ...prev };
      Object.keys(newGames).forEach(matchId => {
        newGames[matchId] = newGames[matchId].map(game =>
          game.id === gameId ? { ...game, courtNumber } : game
        );
      });
      return newGames;
    });

    debouncedCourtUpdate.current[gameId] = setTimeout(async () => {
      try {
        const response = await fetchWithActAs(`/api/admin/games/${gameId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courtNumber })
        });

        if (!response.ok) {
          throw new Error('Failed to update court number');
        }
      } catch (error) {
        console.error('Error updating court number:', error);
      }
    }, 500);
  };

  const hasAnyMatchStarted = (round: any) => {
    if (!round || !round.matches) return false;
    return round.matches.some((match: any) => {
      const matchGames = games[match.id] ?? match.games ?? [];
      return matchGames.some((game: any) =>
        getGameStatus(game) === 'in_progress' || getGameStatus(game) === 'completed'
      );
    });
  };

  const getMatchesForRound = useCallback((round: any, isEditing: boolean) => {
    const matches = isEditing ? (roundMatchups[round.id] || round.matches) : round.matches;
    return matches;
  }, [roundMatchups]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const activeId = event.active.id as string;
    setActiveId(activeId);
    setIsDragging(true);
    setDragPreview(null);
  }, []);

  const handleDragOver = useCallback((event: any) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      setDragPreview(null);
      return;
    }

    const activeData = active.data.current;
    const overData = over.data.current;

    if (!activeData || !overData || activeData.bracketName !== overData.bracketName) {
      setDragPreview(null);
      return;
    }

    setDragPreview({
      sourceId: active.id,
      targetId: over.id,
      sourceTeam: activeData.team,
      targetTeam: overData.team
    });
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);
    setIsDragging(false);
    setDragPreview(null);

    if (!over || active.id === over.id) {
      return;
    }

    const activeData = active.data.current;
    const overData = over.data.current;

    if (!activeData || !overData) {
      return;
    }

    if (activeData.bracketName !== overData.bracketName) {
      return;
    }

    const sourceLocalMatchIndex = activeData.matchIndex;
    const targetLocalMatchIndex = overData.matchIndex;
    const sourceTeamPosition = activeData.teamPosition;
    const targetTeamPosition = overData.teamPosition;
    const roundId = activeData.roundId;
    const bracketName = activeData.bracketName;

    const currentMatches = [...(roundMatchups[roundId] || [])];
    const bracketMatches = currentMatches.filter(match =>
      (match.teamA?.bracketName || match.teamB?.bracketName) === bracketName
    );

    const sourceGlobalIndex = currentMatches.findIndex(match =>
      (match.teamA?.bracketName || match.teamB?.bracketName) === bracketName &&
      bracketMatches.indexOf(match) === sourceLocalMatchIndex
    );
    const targetGlobalIndex = currentMatches.findIndex(match =>
      (match.teamA?.bracketName || match.teamB?.bracketName) === bracketName &&
      bracketMatches.indexOf(match) === targetLocalMatchIndex
    );

    if (sourceGlobalIndex === -1 || targetGlobalIndex === -1) {
      return;
    }

    const sourceMatch = { ...currentMatches[sourceGlobalIndex] };
    const targetMatch = { ...currentMatches[targetGlobalIndex] };

    const sourceTeam = activeData.team;
    const targetTeam = overData.team;

    if (sourceTeamPosition === 'A' && targetTeamPosition === 'A') {
      sourceMatch.teamA = targetTeam;
      targetMatch.teamA = sourceTeam;
    } else if (sourceTeamPosition === 'B' && targetTeamPosition === 'B') {
      sourceMatch.teamB = targetTeam;
      targetMatch.teamB = sourceTeam;
    } else if (sourceTeamPosition === 'A' && targetTeamPosition === 'B') {
      sourceMatch.teamA = targetTeam;
      targetMatch.teamB = sourceTeam;
    } else if (sourceTeamPosition === 'B' && targetTeamPosition === 'A') {
      sourceMatch.teamB = targetTeam;
      targetMatch.teamA = sourceTeam;
    }

    const newMatches = [...currentMatches];
    newMatches[sourceGlobalIndex] = sourceMatch;
    newMatches[targetGlobalIndex] = targetMatch;

    setRoundMatchups(prev => ({
      ...prev,
      [roundId]: newMatches
    }));

    try {
      await autoSaveRoundMatchups(roundId);
    } catch (error) {
      // Handle error silently
    }

  }, [roundMatchups, autoSaveRoundMatchups]);

  const resolveMatchByPoints = async (match: any) => {
    if (!match) return;
    const derivedStatus = deriveMatchStatus(match);
    if (derivedStatus !== 'tied_requires_tiebreaker' && derivedStatus !== 'needs_decision') {
      onInfo('This match is not currently in a state where it can be decided by points.');
      return;
    }

    const teamAName = match.teamA?.name || 'Team A';
    const teamBName = match.teamB?.name || 'Team B';
    const confirmMessage = `Confirm using total points to decide ${teamAName} vs ${teamBName}?`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setResolvingMatch(match.id);
      const stopId = match.round?.stopId || selectedStopId;
      const response = await fetchWithActAs(`/api/admin/matches/${match.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decideByPoints: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to decide match by points');
      }

      await loadGamesForMatch(match.id, true);
      if (stopId) {
        await loadSchedule(stopId, true);
      }
      onInfo('Match decided by total points');
    } catch (error) {
      console.error('Resolve match by points error:', error);
      onError(error instanceof Error ? error.message : 'Failed to decide match by points');
    } finally {
      setResolvingMatch(null);
    }
  };

  const scheduleTiebreakerGame = async (match: any) => {
    if (!match) return;
    const derivedStatus = deriveMatchStatus(match);
    if (!['tied_requires_tiebreaker', 'tied_pending'].includes(derivedStatus)) {
      onInfo('This match does not currently require a tiebreaker.');
      return;
    }

    try {
      setResolvingMatch(match.id);
      const stopId = match.round?.stopId || selectedStopId;
      const response = await fetchWithActAs(`/api/admin/matches/${match.id}/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          games: [
            {
              slot: 'TIEBREAKER',
              teamAScore: null,
              teamBScore: null,
              teamALineup: null,
              teamBLineup: null,
              lineupConfirmed: false,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to schedule tiebreaker');
      }

      await loadGamesForMatch(match.id, true);
      if (stopId) {
        await loadSchedule(stopId, true);
      }
      onInfo('Tiebreaker game created');
    } catch (error) {
      console.error('Schedule tiebreaker error:', error);
      onError(error instanceof Error ? error.message : 'Failed to schedule tiebreaker');
    } finally {
      setResolvingMatch(null);
    }
  };

  // Since we now only show one tournament at a time, simplify the structure
  const tournament = tournaments[0];

  if (!tournament) {
    return (
      <div className="text-center py-8 text-muted">
        You are not assigned as an event manager for any tournaments.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Stop tabs navigation */}
      <div className="border-b border-border-subtle mb-6">
        <nav className="flex gap-1 -mb-px" aria-label="Tabs">
          {tournament.stops.map((stop) => (
            <button
              key={stop.stopId}
              onClick={() => {
                setSelectedStopId(stop.stopId);
                loadSchedule(stop.stopId);
              }}
              className={`tab-button ${
                selectedStopId === stop.stopId ? 'active' : ''
              }`}
            >
              {stop.stopName}
            </button>
          ))}
        </nav>
      </div>

      {/* Stop content */}
      {selectedStopId && (() => {
                const stop = tournament.stops.find(s => s.stopId === selectedStopId);
                if (!stop) return null;

                const stopSchedule = scheduleData[stop.stopId] ?? [];
                log(`=== Stop ${stop.stopName} schedule:`, stopSchedule);
                log(`=== Number of rounds:`, stopSchedule.length);
                if (stopSchedule.length > 0) {
                  log(`=== First round:`, stopSchedule[0]);
                  log(`=== First round matches:`, stopSchedule[0].matches);
                }
                const stopHasAnyGameStarted = stopSchedule.some((round: any) => hasAnyMatchStarted(round));
                const totalMatches = stopSchedule.reduce(
                  (acc: number, r: any) => acc + (r.matches?.length || 0),
                  0
                );
                // Count only games that were actually played (have scores)
                const totalGames = stopSchedule.reduce(
                  (acc: number, r: any) =>
                    acc + (r.matches?.reduce((matchAcc: number, m: any) => {
                      const matchGames = games[m.id] ?? m.games ?? [];
                      if (!Array.isArray(matchGames)) return matchAcc;
                      
                      // Count only games with actual scores (played games)
                      const playedGames = matchGames.filter((game: any) => 
                        game.teamAScore !== null && game.teamBScore !== null
                      );
                      return matchAcc + playedGames.length;
                    }, 0) || 0),
                  0
                );

                return (
                  <div>
                    <div className="flex items-center justify-between mb-6 p-4 bg-surface-2 rounded-lg border border-border-subtle">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-sm font-semibold text-primary">
                            <span className="text-muted font-normal">Location:</span> {stop.locationName || 'TBD'}
                          </h3>
                          <span className="text-xs text-muted">
                            {formatDateRange(stop.startAt ?? null, stop.endAt ?? null)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted">
                          <span className="chip chip-info text-[10px] px-2 py-0.5">{stopSchedule.length} Rounds</span>
                          <span>{totalMatches} Matches</span>
                          <span>{totalGames} Games</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-muted">Lineup Deadline</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="datetime-local"
                              value={lineupDeadlines[stop.stopId] || ''}
                              onChange={(e) => setLineupDeadlines(prev => ({ ...prev, [stop.stopId]: e.target.value }))}
                              className="input input-sm text-xs"
                              style={{ minWidth: '200px' }}
                            />
                            <button
                              className="btn btn-sm btn-secondary disabled:opacity-50"
                              onClick={() => saveLineupDeadline(stop.stopId)}
                              disabled={loading[stop.stopId] || !lineupDeadlines[stop.stopId]}
                            >
                              Save Deadline
                            </button>
                          </div>
                          {stop.lineupDeadline && (
                            <span className="text-xs text-muted">
                              Current: {formatDeadline(stop.lineupDeadline)}
                            </span>
                          )}
                        </div>
                        {!stopHasAnyGameStarted && (
                        <button
                          className="btn btn-primary disabled:opacity-50"
                          onClick={() => generateSchedule(stop.stopId, stop.stopName)}
                          disabled={loading[stop.stopId] || stopHasAnyGameStarted}
                        >
                          {loading[stop.stopId] ? 'Regenerating...' : 'Regenerate Matchups'}
                        </button>
                        )}
                      </div>
                    </div>

                    <div className="bg-surface-1">
                      {loading[stop.stopId] ? (
                        <div className="text-center py-4 text-muted">Loading schedule...</div>
                      ) : stopSchedule.length === 0 ? (
                        <div className="text-center py-4 text-muted">
                          No matchups generated yet. Click "Regenerate Matchups" to create them.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {stopSchedule.map((round: any, roundIdx: number) => {
                            const previousRoundAvailable = roundIdx > 0 && !!stopSchedule[roundIdx - 1];
                            const isEditing = editingRounds.has(round.id);
                            const matches = getMatchesForRound(round, isEditing);
                            const tiebreakerAlerts = gatherRoundTiebreakerAlerts(matches, deriveMatchStatus);
                            const roundHasStarted = hasAnyMatchStarted(round);
                            const roundHasCompletedAllMatches = matches.length > 0 && matches.every((match: any) => {
                              const matchStatus = deriveMatchStatus(match);
                              if (matchStatus === 'completed') return true;

                              const matchGames = games[match.id] ?? match.games ?? [];

                              if (matchGames.length === 0) {
                                return false;
                              }

                              let teamAWins = 0;
                              let teamBWins = 0;

                              for (const game of matchGames) {
                                if (!game) continue;

                                const status = getGameStatus(game);
                                if (status === 'in_progress') {
                                  return false;
                                }

                                const a = game.teamAScore;
                                const b = game.teamBScore;

                                if (a != null && b != null) {
                                  if (a > b) teamAWins += 1;
                                  else if (b > a) teamBWins += 1;
                                }
                              }

                              return (teamAWins >= 3 || teamBWins >= 3) && teamAWins !== teamBWins;
                            });

                            const _ = updateKey;

                            return (
                              <div key={`${round.id}-${renderKey}-${updateKey}`} className="border-2 border-border-medium rounded-lg overflow-hidden bg-surface-1">
                                <div
                                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-2 transition-colors bg-surface-2"
                                  onClick={() => toggleRound(round.id)}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`transform transition-transform text-secondary ${expandedRounds.has(round.id) ? 'rotate-90' : ''}`}>
                                      ▶
                                    </div>
                                    <div>
                                      <h4 className="font-semibold text-base text-primary">Round {round.idx + 1}</h4>
                                      <p className="text-xs text-muted mt-0.5">{matches.length} matches</p>
                                    </div>
                                    {roundHasCompletedAllMatches && (
                                      <span className="chip chip-success text-[10px] px-2 py-0.5">Complete</span>
                                    )}
                                    {roundHasStarted && !roundHasCompletedAllMatches && (
                                      <span className="chip chip-warning text-[10px] px-2 py-0.5">In Progress</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {previousRoundAvailable && !roundHasStarted && (
                                      <button
                                        className="btn btn-ghost text-xs"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          copyLineupsFromPreviousRound(stop.stopId, roundIdx);
                                        }}
                                      >
                                        Copy Previous Lineups
                                      </button>
                                    )}
                                    {isEditing ? (
                                      <button
                                        className="btn btn-secondary text-xs"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          saveRoundMatchups(round.id);
                                        }}
                                      >
                                        Confirm Matchups
                                      </button>
                                    ) : !roundHasStarted ? (
                                      <button
                                        className="btn btn-ghost text-xs"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleRoundEdit(round.id);
                                        }}
                                      >
                                        Edit Matchups
                                      </button>
                                    ) : null}
                                  </div>
                                </div>

                                {expandedRounds.has(round.id) && (
                                  <div className="p-6 border-t border-border-subtle bg-app">
                                    {isEditing && (
                                      <div className="mb-4 p-3 bg-info/10 border-l-4 border-info rounded text-sm text-info">
                                        <strong className="font-semibold">Drag teams to swap:</strong> Drag any team over another team to swap their positions.
                                      </div>
                                    )}

                                    {tiebreakerAlerts.length > 0 && (
                                      <div className="mb-4 space-y-2">
                                        {tiebreakerAlerts.map((alert, idx) => {
                                          const toneToStyles: Record<string, string> = {
                                            warning: 'bg-warning/10 border-warning/40 text-warning-dark',
                                            info: 'bg-info/10 border-info/40 text-info-dark',
                                            success: 'bg-success/10 border-success/40 text-success-dark',
                                          };
                                          return (
                                            <div
                                              key={`round-${round.id}-alert-${idx}`}
                                              className={`rounded-lg border px-3 py-2 text-sm ${toneToStyles[alert.tone] || 'bg-surface-2 border-border-subtle text-secondary'}`}
                                            >
                                              {alert.message}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}

                                    {(() => {
                                      const matchesByBracket: Record<string, any[]> = {};

                                      matches.forEach((match: any, matchIdx: number) => {
                                        const bracketName = match.bracketName || 'Unknown Bracket';

                                        if (!matchesByBracket[bracketName]) {
                                          matchesByBracket[bracketName] = [];
                                        }

                                        matchesByBracket[bracketName].push({ ...match, originalIndex: matchIdx });
                                      });

                                      Object.keys(matchesByBracket).forEach(bracketName => {
                                        matchesByBracket[bracketName].forEach((match: any, localIdx: number) => {
                                          match.localIndex = localIdx;
                                        });
                                      });

                                      return Object.entries(matchesByBracket).map(([bracketName, bracketMatches]) => (
                                        <div key={bracketName} className="space-y-4 mb-6 last:mb-0">
                                          {isEditing ? (
                                              <DndContext
                                                collisionDetection={closestCenter}
                                                onDragStart={handleDragStart}
                                                onDragOver={handleDragOver}
                                                onDragEnd={handleDragEnd}
                                              >
                                                <SortableContext
                                                  items={bracketMatches.map((match: any) => [
                                                    `${round.id}-${bracketName}-${match.localIndex}-A`,
                                                    `${round.id}-${bracketName}-${match.localIndex}-B`
                                                  ]).flat()}
                                                  strategy={noReorderStrategy}
                                                >
                                                  <div className="space-y-3">
                                                    {bracketMatches.map((match: any, localMatchIdx: number) => {
                                                      const localIndex = match.localIndex;
                                                      return (
                                                        <div key={`${match.id}-${localIndex}`} className="rounded-lg border border-dashed border-subtle bg-surface-2 p-3 shadow-sm">
                                                          <div className="mb-3 flex items-center justify-between text-xs text-muted">
                                                            <span>Match {match.originalIndex + 1}</span>
                                                            {match.isBye && (
                                                              <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
                                                                Bye
                                                              </span>
                                                            )}
                                                          </div>

                                                          {!match.isBye ? (
                                                            <div className="grid gap-3 md:grid-cols-2">
                                                              <DraggableTeam
                                                                team={match.teamA}
                                                                teamPosition="A"
                                                                roundId={round.id}
                                                                matchIndex={localIndex}
                                                                bracketName={bracketName}
                                                                isDragging={
                                                                  activeId === `${round.id}-${bracketName}-${localIndex}-A` ||
                                                                  (dragPreview && (
                                                                    dragPreview.sourceId === `${round.id}-${bracketName}-${localIndex}-A` ||
                                                                    dragPreview.targetId === `${round.id}-${bracketName}-${localIndex}-A`
                                                                  )) || false
                                                                }
                                                                dragPreview={dragPreview}
                                                              />

                                                              <DraggableTeam
                                                                team={match.teamB}
                                                                teamPosition="B"
                                                                roundId={round.id}
                                                                matchIndex={localIndex}
                                                                bracketName={bracketName}
                                                                isDragging={
                                                                  activeId === `${round.id}-${bracketName}-${localIndex}-B` ||
                                                                  (dragPreview && (
                                                                    dragPreview.sourceId === `${round.id}-${bracketName}-${localIndex}-B` ||
                                                                    dragPreview.targetId === `${round.id}-${bracketName}-${localIndex}-B`
                                                                  )) || false
                                                                }
                                                                dragPreview={dragPreview}
                                                              />
                                                            </div>
                                                          ) : (
                                                            <div className="flex items-center gap-3 text-sm">
                                                              <span className="font-medium">
                                                                {match.teamA?.name || 'TBD'} vs {match.teamB?.name || 'TBD'}
                                                              </span>
                                                            </div>
                                                          )}
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                </SortableContext>
                                              </DndContext>
                                            ) : (
                                              <div className="space-y-5">
                                                {bracketMatches.map((match: any) => {
                                                  const matchId = match.id;
                                                      const matchStatus = deriveMatchStatus(match);
                                                      const matchGames = games[matchId] ?? match.games ?? [];
                                                      const canEditLineups = !['completed', 'decided_points', 'decided_tiebreaker'].includes(matchStatus);
                                                  const teamALineup = match.teamA?.id ? (lineups[matchId]?.[match.teamA.id] ?? []) : [];
                                                  const teamBLineup = match.teamB?.id ? (lineups[matchId]?.[match.teamB.id] ?? []) : [];
                                                  const hasAnyGameStarted = matchGames.some((game: any) =>
                                                    getGameStatus(game) === 'in_progress' || getGameStatus(game) === 'completed'
                                                  );
                                                  const isEditingThisMatch = editingMatch === match.id;

                                                  return (
                                                    <div key={matchId} className="card">
                                                      {/* Match Header */}
                                                      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-border-subtle">
                                                        <div>
                                                          <h3 className="text-base font-semibold text-primary">
                                                            {(() => {
                                                              const bracketLabel = match.bracketName || match.teamA?.bracketName || match.teamB?.bracketName;
                                                              const teamAName = match.teamA?.name || 'Team A';
                                                              const teamBName = match.teamB?.name || 'Team B';

                                                              // Remove bracket name from team names if it exists
                                                              const cleanTeamAName = bracketLabel && teamAName.endsWith(` ${bracketLabel}`)
                                                                ? teamAName.replace(` ${bracketLabel}`, '')
                                                                : teamAName;
                                                              const cleanTeamBName = bracketLabel && teamBName.endsWith(` ${bracketLabel}`)
                                                                ? teamBName.replace(` ${bracketLabel}`, '')
                                                                : teamBName;

                                                              const matchupText = `${cleanTeamAName} vs ${cleanTeamBName}`;
                                                              return bracketLabel ? `${matchupText} - ${bracketLabel}` : matchupText;
                                                            })()}
                                                          </h3>
                                                        </div>

                                                        {/* Match Status Badge */}
                                                        {matchStatus === 'decided_points' && (
                                                          <div className="text-xs font-semibold px-2 py-1 bg-success/20 text-success rounded">
                                                            ✓ Decided by Total Points
                                                          </div>
                                                        )}
                                                        {matchStatus === 'decided_tiebreaker' && (
                                                          <div className="text-xs font-semibold px-2 py-1 bg-success/20 text-success rounded">
                                                            ✓ Decided by Tiebreaker
                                                          </div>
                                                        )}

                                                        {/* Manager Actions */}
                                                        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 w-full sm:w-auto">
                                                          {(matchStatus === 'needs_decision' || (matchStatus === 'tied_pending' && totalPointsDisagree(match.totalPointsTeamA, match.totalPointsTeamB))) && (
                                                            <button
                                                              className="btn btn-xs btn-secondary flex-1 sm:flex-none"
                                                              disabled={resolvingMatch === match.id || !canEditLineups}
                                                              onClick={() => resolveMatchByPoints(match)}
                                                            >
                                                              {resolvingMatch === match.id ? 'Resolving...' : 'Decide by Points'}
                                                            </button>
                                                          )}
                                                          {(matchStatus === 'tied_requires_tiebreaker' || matchStatus === 'needs_decision' || (matchStatus === 'tied_pending' && totalPointsDisagree(match.totalPointsTeamA, match.totalPointsTeamB))) && (
                                                            <button
                                                              className="btn btn-xs btn-primary flex-1 sm:flex-none"
                                                              disabled={resolvingMatch === match.id}
                                                              onClick={() => scheduleTiebreakerGame(match)}
                                                            >
                                                              {resolvingMatch === match.id ? 'Creating...' : 'Add Tiebreaker'}
                                                            </button>
                                                          )}
                                                        </div>
                                                      </div>

                                                      {/* Total Points Summary */}
                                                      {match.totalPointsTeamA !== null && match.totalPointsTeamB !== null && (
                                                        <div className="bg-surface-2 rounded px-3 py-2 text-sm mb-3">
                                                          <div className="flex justify-between items-center gap-4">
                                                            <div className="flex-1">
                                                              <div className="text-muted text-xs mb-1">Total Points:</div>
                                                              <div className="font-semibold">{match.teamA?.name || 'Team A'}: <span className="text-success">{match.totalPointsTeamA}</span></div>
                                                            </div>
                                                            <div className="flex-1 text-right">
                                                              <div className="text-muted text-xs mb-1">Total Points:</div>
                                                              <div className="font-semibold">{match.teamB?.name || 'Team B'}: <span className="text-success">{match.totalPointsTeamB}</span></div>
                                                            </div>
                                                          </div>
                                                        </div>
                                                      )}

                                                      <div className="mt-3 space-y-3">
                                                        {isEditingThisMatch ? (
                                                          match.teamA?.id && match.teamB?.id ? (
                                                            <InlineLineupEditor
                                                              matchId={match.id}
                                                              stopId={round.stopId}
                                                              teamA={match.teamA}
                                                              teamB={match.teamB}
                                                              lineups={lineups}
                                                              prefetchedTeamRosters={{
                                                                teamA: teamRosters[match.teamA.id] || [],
                                                                teamB: teamRosters[match.teamB.id] || [],
                                                              }}
                                                              teamRosters={teamRosters}
                                                              onSave={async (lineupData) => {
                                                                try {
                                                                  if (lineupData.teamA.length !== 4 || lineupData.teamB.length !== 4) {
                                                                    throw new Error(`Invalid lineup: Team A has ${lineupData.teamA.length} players, Team B has ${lineupData.teamB.length} players. Need exactly 4 each.`);
                                                                  }

                                                                  const response = await fetchWithActAs(`/api/admin/stops/${stop.stopId}/lineups`, {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({
                                                                      lineups: {
                                                                        [match.id]: {
                                                                          [match.teamA.id]: lineupData.teamA,
                                                                          [match.teamB.id]: lineupData.teamB,
                                                                        },
                                                                      },
                                                                    }),
                                                                  });

                                                                  if (!response.ok) {
                                                                    const errorText = await response.text();
                                                                    throw new Error(`Save failed: ${response.status} ${errorText}`);
                                                                  }

                                                                  // Reload schedule to pick up saved lineups
                                                                  await loadSchedule(stop.stopId, true);

                                                                  // Update local state after reload completes
                                                                  setLineups(prev => ({
                                                                    ...prev,
                                                                    [match.id]: {
                                                                      [match.teamA.id]: lineupData.teamA,
                                                                      [match.teamB.id]: lineupData.teamB,
                                                                    },
                                                                  }));

                                                                  setEditingMatch(null);
                                                                  onInfo('Lineups saved successfully!');
                                                                } catch (error) {
                                                                  console.error('Error saving lineups:', error);
                                                                  onError(`Failed to save lineups: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                                                }
                                                              }}
                                                              onCancel={() => setEditingMatch(null)}
                                                            />
                                                          ) : (
                                                            <div className="text-sm text-warning">
                                                              Unable to edit lineups because this match is missing team assignments.
                                                            </div>
                                                          )
                                                        ) : (
                                                          !hasAnyGameStarted && (
                                                            <div className="space-y-4">
                                                              <div className="grid md:grid-cols-2 gap-4">
                                                                {/* Team A Lineup */}
                                                                <div className="rounded-lg border-2 border-border-medium bg-surface-2 p-4">
                                                                  <div className="flex items-center justify-between mb-3">
                                                                    <h4 className="text-sm font-semibold text-primary">
                                                                      {match.teamA?.name || 'Team A'}
                                                                    </h4>
                                                                    {teamALineup.length === 4 && (
                                                                      <span className="chip chip-success text-[10px] px-2 py-0.5">Ready</span>
                                                                    )}
                                                                  </div>
                                                                  <div className="space-y-2">
                                                                    {teamALineup.length > 0 ? (
                                                                      teamALineup.map((player: any, idx: number) => (
                                                                        <div key={`teamA-${idx}-${player.id}`} className="flex items-center gap-2 text-sm bg-surface-1 px-3 py-2 rounded">
                                                                          <span className="text-muted font-semibold w-5">{idx + 1}.</span>
                                                                          <span className="text-secondary flex-1">{player.name}</span>
                                                                          <span className={`chip text-[10px] px-2 py-0.5 ${
                                                                            player.gender === 'MALE' ? 'chip-info' : 'chip-accent'
                                                                          }`}>
                                                                            {player.gender === 'MALE' ? 'M' : 'F'}
                                                                          </span>
                                                                        </div>
                                                                      ))
                                                                    ) : (
                                                                      <div className="text-muted text-sm italic text-center py-4">No lineup set</div>
                                                                    )}
                                                                  </div>
                                                                </div>

                                                                {/* Team B Lineup */}
                                                                <div className="rounded-lg border-2 border-border-medium bg-surface-2 p-4">
                                                                  <div className="flex items-center justify-between mb-3">
                                                                    <h4 className="text-sm font-semibold text-primary">
                                                                      {match.teamB?.name || 'Team B'}
                                                                    </h4>
                                                                    {teamBLineup.length === 4 && (
                                                                      <span className="chip chip-success text-[10px] px-2 py-0.5">Ready</span>
                                                                    )}
                                                                  </div>
                                                                  <div className="space-y-2">
                                                                    {teamBLineup.length > 0 ? (
                                                                      teamBLineup.map((player: any, idx: number) => (
                                                                        <div key={`teamB-${idx}-${player.id}`} className="flex items-center gap-2 text-sm bg-surface-1 px-3 py-2 rounded">
                                                                          <span className="text-muted font-semibold w-5">{idx + 1}.</span>
                                                                          <span className="text-secondary flex-1">{player.name}</span>
                                                                          <span className={`chip text-[10px] px-2 py-0.5 ${
                                                                            player.gender === 'MALE' ? 'chip-info' : 'chip-accent'
                                                                          }`}>
                                                                            {player.gender === 'MALE' ? 'M' : 'F'}
                                                                          </span>
                                                                        </div>
                                                                      ))
                                                                    ) : (
                                                                      <div className="text-muted text-sm italic text-center py-4">No lineup set</div>
                                                                    )}
                                                                  </div>
                                                                </div>
                                                              </div>

                                                              {canEditLineups && (
                                                                <div className="flex justify-center">
                                                                  <button
                                                                    className="btn btn-secondary"
                                                                    onClick={() => setEditingMatch(matchId)}
                                                                  >
                                                                    {teamALineup.length > 0 || teamBLineup.length > 0 ? 'Edit Lineups' : 'Set Lineups'}
                                                                  </button>
                                                                </div>
                                                              )}
                                                            </div>
                                                          )
                                                        )}

                                                        {/* Games Display - show when lineups exist in lineups state OR in game data */}
                                                        {((lineups[match.id] &&
                                                          lineups[match.id][match.teamA?.id || 'teamA']?.length === 4 &&
                                                          lineups[match.id][match.teamB?.id || 'teamB']?.length === 4) ||
                                                          (games[match.id]?.some((g: any) => g.teamALineup && g.teamBLineup))) && (
                                                            <div className="space-y-5">
                                                              <div className="border-t border-border-subtle pt-4">
                                                                <h4 className="text-sm font-semibold text-primary mb-3 label-caps">Games</h4>
                                                                <div className="grid gap-4 lg:grid-cols-2">
                                                                  {games[match.id]
                                                                    ?.filter((game) => game.slot === 'MENS_DOUBLES' || game.slot === 'WOMENS_DOUBLES')
                                                                    .map((game) => (
                                                                      <GameScoreBox
                                                                        key={game.id}
                                                                        game={game}
                                                                        match={match}
                                                                        lineups={lineups}
                                                                        startGame={startGame}
                                                                        endGame={endGame}
                                                                        updateGameScore={updateGameScore}
                                                                        updateGameCourtNumber={updateGameCourtNumber}
                                                                      />
                                                                    ))}
                                                                </div>
                                                              </div>

                                                              <div className="grid gap-4 lg:grid-cols-2">
                                                                {games[match.id]
                                                                  ?.filter((game) => game.slot === 'MIXED_1' || game.slot === 'MIXED_2')
                                                                  .map((game) => (
                                                                    <GameScoreBox
                                                                      key={game.id}
                                                                      game={game}
                                                                      match={match}
                                                                      lineups={lineups}
                                                                      startGame={startGame}
                                                                      endGame={endGame}
                                                                      updateGameScore={updateGameScore}
                                                                      updateGameCourtNumber={updateGameCourtNumber}
                                                                    />
                                                                  ))}
                                                              </div>

                                                              {(() => {
                                                                const resolvedTiebreakerStatus = normalizeTiebreakerStatus(match.tiebreakerStatus);
                                                                
                                                                // Only show tiebreaker-related UI if the database indicates a tiebreaker is needed
                                                                const showTiebreakerPrompt = 
                                                                  resolvedTiebreakerStatus === 'tied_requires_tiebreaker' &&
                                                                  !games[match.id]?.some((g) => g.slot === 'TIEBREAKER');

                                                                if (showTiebreakerPrompt) {
                                                                  return (
                                                                    <div className="border border-warning/40 bg-warning/10 text-warning px-4 py-3 rounded">
                                                                      This matchup is tied 2-2. Add a Tiebreaker game below to determine the winner.
                                                                    </div>
                                                                  );
                                                                }

                                                                const tiebreakerGame = games[match.id]?.find((g) => g.slot === 'TIEBREAKER');
                                                                if (tiebreakerGame && (resolvedTiebreakerStatus === 'tied_requires_tiebreaker' || resolvedTiebreakerStatus === 'tied_pending')) {
                                                                  return (
                                                                    <GameScoreBox
                                                                      key={tiebreakerGame.id}
                                                                      game={tiebreakerGame}
                                                                      match={match}
                                                                      lineups={lineups}
                                                                      startGame={startGame}
                                                                      endGame={endGame}
                                                                      updateGameScore={updateGameScore}
                                                                      updateGameCourtNumber={updateGameCourtNumber}
                                                                    />
                                                                  );
                                                                }

                                                                return null;
                                                              })()}
                                                            </div>
                                                          )}
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        ));
                                      })()}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                    </div>
                  </div>
                );
              })()}
    </div>
  );
}
