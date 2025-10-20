'use client';

/**
 * Team Selector Component
 *
 * Dropdown selector for adding teams to the bracket.
 */

import { useState } from 'react';

interface Team {
  id: string;
  name: string;
  clubId?: string;
}

interface TeamSelectorProps {
  availableTeams: Team[];
  onSelectTeam: (teamId: string) => void;
  disabled?: boolean;
}

export function TeamSelector({ availableTeams, onSelectTeam, disabled }: TeamSelectorProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');

  const handleAddClick = () => {
    if (selectedTeamId) {
      onSelectTeam(selectedTeamId);
      setSelectedTeamId('');
    }
  };

  return (
    <div className="flex gap-2">
      <select
        value={selectedTeamId}
        onChange={(e) => setSelectedTeamId(e.target.value)}
        disabled={disabled || availableTeams.length === 0}
        className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">
          {availableTeams.length === 0 ? 'No teams available' : 'Select a team...'}
        </option>
        {availableTeams.map(team => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>

      <button
        onClick={handleAddClick}
        disabled={disabled || !selectedTeamId}
        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
      >
        Add Team
      </button>
    </div>
  );
}
