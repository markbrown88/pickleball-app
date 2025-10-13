'use client';

import { useState, useCallback, memo } from 'react';
import { DndContext, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { useSortable, SortableContext } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * MatchupDragDrop Component
 *
 * Separated drag and drop matchup functionality from EventManagerTab.
 * Allows teams to be swapped between different matchups by dragging.
 *
 * Bug Fix: When dragging within the same matchup (Team A over Team B),
 * we now properly swap the teams instead of duplicating one team.
 */

// Custom strategy that disables automatic reordering
const noReorderStrategy = () => null;

type Team = {
  id: string;
  name: string;
  bracketName?: string | null;
  [key: string]: any;
};

type Match = {
  id: string;
  teamA?: Team | null;
  teamB?: Team | null;
  [key: string]: any;
};

type DragPreview = {
  sourceId: string;
  targetId: string;
  sourceTeam: Team;
  targetTeam: Team;
} | null;

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
  team: Team;
  teamPosition: 'A' | 'B';
  roundId: string;
  matchIndex: number;
  bracketName: string;
  isDragging?: boolean;
  dragPreview?: DragPreview;
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
      className={`
        cursor-move px-3 py-2 bg-white/50 dark:bg-gray-800/50 rounded
        border border-gray-200 dark:border-gray-700 hover:border-primary/50
        transition-all select-none
        ${isBeingDragged ? 'ring-2 ring-primary/50 shadow-lg' : ''}
        ${isPreviewTarget ? 'ring-2 ring-success/50 bg-success/10' : ''}
      `}
    >
      <div className="text-sm font-medium truncate">
        {team?.name || 'TBD'}
      </div>
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

interface MatchupDragDropProps {
  roundId: string;
  bracketName: string;
  matches: Match[];
  onMatchesUpdate: (matches: Match[]) => void;
  onSave?: () => Promise<void>;
}

export function MatchupDragDrop({
  roundId,
  bracketName,
  matches,
  onMatchesUpdate,
  onSave
}: MatchupDragDropProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPreview, setDragPreview] = useState<DragPreview>(null);

  // Generate sortable IDs for all team positions
  const sortableIds = matches.flatMap((match, idx) => [
    `${roundId}-${bracketName}-${idx}-A`,
    `${roundId}-${bracketName}-${idx}-B`
  ]);

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
    const sourceTeamPosition = activeData.teamPosition as 'A' | 'B';
    const targetTeamPosition = overData.teamPosition as 'A' | 'B';

    // Create a deep copy of matches to avoid mutation
    const newMatches = matches.map(match => ({ ...match }));

    // Check if we're swapping within the same match
    if (sourceLocalMatchIndex === targetLocalMatchIndex) {
      // BUG FIX: When dragging within the same match (e.g., Team A over Team B),
      // we need to swap the teams properly without overwriting both positions
      const match = newMatches[sourceLocalMatchIndex];
      const tempTeamA = match.teamA;
      const tempTeamB = match.teamB;

      // Swap the teams
      match.teamA = tempTeamB;
      match.teamB = tempTeamA;
    } else {
      // Swapping teams between different matches
      const sourceMatch = newMatches[sourceLocalMatchIndex];
      const targetMatch = newMatches[targetLocalMatchIndex];

      const sourceTeam = activeData.team;
      const targetTeam = overData.team;

      // Perform the swap based on team positions
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
    }

    // Update parent component with new matches
    onMatchesUpdate(newMatches);

    // Auto-save if callback provided
    if (onSave) {
      try {
        await onSave();
      } catch (error) {
        console.error('Error auto-saving matchups:', error);
      }
    }
  }, [matches, onMatchesUpdate, onSave]);

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={sortableIds} strategy={noReorderStrategy}>
        <div className="space-y-4">
          <div className="text-sm text-muted bg-info/10 border border-info/20 rounded-lg p-3">
            <strong className="font-semibold">Drag teams to swap:</strong> Drag any team over another team to swap their positions.
          </div>

          {matches.map((match, localIndex) => (
            <div
              key={match.id}
              className="card p-4 bg-white/70 dark:bg-gray-900/70"
            >
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-xs text-muted mb-1">Team A</div>
                  <DraggableTeam
                    team={match.teamA || { id: 'tbd-a', name: 'TBD' }}
                    teamPosition="A"
                    roundId={roundId}
                    matchIndex={localIndex}
                    bracketName={bracketName}
                    isDragging={
                      isDragging &&
                      (dragPreview && (
                        dragPreview.sourceId === `${roundId}-${bracketName}-${localIndex}-A` ||
                        dragPreview.targetId === `${roundId}-${bracketName}-${localIndex}-A`
                      ) || false)
                    }
                    dragPreview={dragPreview}
                  />
                </div>
                <div className="text-muted font-bold">vs</div>
                <div className="flex-1">
                  <div className="text-xs text-muted mb-1">Team B</div>
                  <DraggableTeam
                    team={match.teamB || { id: 'tbd-b', name: 'TBD' }}
                    teamPosition="B"
                    roundId={roundId}
                    matchIndex={localIndex}
                    bracketName={bracketName}
                    isDragging={
                      isDragging &&
                      (dragPreview && (
                        dragPreview.sourceId === `${roundId}-${bracketName}-${localIndex}-B` ||
                        dragPreview.targetId === `${roundId}-${bracketName}-${localIndex}-B`
                      ) || false)
                    }
                    dragPreview={dragPreview}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
