'use client';

import { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface DraggableTeamProps {
  team: any;
  teamPosition: 'A' | 'B';
  roundId: string;
  matchIndex: number;
  bracketName: string;
  isDragging?: boolean;
  dragPreview?: any;
}

export const DraggableTeam = memo(function DraggableTeam({
  team,
  teamPosition,
  roundId,
  matchIndex,
  bracketName,
  isDragging = false,
  dragPreview = null
}: DraggableTeamProps) {
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
