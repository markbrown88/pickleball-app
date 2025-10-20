'use client';

/**
 * Sortable Team Slot Component
 *
 * Draggable team item in the seeding list.
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BracketTeam } from './index';

interface SortableTeamSlotProps {
  team: BracketTeam;
  onRemove: (teamId: string) => void;
  disabled?: boolean;
}

export function SortableTeamSlot({ team, onRemove, disabled }: SortableTeamSlotProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: team.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-gray-700 rounded-lg border border-gray-600 ${
        isDragging ? 'shadow-lg' : ''
      } ${disabled ? 'cursor-not-allowed' : 'cursor-move'}`}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="flex items-center justify-center text-gray-400 hover:text-gray-300"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 8h16M4 16h16"
          />
        </svg>
      </div>

      {/* Seed Number */}
      <div className="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-full text-white font-bold text-sm">
        {team.seed}
      </div>

      {/* Team Name */}
      <div className="flex-1 text-white font-medium">
        {team.name}
      </div>

      {/* Remove Button */}
      <button
        onClick={() => onRemove(team.id)}
        disabled={disabled}
        className="text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Remove team"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
