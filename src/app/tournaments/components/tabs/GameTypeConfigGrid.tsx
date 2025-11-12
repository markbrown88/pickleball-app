'use client';

import { useState } from 'react';

export type GameType =
  | 'MENS_DOUBLES'
  | 'WOMENS_DOUBLES'
  | 'MIXED_DOUBLES'
  | 'MIXED_DOUBLES_1'
  | 'MIXED_DOUBLES_2'
  | 'MENS_SINGLES'
  | 'WOMENS_SINGLES';

export type Bracket = {
  id: string;
  name: string;
  skillLevel?: string;
};

export type BracketGameTypeConfig = {
  bracketId: string;
  gameType: GameType;
  isEnabled: boolean;
  capacity?: number; // optional capacity limit for this specific bracket/game type combo
};

type GameTypeConfigGridProps = {
  brackets: Bracket[];
  config: BracketGameTypeConfig[];
  onConfigChange: (config: BracketGameTypeConfig[]) => void;
  isTeamTournament: boolean; // determines which game types to show
};

export function GameTypeConfigGrid({
  brackets,
  config,
  onConfigChange,
  isTeamTournament,
}: GameTypeConfigGridProps) {
  const [bulkCapacity, setBulkCapacity] = useState('');

  // Define game types based on tournament type
  const gameTypes: GameType[] = isTeamTournament
    ? ['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_DOUBLES_1', 'MIXED_DOUBLES_2', 'MENS_SINGLES', 'WOMENS_SINGLES']
    : ['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_DOUBLES', 'MENS_SINGLES', 'WOMENS_SINGLES'];

  // Get display name for game type
  const getGameTypeName = (gameType: GameType): string => {
    const names: Record<GameType, string> = {
      MENS_DOUBLES: "Men's Doubles",
      WOMENS_DOUBLES: "Women's Doubles",
      MIXED_DOUBLES: 'Mixed Doubles',
      MIXED_DOUBLES_1: 'Mixed Doubles 1',
      MIXED_DOUBLES_2: 'Mixed Doubles 2',
      MENS_SINGLES: "Men's Singles",
      WOMENS_SINGLES: "Women's Singles",
    };
    return names[gameType];
  };

  // Get short name for game type (for column headers)
  const getGameTypeShortName = (gameType: GameType): string => {
    const shortNames: Record<GameType, string> = {
      MENS_DOUBLES: 'MD',
      WOMENS_DOUBLES: 'WD',
      MIXED_DOUBLES: 'Mix',
      MIXED_DOUBLES_1: 'Mix1',
      MIXED_DOUBLES_2: 'Mix2',
      MENS_SINGLES: 'MS',
      WOMENS_SINGLES: 'WS',
    };
    return shortNames[gameType];
  };

  // Check if a bracket/game type is enabled
  const isEnabled = (bracketId: string, gameType: GameType): boolean => {
    const entry = config.find((c) => c.bracketId === bracketId && c.gameType === gameType);
    return entry?.isEnabled ?? false;
  };

  // Get capacity for a bracket/game type
  const getCapacity = (bracketId: string, gameType: GameType): string => {
    const entry = config.find((c) => c.bracketId === bracketId && c.gameType === gameType);
    return entry?.capacity ? String(entry.capacity) : '';
  };

  // Toggle enabled state
  const toggleEnabled = (bracketId: string, gameType: GameType) => {
    const existingIndex = config.findIndex(
      (c) => c.bracketId === bracketId && c.gameType === gameType
    );

    const newConfig = [...config];

    if (existingIndex >= 0) {
      // Toggle existing entry
      newConfig[existingIndex] = {
        ...newConfig[existingIndex],
        isEnabled: !newConfig[existingIndex].isEnabled,
      };
    } else {
      // Create new entry (enabled by default when toggling)
      newConfig.push({
        bracketId,
        gameType,
        isEnabled: true,
      });
    }

    onConfigChange(newConfig);
  };

  // Update capacity for a bracket/game type
  const updateCapacity = (bracketId: string, gameType: GameType, capacityStr: string) => {
    const cleaned = capacityStr.replace(/[^\d]/g, '');
    const capacity = cleaned === '' ? undefined : parseInt(cleaned, 10);

    const existingIndex = config.findIndex(
      (c) => c.bracketId === bracketId && c.gameType === gameType
    );

    const newConfig = [...config];

    if (existingIndex >= 0) {
      newConfig[existingIndex] = {
        ...newConfig[existingIndex],
        capacity,
      };
    } else {
      // Create new entry if updating capacity for non-existent config
      newConfig.push({
        bracketId,
        gameType,
        isEnabled: false,
        capacity,
      });
    }

    onConfigChange(newConfig);
  };

  // Enable all game types for all brackets
  const enableAll = () => {
    const newConfig: BracketGameTypeConfig[] = [];

    brackets.forEach((bracket) => {
      gameTypes.forEach((gameType) => {
        const existing = config.find(
          (c) => c.bracketId === bracket.id && c.gameType === gameType
        );
        newConfig.push({
          bracketId: bracket.id,
          gameType,
          isEnabled: true,
          capacity: existing?.capacity,
        });
      });
    });

    onConfigChange(newConfig);
  };

  // Disable all game types for all brackets
  const disableAll = () => {
    const newConfig = config.map((c) => ({ ...c, isEnabled: false }));
    onConfigChange(newConfig);
  };

  // Set default capacity for all enabled cells
  const applyBulkCapacity = () => {
    const cleaned = bulkCapacity.replace(/[^\d]/g, '');
    if (cleaned === '') return;

    const capacity = parseInt(cleaned, 10);

    const newConfig = config.map((c) => ({
      ...c,
      capacity: c.isEnabled ? capacity : c.capacity,
    }));

    onConfigChange(newConfig);
    setBulkCapacity('');
  };

  // Enable all game types for a specific bracket
  const enableAllForBracket = (bracketId: string) => {
    const newConfig = [...config];

    gameTypes.forEach((gameType) => {
      const existingIndex = newConfig.findIndex(
        (c) => c.bracketId === bracketId && c.gameType === gameType
      );

      if (existingIndex >= 0) {
        newConfig[existingIndex] = {
          ...newConfig[existingIndex],
          isEnabled: true,
        };
      } else {
        newConfig.push({
          bracketId,
          gameType,
          isEnabled: true,
        });
      }
    });

    onConfigChange(newConfig);
  };

  // Disable all game types for a specific bracket
  const disableAllForBracket = (bracketId: string) => {
    const newConfig = config.map((c) =>
      c.bracketId === bracketId ? { ...c, isEnabled: false } : c
    );
    onConfigChange(newConfig);
  };

  if (brackets.length === 0) {
    return (
      <div className="p-4 bg-surface-2 border border-border-subtle rounded">
        <p className="text-sm text-muted">
          No brackets configured yet. Add brackets to your tournament before configuring game types.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-secondary mb-2">
          Game Type Configuration
        </h4>
        <p className="text-xs text-muted mb-4">
          Enable or disable specific game types for each bracket. You can also set capacity limits per game type.
          {isTeamTournament
            ? ' Team tournaments include 6 game types (MD, WD, Mix1, Mix2, MS, WS).'
            : ' Individual tournaments include 5 game types (MD, WD, Mix, MS, WS).'}
        </p>
      </div>

      {/* Configuration Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left p-2 text-xs font-semibold text-secondary border border-border-subtle bg-surface-2">
                Bracket
              </th>
              {gameTypes.map((gameType) => (
                <th
                  key={gameType}
                  className="text-center p-2 text-xs font-semibold text-secondary border border-border-subtle bg-surface-2"
                  title={getGameTypeName(gameType)}
                >
                  {getGameTypeShortName(gameType)}
                </th>
              ))}
              <th className="text-center p-2 text-xs font-semibold text-secondary border border-border-subtle bg-surface-2">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {brackets.map((bracket) => (
              <tr key={bracket.id}>
                <td className="p-2 border border-border-subtle">
                  <div className="font-medium text-secondary text-sm">{bracket.name}</div>
                  {bracket.skillLevel && (
                    <div className="text-xs text-muted">{bracket.skillLevel}</div>
                  )}
                </td>
                {gameTypes.map((gameType) => {
                  const enabled = isEnabled(bracket.id, gameType);
                  const capacity = getCapacity(bracket.id, gameType);

                  return (
                    <td key={gameType} className="p-2 border border-border-subtle">
                      <div className="flex flex-col items-center gap-1">
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={() => toggleEnabled(bracket.id, gameType)}
                          className="cursor-pointer"
                          title={`Enable ${getGameTypeName(gameType)}`}
                        />
                        {/* Capacity input (only shown when enabled) */}
                        {enabled && (
                          <input
                            type="text"
                            className="input w-12 text-xs text-center p-1"
                            value={capacity}
                            onChange={(e) =>
                              updateCapacity(bracket.id, gameType, e.target.value)
                            }
                            placeholder="∞"
                            title="Capacity limit (optional)"
                          />
                        )}
                      </div>
                    </td>
                  );
                })}
                <td className="p-2 border border-border-subtle">
                  <div className="flex flex-col gap-1">
                    <button
                      className="text-xs btn btn-secondary px-2 py-1"
                      onClick={() => enableAllForBracket(bracket.id)}
                    >
                      All
                    </button>
                    <button
                      className="text-xs btn btn-ghost px-2 py-1"
                      onClick={() => disableAllForBracket(bracket.id)}
                    >
                      None
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bulk Actions */}
      <div className="border-t border-border-subtle pt-4 space-y-4">
        {/* Enable/Disable All */}
        <div>
          <div className="text-sm font-medium text-secondary mb-2">Quick Actions</div>
          <div className="flex items-center gap-3">
            <button className="btn btn-secondary" onClick={enableAll}>
              Enable All Game Types
            </button>
            <button className="btn btn-ghost" onClick={disableAll}>
              Disable All Game Types
            </button>
          </div>
        </div>

        {/* Bulk Capacity */}
        <div>
          <div className="text-sm font-medium text-secondary mb-2">
            Set Default Capacity
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted whitespace-nowrap">
              Apply capacity to all enabled cells:
            </label>
            <input
              type="text"
              className="input w-24"
              value={bulkCapacity}
              onChange={(e) => setBulkCapacity(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="e.g., 16"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyBulkCapacity();
                }
              }}
            />
            <button
              className="btn btn-secondary"
              onClick={applyBulkCapacity}
              disabled={!bulkCapacity.trim()}
            >
              Apply
            </button>
          </div>
          <p className="text-xs text-muted mt-1">
            Leave capacity blank for unlimited. This only applies to currently enabled game types.
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="border-t border-border-subtle pt-4">
        <div className="text-sm text-muted">
          {config.filter((c) => c.isEnabled).length} game type configurations enabled across{' '}
          {brackets.length} bracket{brackets.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}
