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

import { useState, useCallback, useEffect } from 'react';
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
  tournamentType: string; // Tournament type (DOUBLE_ELIMINATION or DOUBLE_ELIMINATION_CLUBS)
  stopId?: string;
  availableTeams: Array<{ id: string; name: string; clubId?: string }>;
  availableClubs: Array<{ id: string; name: string }>; // Available clubs for club-based tournaments
  onGenerate?: () => void;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
}

export function BracketSetup({
  tournamentId,
  tournamentType,
  stopId,
  availableTeams,
  availableClubs,
  onGenerate,
  onError,
  onSuccess,
}: BracketSetupProps) {
  // Determine if this is a club-based tournament
  const isClubBased = tournamentType === 'DOUBLE_ELIMINATION_CLUBS';

  // Load saved bracket config from localStorage if available
  const getSavedConfig = () => {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem(`bracket-config-${stopId}`);
    return saved ? JSON.parse(saved) : null;
  };

  const savedConfig = getSavedConfig();

  // For club-based tournaments, auto-populate all available clubs with seeds
  const initialSelectedClubs = isClubBased && availableClubs.length > 0
    ? availableClubs.map((club, idx) => ({ ...club, seed: idx + 1 }))
    : (savedConfig?.selectedClubs || []);

  const [selectedTeams, setSelectedTeams] = useState<BracketTeam[]>(savedConfig?.selectedTeams || []);
  const [selectedClubs, setSelectedClubs] = useState<Array<{ id: string; name: string; seed: number }>>(initialSelectedClubs);
  const [gamesPerMatch, setGamesPerMatch] = useState(savedConfig?.gamesPerMatch || 3);
  const [selectedGameSlots, setSelectedGameSlots] = useState<string[]>(savedConfig?.selectedGameSlots || [
    'MENS_DOUBLES',
    'WOMENS_DOUBLES',
    'MIXED_1',
    'MIXED_2',
  ]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Update selectedClubs when availableClubs changes (for club-based tournaments)
  // This ensures all participating clubs are automatically included
  useEffect(() => {
    if (isClubBased && availableClubs.length > 0) {
      // Only update if clubs haven't been manually modified (i.e., if they match the available clubs)
      const currentClubIds = new Set(selectedClubs.map(c => c.id));
      const availableClubIds = new Set(availableClubs.map(c => c.id));
      const areEqual = currentClubIds.size === availableClubIds.size && 
        [...currentClubIds].every(id => availableClubIds.has(id));
      
      if (!areEqual) {
        // Auto-populate with all available clubs, preserving existing seeds if possible
        const newSelectedClubs = availableClubs.map((club, idx) => {
          const existing = selectedClubs.find(c => c.id === club.id);
          return {
            ...club,
            seed: existing?.seed ?? idx + 1,
          };
        });
        // Sort by seed to maintain order
        newSelectedClubs.sort((a, b) => a.seed - b.seed);
        // Re-number seeds to be sequential
        setSelectedClubs(newSelectedClubs.map((club, idx) => ({ ...club, seed: idx + 1 })));
      }
    }
  }, [isClubBased, availableClubs]);

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

  const handleAddClub = useCallback((clubId: string) => {
    const club = availableClubs.find(c => c.id === clubId);
    if (!club) return;

    if (selectedClubs.some(c => c.id === clubId)) {
      onError?.('Club already added');
      return;
    }

    const newClub = {
      ...club,
      seed: selectedClubs.length + 1,
    };

    setSelectedClubs(prev => [...prev, newClub]);
  }, [availableClubs, selectedClubs, onError]);

  const handleRemoveTeam = useCallback((teamId: string) => {
    setSelectedTeams(prev => {
      const filtered = prev.filter(t => t.id !== teamId);
      // Re-seed remaining teams
      return filtered.map((team, idx) => ({ ...team, seed: idx + 1 }));
    });
  }, []);

  const handleRemoveClub = useCallback((clubId: string) => {
    setSelectedClubs(prev => {
      const filtered = prev.filter(c => c.id !== clubId);
      // Re-seed remaining clubs
      return filtered.map((club, idx) => ({ ...club, seed: idx + 1 }));
    });
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      if (isClubBased) {
        setSelectedClubs(clubs => {
          const oldIndex = clubs.findIndex(c => c.id === active.id);
          const newIndex = clubs.findIndex(c => c.id === over.id);

          const reordered = arrayMove(clubs, oldIndex, newIndex);
          // Update seeds based on new order
          return reordered.map((club, idx) => ({ ...club, seed: idx + 1 }));
        });
      } else {
        setSelectedTeams(teams => {
          const oldIndex = teams.findIndex(t => t.id === active.id);
          const newIndex = teams.findIndex(t => t.id === over.id);

          const reordered = arrayMove(teams, oldIndex, newIndex);
          // Update seeds based on new order
          return reordered.map((team, idx) => ({ ...team, seed: idx + 1 }));
        });
      }
    }
  }, [isClubBased]);

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
    // Validation based on tournament type
    if (isClubBased) {
      if (selectedClubs.length < 2) {
        onError?.('At least 2 clubs are required to generate a bracket');
        return;
      }
    } else {
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
    }

    setIsGenerating(true);

    try {
      // Save config to localStorage for future resets
      if (typeof window !== 'undefined' && stopId) {
        localStorage.setItem(`bracket-config-${stopId}`, JSON.stringify({
          selectedTeams,
          selectedClubs,
          gamesPerMatch,
          selectedGameSlots,
        }));
      }

      const payload = {
        stopId,
        gamesPerMatch: isClubBased ? undefined : gamesPerMatch,
        gameSlots: isClubBased ? undefined : selectedGameSlots,
        teams: isClubBased ? undefined : selectedTeams,
        clubs: isClubBased ? selectedClubs : undefined,
      };

      const response = await fetch(`/api/admin/tournaments/${tournamentId}/generate-bracket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
  }, [tournamentId, stopId, isClubBased, selectedTeams, selectedClubs, gamesPerMatch, selectedGameSlots, onError, onSuccess, onGenerate]);

  const availableTeamsForSelection = availableTeams.filter(
    team => !selectedTeams.some(st => st.id === team.id)
  );

  const availableClubsForSelection = availableClubs.filter(
    club => !selectedClubs.some(sc => sc.id === club.id)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Bracket Setup</h2>
        <p className="text-gray-400 mt-1">
          {isClubBased
            ? 'Set club seeding order for the bracket tournament'
            : 'Add teams and set their seeding order for the bracket tournament'}
        </p>
        {savedConfig && (
          <div className="mt-2 px-3 py-2 bg-blue-900/30 border border-blue-500/50 rounded-md text-sm text-blue-300">
            ℹ️ Previous bracket configuration restored
          </div>
        )}
      </div>

      <div className={isClubBased ? '' : 'grid grid-cols-1 lg:grid-cols-2 gap-6'}>
        {!isClubBased && (
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
        )}

        {/* Seeding Order */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-white">
              Seeding Order ({isClubBased ? selectedClubs.length : selectedTeams.length} {isClubBased ? 'clubs' : 'teams'})
            </h3>
            {(isClubBased ? false : selectedTeams.length > 0) && (
              <button
                onClick={() => setSelectedTeams([])}
                disabled={isGenerating}
                className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
              >
                Clear All
              </button>
            )}
          </div>

          {(isClubBased ? selectedClubs.length === 0 : selectedTeams.length === 0) ? (
            <div className="text-center py-12 text-gray-500">
              {isClubBased ? (
                <p>Loading participating clubs...</p>
              ) : (
                <>
                  <p>No teams added yet</p>
                  <p className="text-sm mt-1">Add teams from the left panel</p>
                </>
              )}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={isClubBased ? selectedClubs.map(c => c.id) : selectedTeams.map(t => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {isClubBased
                    ? selectedClubs.map(club => (
                        <SortableTeamSlot
                          key={club.id}
                          team={{ ...club, seed: club.seed }}
                          onRemove={undefined} // Disable removal for club-based tournaments
                          disabled={isGenerating}
                        />
                      ))
                    : selectedTeams.map(team => (
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
          disabled={isGenerating || (isClubBased ? selectedClubs.length < 2 : selectedTeams.length < 2)}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
        >
          {isGenerating ? 'Generating Bracket...' : 'Generate Bracket'}
        </button>
      </div>

      {/* Info Box */}
      {(isClubBased ? selectedClubs.length > 0 : selectedTeams.length > 0) && (
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-blue-300 mb-2">Bracket Info</h4>
          <div className="text-sm text-gray-300 space-y-1">
            {isClubBased ? (
              <>
                <p>Clubs: {selectedClubs.length}</p>
                <p>
                  Bracket Size: {Math.pow(2, Math.ceil(Math.log2(selectedClubs.length)))} (
                  {Math.pow(2, Math.ceil(Math.log2(selectedClubs.length))) - selectedClubs.length} byes)
                </p>
                <p>Rounds: {Math.ceil(Math.log2(selectedClubs.length))}</p>
                <p className="text-xs text-gray-400 mt-2">
                  Games per match and game slots are configured in the tournament settings
                </p>
              </>
            ) : (
              <>
                <p>Teams: {selectedTeams.length}</p>
                <p>
                  Bracket Size: {Math.pow(2, Math.ceil(Math.log2(selectedTeams.length)))} (
                  {Math.pow(2, Math.ceil(Math.log2(selectedTeams.length))) - selectedTeams.length} byes)
                </p>
                <p>Rounds: {Math.ceil(Math.log2(selectedTeams.length))}</p>
                <p>Games per match: {gamesPerMatch}</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
