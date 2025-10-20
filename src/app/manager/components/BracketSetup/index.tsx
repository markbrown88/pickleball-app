'use client';

/**
 * Bracket Setup Component
 *
 * Allows tournament admins to:
 * 1. Add/remove teams for bracket tournament
 * 2. Set team seeding order via drag & drop
 * 3. Configure games per match and game slots
 * 4. Generate the bracket structure
 */

import { useState, useCallback } from 'react';
import { DndContext, DragEndEvent, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { SortableTeamSlot } from './SortableTeamSlot';
import { TeamSelector } from './TeamSelector';

export interface BracketTeam {
  id: string;
  name: string;
  clubId?: string;
  seed: number;
}

interface BracketSetupProps {
  tournamentId: string;
  stopId?: string;
  availableTeams: Array<{ id: string; name: string; clubId?: string }>;
  onGenerate?: () => void;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
}

export function BracketSetup({
  tournamentId,
  stopId,
  availableTeams,
  onGenerate,
  onError,
  onSuccess,
}: BracketSetupProps) {
  const [selectedTeams, setSelectedTeams] = useState<BracketTeam[]>([]);
  const [gamesPerMatch, setGamesPerMatch] = useState(3);
  const [selectedGameSlots, setSelectedGameSlots] = useState<string[]>([
    'MENS_DOUBLES',
    'WOMENS_DOUBLES',
    'MIXED_1',
    'MIXED_2',
  ]);
  const [isGenerating, setIsGenerating] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleAddTeam = useCallback((teamId: string) => {
    const team = availableTeams.find(t => t.id === teamId);
    if (!team) return;

    if (selectedTeams.some(t => t.id === teamId)) {
      onError?.('Team already added');
      return;
    }

    const newTeam: BracketTeam = {
      ...team,
      seed: selectedTeams.length + 1,
    };

    setSelectedTeams(prev => [...prev, newTeam]);
  }, [availableTeams, selectedTeams, onError]);

  const handleRemoveTeam = useCallback((teamId: string) => {
    setSelectedTeams(prev => {
      const filtered = prev.filter(t => t.id !== teamId);
      // Re-seed remaining teams
      return filtered.map((team, idx) => ({ ...team, seed: idx + 1 }));
    });
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSelectedTeams(teams => {
        const oldIndex = teams.findIndex(t => t.id === active.id);
        const newIndex = teams.findIndex(t => t.id === over.id);

        const reordered = arrayMove(teams, oldIndex, newIndex);
        // Update seeds based on new order
        return reordered.map((team, idx) => ({ ...team, seed: idx + 1 }));
      });
    }
  }, []);

  const handleToggleGameSlot = useCallback((slot: string) => {
    setSelectedGameSlots(prev => {
      if (prev.includes(slot)) {
        return prev.filter(s => s !== slot);
      } else {
        return [...prev, slot];
      }
    });
  }, []);

  const handleGenerateBracket = useCallback(async () => {
    // Validation
    if (selectedTeams.length < 2) {
      onError?.('At least 2 teams are required to generate a bracket');
      return;
    }

    if (selectedGameSlots.length === 0) {
      onError?.('At least one game slot must be selected');
      return;
    }

    if (gamesPerMatch < 1 || gamesPerMatch > selectedGameSlots.length) {
      onError?.(`Games per match must be between 1 and ${selectedGameSlots.length}`);
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/generate-bracket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stopId,
          gamesPerMatch,
          gameSlots: selectedGameSlots,
          teams: selectedTeams, // Send seeded teams
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate bracket');
      }

      onSuccess?.(`Bracket generated successfully! Created ${data.roundsCreated} rounds with ${data.totalMatches} matches.`);
      onGenerate?.();
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to generate bracket');
    } finally {
      setIsGenerating(false);
    }
  }, [tournamentId, stopId, selectedTeams, gamesPerMatch, selectedGameSlots, onError, onSuccess, onGenerate]);

  const availableTeamsForSelection = availableTeams.filter(
    team => !selectedTeams.some(st => st.id === team.id)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Bracket Setup</h2>
        <p className="text-gray-400 mt-1">
          Add teams and set their seeding order for the bracket tournament
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Team Selection */}
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-3">Add Teams</h3>
            <TeamSelector
              availableTeams={availableTeamsForSelection}
              onSelectTeam={handleAddTeam}
              disabled={isGenerating}
            />
          </div>

          {/* Tournament Settings */}
          <div className="bg-gray-800 rounded-lg p-4 space-y-4">
            <h3 className="text-lg font-semibold text-white mb-3">Tournament Settings</h3>

            {/* Games Per Match */}
            <div>
              <label htmlFor="gamesPerMatch" className="block text-sm font-medium text-gray-300 mb-2">
                Games Per Match
              </label>
              <input
                id="gamesPerMatch"
                type="number"
                min="1"
                max={selectedGameSlots.length}
                value={gamesPerMatch}
                onChange={(e) => setGamesPerMatch(parseInt(e.target.value, 10))}
                disabled={isGenerating}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Game Slots */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Game Slots
              </label>
              <div className="space-y-2">
                {[
                  { value: 'MENS_DOUBLES', label: "Men's Doubles" },
                  { value: 'WOMENS_DOUBLES', label: "Women's Doubles" },
                  { value: 'MIXED_1', label: 'Mixed 1' },
                  { value: 'MIXED_2', label: 'Mixed 2' },
                ].map(slot => (
                  <label key={slot.value} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedGameSlots.includes(slot.value)}
                      onChange={() => handleToggleGameSlot(slot.value)}
                      disabled={isGenerating}
                      className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-300">{slot.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Seeding Order */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-white">
              Seeding Order ({selectedTeams.length} teams)
            </h3>
            {selectedTeams.length > 0 && (
              <button
                onClick={() => setSelectedTeams([])}
                disabled={isGenerating}
                className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
              >
                Clear All
              </button>
            )}
          </div>

          {selectedTeams.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No teams added yet</p>
              <p className="text-sm mt-1">Add teams from the left panel</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={selectedTeams.map(t => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {selectedTeams.map(team => (
                    <SortableTeamSlot
                      key={team.id}
                      team={team}
                      onRemove={handleRemoveTeam}
                      disabled={isGenerating}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {/* Generate Button */}
      <div className="flex justify-end">
        <button
          onClick={handleGenerateBracket}
          disabled={isGenerating || selectedTeams.length < 2}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
        >
          {isGenerating ? 'Generating Bracket...' : 'Generate Bracket'}
        </button>
      </div>

      {/* Info Box */}
      {selectedTeams.length > 0 && (
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-blue-300 mb-2">Bracket Info</h4>
          <div className="text-sm text-gray-300 space-y-1">
            <p>Teams: {selectedTeams.length}</p>
            <p>
              Bracket Size: {Math.pow(2, Math.ceil(Math.log2(selectedTeams.length)))} (
              {Math.pow(2, Math.ceil(Math.log2(selectedTeams.length))) - selectedTeams.length} byes)
            </p>
            <p>Rounds: {Math.ceil(Math.log2(selectedTeams.length))}</p>
            <p>Games per match: {gamesPerMatch}</p>
          </div>
        </div>
      )}
    </div>
  );
}
