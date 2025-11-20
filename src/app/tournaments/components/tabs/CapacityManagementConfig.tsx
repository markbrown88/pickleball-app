'use client';

import { useState, useMemo } from 'react';
import { formatDateRangeUTC } from '@/lib/utils';

export type Stop = {
  id: string;
  name: string;
  startAt: Date;
};

export type Bracket = {
  id: string;
  name: string;
  gameType?: string;
  skillLevel?: string;
};

export type Club = {
  id: string;
  name: string;
  city?: string | null;
  region?: string | null;
};

export type StopBracketCapacity = {
  stopId: string;
  bracketId: string;
  clubId?: string; // only for team tournaments
  maxCapacity: number;
  currentCount?: number; // for display only, calculated from roster entries
};

type CapacityManagementConfigProps = {
  stops: Stop[];
  brackets: Bracket[];
  clubs?: Club[]; // only provided for team tournaments
  capacities: StopBracketCapacity[];
  onCapacitiesChange: (capacities: StopBracketCapacity[]) => void;
  isTeamTournament: boolean;
};

export function CapacityManagementConfig({
  stops,
  brackets,
  clubs = [],
  capacities,
  onCapacitiesChange,
  isTeamTournament,
}: CapacityManagementConfigProps) {
  const [filterStop, setFilterStop] = useState<string>('');
  const [filterBracket, setFilterBracket] = useState<string>('');
  const [filterClub, setFilterClub] = useState<string>('');
  const [bulkCapacity, setBulkCapacity] = useState('');

  // Get capacity for a specific combination
  const getCapacity = (stopId: string, bracketId: string, clubId?: string): string => {
    const entry = capacities.find(
      (c) =>
        c.stopId === stopId &&
        c.bracketId === bracketId &&
        (isTeamTournament ? c.clubId === clubId : true)
    );
    return entry?.maxCapacity ? String(entry.maxCapacity) : '';
  };

  // Get current count for a specific combination
  const getCurrentCount = (stopId: string, bracketId: string, clubId?: string): number => {
    const entry = capacities.find(
      (c) =>
        c.stopId === stopId &&
        c.bracketId === bracketId &&
        (isTeamTournament ? c.clubId === clubId : true)
    );
    return entry?.currentCount ?? 0;
  };

  // Update capacity for a specific combination
  const updateCapacity = (
    stopId: string,
    bracketId: string,
    clubId: string | undefined,
    capacityStr: string
  ) => {
    const cleaned = capacityStr.replace(/[^\d]/g, '');
    const capacity = cleaned === '' ? 0 : parseInt(cleaned, 10);

    const newCapacities = [...capacities];
    const existingIndex = newCapacities.findIndex(
      (c) =>
        c.stopId === stopId &&
        c.bracketId === bracketId &&
        (isTeamTournament ? c.clubId === clubId : c.clubId === undefined)
    );

    if (existingIndex >= 0) {
      if (capacity === 0) {
        // Remove entry if capacity is 0 (unlimited)
        newCapacities.splice(existingIndex, 1);
      } else {
        newCapacities[existingIndex] = {
          ...newCapacities[existingIndex],
          maxCapacity: capacity,
        };
      }
    } else if (capacity > 0) {
      // Add new entry only if capacity > 0
      newCapacities.push({
        stopId,
        bracketId,
        clubId: isTeamTournament ? clubId : undefined,
        maxCapacity: capacity,
      });
    }

    onCapacitiesChange(newCapacities);
  };

  // Apply bulk capacity to all visible (filtered) rows
  const applyBulkCapacity = () => {
    const cleaned = bulkCapacity.replace(/[^\d]/g, '');
    if (cleaned === '') return;

    const capacity = parseInt(cleaned, 10);
    const newCapacities = [...capacities];

    // Apply to all filtered combinations
    filteredRows.forEach((row) => {
      const existingIndex = newCapacities.findIndex(
        (c) =>
          c.stopId === row.stopId &&
          c.bracketId === row.bracketId &&
          (isTeamTournament ? c.clubId === row.clubId : c.clubId === undefined)
      );

      if (existingIndex >= 0) {
        newCapacities[existingIndex] = {
          ...newCapacities[existingIndex],
          maxCapacity: capacity,
        };
      } else {
        newCapacities.push({
          stopId: row.stopId,
          bracketId: row.bracketId,
          clubId: isTeamTournament ? row.clubId : undefined,
          maxCapacity: capacity,
        });
      }
    });

    onCapacitiesChange(newCapacities);
    setBulkCapacity('');
  };

  // Generate all possible combinations for display
  const allRows = useMemo(() => {
    const rows: Array<{
      stopId: string;
      bracketId: string;
      clubId?: string;
      stopName: string;
      bracketName: string;
      clubName?: string;
    }> = [];

    stops.forEach((stop) => {
      brackets.forEach((bracket) => {
        if (isTeamTournament && clubs.length > 0) {
          // Team tournament: create row for each stop/bracket/club combo
          clubs.forEach((club) => {
            rows.push({
              stopId: stop.id,
              bracketId: bracket.id,
              clubId: club.id,
              stopName: stop.name,
              bracketName: bracket.name,
              clubName: club.name,
            });
          });
        } else {
          // Individual tournament: create row for each stop/bracket combo
          rows.push({
            stopId: stop.id,
            bracketId: bracket.id,
            stopName: stop.name,
            bracketName: bracket.name,
          });
        }
      });
    });

    return rows;
  }, [stops, brackets, clubs, isTeamTournament]);

  // Apply filters
  const filteredRows = useMemo(() => {
    return allRows.filter((row) => {
      if (filterStop && row.stopId !== filterStop) return false;
      if (filterBracket && row.bracketId !== filterBracket) return false;
      if (isTeamTournament && filterClub && row.clubId !== filterClub) return false;
      return true;
    });
  }, [allRows, filterStop, filterBracket, filterClub, isTeamTournament]);


  if (stops.length === 0 || brackets.length === 0) {
    return (
      <div className="p-4 bg-surface-2 border border-border-subtle rounded">
        <p className="text-sm text-muted">
          {stops.length === 0
            ? 'No stops configured yet. Add stops to your tournament before setting capacity limits.'
            : 'No brackets configured yet. Add brackets to your tournament before setting capacity limits.'}
        </p>
      </div>
    );
  }

  if (isTeamTournament && clubs.length === 0) {
    return (
      <div className="p-4 bg-surface-2 border border-border-subtle rounded">
        <p className="text-sm text-muted">
          No clubs configured yet. Add clubs to your tournament before setting capacity limits for team tournaments.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-secondary mb-2">Capacity Management</h4>
        <p className="text-xs text-muted mb-4">
          Set maximum capacity limits for each stop/bracket
          {isTeamTournament ? '/club' : ''} combination. Leave blank for unlimited capacity.
          Capacity is counted by roster entries (StopTeamPlayer records).
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 p-3 bg-surface-2 border border-border-subtle rounded">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-secondary whitespace-nowrap">
            Filter by Stop:
          </label>
          <select
            className="input text-sm"
            value={filterStop}
            onChange={(e) => setFilterStop(e.target.value)}
          >
            <option value="">All Stops ({stops.length})</option>
            {stops.map((stop) => (
              <option key={stop.id} value={stop.id}>
                {stop.name} - {formatDateRangeUTC(
                  stop.startAt instanceof Date ? stop.startAt.toISOString() : stop.startAt,
                  (stop as any).endAt instanceof Date ? (stop as any).endAt.toISOString() : (stop as any).endAt || null
                )}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-secondary whitespace-nowrap">
            Filter by Bracket:
          </label>
          <select
            className="input text-sm"
            value={filterBracket}
            onChange={(e) => setFilterBracket(e.target.value)}
          >
            <option value="">All Brackets ({brackets.length})</option>
            {brackets.map((bracket) => (
              <option key={bracket.id} value={bracket.id}>
                {bracket.name}
              </option>
            ))}
          </select>
        </div>

        {isTeamTournament && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-secondary whitespace-nowrap">
              Filter by Club:
            </label>
            <select
              className="input text-sm"
              value={filterClub}
              onChange={(e) => setFilterClub(e.target.value)}
            >
              <option value="">All Clubs ({clubs.length})</option>
              {clubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {(filterStop || filterBracket || filterClub) && (
          <button
            className="btn btn-ghost text-xs"
            onClick={() => {
              setFilterStop('');
              setFilterBracket('');
              setFilterClub('');
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Capacity Table */}
      <div className="overflow-x-auto border border-border-subtle rounded">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface-2">
              <th className="text-left p-2 text-xs font-semibold text-secondary border-b border-border-subtle">
                Stop
              </th>
              <th className="text-left p-2 text-xs font-semibold text-secondary border-b border-border-subtle">
                Bracket
              </th>
              {isTeamTournament && (
                <th className="text-left p-2 text-xs font-semibold text-secondary border-b border-border-subtle">
                  Club
                </th>
              )}
              <th className="text-center p-2 text-xs font-semibold text-secondary border-b border-border-subtle">
                Current
              </th>
              <th className="text-center p-2 text-xs font-semibold text-secondary border-b border-border-subtle">
                Max Capacity
              </th>
              <th className="text-center p-2 text-xs font-semibold text-secondary border-b border-border-subtle">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={isTeamTournament ? 6 : 5}
                  className="p-4 text-center text-sm text-muted"
                >
                  No results match your filters
                </td>
              </tr>
            ) : (
              filteredRows.map((row, index) => {
                const capacity = getCapacity(row.stopId, row.bracketId, row.clubId);
                const current = getCurrentCount(row.stopId, row.bracketId, row.clubId);
                const maxCapacity = capacity ? parseInt(capacity, 10) : null;
                const percentFull =
                  maxCapacity && maxCapacity > 0 ? (current / maxCapacity) * 100 : 0;

                return (
                  <tr
                    key={`${row.stopId}-${row.bracketId}-${row.clubId || 'no-club'}-${index}`}
                    className="border-b border-border-subtle hover:bg-surface-2"
                  >
                    <td className="p-2 text-sm text-secondary">{row.stopName}</td>
                    <td className="p-2 text-sm text-secondary">{row.bracketName}</td>
                    {isTeamTournament && (
                      <td className="p-2 text-sm text-secondary">{row.clubName}</td>
                    )}
                    <td className="p-2 text-center text-sm text-muted">{current}</td>
                    <td className="p-2 text-center">
                      <input
                        type="text"
                        className="input w-20 text-sm text-center"
                        value={capacity}
                        onChange={(e) =>
                          updateCapacity(
                            row.stopId,
                            row.bracketId,
                            row.clubId,
                            e.target.value
                          )
                        }
                        placeholder="∞"
                      />
                    </td>
                    <td className="p-2 text-center">
                      {maxCapacity ? (
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`text-xs font-medium ${
                              percentFull >= 100
                                ? 'text-error'
                                : percentFull >= 80
                                  ? 'text-warning'
                                  : 'text-success'
                            }`}
                          >
                            {percentFull.toFixed(0)}% Full
                          </span>
                          {percentFull >= 100 && (
                            <span className="text-xs text-error">FULL</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted">Unlimited</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bulk Actions */}
      <div className="border-t border-border-subtle pt-4">
        <div className="text-sm font-medium text-secondary mb-2">Bulk Actions</div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-muted whitespace-nowrap">
            Set capacity for {filteredRows.length} filtered row{filteredRows.length !== 1 ? 's' : ''}:
          </label>
          <input
            type="text"
            className="input w-24"
            value={bulkCapacity}
            onChange={(e) => setBulkCapacity(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="e.g., 32"
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
            disabled={!bulkCapacity.trim() || filteredRows.length === 0}
          >
            Apply to Filtered
          </button>
        </div>
        <p className="text-xs text-muted mt-2">
          Use filters above to narrow down which rows to apply bulk capacity to.
        </p>
      </div>

      {/* Summary */}
      <div className="border-t border-border-subtle pt-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted">Total Combinations:</span>
            <span className="ml-2 font-semibold text-secondary">{allRows.length}</span>
          </div>
          <div>
            <span className="text-muted">With Limits Set:</span>
            <span className="ml-2 font-semibold text-secondary">{capacities.length}</span>
          </div>
          <div>
            <span className="text-muted">Unlimited:</span>
            <span className="ml-2 font-semibold text-secondary">
              {allRows.length - capacities.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
